"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createPuzzle(formData: FormData) {
    const session = await auth();

    if (session?.user?.role !== "COACH") {
        throw new Error("Unauthorized");
    }

    const fen = formData.get("fen") as string;
    const solution = formData.get("solution") as string;
    const description = formData.get("description") as string;

    if (!fen || !solution) {
        throw new Error("Missing fields");
    }

    await prisma.puzzle.create({
        data: {
            fen,
            solution,
            description,
            createdBy: session.user.id!,
        },
    });

    revalidatePath("/puzzles");
    redirect("/puzzles");
}
