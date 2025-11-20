import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function OpeningsPage() {
    const session = await auth();
    const t = await getTranslations("Navigation");

    const openings = await prisma.opening.findMany({
        orderBy: { createdAt: "desc" },
        include: { creator: true }
    });

    const isCoach = session?.user?.role === "COACH";

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
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
                            <Link
                                key={opening.id}
                                href={`/openings/${opening.id}`}
                                className="block bg-white dark:bg-gray-800 shadow rounded-lg hover:shadow-md transition"
                            >
                                <div className="p-4">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                                        {opening.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {opening.description || "No description"}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2">
                                        Created by {opening.creator.name}
                                    </p>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </main>
    );
}
