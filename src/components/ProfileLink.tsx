"use client";

import { createContext, useContext } from "react";
import { Link } from "@/i18n/navigation";

// Coaches can open a child's profile from any name on the boards. Off by default, so children see plain names.
const ProfileLinksContext = createContext(false);

export const ProfileLinksProvider = ProfileLinksContext.Provider;

export default function ProfileLink({ id, children }: { id: string | undefined; children: React.ReactNode }) {
    const enabled = useContext(ProfileLinksContext);
    if (!enabled || !id) return <>{children}</>;
    return <Link href={`/coach/students/${id}`} prefetch={false} className="hover:underline hover:text-blue-600 dark:hover:text-blue-400">{children}</Link>;
}
