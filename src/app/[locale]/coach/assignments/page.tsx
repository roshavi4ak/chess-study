import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getAssignmentOptions, getCoachOverview } from "@/app/actions/assignments";
import { addDays } from "@/lib/reviewSchedule";
import { Link } from "@/i18n/navigation";
import AssignmentForm from "@/components/AssignmentForm";
import DeleteAssignmentButton from "@/components/DeleteAssignmentButton";
import { findCurriculumLevel } from "@/lib/curriculum";

export default async function CoachAssignmentsPage() {
    const session = await auth();
    if (session?.user?.role !== "COACH") redirect("/dashboard");

    const [t, tCategories, tLevels, locale, overview, options] = await Promise.all([
        getTranslations("CoachHomework"),
        getTranslations("PuzzleCategories"),
        getTranslations("Levels"),
        getLocale(),
        getCoachOverview(),
        getAssignmentOptions(),
    ]);
    const dateFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
    const formatDay = (day: string) => dateFormatter.format(new Date(`${day}T00:00:00Z`));
    const names = new Map(overview.students.map(student => [student.id, student.name ?? "?"]));

    return (
        <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
                <Link href="/coach/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("backToDashboard")}</Link>
            </div>

            <AssignmentForm
                students={overview.students.map(({ id, name }) => ({ id, name }))}
                practices={options.practices}
                tags={options.tags}
                defaultDueOn={addDays(overview.today, 7)}
                minDueOn={overview.today}
            />

            <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("currentHomework")}</h2>
                {overview.assignments.length === 0 && <p className="text-gray-500 dark:text-gray-400">{t("noHomework")}</p>}
                {overview.assignments.map(assignment => {
                    const level = assignment.kind === "LEVEL" && assignment.tag ? findCurriculumLevel(assignment.tag) : undefined;
                    const what = assignment.kind === "PRACTICE"
                        ? t("practiceGoal", { count: assignment.target, practice: assignment.practiceName ?? "?" })
                        : assignment.kind === "LEVEL"
                            ? t("levelGoal", { level: level ? tLevels("levelName", { group: tLevels(`group_${level.group}`), number: level.number }) : "?" })
                            : t("puzzleGoal", { count: assignment.target, theme: assignment.tag && tCategories.has(assignment.tag) ? tCategories(assignment.tag) : assignment.tag ?? "?" });
                    const finished = assignment.progress.filter(entry => entry.complete).length;
                    const past = assignment.dueOn < overview.today;
                    return (
                        <div key={assignment.id} className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 space-y-3">
                            <div className="flex justify-between gap-2">
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{what}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {assignment.studentId ? <Link href={`/coach/students/${assignment.studentId}`} prefetch={false} className="hover:underline">{names.get(assignment.studentId) ?? "?"}</Link> : t("allStudents")}
                                        {" · "}
                                        <span className={past ? "text-red-600 dark:text-red-400" : ""}>{t("due", { date: formatDay(assignment.dueOn) })}</span>
                                        {" · "}
                                        {t("finishedCount", { done: finished, total: assignment.progress.length })}
                                        {!assignment.ownedByMe && assignment.coachName && <> · {t("setBy", { name: assignment.coachName })}</>}
                                    </p>
                                    {assignment.note && <p className="text-sm italic text-gray-600 dark:text-gray-300 mt-1">“{assignment.note}”</p>}
                                </div>
                                {assignment.ownedByMe && <DeleteAssignmentButton id={assignment.id} />}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {assignment.progress.map(entry => (
                                    <span key={entry.studentId} className={`px-2 py-1 rounded text-xs ${entry.complete ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : past ? "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200" : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"}`}>
                                        <Link href={`/coach/students/${entry.studentId}`} prefetch={false} className="hover:underline">{entry.complete ? "✓ " : ""}{names.get(entry.studentId)} {entry.done}/{assignment.target}</Link>
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </section>
        </main>
    );
}
