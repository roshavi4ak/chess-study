"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createOpening(formData: FormData) {
    const session = await auth();

    if (session?.user?.role !== "COACH") {
        throw new Error("Unauthorized");
    }

    const name = formData.get("name") as string;
    const pgn = formData.get("pgn") as string;
    const description = formData.get("description") as string;

    if (!name || !pgn) {
        throw new Error("Missing fields");
    }

    await prisma.opening.create({
        data: {
            name,
            pgn,
            description,
            createdBy: session.user.id!,
        },
    });

    revalidatePath("/openings");
    redirect("/openings");
}
