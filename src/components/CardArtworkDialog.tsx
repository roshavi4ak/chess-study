"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const CONTROL_STYLE = "inline-flex h-11 min-w-11 items-center justify-center rounded-xl bg-white/10 px-3 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-35 disabled:hover:bg-white/10";

export default function CardArtworkDialog({ src, name, tier, monochrome, onClose }: {
    src: string;
    name: string;
    tier: string;
    monochrome: boolean;
    onClose: () => void;
}) {
    const t = useTranslations("Cards");
    const titleId = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [size, setSize] = useState(0);
    const changeZoom = (step: number) => setZoom(current => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + step)));

    useEffect(() => {
        const dialog = dialogRef.current!;
        const stage = stageRef.current!;
        const previousOverflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = "hidden";
        const handleKey = (event: KeyboardEvent) => {
            if (!dialog.open || event.ctrlKey || event.metaKey || event.altKey) return;
            if (["+", "=", "-", "0"].includes(event.key)) {
                event.preventDefault();
                setZoom(current => event.key === "0" ? MIN_ZOOM : Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + (event.key === "-" ? -ZOOM_STEP : ZOOM_STEP))));
            }
        };
        document.addEventListener("keydown", handleKey);
        const resize = new ResizeObserver(() => setSize(Math.max(1, Math.min(stage.clientWidth, stage.clientHeight) - 32)));
        resize.observe(stage);
        return () => {
            resize.disconnect();
            document.removeEventListener("keydown", handleKey);
            dialog.close();
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    useLayoutEffect(() => {
        const stage = stageRef.current;
        if (stage) stage.scrollTo({ left: (stage.scrollWidth - stage.clientWidth) / 2, top: (stage.scrollHeight - stage.clientHeight) / 2 });
    }, [zoom, size]);

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            onClose={() => { if (!dialogRef.current?.open) onClose(); }}
            className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-slate-950 p-0 text-slate-100 backdrop:bg-slate-950"
        >
            <div className="flex h-full min-h-0 flex-col">
                <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
                    <div className="min-w-0 flex-1">
                        <h2 id={titleId} className="truncate text-base font-bold sm:text-xl">{name}</h2>
                        <p className="text-xs text-slate-300">{tier}</p>
                    </div>
                    <button type="button" className={CONTROL_STYLE} aria-label={t("closeViewer")} onClick={() => dialogRef.current?.close()} autoFocus>
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </header>
                <div ref={stageRef} className="min-h-0 flex-1 overflow-auto overscroll-contain" tabIndex={0} aria-label={t("artworkArea")}>
                    <div className="flex min-h-full min-w-full items-center justify-center p-4" style={{ width: size * zoom + 32, height: size * zoom + 32 }}>
                        <Image
                            src={src}
                            alt={name}
                            width={1280}
                            height={1280}
                            unoptimized
                            draggable={false}
                            className={`block max-w-none shrink-0 rounded-xl ${monochrome ? "grayscale" : ""}`}
                            style={{ width: size * zoom, height: size * zoom }}
                        />
                    </div>
                </div>
                <footer className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <button type="button" className={CONTROL_STYLE} aria-label={t("zoomOut")} disabled={zoom === MIN_ZOOM} onClick={() => changeZoom(-ZOOM_STEP)}>
                        <ZoomOut className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <output className="w-14 text-center text-sm tabular-nums" aria-live="polite" aria-label={t("zoomLevel")}>{Math.round(zoom * 100)}%</output>
                    <button type="button" className={CONTROL_STYLE} aria-label={t("zoomIn")} disabled={zoom === MAX_ZOOM} onClick={() => changeZoom(ZOOM_STEP)}>
                        <ZoomIn className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button type="button" className={CONTROL_STYLE} onClick={() => setZoom(MIN_ZOOM)}>
                        <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />{t("resetZoom")}
                    </button>
                </footer>
            </div>
        </dialog>
    );
}
