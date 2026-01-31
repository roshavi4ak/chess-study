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

    // Fetch all existing nodes to compare with the new tree
    const existingNodes = await prisma.practiceNode.findMany({
        where: { practiceId },
    });

    // Create a map of existing nodes by FEN+move for matching
    // This allows us to identify nodes that represent the same position
    const existingNodeMap = new Map<string, typeof existingNodes[0]>();
    for (const node of existingNodes) {
        // Use combination of FEN and move as unique identifier
        const key = `${node.fen}|${node.move || 'root'}`;
        existingNodeMap.set(key, node);
    }

    // Track which existing nodes are still in use
    const usedExistingNodeIds = new Set<string>();
    // Track new nodes that need to be created
    const nodesToCreate: Array<{
        node: PracticeNodeInput;
        parentId: string | null;
        order: number;
        matchedExistingId?: string;
    }> = [];

    // First pass: match new tree nodes with existing nodes
    function matchNodes(node: PracticeNodeInput, parentId: string | null, order: number) {
        const key = `${node.fen}|${node.move || 'root'}`;
        const existingNode = existingNodeMap.get(key);

        if (existingNode && !usedExistingNodeIds.has(existingNode.id)) {
            // Found a matching existing node - preserve its ID
            usedExistingNodeIds.add(existingNode.id);
            nodesToCreate.push({
                node,
                parentId,
                order,
                matchedExistingId: existingNode.id,
            });
        } else {
            // No match found - this is a new node
            nodesToCreate.push({
                node,
                parentId,
                order,
            });
        }

        // Process children
        for (let i = 0; i < node.children.length; i++) {
            matchNodes(node.children[i], node.id, i);
        }
    }

    matchNodes(tree, null, 0);

    // Identify nodes to delete (existing nodes not in the new tree)
    const nodesToDelete = existingNodes.filter(n => !usedExistingNodeIds.has(n.id));

    // Delete nodes that are no longer in the tree
    // Delete in reverse depth order (children first) to avoid FK constraint issues
    if (nodesToDelete.length > 0) {
        // Sort by id length to delete children before parents (child IDs are often longer)
        // Or use a safer approach: delete all in one operation since we have onDelete: Cascade
        await prisma.practiceNode.deleteMany({
            where: {
                id: { in: nodesToDelete.map(n => n.id) },
            },
        });
    }

    // Update practice metadata
    await prisma.practice.update({
        where: { id: practiceId },
        data: {
            name,
            description,
            playerColor: playerColor || "WHITE",
        },
    });

    // Build a map of old parent IDs to new parent IDs for proper tree reconstruction
    const idMapping = new Map<string, string>(); // old temp id -> final db id

    // Process nodes in order (parents before children)
    // We need to process them level by level to ensure parent IDs are resolved
    const nodesByLevel: typeof nodesToCreate[] = [];
    
    function collectByLevel(node: PracticeNodeInput, level: number) {
        if (!nodesByLevel[level]) nodesByLevel[level] = [];
        const found = nodesToCreate.find(n => n.node === node);
        if (found) {
            nodesByLevel[level].push(found);
        }
        for (const child of node.children) {
            collectByLevel(child, level + 1);
        }
    }
    
    collectByLevel(tree, 0);

    // Process level by level
    for (const level of nodesByLevel) {
        if (!level) continue;
        
        for (const { node, order, matchedExistingId } of level) {
            // Resolve parent ID - it might be a mapped ID
            let resolvedParentId: string | null = null;
            
            // Find the parent in nodesToCreate
            const parentEntry = nodesToCreate.find(n => 
                n.node.children.includes(node)
            );
            
            if (parentEntry) {
                // Parent was processed in a previous level
                // Get the parent's assigned ID from the mapping
                const parentTempId = parentEntry.node.id;
                resolvedParentId = idMapping.get(parentTempId) || null;
            }

            if (matchedExistingId) {
                // Update existing node - preserve ID but update other fields
                await prisma.practiceNode.update({
                    where: { id: matchedExistingId },
                    data: {
                        parentId: resolvedParentId,
                        order,
                        notes: node.notes || null,
                        lineNumber: node.lineNumber,
                        // FEN and move should already match
                    },
                });
                idMapping.set(node.id, matchedExistingId);
            } else {
                // Create new node
                const createdNode = await prisma.practiceNode.create({
                    data: {
                        practiceId,
                        parentId: resolvedParentId,
                        fen: node.fen,
                        move: node.move,
                        notes: node.notes || null,
                        order,
                        lineNumber: node.lineNumber,
                    },
                });
                idMapping.set(node.id, createdNode.id);
            }
        }
    }

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
