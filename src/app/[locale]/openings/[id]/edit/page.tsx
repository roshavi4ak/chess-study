import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import OpeningEditor from "@/components/OpeningEditor";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function EditOpeningPage({ params }: PageProps) {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
        redirect("/openings");
    }

    const opening = await prisma.opening.findUnique({
        where: { id },
        include: {
            steps: {
                orderBy: {
                    order: 'asc'
                }
            }
        }
    });

    if (!opening) {
        notFound();
    }

    // Only the creator can edit
    if (opening.createdBy !== session.user.id) {
        redirect("/openings");
    }

    // Transform the opening data to match the expected type
    const openingData = {
        id: opening.id,
        name: opening.name,
        description: opening.description,
        pgn: opening.pgn,
        steps: opening.steps.map(step => ({
            fen: step.fen,
            arrows: step.arrows || "[]", // Provide default empty array if null
            description: step.description,
            order: step.order
        }))
    };

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    Edit Opening Study
                </h1>
                <OpeningEditor opening={openingData} />
            </div>
        </main>
    );
}
