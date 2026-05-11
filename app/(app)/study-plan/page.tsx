import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, readWeeklySchedule } from "@/lib/services/profiles";
import { listTopics } from "@/lib/services/topics";
import { StudyPlanForm } from "@/components/StudyPlanForm";
import { TopicPriorityForm } from "@/components/TopicPriorityForm";

export default async function StudyPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile, topics] = await Promise.all([
    getProfile(supabase, user.id),
    listTopics(supabase),
  ]);
  const dailyQuota = profile?.daily_quota ?? 10;
  const weekly = readWeeklySchedule(profile);

  // Stable display order: by priority asc, then by title for ties.
  const sortedTopics = [...topics].sort(
    (a, b) => a.priority - b.priority || a.title.localeCompare(b.title),
  );

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Study plan settings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Control your daily goal and which topics get scheduled first.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Daily goal</h2>
        <StudyPlanForm
          dailyQuota={dailyQuota}
          weeklySkipDays={[...weekly.skipDays].sort((a, b) => a - b)}
          weeklyQuotas={weekly.quotas}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Topic priorities</h2>
        <TopicPriorityForm topics={sortedTopics} />
      </section>
    </div>
  );
}
