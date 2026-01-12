import { notFound } from "next/navigation";
import { getPractice } from "@/app/actions/practice";
import { getPracticeProgress } from "@/app/actions/progress";
import PracticeSession from "@/components/PracticeSession";
import Link from "next/link";

import { getTranslations } from "next-intl/server";

interface PracticePageProps {
    params: Promise<{ id: string }>;
}

export default async function PracticePage({ params }: PracticePageProps) {
    const { id } = await params;
    const t = await getTranslations("Practice");
    const [practice, progressData] = await Promise.all([
        getPractice(id),
        getPracticeProgress(id),
    ]);

    if (!practice || !practice.tree) {
        notFound();
    }

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <div className="mb-6">
                    <Link
                        href="/practices"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        ← {t("backToPractices")}
                    </Link>
                </div>
                <PracticeSession practice={practice} initialProgress={progressData} />
            </div>
        </main>
    );
}
