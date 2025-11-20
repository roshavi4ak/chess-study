import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { createOpening } from "@/app/actions/opening";

export default async function CreateOpeningPage() {
    const session = await auth();

    if (session?.user?.role !== "COACH") {
        redirect("/openings");
    }

    return (
        <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    Create Opening Study
                </h1>

                <form action={createOpening} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Opening Name
                        </label>
                        <input
                            type="text"
                            name="name"
                            id="name"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border"
                        />
                    </div>

                    <div>
                        <label htmlFor="pgn" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            PGN (Portable Game Notation)
                        </label>
                        <textarea
                            name="pgn"
                            id="pgn"
                            required
                            rows={5}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border"
                            placeholder="1. e4 e5 2. Nf3 Nc6..."
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Description / Notes
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
                            Save Opening
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}
