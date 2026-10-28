/* eslint-disable @typescript-eslint/no-require-imports -- Render the real card component for visual review without student data. */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { NextIntlClientProvider } = require("next-intl");
const { compile } = require("@tailwindcss/node");
const root = path.resolve(__dirname, "..");
const cache = new Map();

function load(relative) {
    const base = path.resolve(root, relative);
    const filename = [base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate));
    if (!filename) throw new Error(`Missing preview module: ${relative}`);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    cache.set(filename, mod);
    const original = mod.require.bind(mod);
    mod.require = name => {
        if (name === "next/image") return ({ src, alt, ...props }) => React.createElement("img", { ...props, src: `../public${src}`, alt });
        if (name === "@/i18n/navigation") return { Link: ({ href, ...props }) => React.createElement("a", { ...props, href: `https://shah.belovezem.com/${require("next-intl").useLocale()}${href}` }) };
        if (name.startsWith("@/")) return load(`src/${name.slice(2)}`);
        if (name.startsWith("./") && !name.endsWith(".json")) return load(path.relative(root, path.resolve(path.dirname(filename), name)));
        return original(name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, filename);
    return mod.exports;
}

async function main() {
    const Card = load("src/components/MasteryCardView.tsx").default;
    const { getCardArtwork } = load("src/lib/cardArtwork.ts");
    const locale = process.argv[2] === "en" ? "en" : "bg";
    const messages = JSON.parse(fs.readFileSync(path.join(root, `messages/${locale}.json`), "utf8"));
    const { practiceCards, themeCards, botCards, worldCards, tournamentCards } = load("src/lib/masteryCards.ts");
    const { activityCards } = load("src/lib/activityCards.ts");
    const catalog = JSON.parse(fs.readFileSync(path.join(root, "docs/card-practice-catalog.json"), "utf8"));
    const tiers = [null, "bronze", "silver", "gold"];
    const sections = { practice: "practices", theme: "themes", activity: "activities", bot: "bots", world: "worlds", tournament: "tournaments" };
    const cards = [
        ...practiceCards([], new Map(catalog.map(practice => [practice.id, { name: practice.name, leafIds: ["one", "two", "three"] }]))),
        ...themeCards([]), ...activityCards([], []), ...botCards({}), ...worldCards({}), ...tournamentCards(0),
    ].map((card, index) => {
        const tier = tiers[index % 4];
        return { ...card, tier, current: tier === "gold" ? 10 : index % 3, nextTarget: tier === "gold" ? null : 5 };
    });
    const missing = cards.filter(card => !fs.existsSync(path.join(root, "public", getCardArtwork(card))));
    if (missing.length) console.warn(`${missing.length} illustrations still pending.`);
    const specimen = tiers.map((tier, index) => ({ ...cards.find(card => card.id === "world:knight"), id: `tier-${index}`, tier, current: index, nextTarget: tier === "gold" ? null : 5 }));
    const previewCards = [];
    const section = (title, collection) => React.createElement("section", { className: "space-y-4 mb-10", key: title },
        React.createElement("h2", { className: "text-2xl font-bold" }, title),
        React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" }, ...collection.map(card => {
            const index = previewCards.push(card) - 1;
            return React.createElement("div", { key: card.id, className: "contents", "data-card-preview": index }, React.createElement(Card, { card }));
        })));
    const tree = React.createElement(NextIntlClientProvider, { locale, messages, timeZone: "Europe/Sofia" },
        React.createElement("main", { className: "max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8" },
            React.createElement("h1", { className: "text-3xl font-extrabold" }, messages.Cards.title),
            React.createElement("p", { className: "text-sm text-slate-500 dark:text-slate-400" }, locale === "bg" ? "Преглед на илюстрациите · Примерен напредък" : "Illustration preview · Sample progress"),
            section([messages.Cards.bronze, messages.Cards.silver, messages.Cards.gold].join(" · "), specimen),
            ...Object.entries(sections).map(([kind, key]) => section(messages.Cards[`${key}Title`], cards.filter(card => card.kind === kind)))));
    const markup = renderToStaticMarkup(tree);
    const source = ["MasteryCardView", "CardArtworkDialog"].map(name => fs.readFileSync(path.join(root, `src/components/${name}.tsx`), "utf8")).join(" ");
    const candidates = [...new Set(`${source} ${markup}`.split(/[\s"'`{}<>]+/))];
    const compiler = await compile('@import "tailwindcss";', { base: root, onDependency() {} });
    const css = compiler.build(candidates);
    const bundleName = `card-art-preview-${locale}.js`;
    await bundlePreview({ locale, messages, cards: previewCards }, bundleName);
    const html = `<!doctype html><html lang="${locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chess card artwork preview</title><style>${css}\nbody{font-family:Arial,sans-serif;background:#f5f7fb;color:#0f172a}@media(prefers-color-scheme:dark){body{background:#0b1220;color:#f1f5f9}}</style><body>${markup}<script src="${bundleName}" defer></script></body></html>`;
    const output = path.join(root, `docs/card-art-preview-${locale}.html`);
    fs.writeFileSync(output, html);
    console.log(`${cards.length} cards rendered: ${output}`);
}

async function bundlePreview(data, filename) {
    const { webpack } = require("next/dist/compiled/webpack/webpack");
    const temporary = path.join(root, ".next/card-art-preview");
    fs.mkdirSync(temporary, { recursive: true });
    const imageStub = path.join(temporary, "image.jsx");
    const navigationStub = path.join(temporary, "navigation.jsx");
    const loader = path.join(temporary, "loader.cjs");
    const entry = path.join(temporary, `entry-${data.locale}.jsx`);
    fs.writeFileSync(imageStub, `import React from 'react'; export default function Image({src,unoptimized,...props}) {return <img {...props} src={'../public'+src}/>;}`);
    fs.writeFileSync(navigationStub, `import React from 'react';import {useLocale} from 'next-intl';export function Link({href,...props}){const locale=useLocale();return <a {...props} href={'https://shah.belovezem.com/'+locale+href}/>;}`);
    fs.writeFileSync(loader, `const ts=require('typescript');module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;};`);
    fs.writeFileSync(entry, `import React from 'react';import {hydrateRoot} from 'react-dom/client';import {NextIntlClientProvider} from 'next-intl';import Card from '@/components/MasteryCardView';const data=${JSON.stringify(data)};for(const root of document.querySelectorAll('[data-card-preview]')){hydrateRoot(root,<React.StrictMode><NextIntlClientProvider locale={data.locale} messages={data.messages} timeZone="Europe/Sofia"><Card card={data.cards[Number(root.dataset.cardPreview)]}/></NextIntlClientProvider></React.StrictMode>);}`);
    await new Promise((resolve, reject) => {
        const compiler = webpack({
            mode: "production", target: "web", entry, devtool: false,
            output: { path: path.join(root, "docs"), filename },
            resolve: { extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"], alias: { "@/i18n/navigation$": navigationStub, "@": path.join(root, "src"), "next/image$": imageStub } },
            module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: loader }] },
            optimization: { minimize: false },
            performance: { hints: false },
        });
        compiler.run((error, stats) => compiler.close(() => {
            if (error) reject(error);
            else if (stats.hasErrors()) reject(new Error(stats.toString({ all: false, errors: true })));
            else resolve();
        }));
    });
}

main().catch(error => { console.error(error); process.exitCode = 1; });
