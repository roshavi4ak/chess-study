"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import PracticeCard from "@/components/PracticeCard";

// API function to fetch practices
async function fetchPractices(): Promise<any[]> {
    const response = await fetch("/api/practices", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch practices: ${response.status}`);
    }
    
    return response.json();
}

export default function PracticesPage() {
    const { data: session, status } = useSession();
    const openingsT = useTranslations("Openings");
    const commonT = useTranslations("Common");
    
    const [practices, setPractices] = useState<any[]>([]);
    const [error, setError] = useState<Error | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const fetchedPractices = await fetchPractices();
                setPractices(fetchedPractices);
            } catch (err) {
                console.error('[Practices] Error fetching practices:', err);
                setError(err as Error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const isCoach = session?.user?.role === "COACH";
    const userId = session?.user?.id;

    if (error) {
        return (
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                        <h2 className="font-bold text-xl mb-2">{commonT("errorLoading", { name: openingsT("practiceOpenings") })}</h2>
                        <p className="mb-2">{commonT("tryAgainLater", { name: openingsT("practiceOpenings").toLowerCase() })}</p>
                        <details className="mt-2">
                            <summary className="cursor-pointer font-semibold">{commonT("technicalDetails")}</summary>
                            <pre className="mt-2 text-xs overflow-auto bg-red-50 p-2 rounded">
                                {error.message}
                            </pre>
                        </details>
                    </div>
                </div>
            </main>
        );
    }

    // Loading state
    if (loading) {
        return (
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <div className="flex min-h-screen items-center justify-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {openingsT("practiceOpenings")}
                    </h1>
                    {isCoach && (
                        <Link
                            href="/practices/create"
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                        >
                            {openingsT("createPractice")}
                        </Link>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {practices.length === 0 ? (
                        <p className="text-gray-500">{openingsT("noPracticesFound")}</p>
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
            </div>
        </main>
    );
}
