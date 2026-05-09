import { createClient } from "@/lib/supabase/server";
import { getDueCount } from "@/lib/services/reviews";
import { getRecentTopics, getWeakestTopics } from "@/lib/services/topics";
import { DashboardStats } from "@/components/DashboardStats";

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date();

  const [dueCount, recentTopics, weakestTopics] = await Promise.all([
    getDueCount(supabase, now),
    getRecentTopics(supabase, 5),
    getWeakestTopics(supabase, 5),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <DashboardStats
        dueCount={dueCount}
        recentTopics={recentTopics}
        weakestTopics={weakestTopics}
        hasAnyTopics={recentTopics.length > 0}
      />
    </div>
  );
}
