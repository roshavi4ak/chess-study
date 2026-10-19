"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { recordPlaySession } from "@/app/actions/play";

export default function TrainingResult({ activityKey, score, won, details }: { activityKey: string; score: number; won: boolean; details: Record<string, string | number | boolean | string[]> }) {
    const t = useTranslations("Training");
    const { data: session, status } = useSession();
    const [state, setState] = useState<"waiting" | "saving" | "saved" | "error">("waiting");
    const [retry, setRetry] = useState(0);
    const started = useRef(false);
    useEffect(() => {
        if (!session?.user?.id || started.current) return;
        started.current = true;
        void recordPlaySession({ kind: "MINIGAME", key: activityKey, score, won, details }).then(() => setState("saved")).catch(() => { started.current = false; setState("error"); });
    }, [session?.user?.id, activityKey, score, won, details, retry]);
    if (status === "unauthenticated") return <p className="text-sm">{t("signInSave")}</p>;
    return <div role="status" className="text-sm">{t(state === "saved" ? "saved" : state === "error" ? "saveError" : "saving")}{state === "error" && <button type="button" className="ml-2 underline" onClick={() => { setState("saving"); setRetry(value => value + 1); }}>{t("retrySave")}</button>}</div>;
}
