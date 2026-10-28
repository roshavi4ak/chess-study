"use client";

import { useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { ENDGAME_LESSONS } from "@/lib/endgameLessons";
import { endgameNet, MATE_LESSONS } from "@/lib/endgameNet";
import type { EndgameId } from "@/lib/endgameTraining";
import { learningMove } from "@/lib/puzzleLearning";
import ReadAloud from "./ReadAloud";

export default function EndgameTutorial({ id, onPractice }: { id: EndgameId; onPractice: () => void }) {
    const tLesson = useTranslations("EndgameLessons");
    const tTraining = useTranslations("Training");
    const [index, setIndex] = useState(0);
    const [ply, setPly] = useState(0);
    const [transition, setTransition] = useState("startingPosition");
    const [branchId, setBranchId] = useState("main");
    const [showNet, setShowNet] = useState(true);
    const steps = ENDGAME_LESSONS[id], step = steps[index];
    const branch = step.branches?.find(candidate => candidate.id === branchId);
    const moves = branch?.moves ?? step.moves;
    const game = new Chess(step.fen);
    const played = moves.slice(0, ply).map(move => learningMove(game, move));
    const last = played.at(-1);
    const textKey = `${id}.${step.id}${branch ? `.${branch.id}` : ""}`;
    const moveKey = `${textKey}.move${ply}`;
    const text = ply > 0 && tLesson.has(moveKey) ? tLesson(moveKey) : tLesson(`${textKey}.${ply > 0 && ply === moves.length ? "after" : "explain"}`);
    const net = MATE_LESSONS.includes(id) ? endgameNet(game) : null;
    const knight = id === "bishopKnightMate" ? game.board().flat().find(piece => piece?.color === "w" && piece.type === "n") : undefined;
    const protectors = knight ? game.attackers(knight.square, "w").filter(square => ["b", "k"].includes(game.get(square)?.type ?? "")) : [];
    const protectionArrows = protectors.map(square => ({ startSquare: square, endSquare: knight!.square, color: "#15803d" }));
    const styles: Record<string, React.CSSProperties> = Object.fromEntries(step.focus.map(square => [square, { backgroundColor: net && showNet ? "rgba(99,102,241,.18)" : "rgba(14,165,233,.35)" }]));
    if (last) { styles[last.from] = { backgroundColor: "rgba(250,204,21,.45)" }; styles[last.to] = { backgroundColor: "rgba(250,204,21,.7)" }; }
    if (net && showNet) {
        for (const square of net.escapes) styles[square] = { ...styles[square], backgroundColor: "rgba(56,189,248,.5)" };
        for (const { square } of net.blocked) styles[square] = { ...styles[square], boxShadow: "inset 0 0 0 3px #dc2626" };
    }
    for (const from of protectors) {
        const target = knight!.square;
        const dx = Math.sign(target.charCodeAt(0) - from.charCodeAt(0));
        const dy = Math.sign(Number(target[1]) - Number(from[1]));
        for (let file = from.charCodeAt(0), rank = Number(from[1]); ; file += dx, rank += dy) {
            const square = `${String.fromCharCode(file)}${rank}` as Square;
            styles[square] = { ...styles[square], boxShadow: "inset 0 0 0 4px #15803d" };
            if (square === target) break;
        }
    }
    function go(next: number) {
        setTransition(new Chess(steps[next].fen).fen().split(" ").slice(0, 4).join(" ") === game.fen().split(" ").slice(0, 4).join(" ") ? "samePosition" : "newExample");
        setIndex(next); setPly(0); setBranchId("main");
    }
    return <section className="space-y-4" aria-label={tLesson("tutorial")}>
        <div className="rounded-xl bg-indigo-50 text-indigo-950 p-4 space-y-2"><p className="font-bold">{tLesson("step", { current: index + 1, total: steps.length })}</p><p className="text-sm font-semibold">{tLesson(transition)}</p><h2 className="text-xl font-bold">{tLesson(`${id}.${step.id}.title`)}</h2><p>{text}</p><ReadAloud text={text} /></div>
        {step.branches?.length ? <fieldset className="rounded-xl border border-indigo-200 p-4 space-y-2"><legend className="font-bold px-1">{tLesson("tryDefense")}</legend><p className="text-sm">{tLesson("branchHelp")}</p><div className="flex flex-wrap gap-2">{["main", ...step.branches.map(candidate => candidate.id)].map(choice => <button key={choice} type="button" aria-pressed={branchId === choice} onClick={() => { setBranchId(choice); setPly(0); setTransition("branchReset"); }} className={`rounded-lg px-4 py-2 ${branchId === choice ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-700"}`}>{tLesson(`${id}.${step.id}.${choice === "main" ? "main" : `${choice}.title`}`)}</button>)}</div></fieldset> : null}
        <p role="status" className="font-bold">{tLesson(game.isCheckmate() ? "checkmate" : game.isGameOver() ? "gameOver" : game.turn() === "w" ? "whiteToMove" : "blackToMove")}</p>
        {net && <aside aria-label={tLesson("netTitle")} className="rounded-xl border border-sky-300 p-4 space-y-3"><h3 className="font-bold">{tLesson("netTitle")}</h3><p className="text-sm">{tLesson("netHelp", { square: net.king })}</p><label className="flex items-center gap-2"><input type="checkbox" checked={showNet} onChange={event => setShowNet(event.target.checked)} />{tLesson("showNet")}</label><div className="grid gap-3 sm:grid-cols-2"><div><h4 className="font-semibold">{tLesson("openExits")}</h4><p>{net.escapes.length ? net.escapes.join(", ") : tLesson("noExits")}</p></div><div><h4 className="font-semibold">{tLesson("closedExits")}</h4><ul className="space-y-1">{net.blocked.map(control => <li key={control.square}><strong>{control.square}</strong>{" — "}{control.by.map(by => `${tLesson(`piece_${by.piece}`)} ${by.square}`).join(", ")}</li>)}</ul></div></div><p className="text-sm font-semibold">{tLesson(net.escapes.length === 0 ? net.inCheck ? "netMate" : "netStalemate" : net.escapes.length === 1 ? "oneExit" : "severalExits")}</p></aside>}
        {knight && <aside className="rounded-xl bg-green-50 text-green-950 p-4" aria-label={tLesson("knightSafety")}>{protectors.length ? tLesson("guardedKnight", { from: protectors.join(", "), to: knight.square }) : tLesson("distantKnight", { square: knight.square })}</aside>}
        <div className="max-w-[560px] aspect-square mx-auto"><Chessboard options={{ id: "endgame-tutorial", position: game.fen(), allowDragging: false, allowDrawingArrows: false, boardOrientation: "white", squareStyles: styles, arrows: [...(last ? [{ startSquare: last.from, endSquare: last.to, color: "#4f46e5" }] : []), ...protectionArrows], animationDurationInMs: 250 }} /></div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{tLesson(net && showNet ? "netLegend" : "legend")}</p>
        {moves.length > 0 && <div className="space-y-2"><p aria-live="polite">{tTraining("lineStep", { current: ply, total: moves.length })}{played.length ? ` · ${played.map(move => move.san).join(" · ")}` : ""}</p><div className="flex flex-wrap gap-2"><button type="button" disabled={ply === 0} onClick={() => setPly(value => value - 1)} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 disabled:opacity-40">{tTraining("previous")}</button><button type="button" disabled={ply === moves.length} onClick={() => setPly(value => value + 1)} className="rounded-lg bg-indigo-600 text-white px-4 py-2 disabled:opacity-40">{tLesson("showMove")}</button></div></div>}
        <div className="rounded-xl bg-amber-50 text-amber-950 p-4 space-y-2"><h3 className="font-bold">{tLesson("avoid")}</h3><p>{tLesson(`${id}.trap`)}</p></div>
        <div className="rounded-xl border border-indigo-200 p-4 space-y-2"><h3 className="font-bold">{tLesson("checklist")}</h3><ol className="list-decimal pl-5 space-y-1">{[1, 2, 3].map(number => <li key={number}>{tLesson(`${id}.check${number}`)}</li>)}</ol></div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={index === 0} onClick={() => go(index - 1)} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-3 disabled:opacity-40">{tLesson("previousStep")}</button>{index + 1 < steps.length && <button type="button" onClick={() => go(index + 1)} className="rounded-lg bg-indigo-600 text-white px-4 py-3">{tLesson("nextStep")}</button>}<button type="button" onClick={onPractice} className="rounded-lg bg-green-700 text-white px-4 py-3 font-bold">{tLesson("practice")}</button></div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{tLesson("examples")}</p>
    </section>;
}
