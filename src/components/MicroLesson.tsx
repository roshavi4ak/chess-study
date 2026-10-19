"use client";

import { useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { MICRO_LESSONS, lessonAnswer, type MicroLessonId } from "@/lib/microLessons";
import { learningMove } from "@/lib/puzzleLearning";
import { useLegalMoves } from "@/hooks/useLegalMoves";
import ReadAloud from "./ReadAloud";

interface MicroLessonProps { lessonId: MicroLessonId; onPractice: () => void }
export default function MicroLesson(props: MicroLessonProps) {
    const [round, setRound] = useState(0);
    return <MicroLessonContent key={round} {...props} onReplay={() => setRound(value => value + 1)} />;
}

function MicroLessonContent({ lessonId, onPractice, onReplay }: MicroLessonProps & { onReplay: () => void }) {
    const t = useTranslations("MicroLessons");
    const lesson = MICRO_LESSONS[lessonId];
    const [step, setStep] = useState(0);
    const [found, setFound] = useState<string[]>([]);
    const [wrong, setWrong] = useState(false);
    const [complete, setComplete] = useState(false);
    const [help, setHelp] = useState(false);
    const [game, setGame] = useState(() => new Chess(lesson.fen));
    const { onPieceDrop, onSquareClick, onPieceClick, optionSquares } = useLegalMoves({ game, onMove: ({ from, to, promotion }) => {
        if (step !== 2 || complete) return false;
        const attempt = new Chess(game.fen());
        const played = attempt.move({ from, to, promotion: promotion ?? "q" });
        if (!lessonAnswer(lessonId, played.from + played.to + (played.promotion ?? ""))) { setWrong(true); return false; }
        setGame(attempt); setWrong(false); setComplete(true); return true;
    } });
    const text = t(`${lessonId}.${step === 0 ? "intro" : step === 1 ? "example" : "challenge"}`);
    function advance() {
        setWrong(false);
        if (step === 0) { const next = new Chess(lesson.fen); learningMove(next, lesson.move); setGame(next); }
        else setGame(new Chess(lesson.challenge));
        setStep(value => value + 1);
    }
    const targets = lesson.targets as readonly string[];
    const ready = targets.every(square => found.includes(square));
    const source = lesson.answer.slice(0, 2);
    return <section className="rounded-2xl border border-indigo-200 bg-white dark:bg-gray-800 p-4 sm:p-6 space-y-4">
        <div className="flex justify-between gap-2"><h3 className="text-xl font-bold">{t(`${lessonId}.title`)}</h3><span className="text-sm">{t("step", { current: step + 1, total: 3 })}</span></div>
        <p className="text-lg" aria-live="polite">{text}</p>
        <ReadAloud key={`${lessonId}-${step}`} text={text} />
        {step === 1 && <p>{t(`${lessonId}.find`)}</p>}
        <div className="w-full max-w-[460px] aspect-square mx-auto"><Chessboard options={{ id: "micro-lesson", position: game.fen(), boardOrientation: "white", allowDragging: step === 2 && !complete,
            onPieceDrop: args => { if (step === 2 && !complete) void onPieceDrop(args); return false; },
            onSquareClick: args => { if (step === 1) { if (targets.includes(args.square)) { setFound(previous => [...new Set([...previous, args.square])]); setWrong(false); } else setWrong(true); } else if (step === 2 && !complete) onSquareClick(args); },
            onPieceClick: args => { if (step === 2 && !complete) onPieceClick(args); },
            squareStyles: { ...optionSquares, ...Object.fromEntries((step === 1 ? found : []).map(square => [square, { backgroundColor: "rgba(34,197,94,.55)" }])), ...(step === 2 && help ? { [source]: { backgroundColor: "rgba(250,204,21,.6)" } } : {}) },
            arrows: step === 0 || (step === 2 && help) ? [{ startSquare: step === 0 ? lesson.move.slice(0, 2) : source, endSquare: step === 0 ? lesson.move.slice(2, 4) : lesson.answer.slice(2, 4), color: "#4f46e5" }] : [], allowDrawingArrows: false, animationDurationInMs: 250,
        }} /></div>
        {wrong && <p role="status" className="text-amber-800 dark:text-amber-200">{t("tryAgain")}</p>}
        {step === 1 && <p role="status">{t("found", { count: found.length, total: targets.length })}</p>}
        {complete ? <div role="status" className="rounded-xl bg-green-50 text-green-950 p-4 space-y-3"><p className="font-bold">{t("complete")}</p><p>{t(`${lessonId}.takeaway`)}</p><button type="button" onClick={onPractice} className="rounded-lg bg-green-600 text-white px-4 py-2 font-bold">{t("practice")}</button></div>
            : step < 2 ? <button type="button" disabled={step === 1 && !ready} onClick={advance} className="rounded-lg bg-indigo-600 text-white px-4 py-2 font-bold disabled:opacity-50">{t(step === 0 ? "showExample" : "tryYourself")}</button>
                : <button type="button" onClick={() => setHelp(true)} className="rounded-lg bg-amber-100 text-amber-950 px-4 py-2">{t("help")}</button>}
        <button type="button" className="ml-3 text-sm underline" onClick={onReplay}>{t("replay")}</button>
    </section>;
}
