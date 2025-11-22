import { auth } from "@/auth";
import { redirect } from "next/navigation";
import OpeningBuilder from "@/components/OpeningBuilder";

export default async function CreateOpeningPage() {
    const session = await auth();

    if (session?.user?.role !== "COACH") {
        redirect("/openings");
    }

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    Create Opening Study
                </h1>
                <OpeningBuilder />
            </div>
        </main>
    );
}
