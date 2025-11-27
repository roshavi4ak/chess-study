"use server";

import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
