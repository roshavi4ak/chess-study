"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export interface AvailableUser {
    id: string;
    name: string | null;
    image: string | null;
    lichessId: string | null;
}

export async function getAvailableUsers(): Promise<AvailableUser[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        const users = await prisma.user.findMany({
            where: {
                lichessId: {
                    not: null,
                    notIn: ["mi666ka", "petar1976"],
                },
                id: {
                    not: session.user.id,
                },
            },
            select: {
                id: true,
                name: true,
                image: true,
                lichessId: true,
            },
        });

        return users;
    } catch (error) {
        console.error("Error fetching available users:", error);
        return [];
    }
}

export async function updateUserName(name: string) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    if (!name || name.trim().length === 0) {
        throw new Error("Name is required");
    }

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                name: name.trim(),
                isNameSet: true,
            },
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating user name:", error);
        throw new Error("Failed to update name");
    }
}
