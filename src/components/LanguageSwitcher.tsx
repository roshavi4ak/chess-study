"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { ChangeEvent, useTransition } from "react";

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const onSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const nextLocale = e.target.value as 'en' | 'bg';
        startTransition(() => {
            // Set a cookie to remember the user's locale preference
            // This cookie will be used by the middleware on subsequent requests
            document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;

            // Use next-intl's router to handle the locale change properly
            router.replace(pathname, {locale: nextLocale});
        });
    };

    return (
        <select
            defaultValue={locale}
            className="bg-transparent border border-gray-300 rounded px-2 py-1 text-sm"
            onChange={onSelectChange}
            disabled={isPending}
        >
            <option value="en">English</option>
            <option value="bg">Български</option>
        </select>
    );
}
