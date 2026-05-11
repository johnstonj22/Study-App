import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  distributeAcrossDays,
  dowFromDateKey,
  formatDateKey,
  orderForBonus,
  startOfDayInTimezone,
  startOfLocalDay,
} from "@/lib/scheduler";
import {
  getCompletedCountsByDay,
  getItemsInWindow,
} from "@/lib/services/reviews";
import {
  effectiveQuotaForDow,
  getProfile,
  getSkipDates,
  readWeeklySchedule,
} from "@/lib/services/profiles";
import {
  getAncestorChain,
  getTopicPriorities,
  listTopics,
} from "@/lib/services/topics";
import { ReviewQueue } from "@/components/ReviewQueue";

export default async function ReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  const dailyQuota = profile?.daily_quota ?? 10;
  const tz = profile?.timezone ?? "UTC";
  const weekly = readWeeklySchedule(profile);

  const now = new Date();
  const startOfToday = startOfDayInTimezone(now, tz);
  const todayKey = formatDateKey(startOfToday, tz);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const startOfTomorrow = startOfLocalDay(ty!, tm!, td! + 1, tz);

  // Use the same item window the calendar uses for today's cell, so the
  // review session and calendar stay consistent. This includes items due
  // later today (next_review_at after `now` but before tomorrow's local
  // midnight), which would otherwise be invisible to the review page until
  // their timestamp passed.
  const [eligible, completedMap, topicPriorities, allTopics, skipDates] =
    await Promise.all([
      getItemsInWindow(supabase, new Date(0), startOfTomorrow),
      getCompletedCountsByDay(supabase, startOfToday, startOfTomorrow, tz),
      getTopicPriorities(supabase),
      listTopics(supabase),
      getSkipDates(supabase, user.id),
    ]);

  // Pre-build "Root / Mid / Leaf" paths for every topic so the review card
  // can show context even when topics nest several levels deep.
  const topicsById = new Map(allTopics.map((t) => [t.id, t]));
  const topicPaths = new Map<string, string>();
  for (const t of allTopics) {
    topicPaths.set(
      t.id,
      getAncestorChain(t.id, topicsById)
        .map((a) => a.title)
        .join(" / "),
    );
  }

  const completedToday = completedMap.get(todayKey) ?? 0;
  const todayDow = dowFromDateKey(todayKey);
  const todayQuota = effectiveQuotaForDow(todayDow, weekly.quotas, dailyQuota);
  const remainingQuota = Math.max(0, todayQuota - completedToday);

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
  const goalItems = todayBucket?.items ?? [];
  const goalIds = new Set(goalItems.map((i) => i.id));
  const bonusItems = orderForBonus(
    eligible.filter((i) => !goalIds.has(i.id)),
    topicPriorities,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Review</h1>
        <Link
          href="/study-plan"
          className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
        >
          {todayQuota}/day · edit
        </Link>
      </div>

      {goalItems.length === 0 && bonusItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nothing is due right now.
          </p>
          <Link
            href="/topics"
            className="mt-3 inline-block text-sm font-medium underline"
          >
            Add more flashcards or questions
          </Link>
        </div>
      ) : (
        <ReviewQueue
          goalItems={goalItems}
          bonusItems={bonusItems}
          completedToday={completedToday}
          dailyQuota={todayQuota}
          topicPaths={topicPaths}
        />
      )}
    </div>
  );
}
