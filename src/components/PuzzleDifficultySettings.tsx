"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getPuzzleDifficulty, savePuzzleDifficulty } from "@/app/actions/puzzleDifficulty";
import { DEFAULT_PUZZLE_DIFFICULTY, MIN_DIFFICULTY_OFFSET, MAX_DIFFICULTY_OFFSET, isPuzzleDifficulty, puzzleRatingRange, type PuzzleDifficulty, type PuzzleDifficultyView } from "@/lib/puzzleDifficulty";

export default function PuzzleDifficultySettings({ studentId, defaultOpen = false, onSaved }: {
    studentId?: string; defaultOpen?: boolean; onSaved?: () => void;
}) {
    const t = useTranslations("PuzzleDifficulty");
    const [open, setOpen] = useState(defaultOpen);
    const [view, setView] = useState<PuzzleDifficultyView | null>(null);
    const [draft, setDraft] = useState<PuzzleDifficulty>({ ...DEFAULT_PUZZLE_DIFFICULTY });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        if (!open) return;
        let active = true;
        setLoading(true); setError(""); setSaved(false);
        getPuzzleDifficulty(studentId).then(result => {
            if (!active) return;
            if ("view" in result) { setView(result.view); setDraft(result.view); }
            else { setView(null); setError(result.error); }
        }).catch(() => { if (active) { setView(null); setError("saveFailed"); } })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [open, studentId, retry]);

    function change(next: Partial<PuzzleDifficulty>) { setDraft(previous => ({ ...previous, ...next })); setSaved(false); setError(""); }
    function changeLimit(key: "minOffset" | "maxOffset", value: number) {
        const next = { ...draft, [key]: value };
        next.preferredOffset = Math.max(next.minOffset, Math.min(next.maxOffset, next.preferredOffset));
        change(next);
    }
    async function save(event: React.FormEvent) {
        event.preventDefault();
        if (!view || saving) return;
        if (!isPuzzleDifficulty(draft)) { setError("invalid"); return; }
        setSaving(true); setSaved(false); setError("");
        try {
            const result = await savePuzzleDifficulty(view.canEditLimits ? draft : { preferredOffset: draft.preferredOffset }, studentId);
            if ("view" in result) { setView(result.view); setDraft(result.view); setSaved(true); onSaved?.(); }
            else setError(result.error);
        } catch { setError("saveFailed"); }
        finally { setSaving(false); }
    }

    const range = view && isPuzzleDifficulty(draft) ? puzzleRatingRange(view.studentRating, draft) : view;
    const editable = view && (view.canEditLimits || view.allowStudentChoice);
    return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="w-full rounded-xl border border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-gray-900 dark:text-gray-100">
        <summary className="cursor-pointer font-bold text-blue-700 dark:text-blue-300">{t("title")}</summary>
        {open && <div className="mt-3 space-y-3">
            {loading ? <p role="status">{t("loading")}</p> : range && view && <>
                <p>{t("range", { rating: range.studentRating, min: range.min, max: range.max })}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t("target", { target: range.target })} {t("updates")}</p>
                <form onSubmit={save} className="space-y-3">
                    <fieldset disabled={saving} className="space-y-3">
                        {view.canEditLimits && <>
                            <p className="text-sm">{t("coachHelp")}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {(["minOffset", "maxOffset"] as const).map(key => <label key={key} className="block text-sm font-medium">{t(key)}<input type="number" min={MIN_DIFFICULTY_OFFSET} max={MAX_DIFFICULTY_OFFSET} step={1} required value={Number.isNaN(draft[key]) ? "" : draft[key]} onChange={event => changeLimit(key, event.target.valueAsNumber)} className="mt-1 block w-full rounded border p-2 bg-white dark:bg-gray-900" /></label>)}
                            </div>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.allowStudentChoice} onChange={event => change({ allowStudentChoice: event.target.checked })} />{t("allowChoice")}</label>
                        </>}
                        {editable ? <>
                            <p className="text-sm font-medium">{t("choose")}</p>
                            <div className="flex flex-wrap gap-2">{([0, 100, 300] as const).map(offset => <button key={offset} type="button" disabled={offset < draft.minOffset || offset > draft.maxOffset} aria-pressed={draft.preferredOffset === offset} onClick={() => change({ preferredOffset: offset })} className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-40 ${draft.preferredOffset === offset ? "bg-blue-600 text-white" : "bg-gray-50 dark:bg-gray-900"}`}>{t(`preset${offset}`)}</button>)}</div>
                            <label className="block text-sm font-medium">{t("preferredOffset")}<input type="number" min={draft.minOffset} max={draft.maxOffset} step={1} required value={Number.isNaN(draft.preferredOffset) ? "" : draft.preferredOffset} onChange={event => change({ preferredOffset: event.target.valueAsNumber })} className="mt-1 block w-full max-w-xs rounded border p-2 bg-white dark:bg-gray-900" /></label>
                        </> : <p className="text-sm">{t("locked")}</p>}
                    </fieldset>
                    {editable && <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{t(saving ? "saving" : "save")}</button>}
                </form>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("scope")}</p>
            </>}
            {error && <div role="alert"><p>{t(error)}</p>{!view && <button type="button" onClick={() => setRetry(value => value + 1)} className="underline">{t("retry")}</button>}</div>}
            {saved && <p role="status" className="text-green-700 dark:text-green-300">{t("saved")}</p>}
        </div>}
    </details>;
}
