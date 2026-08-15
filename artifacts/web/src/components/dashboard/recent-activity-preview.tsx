import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowUpRight, CheckCircle2, MessageCircle, Target } from "lucide-react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";

const BAR_WIDTH = 14;

function progressBar(progress: number) {
  const clamped = Math.max(0, Math.min(100, progress));
  const filled = Math.round((clamped / 100) * BAR_WIDTH);
  return `${"█".repeat(filled)}${"░".repeat(BAR_WIDTH - filled)}`;
}

type Activity = {
  id: string;
  type: "check_in" | "goal_update" | "milestone_completed";
  title: string;
  description: string;
  goalId?: string | null;
  goalTitle?: string | null;
  progress?: number | null;
  createdAt: string;
};

function ActivityIcon({ type }: { type: Activity["type"] }) {
  const Icon = type === "check_in" ? MessageCircle : type === "milestone_completed" ? CheckCircle2 : Target;
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#FAFAFA]">
      <Icon className="h-3.5 w-3.5 text-[#4B5563]" />
    </div>
  );
}

export function RecentActivityPreview({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch("/api/activity?limit=8");
      if (!response.ok) throw new Error("Failed to load activity");
      const result = (await response.json()) as { activities?: Activity[] };
      setItems((result.activities ?? []).slice(0, 5));
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="rounded-2xl border border-[#EBEBEB] bg-white px-5 py-5 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#111827]">Recent activity</h2>
          <p className="mt-1 text-xs text-[#9CA3AF]">Your latest saved check-ins and goal updates.</p>
        </div>
        <Link href="/activity" className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#6B7280] hover:text-[#111827]">
          View all <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-5 space-y-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex animate-pulse gap-3">
              <div className="h-8 w-8 rounded-full bg-[#F3F4F6]" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 w-32 rounded bg-[#F3F4F6]" />
                <div className="h-3 w-3/4 rounded bg-[#F3F4F6]" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-5 rounded-xl bg-[#FAFAFA] px-4 py-6 text-center">
          <p className="text-sm font-medium text-[#374151]">No recent activity yet</p>
          <p className="mt-1 text-xs leading-5 text-[#9CA3AF]">Send a check-in through GotThis and your progress will show up here.</p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-[#F3F4F6]">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 py-3.5 first:pt-1 last:pb-0">
              <ActivityIcon type={item.type} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#111827]">{item.goalTitle || item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#6B7280]">{item.description}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-[#9CA3AF]">
                    {formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                </div>

                {typeof item.progress === "number" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#6B7280]">
                    <span className="font-mono tracking-tight">{progressBar(item.progress)}</span>
                    <span className="font-semibold text-[#374151]">{Math.round(item.progress)}%</span>
                    {item.goalId ? (
                      <Link href={`/goal/${item.goalId}`} className="ml-auto inline-flex items-center gap-1 font-semibold text-[#6B7280] hover:text-[#111827]">
                        Open goal <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </div>
                ) : item.goalId ? (
                  <Link href={`/goal/${item.goalId}`} className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#6B7280] hover:text-[#111827]">
                    Open goal <ArrowUpRight className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
