import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PuzzleBuilder from "@/components/PuzzleBuilder";

export default async function CreatePuzzlePage() {
    const session = await auth();

    if (session?.user?.role !== "COACH") {
        redirect("/puzzles");
    }

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    Create Puzzle
                </h1>
                <PuzzleBuilder />
            </div>
        </main>
    );
}
