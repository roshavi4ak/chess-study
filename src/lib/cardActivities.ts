// Every playable activity outside opening drills, themed puzzles, bots and mini-game worlds.
export const CARD_ACTIVITIES = [
    { id: "puzzles", href: "/puzzles/play" },
    { id: "endgames", href: "/fun/endgames" },
    { id: "defense", href: "/fun/defense" },
    { id: "streak", href: "/fun/streak" },
    { id: "coordinates", href: "/fun/coordinates" },
    { id: "solo", href: "/fun/solo" },
    { id: "notation", href: "/fun/notation" },
    { id: "race", href: "/race#join" },
    { id: "duel", href: "/race#duel" },
    { id: "levels", href: "/levels" },
    { id: "teamwork", href: "/challenges" },
    { id: "freeplay", href: "/play" },
] as const;
export type CardActivityId = typeof CARD_ACTIVITIES[number]["id"];
