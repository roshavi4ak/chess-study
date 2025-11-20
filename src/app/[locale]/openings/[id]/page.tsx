import { prisma } from "@/lib/db";
import OpeningViewer from "@/components/OpeningViewer";
import { notFound } from "next/navigation";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function OpeningPage({ params }: PageProps) {
    const { id } = await params;
    const opening = await prisma.opening.findUnique({
        where: { id },
        include: { creator: true }
    });

    if (!opening) {
        notFound();
    }

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {opening.name}
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        {opening.description}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        Created by {opening.creator.name}
                    </p>
                </div>

                <div className="flex justify-center">
                    <OpeningViewer pgn={opening.pgn} />
                </div>
            </div>
        </main>
    );
}
