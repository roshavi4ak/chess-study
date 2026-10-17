"use client";

import { use, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getMyCertificates, type Certificate } from "@/app/actions/certificates";
import { useCertificateTitle } from "@/components/useCertificateTitle";

// A printable A4 certificate. The navbar and buttons are hidden when printing.
export default function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const t = useTranslations("Certificates");
    const locale = useLocale();
    const title = useCertificateTitle();
    const [data, setData] = useState<{ name: string | null; certificate: Certificate | null } | null>(null);
    const [today] = useState(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date()));

    useEffect(() => {
        getMyCertificates()
            .then(result => setData({ name: result?.name ?? null, certificate: result?.list.find(item => item.id === decodeURIComponent(id)) ?? null }))
            .catch(() => setData({ name: null, certificate: null }));
    }, [id]);

    if (!data) return <main className="max-w-3xl mx-auto p-6"><div className="h-96 rounded-lg bg-white shadow animate-pulse" /></main>;
    if (!data.certificate) {
        return <main className="max-w-3xl mx-auto p-6 space-y-3"><p>{t("notEarned")}</p><Link href="/certificates" className="text-blue-600 hover:underline">← {t("title")}</Link></main>;
    }

    return (
        <main className="max-w-4xl mx-auto py-6 px-4 print:p-0 print:max-w-none">
            <style>{`@media print { nav { display: none !important; } @page { size: A4 landscape; margin: 12mm; } body { background: white !important; } }`}</style>
            <div className="flex justify-between items-center mb-4 print:hidden">
                <Link href="/certificates" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("title")}</Link>
                <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-bold">
                    <Printer className="h-4 w-4" /> {t("print")}
                </button>
            </div>
            <div className="aspect-[297/210] w-full bg-white text-gray-900 border-[12px] border-double border-amber-500 rounded-xl p-[6%] flex flex-col items-center justify-center text-center gap-[3%] shadow-xl print:shadow-none">
                <p className="text-5xl" aria-hidden>♔ ♕ ♖</p>
                <h1 className="text-4xl sm:text-5xl font-black tracking-wide text-amber-700 uppercase">{t("heading")}</h1>
                <p className="text-lg sm:text-xl">{t("awardedTo")}</p>
                <p className="text-4xl sm:text-5xl font-black font-serif">{data.name ?? ""}</p>
                <p className="text-xl sm:text-2xl">{title(data.certificate)}</p>
                <div className="w-full flex justify-between items-end mt-[4%] text-base sm:text-lg">
                    <div className="text-left">
                        <p className="border-t border-gray-400 pt-1 px-6">{today}</p>
                        <p className="text-sm text-gray-500 px-6">{t("date")}</p>
                    </div>
                    <p className="text-5xl" aria-hidden>🏅</p>
                    <div className="text-right">
                        <p className="border-t border-gray-400 pt-1 px-6">&nbsp;</p>
                        <p className="text-sm text-gray-500 px-6">{t("coachSignature")}</p>
                    </div>
                </div>
            </div>
        </main>
    );
}
