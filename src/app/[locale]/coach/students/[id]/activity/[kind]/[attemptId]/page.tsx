import { Chess } from "chess.js";
import { notFound, redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { loadPuzzleMistakes, getReviewCoach } from "@/lib/attemptReview";
import { readMoveErrors, validateExerciseReviews } from "@/lib/attemptMoves";
import { Link } from "@/i18n/navigation";
import AttemptReview from "@/components/AttemptReview";

export default async function ActivityReviewPage({ params }: { params: Promise<{ id: string; kind: string; attemptId: string }> }) {
    const { id, kind, attemptId } = await params;
    const coach = await getReviewCoach();
    if (!coach) redirect("/dashboard");
    const student = await prisma.user.findFirst({ where: { id, role: "STUDENT" }, select: { name: true } });
    if (!student) notFound();
    const t = await getTranslations("AttemptReview");
    const locale = await getLocale();
    const studentName = student.name ?? "?";
    let content;
    let title = t("title");
    if (kind === "puzzle") {
        const attempt = await prisma.puzzleAttempt.findFirst({ where: { id: attemptId, userId: id }, include: { puzzle: true } });
        if (!attempt) notFound();
        const { puzzle } = attempt;
        const attempts = await loadPuzzleMistakes(puzzle.id);
        if (!attempts.some(row => row.id === attempt.id)) attempts.unshift({ id: attempt.id, student: studentName, at: attempt.createdAt.toISOString(), success: attempt.success,
            errors: attempt.moveErrors === null ? null : readMoveErrors(attempt.moveErrors) });
        const focusIndex = attempts.findIndex(row => row.id === attempt.id);
        if (focusIndex > 0) attempts.unshift(...attempts.splice(focusIndex, 1));
        title = puzzle.name;
        content = <><Link href={`/puzzles/${encodeURIComponent(puzzle.name)}`} prefetch={false} className="text-blue-600 dark:text-blue-400 underline">{t("openPuzzle")}</Link>
            <AttemptReview fen={puzzle.fen} moves={puzzle.solution.split(/\s+/).filter(Boolean)} attempts={attempts} focusId={attempt.id}
                orientation={new Chess(puzzle.fen).turn() === "w" ? "black" : "white"} title={t("clubMistakes")} /></>;
    } else if (kind === "practice") {
        const attempt = await prisma.practiceAttempt.findFirst({ where: { id: attemptId, userId: id }, include: { practice: { include: { nodes: true } }, node: true } });
        if (!attempt) notFound();
        const nodes = new Map(attempt.practice.nodes.map(node => [node.id, node]));
        const path: typeof attempt.practice.nodes = [];
        const visited = new Set<string>();
        for (let node: typeof attempt.node | undefined = attempt.node; node && !visited.has(node.id); node = node.parentId ? nodes.get(node.parentId) : undefined) {
            visited.add(node.id); path.unshift(node);
        }
        if (!path.length) notFound();
        title = `${attempt.practice.name} · ${t("line", { number: attempt.node.lineNumber ?? "?" })}`;
        content = <><Link href={`/practices/${attempt.practiceId}`} prefetch={false} className="text-blue-600 dark:text-blue-400 underline">{t("openPractice")}</Link>
            <AttemptReview fen={path[0].fen} moves={path.slice(1).flatMap((node, index) => {
                const move = index === path.length - 2 ? attempt.finalMove ?? node.move : node.move;
                return move ? [move] : [];
            })}
                orientation={attempt.practice.playerColor === "WHITE" ? "white" : "black"} focusId={attempt.id} title={t("attempt")}
                attempts={[{ id: attempt.id, student: studentName, at: attempt.createdAt.toISOString(), success: attempt.status === "PERFECT", usedHints: attempt.usedHints,
                    errors: attempt.moveErrors === null ? null : readMoveErrors(attempt.moveErrors) }]} /></>;
    } else if (kind === "play") {
        const attempt = await prisma.playSession.findFirst({ where: { id: attemptId, userId: id } });
        if (!attempt) notFound();
        const tProfile = await getTranslations("StudentProfile");
        title = tProfile.has(`kind_${attempt.kind}`) ? tProfile(`kind_${attempt.kind}`) : attempt.kind;
        const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sofia" });
        const details = attempt.details && typeof attempt.details === "object" && !Array.isArray(attempt.details) ? attempt.details : {};
        let exercises: ReturnType<typeof validateExerciseReviews> = [];
        try { exercises = validateExerciseReviews(details.exercises ?? []); } catch { /* Older activities did not store review data. */ }
        // Older activities often have only a score, not a replay or wrong moves.
        content = <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <p>{date.format(attempt.createdAt)}</p><p>{t("score", { score: attempt.score })}</p>
            <p>{attempt.key}</p>
            {exercises.length ? exercises.map((exercise, index) => <AttemptReview key={index} fen={exercise.fen} moves={exercise.moves} title={t("exercise", { number: index + 1 })}
                attempts={[{ id: `${attempt.id}:${index}`, student: studentName, at: attempt.createdAt.toISOString(), success: exercise.success, errors: exercise.errors, answer: exercise.answer }]} />)
                : <p className="text-gray-500">{t("legacyActivity")}</p>}
        </div>;
    } else notFound();
    return <main className="mx-auto max-w-6xl px-4 py-6 space-y-5">
        <Link href={`/coach/students/${id}#timeline`} prefetch={false} className="text-blue-600 dark:text-blue-400 underline">← {t("back", { name: studentName })}</Link>
        <h1 className="text-2xl font-bold">{studentName} · {title}</h1>
        {content}
    </main>;
}
