/* eslint-disable @typescript-eslint/no-require-imports -- Run regression checks directly with Node. */
// Checks that every literal translation key used in src/ exists in both messages/en.json and messages/bg.json.
// It understands `const t = useTranslations("Namespace")` / `await getTranslations("Namespace")` and calls like
// t("key"), t("key", {...}), t.rich("key") and t.has("key"). Dynamic keys (template literals, variables) are skipped.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const messages = Object.fromEntries(['en', 'bg'].map(lang => [lang, JSON.parse(fs.readFileSync(path.join(root, 'messages', `${lang}.json`), 'utf8'))]));

function* files(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* files(full);
        else if (/\.(tsx?|jsx?)$/.test(entry.name)) yield full;
    }
}

const has = (tree, dotted) => dotted.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), tree) !== undefined;
const problems = [];
let checked = 0;
for (const file of files(path.join(root, 'src'))) {
    const source = fs.readFileSync(file, 'utf8');
    const bindings = [...source.matchAll(/const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*["']([\w.]+)["']\s*\)/g)];
    // Also: const [t, tOther] = await Promise.all([getTranslations("A"), getTranslations("B")...])
    for (const match of source.matchAll(/const\s+\[([^\]]+)\]\s*=\s*await\s+Promise\.all\(\[([\s\S]*?)\]\)/g)) {
        const names = match[1].split(',').map(name => name.trim());
        const calls = [...match[2].matchAll(/getTranslations\(\s*["']([\w.]+)["']\s*\)|[\w.]+\([^()]*\)/g)];
        names.forEach((name, index) => {
            const ns = calls[index] && calls[index][1];
            if (ns) bindings.push([null, name, ns]);
        });
    }
    for (const [, variable, ns] of bindings) {
        const calls = source.matchAll(new RegExp(`\\b${variable}(?:\\.rich|\\.has|\\.markup)?\\(\\s*["']([\\w.]+)["']`, 'g'));
        for (const [, key] of calls) {
            checked += 1;
            for (const lang of ['en', 'bg']) {
                if (!has(messages[lang], `${ns}.${key}`)) problems.push(`${path.relative(root, file)}: ${lang} is missing ${ns}.${key}`);
            }
        }
    }
}

if (problems.length) {
    console.error([...new Set(problems)].join('\n'));
    process.exit(1);
}
console.log(`Translation keys passed (${checked} literal keys checked in en and bg).`);
