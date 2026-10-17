"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { HelpCircle, Pencil } from "lucide-react";
import { deletePracticeQuestion, savePracticeQuestion, type WhyQuestion } from "@/app/actions/practiceQuestions";

const today = () => new Date().toISOString().slice(0, 10);
const answeredKey = (nodeId: string) => `chess-study:why:${nodeId}`;

// A question is asked at most once a day per line in this browser, so repeating a line stays quick.
function answeredToday(nodeId: string) {
    try {
        return window.localStorage.getItem(answeredKey(nodeId)) === today();
    } catch {
        return false;
    }
}

function markAnswered(nodeId: string) {
    try {
        window.localStorage.setItem(answeredKey(nodeId), today());
    } catch {
        // Fine: the question may simply be asked again.
    }
}

export default function WhyQuestionCard({ nodeId, question, canEdit, onSaved }: { nodeId: string; question?: WhyQuestion; canEdit: boolean; onSaved: (question: WhyQuestion | null) => void }) {
    const t = useTranslations("WhyQuestion");
    const [picked, setPicked] = useState<number | null>(null);
    const [skipped] = useState(() => !!question && answeredToday(nodeId));
    const [editing, setEditing] = useState(false);

    return (
        <div className="space-y-3">
            {question && !skipped && !editing && (
                <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-950 dark:text-indigo-50 space-y-3">
                    <p className="font-bold flex items-center gap-2"><HelpCircle className="h-5 w-5" /> {question.prompt}</p>
                    <div className="grid gap-2">
                        {question.options.map((option, index) => {
                            const state = picked === null ? "" : index === question.answer ? "bg-green-500 text-white" : index === picked ? "bg-red-400 text-white" : "opacity-60";
                            return (
                                <button key={index} type="button" disabled={picked !== null}
                                    onClick={() => { setPicked(index); markAnswered(nodeId); }}
                                    className={`text-left px-3 py-2 rounded-lg bg-white dark:bg-gray-800 font-medium ${state}`}>
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                    {picked !== null && (
                        <p className="font-medium">
                            {picked === question.answer ? `⭐ ${t("right")}` : t("notQuite")} {question.explanation}
                        </p>
                    )}
                </div>
            )}
            {canEdit && !editing && (
                <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-sm text-indigo-700 dark:text-indigo-300 hover:underline">
                    <Pencil className="h-4 w-4" /> {question ? t("edit") : t("add")}
                </button>
            )}
            {editing && <QuestionEditor nodeId={nodeId} question={question} onDone={saved => { setEditing(false); if (saved !== undefined) onSaved(saved); }} />}
        </div>
    );
}

function QuestionEditor({ nodeId, question, onDone }: { nodeId: string; question?: WhyQuestion; onDone: (saved?: WhyQuestion | null) => void }) {
    const t = useTranslations("WhyQuestion");
    const [prompt, setPrompt] = useState(question?.prompt ?? "");
    const [options, setOptions] = useState<string[]>(question ? [...question.options, "", "", ""].slice(0, 4) : ["", "", "", ""]);
    const [answer, setAnswer] = useState(question?.answer ?? 0);
    const [explanation, setExplanation] = useState(question?.explanation ?? "");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const field = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm";

    function save() {
        setError(null);
        // Drop empty answers but keep the right one pointing at the same text.
        const filled = options.map((text, index) => ({ text: text.trim(), index })).filter(option => option.text);
        const next: WhyQuestion = { prompt, options: filled.map(option => option.text), answer: filled.findIndex(option => option.index === answer), explanation };
        startTransition(async () => {
            try {
                await savePracticeQuestion(nodeId, next);
                onDone(next);
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            }
        });
    }

    return (
        <div className="p-4 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("editorHelp")}</p>
            <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={t("promptPlaceholder")} maxLength={200} className={field} />
            {options.map((option, index) => (
                <label key={index} className="flex items-center gap-2">
                    <input type="radio" name={`answer-${nodeId}`} checked={answer === index} onChange={() => setAnswer(index)} aria-label={t("markRight")} />
                    <input value={option} onChange={e => setOptions(options.map((value, i) => (i === index ? e.target.value : value)))} placeholder={t("optionPlaceholder", { number: index + 1 })} maxLength={120} className={field} />
                </label>
            ))}
            <input value={explanation} onChange={e => setExplanation(e.target.value)} placeholder={t("explanationPlaceholder")} maxLength={300} className={field} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={save} disabled={pending} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-50">{t("save")}</button>
                <button type="button" onClick={() => onDone()} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium">{t("cancel")}</button>
                {question && (
                    <button type="button" disabled={pending} onClick={() => startTransition(async () => { await deletePracticeQuestion(nodeId); onDone(null); })}
                        className="px-4 py-2 rounded-lg text-red-700 dark:text-red-300 font-medium">{t("delete")}</button>
                )}
            </div>
        </div>
    );
}
