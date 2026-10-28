import type { TeamColor } from "@/lib/clubGoals";

export const TEAM_STYLE: Record<TeamColor, { dot: string; soft: string; bar: string; ring: string }> = {
    red: { dot: "🔴", soft: "bg-red-50 dark:bg-red-900/30", bar: "bg-red-500", ring: "ring-red-500" },
    blue: { dot: "🔵", soft: "bg-blue-50 dark:bg-blue-900/30", bar: "bg-blue-500", ring: "ring-blue-500" },
    green: { dot: "🟢", soft: "bg-green-50 dark:bg-green-900/30", bar: "bg-green-500", ring: "ring-green-500" },
    yellow: { dot: "🟡", soft: "bg-yellow-50 dark:bg-yellow-900/30", bar: "bg-yellow-400", ring: "ring-yellow-400" },
    purple: { dot: "🟣", soft: "bg-purple-50 dark:bg-purple-900/30", bar: "bg-purple-500", ring: "ring-purple-500" },
    orange: { dot: "🟠", soft: "bg-orange-50 dark:bg-orange-900/30", bar: "bg-orange-500", ring: "ring-orange-500" },
};

export const teamStyle = (color: string) => TEAM_STYLE[(color in TEAM_STYLE ? color : "blue") as TeamColor];
