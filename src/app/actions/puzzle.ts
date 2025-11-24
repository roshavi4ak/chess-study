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
    const name = formData.get("name") as string;
    const rating = parseInt(formData.get("rating") as string) || 1200;
    const tags = (formData.get("tags") as string)?.split(",").filter(Boolean) || [];
    const hints = JSON.parse((formData.get("hints") as string) || "[]");

    if (!fen || !solution || !name) {
        throw new Error("Missing fields");
    }

    await prisma.puzzle.create({
        data: {
            fen,
            solution,
            description,
            name,
            rating,
            tags,
            hints,
            createdBy: session.user.id!,
        },
    });

    revalidatePath("/puzzles");
    redirect("/puzzles");
}

export async function updatePuzzle(id: string, formData: FormData) {
    const session = await auth();

    if (session?.user?.role !== "COACH") {
        throw new Error("Unauthorized");
    }

    const fen = formData.get("fen") as string;
    const solution = formData.get("solution") as string;
    const description = formData.get("description") as string;
    const name = formData.get("name") as string;
    const rating = parseInt(formData.get("rating") as string) || 1200;
    const tags = (formData.get("tags") as string)?.split(",").filter(Boolean) || [];
    const hints = JSON.parse((formData.get("hints") as string) || "[]");

    const puzzle = await prisma.puzzle.findUnique({ where: { id } });
    if (!puzzle || puzzle.createdBy !== session.user.id) {
        throw new Error("Unauthorized or not found");
    }

    await prisma.puzzle.update({
        where: { id },
        data: {
            fen,
            solution,
            description,
            name,
            rating,
            tags,
            hints,
        },
    });

    revalidatePath("/puzzles");
    revalidatePath(`/puzzles/${name}`);
    redirect("/puzzles");
}

export async function deletePuzzle(id: string) {
    const session = await auth();

    if (session?.user?.role !== "COACH") {
        throw new Error("Unauthorized");
    }

    const puzzle = await prisma.puzzle.findUnique({ where: { id } });
    if (!puzzle || puzzle.createdBy !== session.user.id) {
        throw new Error("Unauthorized or not found");
    }

    await prisma.puzzle.delete({ where: { id } });
    revalidatePath("/puzzles");
    redirect("/puzzles");
}
