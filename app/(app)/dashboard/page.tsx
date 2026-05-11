import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCompletedCountsByDay,
  getItemsInWindow,
} from "@/lib/services/reviews";
import {
  computeTopicMasteryTree,
  getQuestionCountsByTopic,
  getRecentTopics,
  getTopicPriorities,
  getTopicTree,
  listTopics,
} from "@/lib/services/topics";
import {
  effectiveQuotaForDow,
  getProfile,
  getSkipDates,
  readWeeklySchedule,
} from "@/lib/services/profiles";
import {
  distributeAcrossDays,
  dowFromDateKey,
  formatDateKey,
  startOfDayInTimezone,
  startOfLocalDay,
} from "@/lib/scheduler";
import { DashboardStats } from "@/components/DashboardStats";
import { MasteryMap } from "@/components/MasteryMap";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  const dailyQuota = profile?.daily_quota ?? 10;
  const tz = profile?.timezone ?? "UTC";
  const weekly = readWeeklySchedule(profile);

  const startOfToday = startOfDayInTimezone(new Date(), tz);
  const todayKey = formatDateKey(startOfToday, tz);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const startOfTomorrow = startOfLocalDay(ty!, tm!, td! + 1, tz);

  const [
    eligible,
    completedMap,
    topicPriorities,
    recentTopics,
    masteryTree,
    tree,
    flatTopics,
    countsByTopic,
    skipDates,
  ] = await Promise.all([
    getItemsInWindow(supabase, new Date(0), startOfTomorrow),
    getCompletedCountsByDay(supabase, startOfToday, startOfTomorrow, tz),
    getTopicPriorities(supabase),
    getRecentTopics(supabase, 5),
    computeTopicMasteryTree(supabase),
    getTopicTree(supabase),
    listTopics(supabase),
    getQuestionCountsByTopic(supabase),
    getSkipDates(supabase, user.id),
  ]);

  const completedToday = completedMap.get(todayKey) ?? 0;
  const todayDow = dowFromDateKey(todayKey);
  const todayQuota = effectiveQuotaForDow(todayDow, weekly.quotas, dailyQuota);
  const remainingQuota = Math.max(0, todayQuota - completedToday);
  // Weekly-skipped today still goes through the scheduler with skipDates
  // populated, so the bucket comes back empty.
  const allSkipDates = weekly.skipDays.has(todayDow)
    ? new Set([...skipDates, todayKey])
    : skipDates;
  const [todayBucket] = distributeAcrossDays(
    eligible,
    startOfToday,
    1,
    {
      dailyQuotas: [remainingQuota],
      flashcardRatio: 0.5,
      topicPriorities,
      skipDates: allSkipDates,
    },
    tz,
  );
  const dueToday = todayBucket?.items.length ?? 0;

  const map =
    tree.length > 0 ? (
      <MasteryMap
        tree={tree}
        masteryMap={masteryTree.map}
        overallMastery={masteryTree.overall}
        countsByTopic={countsByTopic}
        flatTopics={flatTopics}
      />
    ) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <DashboardStats
        dueToday={dueToday}
        dailyQuota={todayQuota}
        completedToday={completedToday}
        recentTopics={recentTopics}
        hasAnyTopics={recentTopics.length > 0}
        overallMastery={masteryTree.overall}
        masteryMap={masteryTree.map}
        mapSlot={map}
      />
    </div>
  );
}
