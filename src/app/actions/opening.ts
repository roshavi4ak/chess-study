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
