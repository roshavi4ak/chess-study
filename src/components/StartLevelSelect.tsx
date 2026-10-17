"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setStartLevel } from "@/app/actions/levels";
import { CURRICULUM } from "@/lib/curriculum";

// Lets a coach place a child further along the level path (earlier levels then count as passed).
export default function StartLevelSelect({ studentId, value }: { studentId: string; value: string | null }) {
    const t = useTranslations("Levels");
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    return (
        <select
            value={value ?? ""}
            disabled={pending}
            aria-label={t("startLevel")}
            onChange={event => startTransition(async () => {
                await setStartLevel(studentId, event.target.value || null);
                router.refresh();
            })}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs"
        >
            <option value="">{t("fromStart")}</option>
            {CURRICULUM.map(level => (
                <option key={level.id} value={level.id}>{t("levelName", { group: t(`group_${level.group}`), number: level.number })}</option>
            ))}
        </select>
    );
}
