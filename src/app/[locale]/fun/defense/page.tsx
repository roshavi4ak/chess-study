import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import DefenseTrainer from "@/components/DefenseTrainer";

export default async function DefensePage() {
    const t = await getTranslations("Defense");
    return <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5"><div className="flex flex-wrap justify-between gap-3"><h1 className="text-3xl font-bold">🔎 {t("title")}</h1><Link href="/fun" className="text-blue-600 dark:text-blue-400 underline">{t("back")}</Link></div><p>{t("intro")}</p><DefenseTrainer /></main>;
}
