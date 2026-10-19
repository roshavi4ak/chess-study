"use client";

import { useEffect, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { defenseAnswer, defenseRound, defenseStart } from "@/lib/defenseTraining";
import { Chess } from "chess.js";
import { learningMove } from "@/lib/puzzleLearning";
import { useLegalMoves } from "@/hooks/useLegalMoves";
import TrainingLine from "./TrainingLine";
import TrainingResult from "./TrainingResult";
import DefensePuzzleRound from "./DefensePuzzleRound";
import { DEFENSE_LEVELS } from "@/lib/defensePuzzles";
import { getPersonalBests } from "@/app/actions/play";
import { useSession } from "next-auth/react";

export default function DefenseTrainer() {
    const tTraining = useTranslations("Training");
    const tLevels = useTranslations("DefenseLevels");
    const { data: session } = useSession();
    const [level, setLevel] = useState(1);
    const [round, setRound] = useState(0);
    const [exclude, setExclude] = useState("");
    const [bests, setBests] = useState<Record<string, number>>({});
    const recent = useRef<Record<number, string[]>>({});
    useEffect(() => {
        if (!session?.user?.id) return;
        let active = true;
        void getPersonalBests().then(data => { if (active) setBests(data.byKey); }).catch(() => undefined);
        return () => { active = false; };
    }, [session?.user?.id]);
    const band = DEFENSE_LEVELS[level - 1];
    function again() { setExclude((recent.current[level] ?? []).join(",")); setRound(value => value + 1); }
    function complete(ids: string[], stars: number) {
        recent.current[level] = [...(recent.current[level] ?? []), ...ids].slice(-100);
        setBests(previous => ({ ...previous, [`defense:level:${level}`]: Math.max(previous[`defense:level:${level}`] ?? 0, stars) }));
    }
    return <div className="space-y-4"><p className="text-sm text-gray-500 dark:text-gray-400">{tTraining("unrated")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" aria-label={tLevels("chooseLevel")}>{DEFENSE_LEVELS.map(item => <button key={item.level} type="button" aria-pressed={level === item.level} onClick={() => { setLevel(item.level); setExclude((recent.current[item.level] ?? []).join(",")); setRound(0); }} className={`rounded-xl p-3 font-bold border ${level === item.level ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"}`}>{tLevels("level", { level: item.level })}{bests[`defense:level:${item.level}`] > 0 && <span className="block text-sm" aria-label={tLevels("stars", { count: bests[`defense:level:${item.level}`] })}>{"★".repeat(bests[`defense:level:${item.level}`])}</span>}</button>)}</div>
        <p>{tLevels(level === 1 ? "beginner" : "rated", { min: band.min, max: band.max - 1 })} {level > 1 && tLevels("moves", { count: band.replies })}</p>
        {level === 1 ? <DefenseRound key={`1-${round}`} round={round} onAgain={again} onComplete={stars => complete([], stars)} /> : <DefensePuzzleRound key={`${level}-${round}`} level={level} exclude={exclude} onAgain={again} onComplete={complete} />}
    </div>;
}
function DefenseRound({ round, onAgain, onComplete }: { round: number; onAgain: () => void; onComplete: (stars: number) => void }) {
    const t = useTranslations("Defense");
    const list = defenseRound(round);
    const [index, setIndex] = useState(0);
    const [results, setResults] = useState<boolean[]>([]);
    if (index === list.length) return <section className="rounded-2xl bg-green-50 text-green-950 p-6 space-y-4"><h2 className="text-2xl font-bold">{t("roundDone")}</h2><p>{t("summary", { correct: results.filter(Boolean).length, total: results.length })}</p><TrainingResult activityKey="defense:level:1" score={results.every(Boolean) ? 3 : 1} won details={{ feature: "defense", level: 1, independent: results.filter(Boolean).length, total: results.length, positions: list.map(item => item.id) }} /><button type="button" onClick={onAgain} className="rounded-lg bg-green-600 text-white px-4 py-2 font-bold">{t("newRound")}</button></section>;
    return <section className="space-y-4"><p className="font-bold">{t("progress", { current: index + 1, total: list.length })}</p><DefenseExercise key={list[index].id} position={list[index]} onDone={independent => { const next = [...results, independent]; setResults(next); setIndex(value => value + 1); if (next.length === list.length) onComplete(next.every(Boolean) ? 3 : 1); }} /></section>;
}

function DefenseExercise({ position, onDone }: { position: ReturnType<typeof defenseRound>[number]; onDone: (independent: boolean) => void }) {
    const t = useTranslations("Defense");
    const tHelp = useTranslations("LearningHelp");
    const setup = defenseStart(position);
    const [stage, setStage] = useState<"watch" | "identify" | "move" | "done">("watch");
    const [fen, setFen] = useState(position.fen);
    const [helped, setHelped] = useState(false);
    const [wrong, setWrong] = useState(false);
    const [attempt, setAttempt] = useState<{ move: string; reply: string } | null>(null);
    const game = new Chess(fen);
    const { onSquareClick, onPieceClick, onPieceDrop, optionSquares } = useLegalMoves({ game, onMove: ({ from, to, promotion }) => {
        if (stage !== "move") return false;
        const move = from + to + (promotion ?? "");
        answer(move); return false;
    } });
    function answer(move: string) {
        const result = defenseAnswer(position, move);
        if (!result) return;
        if (result.correct) { setFen(result.fen); setStage("done"); setWrong(false); setAttempt(null); }
        else { setWrong(true); setHelped(true); if (result.reply) setAttempt({ move, reply: result.reply }); }
    }
    function identify(square: string) {
        if (square === position.target) { setStage("move"); setWrong(false); }
        else { setWrong(true); setHelped(true); }
    }
    const candidateLabel = (move: string) => learningMove(new Chess(setup.fen), move).san;
    return <div className="space-y-4">
        <div className="rounded-xl bg-indigo-50 text-indigo-950 p-4 space-y-2"><h2 className="font-bold text-xl">{t(stage === "watch" ? "watch" : stage === "identify" ? "identify" : stage === "done" ? "correct" : "choose")}</h2><p>{t(stage === "watch" ? "watchHelp" : stage === "identify" ? "identifyHelp" : stage === "done" ? "takeaway" : "chooseHelp")}</p></div>
        <div className="max-w-[560px] aspect-square mx-auto"><Chessboard options={{ id: "defense-board", position: fen, boardOrientation: "white", allowDragging: stage === "move", onSquareClick: args => { if (stage === "identify") identify(args.square); else if (stage === "move") void onSquareClick(args); }, onPieceClick: args => { if (stage === "move") onPieceClick(args); }, onPieceDrop: args => { if (stage === "move") void onPieceDrop(args); return false; }, squareStyles: { ...optionSquares, ...(stage !== "watch" ? { [setup.from]: { backgroundColor: "rgba(250,204,21,.4)" }, [setup.to]: { backgroundColor: "rgba(250,204,21,.6)" } } : {}), ...(helped && stage === "identify" ? { [position.target]: { backgroundColor: "rgba(239,68,68,.5)" } } : {}) }, allowDrawingArrows: false, animationDurationInMs: 350 }} /></div>
        {stage === "watch" && <button type="button" onClick={() => { setFen(setup.fen); setStage("identify"); }} className="rounded-lg bg-indigo-600 text-white px-4 py-2 font-bold">{t("showMove")}</button>}
        {stage === "identify" && <button type="button" onClick={() => setHelped(true)} className="rounded-lg bg-amber-100 text-amber-950 px-4 py-2">{t("showThreat")}</button>}
        {stage === "move" && <div className="flex flex-wrap gap-3">{(roundOrder(position.id) ? [position.safe, position.tempting] : [position.tempting, position.safe]).map(move => <button key={move} type="button" onClick={() => answer(move)} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-5 py-3 font-bold">{candidateLabel(move)}</button>)}</div>}
        {wrong && <p role="status" className="text-amber-800 dark:text-amber-200">{t(stage === "identify" ? "wrongPiece" : "wrongMove")}</p>}
        {attempt && <TrainingLine key={attempt.move} fen={setup.fen} moves={[attempt.move, attempt.reply]} label={t("consequence")} />}
        {stage === "done" && <><p role="status" className="text-green-700 dark:text-green-300">{t(helped ? "learned" : "independent")}</p><button type="button" onClick={() => onDone(!helped)} className="rounded-lg bg-green-600 text-white px-4 py-2 font-bold">{t("next")}</button></>}
        {helped && <p className="text-sm text-gray-500 dark:text-gray-400">{tHelp("assisted")}</p>}
    </div>;
}
const roundOrder = (id: string) => Number(id.at(-1)) % 2 === 0;
