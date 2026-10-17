const TIME_ZONE = "Europe/Sofia";

const calendarFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
});

function calendarParts(date: Date) {
    const parts = calendarFormatter.formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find(part => part.type === type)!.value);

    return {
        year: value("year"), month: value("month"), day: value("day"),
        hour: value("hour"), minute: value("minute"), second: value("second"),
    };
}

// Monday midnight in Sofia, independent of the server's timezone.
function mondayMidnight(calendarDate: Date) {
    const parts = calendarParts(calendarDate);
    const localTime = Date.UTC(parts.year, parts.month - 1, parts.day,
        parts.hour, parts.minute, parts.second);
    const offset = localTime - calendarDate.getTime();
    return new Date(calendarDate.getTime() - offset);
}

function dateLabel(calendarDate: Date) {
    const day = String(calendarDate.getUTCDate()).padStart(2, "0");
    const month = String(calendarDate.getUTCMonth() + 1).padStart(2, "0");
    return `${day}.${month}.${calendarDate.getUTCFullYear()}`;
}

export function getLeaderboardWeek(now = new Date(), weeksAgo = 0) {
    const { year, month, day } = calendarParts(now);
    // UTC dates represent local calendar days here; convert each boundary separately
    // so weeks containing a daylight-saving change still end at Monday midnight.
    const monday = new Date(Date.UTC(year, month - 1, day));
    const daysSinceMonday = (monday.getUTCDay() + 6) % 7;
    monday.setUTCDate(monday.getUTCDate() - daysSinceMonday - weeksAgo * 7);
    const nextMonday = new Date(monday);
    nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
    const sunday = new Date(nextMonday);
    sunday.setUTCDate(sunday.getUTCDate() - 1);

    return {
        startDate: mondayMidnight(monday),
        endDate: mondayMidnight(nextMonday), // Exclusive boundary.
        dateRange: { start: dateLabel(monday), end: dateLabel(sunday) },
    };
}
