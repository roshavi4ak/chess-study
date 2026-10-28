"use client";

import { useTranslations } from "next-intl";
import { GOAL_METRICS, OPENING_METRICS, PERIOD_PRESETS, THEME_METRICS, presetPeriod, type GoalMetric } from "@/lib/clubGoals";

export const fieldClass = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm";

export interface GoalFieldsValue {
    metric: GoalMetric;
    tag: string;
    practiceId: string;
    startsOn: string;
    endsOn: string;
}

// The measure (with an optional theme or opening) and the period: shared by team challenges and club goals.
export default function TeamGoalFields({ value, onChange, practices, tags, today }: {
    value: GoalFieldsValue;
    onChange: (next: GoalFieldsValue) => void;
    practices: { id: string; name: string }[];
    tags: string[];
    today: string;
}) {
    const t = useTranslations("Teams");
    const tMetrics = useTranslations("GoalMetrics");
    const tCategories = useTranslations("PuzzleCategories");
    const set = (patch: Partial<GoalFieldsValue>) => onChange({ ...value, ...patch });

    return (
        <>
            <label className="space-y-1 text-sm font-medium">
                <span>{t("measure")}</span>
                <select aria-label={t("measure")} value={value.metric} onChange={event => set({ metric: event.target.value as GoalMetric })} className={fieldClass}>
                    {GOAL_METRICS.map(metric => <option key={metric} value={metric}>{tMetrics(`name_${metric}`)}</option>)}
                </select>
                <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{tMetrics(`help_${value.metric}`)}</span>
            </label>

            {THEME_METRICS.includes(value.metric) && (
                <label className="space-y-1 text-sm font-medium">
                    <span>{t("theme")}</span>
                    <select value={value.tag} onChange={event => set({ tag: event.target.value })} className={fieldClass}>
                        <option value="">{t("anyTheme")}</option>
                        {tags.map(tag => <option key={tag} value={tag}>{tCategories.has(tag) ? tCategories(tag) : tag}</option>)}
                    </select>
                </label>
            )}
            {OPENING_METRICS.includes(value.metric) && (
                <label className="space-y-1 text-sm font-medium">
                    <span>{t("opening")}</span>
                    <select value={value.practiceId} onChange={event => set({ practiceId: event.target.value })} className={fieldClass}>
                        <option value="">{t("anyOpening")}</option>
                        {practices.map(practice => <option key={practice.id} value={practice.id}>{practice.name}</option>)}
                    </select>
                </label>
            )}

            <fieldset className="space-y-1 text-sm font-medium sm:col-span-2">
                <legend>{t("period")}</legend>
                <div className="flex flex-wrap gap-2 pt-1">
                    {PERIOD_PRESETS.map(preset => {
                        const period = presetPeriod(preset, today);
                        const active = period.startsOn === value.startsOn && period.endsOn === value.endsOn;
                        return (
                            <button key={preset} type="button" onClick={() => set(period)} aria-pressed={active}
                                className={`px-3 py-1.5 rounded-lg ${active ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700"}`}>
                                {t(`preset_${preset}`)}
                            </button>
                        );
                    })}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <label className="space-y-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{t("from")}</span>
                        <input type="date" value={value.startsOn} onChange={event => set({ startsOn: event.target.value })} className={fieldClass} required />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{t("to")}</span>
                        <input type="date" value={value.endsOn} min={value.startsOn} onChange={event => set({ endsOn: event.target.value })} className={fieldClass} required />
                    </label>
                </div>
            </fieldset>
        </>
    );
}
