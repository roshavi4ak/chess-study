import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle, ExternalLink, XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getAssignmentOptions } from "@/app/actions/assignments";
import { CURRICULUM, KING_LEVEL, TEST_PASS, TEST_PUZZLES, findCurriculumLevel } from "@/lib/curriculum";
import { WEEKLY_GOAL_DAYS } from "@/lib/dailyMission";
import { addDays } from "@/lib/reviewSchedule";
import { loadStudentProfile, type StudentProfile, type TimelineEvent } from "@/lib/studentProfile";
import StartLevelSelect from "@/components/StartLevelSelect";
import StudentHomeworkPanel from "@/components/StudentHomeworkPanel";
import DeleteAssignmentButton from "@/components/DeleteAssignmentButton";
import PuzzleDifficultySettings from "@/components/PuzzleDifficultySettings";

const card = "bg-white dark:bg-gray-800 shadow rounded-2xl border border-gray-100 dark:border-gray-700";
const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";
const td = "px-3 py-2 whitespace-nowrap";
const SECTIONS = ["overview", "homework", "levels", "openings", "puzzles", "fun", "timeline"] as const;

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className={`${card} p-4`}>
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
            {sub && <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
        </div>
    );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    return (
        <section id={id} className="scroll-mt-20 space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
            {children}
        </section>
    );
}

