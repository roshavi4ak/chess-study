import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getChallengeForEdit, getTeamPlanningOptions } from "@/app/actions/clubGoals";
import ChallengeForm from "@/components/ChallengeForm";

export default async function EditChallengePage({ params }: { params: Promise<{ id: string; locale: string }> }) {
    const { id, locale } = await params;
    const session = await auth();
    if (session?.user?.role !== "COACH") redirect(`/${locale}/dashboard`);
    const [challenge, options, t] = await Promise.all([getChallengeForEdit(id), getTeamPlanningOptions(), getTranslations("Teams")]);
    if (!challenge) notFound();
    return <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t("editChallenge")}</h1>
        <ChallengeForm students={options.students} practices={options.practices} tags={options.tags} today={options.today} savedTeams={options.savedTeams} initialData={challenge} />
    </main>;
}
