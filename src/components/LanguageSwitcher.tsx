"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { ChangeEvent, useTransition } from "react";

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const onSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const nextLocale = e.target.value;
        startTransition(() => {
            // Replace the locale in the pathname
            // This is a simplified approach; for production, use next-intl's navigation APIs
            const newPath = pathname.replace(`/${locale}`, `/${nextLocale}`);
            router.replace(newPath);
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
