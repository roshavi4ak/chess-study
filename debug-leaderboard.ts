import { prisma } from "./src/lib/db";
import { getLeaderboardData } from "./src/app/actions/leaderboard";

async function debug() {
    try {
        console.log("Fetching leaderboard data...");
        const data = await getLeaderboardData();
        console.log(`Successfully fetched ${data.length} entries.`);
        if (data.length > 0) {
            console.log("Sample entry:", JSON.stringify(data[0], null, 2));
        }
    } catch (error) {
        console.error("Error fetching leaderboard data:");
        console.error(error);
    }
}

debug();
