"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteClubTeam, saveClubTeam, type ClubTeamView } from "@/app/actions/clubGoals";
import { TEAM_COLORS, type TeamColor } from "@/lib/clubGoals";
import { teamStyle } from "@/components/TeamBadge";
import { fieldClass } from "@/components/TeamGoalFields";

export default function ClubTeamLibrary({ teams, students }: { teams: ClubTeamView[]; students: { id: string; name: string | null }[] }) {
    const t = useTranslations("Teams");
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [editingId, setEditingId] = useState<string>();
    const [name, setName] = useState("");
    const [color, setColor] = useState<TeamColor>("red");
    const [memberIds, setMemberIds] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [search, setSearch] = useState("");

    function reset() {
        setEditingId(undefined); setName(""); setColor("red"); setMemberIds([]); setSearch("");
    }

    function run(action: () => Promise<void>) {
        setError(null); setSaved(false);
        startTransition(async () => {
            try { await action(); setSaved(true); router.refresh(); }
            catch (err) { setError(err instanceof Error ? err.message : String(err)); }
        });
    }

    return (
        <section id="team-library" className="space-y-4 scroll-mt-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t("teamLibrary")}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">{t("teamLibraryHelp")}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map(team => (
                    <article key={team.id} className={`rounded-xl p-4 space-y-2 ${teamStyle(team.color).soft}`}>
                        <h3 className="font-bold">{teamStyle(team.color).dot} {team.name}</h3>
                        <p className="text-xs font-medium">{t("members", { count: team.memberIds.length })}</p>
                        <p className="text-sm break-words">{team.memberIds.map(id => students.find(student => student.id === id)?.name ?? "?").join(", ") || t("noMembers")}</p>
                        <div className="flex gap-4 text-sm">
                            <button type="button" disabled={pending} onClick={() => {
                                setEditingId(team.id); setName(team.name); setColor(team.color as TeamColor); setMemberIds(team.memberIds); setSearch(""); setError(null); setSaved(false);
                            }} className="font-medium text-blue-700 dark:text-blue-300 disabled:opacity-50">{t("edit")}</button>
                            <button type="button" disabled={pending} onClick={() => {
                                if (window.confirm(t("confirmDeleteTeam"))) run(async () => { await deleteClubTeam(team.id); if (editingId === team.id) reset(); });
                            }} className="text-red-700 dark:text-red-300 disabled:opacity-50">{t("delete")}</button>
                        </div>
                    </article>
                ))}
            </div>
            {!teams.length && <p className="text-sm text-gray-500 dark:text-gray-400">{t("noSavedTeams")}</p>}
            <form onSubmit={event => { event.preventDefault(); run(async () => { await saveClubTeam({ name, color, memberIds }, editingId); reset(); }); }} className="bg-white dark:bg-gray-800 shadow rounded-xl p-4 sm:p-6 space-y-4">
                <h3 className="text-xl font-bold">{t(editingId ? "editTeam" : "newTeam")}</h3>
                <fieldset disabled={pending} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block space-y-1 text-sm font-medium">
                            <span>{t("teamName")}</span>
                            <input value={name} onChange={event => setName(event.target.value)} maxLength={40} required className={fieldClass} />
                        </label>
                        <label className="block space-y-1 text-sm font-medium">
                            <span>{t("teamColor")}</span>
                            <select value={color} onChange={event => setColor(event.target.value as TeamColor)} className={fieldClass}>
                                {TEAM_COLORS.map(color => <option key={color} value={color}>{teamStyle(color).dot} {t(`team_${color}`)}</option>)}
                            </select>
                        </label>
                    </div>
                    <label className="block space-y-1 text-sm font-medium">
                        <span>{t("findStudent")}</span>
                        <input type="search" value={search} onChange={event => setSearch(event.target.value)} className={fieldClass} />
                    </label>
                    <fieldset className="space-y-2">
                        <legend className="text-sm font-medium">{t("teamMembers")} · {t("members", { count: memberIds.length })}</legend>
                        <div className="max-h-64 overflow-y-auto grid gap-1 sm:grid-cols-2">
                            {students.filter(student => (student.name ?? "?").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(student => (
                                <label key={student.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                                    <input type="checkbox" checked={memberIds.includes(student.id)} onChange={event => setMemberIds(current => event.target.checked ? [...current, student.id] : current.filter(id => id !== student.id))} />
                                    {student.name ?? "?"}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                </fieldset>
                <div className="flex items-center gap-4">
                    <button type="submit" disabled={pending} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-bold disabled:opacity-50">{t(pending ? "saving" : editingId ? "saveChanges" : "createTeam")}</button>
                    {editingId && <button type="button" disabled={pending} onClick={reset} className="text-sm text-blue-600 dark:text-blue-400">{t("cancel")}</button>}
                </div>
            </form>
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {saved && <p role="status" className="text-sm text-green-700 dark:text-green-400">{t("saved")}</p>}
        </section>
    );
}
