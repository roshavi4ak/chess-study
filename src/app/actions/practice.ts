"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PlayerColor } from "@prisma/client";

// TypeScript interface for the tree node structure from the frontend
interface PracticeNodeInput {
    id: string;  // Temporary client-side ID
    fen: string;
    move: string | null;
    notes: string;
    lineNumber: number | null;  // For ordering lines in practice (only set on leaf nodes)
    children: PracticeNodeInput[];
}

export async function createPractice(formData: FormData) {
    const session = await auth();

    if (session?.user?.role !== "COACH") {
        throw new Error("Unauthorized");
    }

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const playerColor = formData.get("playerColor") as PlayerColor;
    const treeJson = formData.get("tree") as string;

    if (!name || !treeJson) {
        throw new Error("Missing required fields");
    }

    let tree: PracticeNodeInput;
    try {
        tree = JSON.parse(treeJson);
    } catch (e) {
        throw new Error("Invalid tree data");
    }

    // Create practice with nodes recursively
    const practice = await prisma.practice.create({
        data: {
            name,
            description,
            playerColor: playerColor || "WHITE",
            createdBy: session.user.id!,
        },
    });

    // Recursively create nodes
    async function createNodes(node: PracticeNodeInput, parentId: string | null, order: number) {
        const createdNode = await prisma.practiceNode.create({
            data: {
                practiceId: practice.id,
                parentId,
                fen: node.fen,
                move: node.move,
                notes: node.notes || null,
                order,
                lineNumber: node.lineNumber,
            },
        });

        // Create children
        for (let i = 0; i < node.children.length; i++) {
            await createNodes(node.children[i], createdNode.id, i);
        }
    }

    await createNodes(tree, null, 0);

    revalidatePath("/practices");
    redirect("/practices");
}

export async function updatePractice(practiceId: string, formData: FormData) {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    // Verify the user is the creator
    const practice = await prisma.practice.findUnique({
        where: { id: practiceId },
        select: { createdBy: true },
    });

    if (!practice) {
        throw new Error("Practice not found");
    }

    if (practice.createdBy !== session.user.id) {
        throw new Error("Unauthorized - you can only edit your own practices");
    }

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const playerColor = formData.get("playerColor") as PlayerColor;
    const treeJson = formData.get("tree") as string;

    if (!name || !treeJson) {
        throw new Error("Missing required fields");
    }

    let tree: PracticeNodeInput;
    try {
        tree = JSON.parse(treeJson);
    } catch (e) {
        throw new Error("Invalid tree data");
    }

    // Delete all existing nodes and create new ones
    await prisma.practiceNode.deleteMany({
        where: { practiceId },
    });

    // Update practice metadata
    await prisma.practice.update({
        where: { id: practiceId },
        data: {
            name,
            description,
            playerColor: playerColor || "WHITE",
        },
    });

    // Recursively create nodes
    async function createNodes(node: PracticeNodeInput, parentId: string | null, order: number) {
        const createdNode = await prisma.practiceNode.create({
            data: {
                practiceId,
                parentId,
                fen: node.fen,
                move: node.move,
                notes: node.notes || null,
                order,
                lineNumber: node.lineNumber,
            },
        });

        // Create children
        for (let i = 0; i < node.children.length; i++) {
            await createNodes(node.children[i], createdNode.id, i);
        }
    }

    await createNodes(tree, null, 0);

    revalidatePath("/practices");
    revalidatePath(`/practices/${practiceId}`);
    redirect("/practices");
}

export async function getPractices() {
    const practices = await prisma.practice.findMany({
        include: {
            creator: {
                select: { name: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return practices;
}

export async function getPractice(id: string) {
    const practice = await prisma.practice.findUnique({
        where: { id },
        include: {
            creator: {
                select: { name: true },
            },
            nodes: {
                orderBy: { order: "asc" },
            },
        },
    });

    if (!practice) {
        return null;
    }

    // Build tree structure from flat nodes
    const nodeMap = new Map<string, any>();
    let rootNode: any = null;

    // First pass: create map of all nodes
    for (const node of practice.nodes) {
        nodeMap.set(node.id, {
            id: node.id,
            fen: node.fen,
            move: node.move,
            notes: node.notes,
            lineNumber: node.lineNumber,
            children: [],
        });
    }

    // Second pass: link children to parents
    for (const node of practice.nodes) {
        const mappedNode = nodeMap.get(node.id)!;
        if (node.parentId) {
            const parent = nodeMap.get(node.parentId);
            if (parent) {
                parent.children.push(mappedNode);
            }
        } else {
            rootNode = mappedNode;
        }
    }

    return {
        id: practice.id,
        name: practice.name,
        description: practice.description,
        playerColor: practice.playerColor,
        creatorName: practice.creator?.name,
        tree: rootNode,
    };
}

export async function deletePractice(practiceId: string) {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const practice = await prisma.practice.findUnique({
        where: { id: practiceId },
        select: { createdBy: true },
    });

    if (!practice) {
        throw new Error("Practice not found");
    }

    if (practice.createdBy !== session.user.id) {
        throw new Error("Unauthorized - you can only delete your own practices");
    }

    await prisma.practice.delete({
        where: { id: practiceId },
    });

    revalidatePath("/practices");
}
