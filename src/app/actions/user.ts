"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { AVATARS } from "@/lib/avatars";

export async function updateAvatar(avatarFilename: string) {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
        throw new Error("Unauthorized");
    }

    if (!AVATARS.includes(avatarFilename) || avatarFilename.includes('/') || avatarFilename.includes('\\') || avatarFilename.includes('..')) {
        throw new Error("Invalid avatar filename");
    }

    const imagePath = `/img/avatars/${avatarFilename}`;

    await prisma.user.update({
        where: { id: session.user.id },
        data: { image: imagePath },
    });

    revalidatePath("/dashboard");
    revalidatePath("/leaderboard");
}