function RatingChart({ points }: { points: number[] }) {
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = Math.max(1, max - min);
    const width = 600;
    const height = 120;
    const path = points.map((value, index) => `${index === 0 ? "M" : "L"}${(index / (points.length - 1) * width).toFixed(1)},${(height - (value - min) / span * (height - 10) - 5).toFixed(1)}`).join(" ");
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 text-blue-600 dark:text-blue-400" preserveAspectRatio="none" role="img" aria-label={`${points[0]} → ${points[points.length - 1]}`}>
            <path d={path} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

function ActivityGrid({ activity, label }: { activity: StudentProfile["activity"]; label: (day: string, total: number) => string }) {
    // Columns are weeks (Monday first), rows are weekdays.
    const firstWeekday = (new Date(`${activity[0].day}T00:00:00Z`).getUTCDay() + 6) % 7;
    const cells: (StudentProfile["activity"][number] | null)[] = [...Array(firstWeekday).fill(null), ...activity];
    const weeks: typeof cells[] = [];
    for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
    const shade = (total: number) => total === 0 ? "bg-gray-100 dark:bg-gray-700" : total < 3 ? "bg-green-200 dark:bg-green-900" : total < 8 ? "bg-green-400 dark:bg-green-700" : "bg-green-600 dark:bg-green-500";
    return (
        <div className="flex gap-1 overflow-x-auto pb-1">
            {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                    {week.map((cell, dayIndex) => {
                        if (!cell) return <span key={dayIndex} className="h-3 w-3" />;
                        const total = cell.puzzles + cell.lines + cell.play;
                        return <span key={dayIndex} title={label(cell.day, total)} className={`h-3 w-3 rounded-sm ${shade(total)}`} />;
                    })}
                </div>
            ))}
        </div>
    );
}

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (session?.user?.role !== "COACH") redirect("/dashboard");

    const [profile, options, t, tLevels, tCategories, tHomework, tLeagues, tCoach, locale] = await Promise.all([
        loadStudentProfile(id),
        getAssignmentOptions(),
        getTranslations("StudentProfile"),
        getTranslations("Levels"),
        getTranslations("PuzzleCategories"),
        getTranslations("CoachHomework"),
        getTranslations("Leagues"),
        getTranslations("CoachDashboard"),
        getLocale(),
    ]);
    if (!profile) notFound();

    const { student, summary, level, totals } = profile;
    const coachId = session.user.id;
    const dayFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    const formatDay = (day: string) => dayFormat.format(new Date(`${day}T00:00:00Z`));
    const dateTime = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" });
    const formatAt = (date: Date | null) => date ? dateTime.format(date) : "—";
    const theme = (tag: string) => tCategories.has(tag) ? tCategories(tag) : tag;
    const levelName = (levelId: string) => {
        const entry = findCurriculumLevel(levelId);
        if (!entry) return levelId;
        return entry.id === KING_LEVEL.id ? tLevels("kingName", { passes: level.kingPasses }) : tLevels("levelName", { group: tLevels(`group_${entry.group}`), number: entry.number });
    };
    const kindName = (kind: string) => t.has(`kind_${kind}`) ? t(`kind_${kind}`) : kind;
    const percent = (part: number, whole: number) => whole ? Math.round(100 * part / whole) : 0;
    const name = student.name ?? "?";

    const homeworkText = (item: StudentProfile["homework"][number]) => item.kind === "PRACTICE"
        ? tHomework("practiceGoal", { count: item.target, practice: item.practiceName ?? "?" })
        : item.kind === "LEVEL"
            ? tHomework("levelGoal", { level: item.tag ? levelName(item.tag) : "?" })
            : tHomework("puzzleGoal", { count: item.target, theme: item.tag ? theme(item.tag) : "?" });

    const timelineText = (event: TimelineEvent) => {
        switch (event.type) {
            case "puzzle": return t(event.success ? "eventPuzzleSolved" : "eventPuzzleFailed", { name: event.name, rating: event.rating });
            case "practice": return t(event.status === "PERFECT" ? "eventLinePerfect" : event.status === "COMPLETED" ? "eventLineMistakes" : "eventLinePartial", { practice: event.practice, line: event.lineNumber ?? "?", count: event.mistakes });
            case "play": return t("eventPlay", { kind: kindName(event.kind), detail: event.key.startsWith("level:") ? levelName(event.key.slice(6)) : event.key, score: event.score });
            case "opening": return t("eventOpening", { opening: event.opening });
        }
    };
    const timelineIcon = (event: TimelineEvent) => event.type === "puzzle" ? (event.success ? "🧩✅" : "🧩❌") : event.type === "practice" ? (event.status === "PERFECT" ? "♟️✅" : "♟️") : event.type === "play" ? (event.won ? "🎮🏆" : "🎮") : "📖";

    const currentHomework = profile.homework.filter(item => item.dueOn >= profile.today);
    const pastHomework = profile.homework.filter(item => item.dueOn < profile.today);

    return (
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <Link href="/coach/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("backToDashboard")}</Link>
                <Link href="/coach/assignments" className="text-blue-600 dark:text-blue-400 hover:underline">{t("allHomework")} →</Link>
            </div>

            {/* Header */}
            <div className={`${card} p-6 flex flex-wrap items-center gap-6`}>
                {student.image ? (
                    <Image src={student.image} alt="" width={96} height={96} className="h-24 w-24 rounded-full object-contain bg-gray-50 dark:bg-gray-900 ring-4 ring-blue-500/20" />
                ) : (
                    <div className="h-24 w-24 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-4xl font-black text-indigo-700 dark:text-indigo-300">{name[0]}</div>
                )}
                <div className="flex-1 min-w-[16rem] space-y-2">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">{name}</h1>
                    <div className="flex flex-wrap gap-2 text-sm">
                        {student.lichessId && (
                            <a href={`https://lichess.org/@/${student.lichessId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:underline">
                                lichess: {student.lichessId} <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">🎓 {levelName(level.currentId)}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">🏆 {tLeagues("yourLeague", { tier: tLeagues(`tier_${student.league}`) })}</span>
                        {summary.flags.includes("inactive") && <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700">{tHomework("flagInactive")}</span>}
                        {summary.flags.includes("backlog") && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">{tHomework("flagBacklog")}</span>}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t("lastActive")}: {summary.lastActiveDay ? formatDay(summary.lastActiveDay) : tHomework("never")}
                        {totals.firstActiveDay && <> · {t("firstActive")}: {formatDay(totals.firstActiveDay)}</>}
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                    {([["puzzle", student.ratings.puzzle], ["blitz", student.ratings.blitz], ["rapid", student.ratings.rapid], ["bullet", student.ratings.bullet], ["classical", student.ratings.classical]] as const).map(([key, value]) => (
                        <div key={key} className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900">
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t(`rating_${key}`)}</p>
                            <p className="text-lg font-bold">{value ?? "—"}</p>
                        </div>
                    ))}
                    <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{tHomework("startLevel")}</p>
                        <StartLevelSelect studentId={student.id} value={student.startLevel} />
                    </div>
                </div>
            </div>

            <nav className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur flex gap-2 overflow-x-auto text-sm">
                {SECTIONS.map(section => <a key={section} href={`#${section}`} className="px-3 py-1 rounded-full bg-white dark:bg-gray-800 shadow-sm whitespace-nowrap hover:bg-blue-50 dark:hover:bg-gray-700">{t(`section_${section}`)}</a>)}
            </nav>

            {/* Overview */}
            <Section id="overview" title={t("section_overview")}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label={t("statPuzzles")} value={totals.puzzlesTried} sub={t("statPuzzlesSub", { solved: totals.puzzlesSolved, percent: percent(totals.puzzlesSolved, totals.puzzlesTried) })} />
                    <Stat label={t("statLines")} value={totals.linesCompleted} sub={t("statLinesSub", { perfect: totals.linesPerfect, mastered: totals.linesMastered })} />
                    <Stat label={t("statMistakes")} value={totals.practiceMistakes} sub={t("statMistakesSub", { attempts: totals.practiceAttempts })} />
                    <Stat label={t("statBacklog")} value={summary.backlog} sub={summary.weakTheme ? t("statWeakTheme", { theme: theme(summary.weakTheme) }) : undefined} />
                    <Stat label={t("statActiveDays")} value={totals.activeDays} sub={t("statThisWeek", { count: summary.activeDaysThisWeek, goal: WEEKLY_GOAL_DAYS })} />
                    <Stat label={t("statLevels")} value={`${level.passed.length} / ${CURRICULUM.length}`} sub={levelName(level.currentId)} />
                    <Stat label={t("statOpenings")} value={totals.openingsViewed} sub={t("statOpeningsSub", { count: totals.openingsCompleted })} />
                    <Stat label={t("statFun")} value={totals.playSessions} sub={t("statGames", { count: totals.gamesRecorded })} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className={`${card} p-4 space-y-2`}>
                        <h3 className="font-bold">{t("activityTitle", { days: profile.activity.length })}</h3>
                        <ActivityGrid activity={profile.activity} label={(day, total) => t("activityCell", { date: formatDay(day), count: total })} />
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t("activityLegend")}</p>
                    </div>
                    <div className={`${card} p-4 space-y-2`}>
                        <h3 className="font-bold">{t("ratingTitle")}</h3>
                        {profile.ratingHistory.length > 1 ? (
                            <>
                                <RatingChart points={profile.ratingHistory} />
                                <p className="text-xs text-gray-500 dark:text-gray-400">{t("ratingLegend", { count: profile.ratingHistory.length - 1, from: profile.ratingHistory[0], to: profile.ratingHistory[profile.ratingHistory.length - 1] })}</p>
                            </>
                        ) : <p className="text-sm text-gray-500">{t("noData")}</p>}
                    </div>
                </div>
            </Section>

            {/* Homework and help */}
            <Section id="homework" title={t("section_homework")}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className={`${card} p-4 space-y-3`}>
                            <h3 className="font-bold">{t("currentHomework")}</h3>
                            {currentHomework.length === 0 && <p className="text-sm text-gray-500">{tHomework("noHomework")}</p>}
                            {currentHomework.map(item => (
                                <div key={item.id} className="flex justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0">
                                    <div className="space-y-1">
                                        <p className="font-medium">{item.complete ? "✅ " : ""}{homeworkText(item)}</p>
                                        <div className="h-2 w-48 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${percent(item.done, item.target)}%` }} /></div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {item.done} / {item.target} · {tHomework("due", { date: formatDay(item.dueOn) })}
                                            {item.studentId === null && <> · {tHomework("allStudents")}</>}
                                            {item.coachId !== coachId && item.coachName && <> · {tHomework("setBy", { name: item.coachName })}</>}
                                        </p>
                                        {item.note && <p className="text-sm italic text-gray-600 dark:text-gray-300">“{item.note}”</p>}
                                    </div>
                                    {item.coachId === coachId && <DeleteAssignmentButton id={item.id} />}
                                </div>
                            ))}
                        </div>
                        {pastHomework.length > 0 && (
                            <details className={`${card} p-4`}>
                                <summary className="font-bold cursor-pointer">{t("pastHomework", { count: pastHomework.length, done: pastHomework.filter(item => item.complete).length })}</summary>
                                <ul className="mt-3 space-y-1 text-sm">
                                    {pastHomework.map(item => (
                                        <li key={item.id} className={item.complete ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                                            {item.complete ? "✓" : "✗"} {homeworkText(item)} — {item.done}/{item.target} · {formatDay(item.dueOn)}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </div>
                    <StudentHomeworkPanel
                        studentId={student.id}
                        studentName={name}
                        suggestions={profile.suggestions}
                        practices={options.practices}
                        tags={options.tags}
                        defaultDueOn={addDays(profile.today, 7)}
                        minDueOn={profile.today}
                    />
                </div>
            </Section>

            {/* Levels */}
            <Section id="levels" title={t("section_levels")}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {[...CURRICULUM, KING_LEVEL].map(entry => {
                        const passed = level.passed.includes(entry.id) || (entry.id === KING_LEVEL.id && level.kingPasses > 0);
                        const current = level.currentId === entry.id;
                        const tests = profile.levelTests.filter(test => test.levelId === entry.id).length;
                        return (
                            <div key={entry.id} className={`rounded-xl border-2 px-3 py-2 text-sm ${passed ? "border-green-300 bg-green-50 dark:bg-green-900/30" : current ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30" : "border-gray-200 dark:border-gray-700"}`}>
                                <p className="font-bold">{passed ? "✓ " : ""}{levelName(entry.id)}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-300">{tLevels(`topic_${entry.id}`)}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {t("levelStats", { best: level.best[entry.id] ?? 0, count: TEST_PUZZLES, tests, practice: profile.levelPractice[entry.id] ?? 0 })}
                                </p>
                            </div>
                        );
                    })}
                </div>
                {profile.levelTests.length > 0 && (
                    <div className={`${card} overflow-x-auto`}>
                        <table className="min-w-full text-sm divide-y divide-gray-100 dark:divide-gray-700">
                            <thead><tr><th className={th}>{t("date")}</th><th className={th}>{t("level")}</th><th className={th}>{t("score")}</th><th className={th}>{t("result")}</th></tr></thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {profile.levelTests.map((test, index) => (
                                    <tr key={index}>
                                        <td className={td}>{formatAt(test.createdAt)}</td>
                                        <td className={td}>{levelName(test.levelId)}</td>
                                        <td className={td}>{test.score} / {TEST_PUZZLES}</td>
                                        <td className={td}>{test.passed ? <span className="text-green-700 dark:text-green-400">{t("testPassed")}</span> : <span className="text-gray-500">{t("testNotPassed", { need: TEST_PASS })}</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Section>

            {/* Openings */}
            <Section id="openings" title={t("section_openings")}>
                {profile.practices.length === 0 && <p className="text-gray-500">{t("noPractice")}</p>}
                <div className="space-y-3">
                    {profile.practices.map(practice => (
                        <details key={practice.id} className={`${card} p-4`}>
                            <summary className="cursor-pointer flex flex-wrap items-center justify-between gap-2">
                                <span className="font-bold text-lg">{practice.playerColor === "WHITE" ? "♔" : "♚"} {practice.name}</span>
                                <span className="text-sm text-gray-600 dark:text-gray-300">
                                    {t("practiceSummary", { seen: practice.seenLines, total: practice.totalLines, mastered: practice.masteredLines, due: practice.dueLines, attempts: practice.attempts, mistakes: practice.mistakes })}
                                    {practice.lastAttemptAt && <> · {formatAt(practice.lastAttemptAt)}</>}
                                </span>
                            </summary>
                            <div className="mt-3 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
                                <div className="bg-green-500" style={{ width: `${percent(practice.masteredLines, practice.totalLines)}%` }} />
                                <div className="bg-blue-400" style={{ width: `${percent(practice.seenLines - practice.masteredLines, practice.totalLines)}%` }} />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-sm">
                                <Link href={`/practices/${practice.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">{t("openPractice")}</Link>
                            </div>
                            <div className="mt-3 overflow-x-auto">
                                <table className="min-w-full text-sm divide-y divide-gray-100 dark:divide-gray-700">
                                    <thead>
                                        <tr>
                                            <th className={th}>#</th>
                                            <th className={th}>{t("lineMoves")}</th>
                                            <th className={th}>{t("lineAttempts")}</th>
                                            <th className={th}>{t("linePerfect")}</th>
                                            <th className={th}>{t("lineWithMistakes")}</th>
                                            <th className={th}>{t("lineMistakes")}</th>
                                            <th className={th}>{t("lineState")}</th>
                                            <th className={th}>{t("lineLast")}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {practice.lines.map(line => (
                                            <tr key={line.nodeId} className={line.withMistakes + line.mistakes > 0 && !line.mastered ? "bg-red-50/60 dark:bg-red-900/10" : ""}>
                                                <td className={td}>{line.lineNumber ?? "—"}</td>
                                                <td className="px-3 py-2 font-mono text-xs min-w-[16rem]">{line.moves}</td>
                                                <td className={`${td} text-center`}>{line.attempts}</td>
                                                <td className={`${td} text-center`}>{line.perfect}</td>
                                                <td className={`${td} text-center`}>{line.withMistakes}</td>
                                                <td className={`${td} text-center font-bold`}>{line.mistakes || (line.withMistakes ? "?" : 0)}</td>
                                                <td className={td}>
                                                    {line.mastered ? <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">{t("stateMastered")}</span>
                                                        : line.due ? <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">{t("stateDue")}</span>
                                                            : line.lastAttemptAt ? <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">{t("stateLearning", { level: line.reviewLevel })}</span>
                                                                : <span className="text-xs text-gray-400">{t("stateNew")}</span>}
                                                </td>
                                                <td className={`${td} text-xs text-gray-500 dark:text-gray-400`}>
                                                    {line.lastStatus && tCoach.has(`status${line.lastStatus}`) ? tCoach(`status${line.lastStatus}`) : ""} {formatAt(line.lastAttemptAt)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t("lineLegend")}</p>
                            </div>
                        </details>
                    ))}
                </div>
                {profile.openings.length > 0 && (
                    <div className={`${card} p-4 space-y-2`}>
                        <h3 className="font-bold">{t("openingCourses")}</h3>
                        <ul className="text-sm space-y-1">
                            {profile.openings.map(opening => (
                                <li key={opening.id}>
                                    <Link href={`/openings/${opening.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">{opening.name}</Link>
                                    {" — "}{t("openingViews", { count: opening.viewCount })}{opening.completed ? ` · ${t("openingCompleted")}` : ""} · {formatAt(opening.lastViewedAt)}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </Section>

            {/* Puzzles */}
            <Section id="puzzles" title={t("section_puzzles")}>
                <PuzzleDifficultySettings studentId={id} defaultOpen />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className={`${card} overflow-x-auto`}>
                        <h3 className="font-bold px-4 pt-4">{t("themesTitle")}</h3>
                        {profile.themes.length === 0 ? <p className="p-4 text-sm text-gray-500">{t("noData")}</p> : (
                            <table className="min-w-full text-sm divide-y divide-gray-100 dark:divide-gray-700">
                                <thead><tr><th className={th}>{t("theme")}</th><th className={th}>{t("tried")}</th><th className={th}>{t("solved")}</th><th className={th}>%</th></tr></thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {profile.themes.slice(0, 25).map(item => {
                                        const rate = percent(item.solved, item.tried);
                                        return (
                                            <tr key={item.tag}>
                                                <td className={td}>{theme(item.tag)}</td>
                                                <td className={td}>{item.tried}</td>
                                                <td className={td}>{item.solved}</td>
                                                <td className={`${td} font-bold ${item.tried >= 5 && rate < 60 ? "text-red-600 dark:text-red-400" : rate >= 80 ? "text-green-700 dark:text-green-400" : ""}`}>{rate}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div className={`${card} overflow-x-auto`}>
                        <h3 className="font-bold px-4 pt-4">{t("recentPuzzles")}</h3>
                        {profile.recentPuzzles.length === 0 ? <p className="p-4 text-sm text-gray-500">{t("noData")}</p> : (
                            <table className="min-w-full text-sm divide-y divide-gray-100 dark:divide-gray-700">
                                <thead><tr><th className={th}>{t("date")}</th><th className={th}>{t("puzzle")}</th><th className={th}>{t("result")}</th><th className={th}>±</th></tr></thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {profile.recentPuzzles.map((puzzle, index) => (
                                        <tr key={`${puzzle.id}-${index}`}>
                                            <td className={`${td} text-xs text-gray-500`}>{formatAt(puzzle.createdAt)}</td>
                                            <td className={td}>
                                                <Link href={`/puzzles/${puzzle.name}`} prefetch={false} className="text-blue-600 dark:text-blue-400 hover:underline">{puzzle.name}</Link>
                                                <span className="text-xs text-gray-500"> ({puzzle.rating})</span>
                                            </td>
                                            <td className={td}>{puzzle.success ? <CheckCircle className="h-4 w-4 text-green-600" aria-label={tCoach("solved")} /> : <XCircle className="h-4 w-4 text-red-600" aria-label={tCoach("failed")} />}</td>
                                            <td className={`${td} ${puzzle.points > 0 ? "text-green-700 dark:text-green-400" : puzzle.points < 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"}`}>{puzzle.points > 0 ? `+${puzzle.points}` : puzzle.points}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </Section>

            {/* Fun modes and games */}
            <Section id="fun" title={t("section_fun")}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className={`${card} overflow-x-auto`}>
                        <h3 className="font-bold px-4 pt-4">{t("funByKind")}</h3>
                        {profile.playKinds.length === 0 ? <p className="p-4 text-sm text-gray-500">{t("noData")}</p> : (
                            <table className="min-w-full text-sm divide-y divide-gray-100 dark:divide-gray-700">
                                <thead><tr><th className={th}>{t("activity")}</th><th className={th}>{t("times")}</th><th className={th}>{t("wins")}</th><th className={th}>{t("best")}</th><th className={th}>{t("lastTime")}</th></tr></thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {profile.playKinds.map(kind => (
                                        <tr key={kind.kind}>
                                            <td className={td}>{kindName(kind.kind)}</td>
                                            <td className={td}>{kind.count}</td>
                                            <td className={td}>{kind.wins}</td>
                                            <td className={td}>{kind.best}</td>
                                            <td className={`${td} text-xs text-gray-500`}>{formatAt(kind.last)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div className={`${card} overflow-x-auto`}>
                        <h3 className="font-bold px-4 pt-4">{t("lichessGames")}</h3>
                        {profile.games.length === 0 ? <p className="p-4 text-sm text-gray-500">{t("noData")}</p> : (
                            <table className="min-w-full text-sm divide-y divide-gray-100 dark:divide-gray-700">
                                <thead><tr><th className={th}>{t("date")}</th><th className={th}>{t("opponent")}</th><th className={th}>{t("result")}</th><th className={th}>{t("opening")}</th></tr></thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {profile.games.map(game => (
                                        <tr key={game.id}>
                                            <td className={`${td} text-xs text-gray-500`}>{formatAt(game.playedAt)}</td>
                                            <td className={td}><a href={`https://lichess.org/${game.lichessGameId}`} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{game.playerColor === "WHITE" ? "♔" : "♚"} {game.opponentName ?? "?"}</a></td>
                                            <td className={td}>{game.result ?? "—"}</td>
                                            <td className="px-3 py-2 text-xs">{game.openingName ?? "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </Section>

            {/* Timeline */}
            <Section id="timeline" title={t("section_timeline")}>
                <div className={`${card} p-4`}>
                    {profile.timeline.length === 0 ? <p className="text-sm text-gray-500">{t("noData")}</p> : (
                        <ol className="space-y-1 text-sm">
                            {profile.timeline.map((event, index) => (
                                <li key={index} className="flex gap-3">
                                    <span className="w-32 shrink-0 text-xs text-gray-500 dark:text-gray-400 pt-0.5">{formatAt(event.at)}</span>
                                    <span aria-hidden className="w-10 shrink-0">{timelineIcon(event)}</span>
                                    <span>{timelineText(event)}</span>
                                </li>
                            ))}
                        </ol>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{t("timelineLegend")}</p>
                </div>
            </Section>
        </main>
    );
}
