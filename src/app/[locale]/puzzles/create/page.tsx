import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { createPuzzle } from "@/app/actions/puzzle";

export default async function CreatePuzzlePage() {
    const session = await auth();

    if (session?.user?.role !== "COACH") {
        redirect("/puzzles");
    }

    return (
        <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    Create Puzzle
                </h1>

                <form action={createPuzzle} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <div>
                        <label htmlFor="fen" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            FEN (Starting Position)
                        </label>
                        <input
                            type="text"
                            name="fen"
                            id="fen"
                            required
                            defaultValue="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border"
                        />
                    </div>

                    <div>
                        <label htmlFor="solution" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Solution (Space separated moves, e.g. "e4 e5 Nf3")
                        </label>
                        <input
                            type="text"
                            name="solution"
                            id="solution"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border"
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Description
                        </label>
                        <textarea
                            name="description"
                            id="description"
                            rows={3}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border"
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Save Puzzle
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}
