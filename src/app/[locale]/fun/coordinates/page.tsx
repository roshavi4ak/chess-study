"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Chessboard } from "react-chessboard";
import { Link } from "@/i18n/navigation";
import { getPersonalBests, recordPlaySession, type PersonalBests } from "@/app/actions/play";
import { COORDINATES_SECONDS, randomSquare } from "@/lib/coordinates";
import PersonalBestPanel from "@/components/PersonalBestPanel";

type Side = "white" | "black";

export default function CoordinatesPage() {
    const t = useTranslations("Fun");
    const [bests, setBests] = useState<PersonalBests | null>(null);
    const [side, setSide] = useState<Side>("white");
    const [running, setRunning] = useState(false);
    const [target, setTarget] = useState<string | null>(null);
    const [score, setScore] = useState(0);
    const [secondsLeft, setSecondsLeft] = useState(COORDINATES_SECONDS);
    const [flash, setFlash] = useState<Record<string, React.CSSProperties>>({});
    const [finalScore, setFinalScore] = useState<number | null>(null);
    const scoreRef = useRef(0);

    useEffect(() => {
        getPersonalBests().then(setBests).catch(() => undefined);
    }, []);

    useEffect(() => {
        if (!running) return;
        const timer = setInterval(() => setSecondsLeft(left => left - 1), 1000);
        return () => clearInterval(timer);
    }, [running]);

    useEffect(() => {
        if (!running || secondsLeft > 0) return;
        // Time is up: the effect reacts to the clock reaching zero.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRunning(false);
        setTarget(null);
        setFinalScore(scoreRef.current);
        recordPlaySession({ kind: "COORDINATES", key: side, score: scoreRef.current })
            .then(() => getPersonalBests().then(setBests))
            .catch(error => console.error("Failed to save coordinates score:", error));
    }, [running, secondsLeft, side]);

    function start() {
        scoreRef.current = 0;
        setScore(0);
        setFinalScore(null);
        setSecondsLeft(COORDINATES_SECONDS);
        setTarget(randomSquare());
        setRunning(true);
    }

    function onSquareClick({ square }: { square: string }) {
        if (!running || !target) return;
        const right = square === target;
        if (right) {
            scoreRef.current += 1;
            setScore(scoreRef.current);
            setTarget(randomSquare(target));
        }
        setFlash({ [square]: { backgroundColor: right ? "rgba(34, 197, 94, 0.7)" : "rgba(239, 68, 68, 0.7)" } });
        setTimeout(() => setFlash({}), 250);
    }

    return (
        <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🎯 {t("coordinatesTitle")}</h1>
                <Link href="/fun" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("backToFun")}</Link>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-3">
                    <div className="flex justify-between items-center text-2xl font-black text-gray-900 dark:text-white">
                        <span>{running && target ? t("findSquare", { square: target }) : t("coordinatesIntro")}</span>
                        <span className="tabular-nums">{running ? `${secondsLeft}s` : ""}</span>
                    </div>
                    <div className="relative w-full max-w-[600px] aspect-square">
                        <Chessboard
                            options={{
                                id: "coordinates-board",
                                position: {},
                                boardOrientation: side,
                                showNotation: false,
                                allowDragging: false,
                                onSquareClick,
                                squareStyles: flash,
                            }}
                        />
                        {running && target && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <span className="text-8xl font-black text-white/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">{target}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
                        <p className="text-4xl font-black text-center text-blue-600 dark:text-blue-400">{running ? score : finalScore ?? 0}</p>
                        {finalScore !== null && !running && <p className="text-center font-medium">{t("timeUp", { score: finalScore })}</p>}
                        <div className="flex gap-2 justify-center">
                            {(["white", "black"] as Side[]).map(option => (
                                <button key={option} type="button" disabled={running} onClick={() => setSide(option)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${side === option ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700"} disabled:opacity-50`}>
                                    {option === "white" ? t("asWhite") : t("asBlack")}
                                </button>
                            ))}
                        </div>
                        <button type="button" onClick={start} disabled={running} className="w-full py-3 rounded-lg bg-green-600 text-white text-lg font-bold hover:bg-green-700 disabled:opacity-50">
                            {finalScore === null ? t("start") : t("playAgain")}
                        </button>
                    </div>
                    {bests && <PersonalBestPanel best={bests.coordinates} club={bests.clubWeek.coordinates} />}
                </div>
            </div>
        </main>
    );
}
