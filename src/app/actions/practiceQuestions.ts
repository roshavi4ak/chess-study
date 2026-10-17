"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface WhyQuestion {
    prompt: string;
    options: string[];
    answer: number;
    explanation: string | null;
}

// Questions for every line of a practice, keyed by the line's last node. Empty if the table does not exist yet.
export async function getPracticeQuestions(practiceId: string): Promise<Record<string, WhyQuestion>> {
    try {
        const rows = await prisma.practiceQuestion.findMany({ where: { node: { practiceId } } });
        return Object.fromEntries(rows.map(row => [row.nodeId, { prompt: row.prompt, options: row.options, answer: row.answer, explanation: row.explanation }]));
    } catch (error) {
        console.error("[PracticeQuestions] Could not load questions:", error);
        return {};
    }
}

async function requireCoach() {
    const session = await auth();
    if (session?.user?.role !== "COACH" || !session.user.id) throw new Error("Unauthorized");
    return session.user.id;
}

export async function savePracticeQuestion(nodeId: string, input: WhyQuestion) {
    const coachId = await requireCoach();
    const prompt = input.prompt.trim().slice(0, 200);
    const options = input.options.map(option => option.trim().slice(0, 120)).filter(Boolean);
    if (!prompt) throw new Error("Write a question");
    if (options.length < 2 || options.length > 4) throw new Error("Give 2 to 4 answers");
    if (!Number.isInteger(input.answer) || input.answer < 0 || input.answer >= options.length) throw new Error("Choose the right answer");
    const node = await prisma.practiceNode.findUnique({ where: { id: nodeId }, select: { practiceId: true, _count: { select: { children: true } } } });
    if (!node || node._count.children > 0) throw new Error("Questions belong to the last move of a line");
    const data = { prompt, options, answer: input.answer, explanation: input.explanation?.trim().slice(0, 300) || null, updatedBy: coachId };
    await prisma.practiceQuestion.upsert({ where: { nodeId }, update: data, create: { nodeId, ...data } });
    revalidatePath(`/[locale]/practices/${node.practiceId}`, "page");
}

export async function deletePracticeQuestion(nodeId: string) {
    await requireCoach();
    await prisma.practiceQuestion.deleteMany({ where: { nodeId } });
}
