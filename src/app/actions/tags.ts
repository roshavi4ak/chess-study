"use server";

import { prisma } from "@/lib/db";

export async function getAllTags() {
    const puzzles = await prisma.puzzle.findMany({
        select: { tags: true }
    });

    // Flatten all tags and count occurrences
    const tagCounts = new Map<string, number>();
    puzzles.forEach(puzzle => {
        puzzle.tags.forEach(tag => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
    });

    // Convert to array and sort
    const tagArray = Array.from(tagCounts.entries()).map(([tag, count]) => ({ tag, count }));

    // Sort by count (descending) for top 10, then alphabetically for the rest
    const top10 = tagArray.sort((a, b) => b.count - a.count).slice(0, 10);
    const rest = tagArray.slice(10).sort((a, b) => a.tag.localeCompare(b.tag));

    return [...top10, ...rest];
}
