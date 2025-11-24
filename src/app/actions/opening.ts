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

    const stepsJson = formData.get("steps") as string;

    if (!name || !pgn) {
        throw new Error("Missing fields");
    }

    let steps = [];
    if (stepsJson) {
        try {
            steps = JSON.parse(stepsJson);
        } catch (e) {
            console.error("Failed to parse steps", e);
        }
    }

    await prisma.opening.create({
        data: {
            name,
            pgn,
            description,
            createdBy: session.user.id!,
            steps: {
                create: steps.map((step: any, index: number) => ({
                    fen: step.fen,
                    arrows: JSON.stringify(step.arrows),
                    description: step.description,
                    order: index,
                })),
            },
        },
    });

    revalidatePath("/openings");
    redirect("/openings");
}

export async function deleteOpening(openingId: string) {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    // Verify the user is the creator
    const opening = await prisma.opening.findUnique({
        where: { id: openingId },
        select: { createdBy: true }
    });

    if (!opening) {
        throw new Error("Opening not found");
    }

    if (opening.createdBy !== session.user.id) {
        throw new Error("Unauthorized - you can only delete your own openings");
    }

    // Delete the opening (steps will be cascade deleted)
    await prisma.opening.delete({
        where: { id: openingId }
    });

    revalidatePath("/openings");
}

export async function updateOpening(openingId: string, formData: FormData) {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    // Verify the user is the creator
    const opening = await prisma.opening.findUnique({
        where: { id: openingId },
        select: { createdBy: true }
    });

    if (!opening) {
        throw new Error("Opening not found");
    }

    if (opening.createdBy !== session.user.id) {
        throw new Error("Unauthorized - you can only edit your own openings");
    }

    const name = formData.get("name") as string;
    const pgn = formData.get("pgn") as string;
    const description = formData.get("description") as string;
    const stepsJson = formData.get("steps") as string;

    if (!name || !pgn) {
        throw new Error("Missing fields");
    }

    let steps = [];
    if (stepsJson) {
        try {
            steps = JSON.parse(stepsJson);
        } catch (e) {
            console.error("Failed to parse steps", e);
        }
    }

    // Delete existing steps and create new ones
    await prisma.opening.update({
        where: { id: openingId },
        data: {
            name,
            pgn,
            description,
            steps: {
                deleteMany: {},
                create: steps.map((step: any, index: number) => ({
                    fen: step.fen,
                    arrows: JSON.stringify(step.arrows),
                    description: step.description,
                    order: index,
                })),
            },
        },
    });

    revalidatePath("/openings");
    revalidatePath(`/openings/${openingId}`);
    redirect("/openings");
}
