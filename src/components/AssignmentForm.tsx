"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createAssignment, type AssignmentInput } from "@/app/actions/assignments";
import { CURRICULUM } from "@/lib/curriculum";

interface AssignmentFormProps {
    students: { id: string; name: string | null }[];
    practices: { id: string; name: string }[];
    tags: string[];
    defaultDueOn: string;
    minDueOn: string;
    // On a student's profile: homework only for that student, optionally pre-filled from a suggestion.
    fixedStudentId?: string;
    initial?: Partial<Pick<AssignmentInput, "kind" | "practiceId" | "tag" | "target" | "note">>;
}

const DEFAULT_TARGET: Record<AssignmentInput["kind"], number> = { PRACTICE: 5, PUZZLE_THEME: 10, LEVEL: 1 };

const fieldClass = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm";

export default function AssignmentForm({ students, practices, tags, defaultDueOn, minDueOn, fixedStudentId, initial }: AssignmentFormProps) {
    const t = useTranslations("CoachHomework");
    const tCategories = useTranslations("PuzzleCategories");
    const tLevels = useTranslations("Levels");
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [kind, setKind] = useState<AssignmentInput["kind"]>(initial?.kind ?? "PRACTICE");
    const [studentId, setStudentId] = useState(fixedStudentId ?? "");
    const [practiceId, setPracticeId] = useState(initial?.practiceId ?? practices[0]?.id ?? "");
    const [tag, setTag] = useState(initial?.kind === "PUZZLE_THEME" && initial.tag ? initial.tag : tags[0] ?? "");
    const [levelId, setLevelId] = useState(initial?.kind === "LEVEL" && initial.tag ? initial.tag : CURRICULUM[0].id);
    const [target, setTarget] = useState(initial?.target ?? DEFAULT_TARGET[initial?.kind ?? "PRACTICE"]);
    const [dueOn, setDueOn] = useState(defaultDueOn);
    const [note, setNote] = useState(initial?.note ?? "");
    const chooseKind = (next: AssignmentInput["kind"]) => { setKind(next); setTarget(DEFAULT_TARGET[next]); };

    function submit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setSaved(false);
        startTransition(async () => {
            try {
                await createAssignment({ studentId: studentId || null, kind, practiceId, tag: kind === "LEVEL" ? levelId : tag, target, dueOn, note });
                setNote("");
                setSaved(true);
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            }
        });
    }

    return (
        <form onSubmit={submit} className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("newHomework")}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!fixedStudentId && (
                    <label className="space-y-1 text-sm font-medium">
                        <span>{t("forWhom")}</span>
                        <select value={studentId} onChange={e => setStudentId(e.target.value)} className={fieldClass}>
                            <option value="">{t("allStudents")}</option>
                            {students.map(student => <option key={student.id} value={student.id}>{student.name ?? "?"}</option>)}
                        </select>
                    </label>
                )}

                <fieldset className="space-y-1 text-sm font-medium">
                    <legend>{t("type")}</legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
                        <label className="flex items-center gap-2">
                            <input type="radio" checked={kind === "PRACTICE"} onChange={() => chooseKind("PRACTICE")} />
                            {t("kindPractice")}
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="radio" checked={kind === "PUZZLE_THEME"} onChange={() => chooseKind("PUZZLE_THEME")} />
                            {t("kindPuzzles")}
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="radio" checked={kind === "LEVEL"} onChange={() => chooseKind("LEVEL")} />
                            {t("kindLevel")}
                        </label>
                    </div>
                </fieldset>

                {kind === "PRACTICE" ? (
                    <label className="space-y-1 text-sm font-medium">
                        <span>{t("practice")}</span>
                        <select value={practiceId} onChange={e => setPracticeId(e.target.value)} className={fieldClass} required>
                            {practices.map(practice => <option key={practice.id} value={practice.id}>{practice.name}</option>)}
                        </select>
                    </label>
                ) : kind === "LEVEL" ? (
                    <label className="space-y-1 text-sm font-medium">
                        <span>{t("level")}</span>
                        <select value={levelId} onChange={e => setLevelId(e.target.value)} className={fieldClass} required>
                            {CURRICULUM.map(level => (
                                <option key={level.id} value={level.id}>
                                    {tLevels("levelName", { group: tLevels(`group_${level.group}`), number: level.number })} — {tLevels(`topic_${level.id}`)}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : (
                    <label className="space-y-1 text-sm font-medium">
                        <span>{t("theme")}</span>
                        <select value={tag} onChange={e => setTag(e.target.value)} className={fieldClass} required>
                            {tags.map(item => <option key={item} value={item}>{tCategories.has(item) ? tCategories(item) : item}</option>)}
                        </select>
                    </label>
                )}

                {kind !== "LEVEL" && (
                    <label className="space-y-1 text-sm font-medium">
                        <span>{kind === "PRACTICE" ? t("targetLines") : t("targetPuzzles")}</span>
                        <input type="number" min={1} max={50} value={target} onChange={e => setTarget(Number(e.target.value))} className={fieldClass} required />
                    </label>
                )}

                <label className="space-y-1 text-sm font-medium">
                    <span>{t("dueOn")}</span>
                    <input type="date" min={minDueOn} value={dueOn} onChange={e => setDueOn(e.target.value)} className={fieldClass} required />
                </label>

                <label className="space-y-1 text-sm font-medium sm:col-span-2">
                    <span>{t("note")}</span>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={300} placeholder={t("notePlaceholder")} className={fieldClass} />
                </label>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {saved && <p className="text-sm text-green-700 dark:text-green-400">{t("saved")}</p>}

            <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50">
                {pending ? t("saving") : t("assign")}
            </button>
        </form>
    );
}
