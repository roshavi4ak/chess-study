"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Lightbulb } from "lucide-react";
import AssignmentForm from "@/components/AssignmentForm";
import { findCurriculumLevel } from "@/lib/curriculum";
import type { Suggestion } from "@/lib/studentProfile";

interface StudentHomeworkPanelProps {
    studentId: string;
    studentName: string;
    suggestions: Suggestion[];
    practices: { id: string; name: string }[];
    tags: string[];
    defaultDueOn: string;
    minDueOn: string;
}

// Suggested help for one child; clicking a suggestion fills in the homework form below it.
export default function StudentHomeworkPanel({ studentId, studentName, suggestions, practices, tags, defaultDueOn, minDueOn }: StudentHomeworkPanelProps) {
    const t = useTranslations("StudentProfile");
    const tCategories = useTranslations("PuzzleCategories");
    const tLevels = useTranslations("Levels");
    const [preset, setPreset] = useState<{ version: number; suggestion: Suggestion | null }>({ version: 0, suggestion: null });

    const theme = (tag?: string) => tag ? (tCategories.has(tag) ? tCategories(tag) : tag) : "";
    const levelName = (id?: string) => {
        const level = id ? findCurriculumLevel(id) : undefined;
        return level ? `${tLevels("levelName", { group: tLevels(`group_${level.group}`), number: level.number })} — ${tLevels(`topic_${level.id}`)}` : "";
    };
    const describe = (suggestion: Suggestion) => {
        switch (suggestion.reason) {
            case "weakLine": return t("suggestWeakLine", { practice: suggestion.practiceName ?? "", line: suggestion.lineNumber ?? "?", count: suggestion.detail });
            case "dueLines": return t("suggestDueLines", { practice: suggestion.practiceName ?? "", count: suggestion.detail });
            case "weakTheme": return t("suggestWeakTheme", { theme: theme(suggestion.tag), percent: suggestion.detail });
            case "level": return t("suggestLevel", { level: levelName(suggestion.tag) });
        }
    };
    const note = (suggestion: Suggestion) => suggestion.reason === "weakLine" && suggestion.lineNumber
        ? t("suggestNoteLine", { line: suggestion.lineNumber })
        : "";

    const chosen = preset.suggestion;
    return (
        <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
                <h3 className="font-bold flex items-center gap-2 text-amber-900 dark:text-amber-100"><Lightbulb className="h-5 w-5" /> {t("howToHelp", { name: studentName })}</h3>
                {suggestions.length === 0 ? (
                    <p className="text-sm text-gray-600 dark:text-gray-300">{t("noSuggestions")}</p>
                ) : (
                    <ul className="space-y-2">
                        {suggestions.map((suggestion, index) => (
                            <li key={index} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="text-gray-800 dark:text-gray-100">{describe(suggestion)}</span>
                                <button type="button" onClick={() => setPreset(previous => ({ version: previous.version + 1, suggestion }))}
                                    className="px-3 py-1 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700">
                                    {t("assignThis")}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <AssignmentForm
                key={preset.version}
                students={[]}
                practices={practices}
                tags={chosen?.tag && chosen.kind === "PUZZLE_THEME" && !tags.includes(chosen.tag) ? [chosen.tag, ...tags] : tags}
                defaultDueOn={defaultDueOn}
                minDueOn={minDueOn}
                fixedStudentId={studentId}
                initial={chosen ? { kind: chosen.kind, practiceId: chosen.practiceId, tag: chosen.tag, target: chosen.target, note: note(chosen) } : undefined}
            />
        </div>
    );
}
