import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCompletedCountsByDay,
  getItemsInWindow,
} from "@/lib/services/reviews";
import {
  getRecentTopics,
  getTopicPriorities,
  getWeakestTopics,
} from "@/lib/services/topics";
import { getProfile } from "@/lib/services/profiles";
import {
  distributeAcrossDays,
  formatDateKey,
  startOfDayInTimezone,
  startOfLocalDay,
} from "@/lib/scheduler";
import { DashboardStats } from "@/components/DashboardStats";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  const dailyQuota = profile?.daily_quota ?? 10;
  const tz = profile?.timezone ?? "UTC";

  const startOfToday = startOfDayInTimezone(new Date(), tz);
  const todayKey = formatDateKey(startOfToday, tz);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const startOfTomorrow = startOfLocalDay(ty!, tm!, td! + 1, tz);

  const [eligible, completedMap, topicPriorities, recentTopics, weakestTopics] =
    await Promise.all([
      getItemsInWindow(supabase, new Date(0), startOfTomorrow),
      getCompletedCountsByDay(supabase, startOfToday, startOfTomorrow, tz),
      getTopicPriorities(supabase),
      getRecentTopics(supabase, 5),
      getWeakestTopics(supabase, 5),
    ]);

  const completedToday = completedMap.get(todayKey) ?? 0;
  const remainingQuota = Math.max(0, dailyQuota - completedToday);
  const [todayBucket] = distributeAcrossDays(
    eligible,
    startOfToday,
    1,
    { dailyQuotas: [remainingQuota], flashcardRatio: 0.5, topicPriorities },
    tz,
  );
  const dueToday = todayBucket?.items.length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <DashboardStats
        dueToday={dueToday}
        dailyQuota={dailyQuota}
        completedToday={completedToday}
        recentTopics={recentTopics}
        weakestTopics={weakestTopics}
        hasAnyTopics={recentTopics.length > 0}
      />
    </div>
  );
}
