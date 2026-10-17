"use client";

import { useTranslations } from "next-intl";
import type { Certificate } from "@/app/actions/certificates";
import { findCurriculumLevel, KING_LEVEL } from "@/lib/curriculum";

// The line "for …" on a certificate, in the viewer's language.
export function useCertificateTitle() {
    const t = useTranslations("Certificates");
    const tCategories = useTranslations("PuzzleCategories");
    const tBots = useTranslations("Bots");
    const tWorlds = useTranslations("MiniGames");
    const tLevels = useTranslations("Levels");
    return (certificate: Certificate) => {
        if (certificate.kind === "allBots") return t("forAllBots");
        if (certificate.kind === "world") return t("forWorld", { world: tWorlds(`${certificate.subject}Name`) });
        if (certificate.kind === "level") {
            const level = findCurriculumLevel(certificate.subject) ?? KING_LEVEL;
            return t("forLevel", { level: tLevels("levelName", { group: tLevels(`group_${level.group}`), number: level.number }) });
        }
        if (certificate.cardKind === "bot") return t("forBot", { name: tBots(`${certificate.subject}Name`) });
        if (certificate.cardKind === "theme") return t("forTheme", { theme: tCategories.has(certificate.subject) ? tCategories(certificate.subject) : certificate.subject });
        if (certificate.cardKind === "world") return t("forWorld", { world: tWorlds(`${certificate.subject}Name`) });
        if (certificate.cardKind === "tournament") return t("forTournaments");
        return t("forOpening", { name: certificate.subject });
    };
}
