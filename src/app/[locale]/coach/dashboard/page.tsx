import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, ExternalLink } from "lucide-react";

export default async function CoachDashboard() {
    console.log("[CoachDashboard] Page loading...");

    let session;
    let t: Awaited<ReturnType<typeof getTranslations<"CoachDashboard">>>;

    try {
        session = await auth();
        console.log("[CoachDashboard] Auth completed, user:", session?.user?.name, "role:", session?.user?.role);
    } catch (authError) {
        console.error("[CoachDashboard] Auth error:", authError);
        return (
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <h1 className="text-3xl font-bold text-red-600">Authentication Error</h1>
                    <p className="mt-4 text-gray-600">Failed to authenticate. Please try again.</p>
                    <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto">
                        {authError instanceof Error ? authError.message : String(authError)}
                    </pre>
                </div>
            </main>
        );
    }

    try {
        t = await getTranslations("CoachDashboard");
        console.log("[CoachDashboard] Translations loaded");
    } catch (translationError) {
        console.error("[CoachDashboard] Translation error:", translationError);
        return (
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <h1 className="text-3xl font-bold text-red-600">Translation Error</h1>
                    <p className="mt-4 text-gray-600">Failed to load translations.</p>
                    <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto">
                        {translationError instanceof Error ? translationError.message : String(translationError)}
                    </pre>
                </div>
            </main>
        );
    }

    if (!session || session.user?.role !== "COACH") {
        console.log("[CoachDashboard] Redirecting non-coach user to /dashboard");
        redirect("/dashboard");
    }

    let attempts: any[] = [];
    let practiceAttempts: any[] = [];
    let students: any[] = [];

    try {
        console.log("[CoachDashboard] Starting data fetch...");

        const results = await Promise.all([
            prisma.puzzleAttempt.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { name: true, image: true, ratingPuzzle: true } },
                    puzzle: { select: { name: true, rating: true } }
                },
                take: 100
            }),
            prisma.practiceAttempt.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { name: true, image: true } },
                    practice: { select: { name: true } }
                },
                take: 100
            }),
            prisma.user.findMany({
                where: { role: 'STUDENT' },
                include: {
                    _count: {
                        select: {
                            puzzleAttempts: true,
                            practiceAttempts: true,
                            openingProgress: true
                        }
                    }
                },
                orderBy: { name: 'asc' }
            })
        ]);

        attempts = results[0];
        practiceAttempts = results[1];
        students = results[2];

        console.log(`[CoachDashboard] Data fetched successfully: ${attempts.length} puzzle attempts, ${practiceAttempts.length} practice attempts, ${students.length} students`);
    } catch (dbError) {
        console.error("[CoachDashboard] Database error:", dbError);
        return (
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <h1 className="text-3xl font-bold text-red-600">Database Error</h1>
                    <p className="mt-4 text-gray-600">Failed to load data from the database.</p>
                    <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto">
                        {dbError instanceof Error ? dbError.message : String(dbError)}
                    </pre>
                </div>
            </main>
        );
    }

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0 space-y-12">
                <div className="flex justify-between items-center text-center sm:text-left">
                    <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {t("title")}
                    </h1>
                </div>

                {/* Student Overview Section */}
                <div className="bg-white dark:bg-gray-800 shadow-xl overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-700">
                    <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-700">
                        <h3 className="text-xl leading-6 font-bold text-white flex items-center gap-2">
                            <span className="p-1.5 bg-white/20 rounded-lg">📊</span>
                            {t("studentProgress")}
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50/50 dark:bg-gray-900/50">
                                <tr>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {t("student")}
                                    </th>
                                    <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {t("puzzlesSolved")}
                                    </th>
                                    <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {t("linesMastered")}
                                    </th>
                                    <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {t("openingsStudied")}
                                    </th>
                                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {t("rating")}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {students.map((student: any) => (
                                    <tr key={student.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {student.image ? (
                                                    <img className="h-9 w-9 rounded-full ring-2 ring-blue-500/20" src={student.image} alt="" />
                                                ) : (
                                                    <div className="h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold">
                                                        {student.name?.[0] || '?'}
                                                    </div>
                                                )}
                                                <div className="ml-3">
                                                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                                        {student.name || "Unknown"}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-700 dark:text-gray-300">
                                            {student._count?.puzzleAttempts || 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-700 dark:text-gray-300">
                                            {student._count?.practiceAttempts || 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-700 dark:text-gray-300">
                                            {student._count?.openingProgress || 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-700 dark:text-gray-300">
                                            {student.ratingPuzzle || 1200}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Puzzle History Section */}
                <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:px-6 bg-blue-50 dark:bg-gray-900/50">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                            {t("puzzleHistory")}
                        </h3>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700">
                        {attempts.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                                {t("noAttempts")}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-900/80">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                {t("student")}
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                {t("puzzle")}
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                                                {t("status")}
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                {t("date")}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {attempts.map((attempt: any) => (
                                            <tr key={attempt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        {attempt.user?.image && (
                                                            <div className="flex-shrink-0 h-10 w-10 mr-3">
                                                                <img className="h-10 w-10 rounded-full" src={attempt.user.image} alt="" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                                {attempt.user?.name || "Unknown"}
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                {t("rating")}: {attempt.user?.ratingPuzzle || 1200}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {attempt.puzzle ? (
                                                        <div className="flex flex-col">
                                                            <Link
                                                                href={`/puzzles/${attempt.puzzle.name}`}
                                                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                                            >
                                                                {attempt.puzzle.name}
                                                                <ExternalLink className="w-3 h-3" />
                                                            </Link>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                {t("rating")}: {attempt.puzzle.rating}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-gray-500">Unknown</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    {attempt.success ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            <CheckCircle className="w-3 h-3 mr-1" />
                                                            {t("solved")}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                            <XCircle className="w-3 h-3 mr-1" />
                                                            {t("failed")}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    {new Date(attempt.createdAt).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Practice History Section */}
                <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:px-6 bg-green-50 dark:bg-gray-900/50">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                            {t("practiceHistory")}
                        </h3>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700">
                        {practiceAttempts.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                                {t("noPracticeAttempts")}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-900/80">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                {t("student")}
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                {t("practice")}
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                                                {t("status")}
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                {t("date")}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {practiceAttempts.map((attempt: any) => (
                                            <tr key={attempt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        {attempt.user?.image && (
                                                            <div className="flex-shrink-0 h-10 w-10 mr-3">
                                                                <img className="h-10 w-10 rounded-full" src={attempt.user.image} alt="" />
                                                            </div>
                                                        )}
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {attempt.user?.name || "Unknown"}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                                                        {attempt.practice?.name || "Unknown"}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span className={cn(
                                                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                        attempt.status === "PERFECT" && "bg-green-100 text-green-800",
                                                        attempt.status === "COMPLETED" && "bg-blue-100 text-blue-800",
                                                        attempt.status === "PARTIAL" && "bg-yellow-100 text-yellow-800"
                                                    )}>
                                                        {attempt.status === "PERFECT" && <CheckCircle className="w-3 h-3 mr-1" />}
                                                        {t(`status${attempt.status}`)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    {new Date(attempt.createdAt).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
