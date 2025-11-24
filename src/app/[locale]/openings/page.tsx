import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import OpeningCard from "@/components/OpeningCard";

export default async function OpeningsPage() {
    const session = await auth();
    const t = await getTranslations("Navigation");

    const openings = await prisma.opening.findMany({
        orderBy: { createdAt: "desc" },
        include: { creator: true }
    });

    const isCoach = session?.user?.role === "COACH";
    const userId = session?.user?.id;

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
                            <OpeningCard
                                key={opening.id}
                                opening={opening}
                                isCreator={userId === opening.createdBy}
                            />
                        ))
                    )}
                </div>
            </div>
        </main>
    );
}

