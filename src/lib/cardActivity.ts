import { CARD_ACTIVITIES } from "./cardActivities";
import type { MasteryCard } from "./masteryCards";

export function getCardActivityHref(card: MasteryCard): string {
    switch (card.kind) {
        case "practice": return card.practiceId ? `/practices/${encodeURIComponent(card.practiceId)}` : "/practices";
        case "theme": return card.tag ? `/puzzles/play?tag=${encodeURIComponent(card.tag)}` : "/puzzles/play";
        case "bot": return card.tag ? `/play/bots?bot=${encodeURIComponent(card.tag)}` : "/play/bots";
        case "world": return card.tag ? `/games/${encodeURIComponent(card.tag)}` : "/games";
        case "tournament": return "/tournaments";
        case "activity": return CARD_ACTIVITIES.find(activity => activity.id === card.tag)?.href ?? "/fun";
    }
}
