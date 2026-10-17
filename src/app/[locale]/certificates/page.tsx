"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getMyCertificates, type Certificate } from "@/app/actions/certificates";
import { useCertificateTitle } from "@/components/useCertificateTitle";

export default function CertificatesPage() {
    const t = useTranslations("Certificates");
    const title = useCertificateTitle();
    const [list, setList] = useState<Certificate[] | null>(null);

    useEffect(() => {
        getMyCertificates().then(result => setList(result?.list ?? [])).catch(() => setList([]));
    }, []);

    return (
        <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📜 {t("title")}</h1>
                <Link href="/fun" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("backToFun")}</Link>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{t("intro")}</p>
            {list === null && <div className="h-32 rounded-lg bg-white dark:bg-gray-800 shadow animate-pulse" />}
            {list?.length === 0 && <p className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">{t("none")}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {list?.map(certificate => (
                    <Link key={certificate.id} href={`/certificates/${encodeURIComponent(certificate.id)}`}
                        className="flex items-center justify-between gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-4 hover:shadow-md">
                        <span className="font-medium">📜 {title(certificate)}</span>
                        <Printer className="h-5 w-5 shrink-0 text-amber-700" />
                    </Link>
                ))}
            </div>
        </main>
    );
}
