import { prisma } from "@/lib/db";
import PuzzleSession from "@/components/PuzzleSession";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isSkillTag } from "@/lib/dailyMission";
import { orderThemes, themeLabel } from "@/lib/puzzleThemes";
import { loadPuzzleMistakes } from "@/lib/attemptReview";
import AttemptReview from "@/components/AttemptReview";
import { Chess } from "chess.js";

interface PageProps {
    params: Promise<{
        name: string;
    }>;
    searchParams: Promise<{
        tag?: string;
    }>;
}

export default async function PuzzlePage(props: PageProps) {
    const { name } = await props.params;
    const puzzle = await prisma.puzzle.findUnique({
        where: { name },
        include: { creator: true }
    });

    if (!puzzle) {
        notFound();
    }

    const hints = (puzzle.hints as unknown as string[]) || [];
    const session = await import("@/auth").then(m => m.auth());
    const isCreator = session?.user?.id === puzzle.createdBy;

    const { tag } = await props.searchParams;
    const [t, tCommon, tCategories] = await Promise.all([getTranslations("Puzzles"), getTranslations("Common"), getTranslations("PuzzleCategories")]);
    // Imported puzzles all carry the description "Lichess Puzzle <id>".
    const lichessId = puzzle.description?.match(/^Lichess Puzzle (\S+)$/)?.[1];
    const coach = session?.user?.role === "COACH";
    const mistakes = coach ? await loadPuzzleMistakes(puzzle.id) : [];
    const tReview = await getTranslations("AttemptReview");

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <div className="mb-6 text-center relative">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {puzzle.name}
                    </h1>
                    {isCreator && (
                        <div className="absolute top-0 right-0">
                            <a
                                href={`/puzzles/${puzzle.name}/edit`}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                            >
                                {tCommon("edit")}
                            </a>
                        </div>
                    )}
                    <div className="flex flex-wrap justify-center items-center gap-2 mt-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{t("themes")}:</span>
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-bold" title={t("rating")}>
                            {t("ratingValue", { rating: puzzle.rating })}
                        </span>
                        {orderThemes(puzzle.tags, tag).map(theme => (
                            <span key={theme} title={theme} className={`px-2 py-1 rounded text-xs ${theme === tag ? "bg-green-100 text-green-800 font-bold" : isSkillTag(theme) ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
                                {themeLabel(theme, tCategories)}
                            </span>
                        ))}
                    </div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">
                        {lichessId ? t("lichessPuzzle", { id: lichessId }) : puzzle.description}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        {tCommon("createdBy", { name: puzzle.creator.name ?? tCommon("unknown") })}
                    </p>
                </div>

                <div className="flex justify-center">
                    <PuzzleSession
                        id={puzzle.id}
                        currentPuzzleName={puzzle.name}
                        fen={puzzle.fen}
                        solution={puzzle.solution}
                        hints={hints}
                        tag={tag}
                    />
                </div>
                {coach && <div className="mt-8"><AttemptReview fen={puzzle.fen} moves={puzzle.solution.split(/\s+/).filter(Boolean)}
                    orientation={new Chess(puzzle.fen).turn() === "w" ? "black" : "white"}
                    attempts={mistakes} title={tReview("clubMistakes")} /></div>}
            </div>
        </main>
    );
}
