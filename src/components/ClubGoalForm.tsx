"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClubGoal, updateClubGoal, type ClubGoalEdit } from "@/app/actions/clubGoals";
import { Link } from "@/i18n/navigation";
import { presetPeriod } from "@/lib/clubGoals";
import TeamGoalFields, { fieldClass, type GoalFieldsValue } from "@/components/TeamGoalFields";

// Coach form: one target for the whole club over a week, a month or any dates.
export default function ClubGoalForm({ practices, tags, today, initialData }: { practices: { id: string; name: string }[]; tags: string[]; today: string; initialData?: ClubGoalEdit }) {
    const t = useTranslations("Teams");
    const router = useRouter();
    const locale = useLocale();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [title, setTitle] = useState(initialData?.title ?? "");
    const [target, setTarget] = useState(initialData?.target ?? 500);
    const [goal, setGoal] = useState<GoalFieldsValue>(initialData ? { metric: initialData.metric, startsOn: initialData.startsOn, endsOn: initialData.endsOn, tag: initialData.tag ?? "", practiceId: initialData.practiceId ?? "" } : { metric: "PUZZLES_SOLVED", tag: "", practiceId: "", ...presetPeriod("thisMonth", today) });

    function submit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setSaved(false);
        startTransition(async () => {
            try {
                if (initialData) {
                    await updateClubGoal(initialData.id, { title, target, ...goal });
                    router.push(`/${locale}/coach/teams`);
                    router.refresh();
                    return;
                }
                await createClubGoal({ title, target, ...goal });
                setTitle("");
                setSaved(true);
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            }
        });
    }

    return (
        <form onSubmit={submit} className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t(initialData ? "editGoal" : "newGoal")}</h2>
            {initialData && <p className="text-sm text-gray-600 dark:text-gray-300">{t("editRecounts")}</p>}
            <fieldset disabled={pending}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1 text-sm font-medium">
                    <span>{t("goalTitle")}</span>
                    <input value={title} onChange={event => setTitle(event.target.value)} maxLength={80} required placeholder={t("goalTitlePlaceholder")} className={fieldClass} />
                </label>
                <label className="space-y-1 text-sm font-medium">
                    <span>{t("target")}</span>
                    <input type="number" min={1} max={1000000} value={target} onChange={event => setTarget(Number(event.target.value))} required className={fieldClass} />
                </label>
                <TeamGoalFields value={goal} onChange={setGoal} practices={practices} tags={tags} today={today} />
            </div>
            </fieldset>
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {saved && <p role="status" className="text-sm text-green-700 dark:text-green-400">{t("saved")}</p>}
            <div className="flex items-center gap-4">
                <button type="submit" disabled={pending} className="px-5 py-2 rounded-lg bg-green-600 text-white font-bold disabled:opacity-50">{t(pending ? "saving" : initialData ? "saveChanges" : "createGoal")}</button>
                {initialData && <Link href="/coach/teams" className="text-sm text-blue-600 dark:text-blue-400">{t("cancel")}</Link>}
            </div>
        </form>
    );
}
