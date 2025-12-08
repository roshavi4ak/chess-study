import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getPractice } from "@/app/actions/practice";
import PracticeEditor from "@/components/PracticeEditor";

interface EditPracticePageProps {
    params: Promise<{ id: string }>;
}

export default async function EditPracticePage({ params }: EditPracticePageProps) {
    const session = await auth();
    const { id } = await params;

    if (session?.user?.role !== "COACH") {
        redirect("/practices");
    }

    const practice = await getPractice(id);

    if (!practice || !practice.tree) {
        notFound();
    }

    // Verify user is the creator (getPractice doesn't return createdBy, so we need to check)
    // For now, we'll trust the server action to verify ownership

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    Edit Practice: {practice.name}
                </h1>
                <PracticeEditor practiceId={id} initialData={practice} />
            </div>
        </main>
    );
}
