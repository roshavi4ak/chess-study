"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLichessAnalysisUrl } from "@/lib/lichessAnalysis";

export default function LichessAnalysisLink({ fen, orientation = "white", onOpen }: {
    fen: string;
    orientation?: "white" | "black";
    onOpen?: () => void;
}) {
    const t = useTranslations("Common");
    return (
        <a
            href={getLichessAnalysisUrl(fen, orientation)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOpen}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 font-medium"
        >
            {t("openLichessAnalysis")}
            <ExternalLink size={16} aria-hidden="true" />
        </a>
    );
}
