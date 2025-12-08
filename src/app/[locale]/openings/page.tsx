import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import OpeningCard from "@/components/OpeningCard";
import PracticeCard from "@/components/PracticeCard";

export default async function OpeningsPage() {
    const session = await auth();
    const t = await getTranslations("Navigation");

    let openings: any[] = [];
    let practices: any[] = [];
    let error: Error | null = null;

    try {
        console.log('[Openings] Fetching openings...');
        openings = await prisma.opening.findMany({
            orderBy: { createdAt: "desc" },
            include: { creator: true }
        });
        console.log(`[Openings] Successfully fetched ${openings.length} openings`);

        // Also fetch practices
        practices = await prisma.practice.findMany({
            orderBy: { createdAt: "desc" },
            include: { creator: true }
        });
        console.log(`[Openings] Successfully fetched ${practices.length} practices`);
    } catch (err) {
        console.error('[Openings] Error fetching openings:', err);
        error = err as Error;
        // Return a user-friendly error page instead of crashing
    }

    const isCoach = session?.user?.role === "COACH";
    const userId = session?.user?.id;

    // If there's an error, show it to the user
    if (error) {
        return (
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                        <h2 className="font-bold text-xl mb-2">Error Loading Openings</h2>
                        <p className="mb-2">Unable to load openings. Please try again later.</p>
                        <details className="mt-2">
                            <summary className="cursor-pointer font-semibold">Technical Details</summary>
                            <pre className="mt-2 text-xs overflow-auto bg-red-50 p-2 rounded">
                                {error.message}
                            </pre>
                        </details>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0 space-y-12">
                {/* Opening Studies Section */}
                <section>
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {t("openings")}
                        </h1>
                        {isCoach && (
                            <Link
                                href="/openings/create"
                                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                            >
                                Create Opening
                            </Link>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {openings.length === 0 ? (
                            <p className="text-gray-500">No openings found.</p>
                        ) : (
                            openings.map((opening) => (
                                <OpeningCard
                                    key={opening.id}
                                    opening={opening}
                                    isCreator={userId === opening.createdBy}
                                />
                            ))
                        )}
                    </div>
                </section>

                {/* Practice Openings Section */}
                <section>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Practice Openings
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Interactive drills to master opening variations
                            </p>
                        </div>
                        {isCoach && (
                            <Link
                                href="/practices/create"
                                className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
                            >
                                Create Practice
                            </Link>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {practices.length === 0 ? (
                            <p className="text-gray-500">No practice openings available yet.</p>
                        ) : (
                            practices.map((practice) => (
                                <PracticeCard
                                    key={practice.id}
                                    practice={practice}
                                    isCreator={userId === practice.createdBy}
                                />
                            ))
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
