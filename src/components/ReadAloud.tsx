"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";

function subscribe(onChange: () => void) {
    window.speechSynthesis?.addEventListener("voiceschanged", onChange);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", onChange);
}
export default function ReadAloud({ text }: { text: string }) {
    const t = useTranslations("MicroLessons");
    const locale = useLocale();
    const [speaking, setSpeaking] = useState(false);
    const available = useSyncExternalStore(subscribe, () => typeof window !== "undefined" && !!window.speechSynthesis?.getVoices().some(voice => voice.lang.toLowerCase().startsWith(locale)), () => false);
    useEffect(() => () => { window.speechSynthesis?.cancel(); }, [text]);
    function speak() {
        window.speechSynthesis.cancel();
        if (speaking) { setSpeaking(false); return; }
        const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith(locale));
        if (!voice) return;
        const speech = new SpeechSynthesisUtterance(text);
        speech.voice = voice;
        speech.lang = voice.lang;
        speech.rate = 0.85;
        speech.onend = () => setSpeaking(false);
        speech.onerror = () => setSpeaking(false);
        setSpeaking(true);
        window.speechSynthesis.speak(speech);
    }
    return <button type="button" disabled={!available} onClick={speak} className="text-sm underline disabled:opacity-60" title={!available ? t("voiceUnavailable") : undefined}>{t(!available ? "voiceUnavailable" : speaking ? "stopAudio" : "listen")}</button>;
}
