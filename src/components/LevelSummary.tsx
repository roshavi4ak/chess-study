"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getMyLevel, type MyLevel } from "@/app/actions/levels";
import { CURRICULUM, KING_LEVEL, findCurriculumLevel } from "@/lib/curriculum";

// "Your level: Knight 2 — take the test" row on the dashboard.
export default function LevelSummary() {
    const t = useTranslations("Levels");
    const [mine, setMine] = useState<MyLevel | null>(null);

    useEffect(() => {
        getMyLevel().then(setMine).catch(() => undefined);
    }, []);

    if (!mine) return null;
    const level = findCurriculumLevel(mine.currentId) ?? KING_LEVEL;
    const name = level.id === KING_LEVEL.id ? t("kingName", { passes: mine.kingPasses }) : t("levelName", { group: t(`group_${level.group}`), number: level.number });

    return (
        <Link href="/levels" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white dark:bg-gray-800 shadow px-4 py-3 hover:shadow-md transition">
            <span className="font-medium text-gray-900 dark:text-white">🎓 {t("yourLevel")}: <span className="font-black">{name}</span></span>
            <span className="text-sm text-gray-600 dark:text-gray-300">{t("passedCount", { count: mine.passed.length, total: CURRICULUM.length })} <span className="text-blue-600 dark:text-blue-400">→</span></span>
        </Link>
    );
}
