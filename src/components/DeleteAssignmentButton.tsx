"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteAssignment } from "@/app/actions/assignments";

export default function DeleteAssignmentButton({ id }: { id: string }) {
    const t = useTranslations("CoachHomework");
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    return (
        <button
            type="button"
            disabled={pending}
            onClick={() => {
                if (!confirm(t("confirmDelete"))) return;
                startTransition(async () => {
                    await deleteAssignment(id);
                    router.refresh();
                });
            }}
            className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
            aria-label={t("delete")}
        >
            <Trash2 className="h-4 w-4" />
        </button>
    );
}
