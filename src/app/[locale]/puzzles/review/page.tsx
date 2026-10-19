import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loadPuzzleReviews, loadReviewTransfer } from "@/lib/puzzleReviewService";
import PuzzleReviewSession from "@/components/PuzzleReviewSession";

export default async function PuzzleReviewPage() {
    const session = await auth();
    const t = await getTranslations("PuzzleReview");
    if (!session?.user?.id) return <main className="max-w-2xl mx-auto p-6 space-y-4"><h1 className="text-2xl font-bold">{t("title")}</h1><p>{t("signIn")}</p><Link href="/">{t("back")}</Link></main>;
    const review = await loadPuzzleReviews(session.user.id);
    const fresh = await loadReviewTransfer(session.user.id, review.items);
    // Alternate a familiar position and a fresh example; at most five per visit.
    const items = review.items.flatMap(item => {
        const transfer = fresh.find(puzzle => puzzle.afterPuzzleId === item.id);
        return transfer ? [item, transfer] : [item];
    });
    return <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5"><div className="flex justify-between gap-3 items-center"><h1 className="text-2xl font-bold">{t("title")}</h1><Link href="/dashboard" className="text-blue-600 underline">{t("back")}</Link></div><p>{t("intro")}</p>
        {items.length ? <PuzzleReviewSession items={items} /> : <div className="rounded-xl bg-white dark:bg-gray-800 p-6 space-y-3"><p>{t(review.target ? "alreadyDone" : "empty")}</p><p className="text-sm">{t("comeBack")}</p><Link href="/puzzles/play" className="text-blue-600 underline">{t("newPuzzles")}</Link></div>}
    </main>;
}
