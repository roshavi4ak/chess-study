import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getClubGoalForEdit, getTeamPlanningOptions } from "@/app/actions/clubGoals";
import ClubGoalForm from "@/components/ClubGoalForm";

export default async function EditClubGoalPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
    const { id, locale } = await params;
    const session = await auth();
    if (session?.user?.role !== "COACH") redirect(`/${locale}/dashboard`);
    const [goal, options, t] = await Promise.all([getClubGoalForEdit(id), getTeamPlanningOptions(), getTranslations("Teams")]);
    if (!goal) notFound();
    return <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t("editGoal")}</h1>
        <ClubGoalForm practices={options.practices} tags={options.tags} today={options.today} initialData={goal} />
    </main>;
}
