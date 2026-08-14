import { useEffect, useState } from "react";
import { Link } from "wouter";
import { format, isToday, isYesterday } from "date-fns";
import { ArrowUpRight, CheckCircle2, MessageCircle, Target, Activity as ActivityIcon } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

const BAR_WIDTH = 18;

function progressBar(progress: number) {
  const clamped = Math.max(0, Math.min(100, progress));
  const filled = Math.round((clamped / 100) * BAR_WIDTH);
  return `${"█".repeat(filled)}${"░".repeat(BAR_WIDTH - filled)}`;
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMMM d");
}

type Activity = {
  id: string;
  type: "check_in" | "goal_update" | "milestone_completed";
  title: string;
  description: string;
  goalId?: string | null;
  goalTitle?: string | null;
  progress?: number | null;
  date: string;
  createdAt: string;
};

function ActivityRow({ item }: { item: Activity }) {
  const Icon = item.type === "check_in"
    ? MessageCircle
    : item.type === "milestone_completed"
      ? CheckCircle2
      : Target;

  return (
    <div className="flex gap-4 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-white">
        <Icon className="h-4 w-4 text-[#374151]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111827]">{item.title}</p>
            {item.goalId ? (
              <Link href={`/goal/${item.goalId}`} className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[#6B7280] hover:text-[#111827]">
                {item.goalTitle ?? "Goal"}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
          <span className="text-[11px] text-[#9CA3AF]">{format(new Date(item.createdAt), "h:mm a")}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4B5563]">{item.description}</p>
        {typeof item.progress === "number" ? (
          <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-[#6B7280]">
            <span>{progressBar(item.progress)}</span>
            <span className="font-sans font-semibold">{item.progress}%</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [items, setItems] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch("/api/activity?limit=50")
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load activity");
        return response.json() as Promise<{ activities: Activity[] }>;
      })
      .then((result) => {
        if (active) setItems(result.activities ?? []);
      })
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const grouped = items.reduce<Record<string, Activity[]>>((groups, item) => {
    const label = dateLabel(item.createdAt);
    (groups[label] ??= []).push(item);
    return groups;
  }, {});

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">
            <ActivityIcon className="h-4 w-4" /> Activity
          </div>
          <h1 className="mt-2 font-serif text-[30px] font-semibold tracking-tight text-[#111827]">Your progress, in context.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B7280]">
            A simple history of your check-ins, goal updates, and completed milestones. Every item here comes from your saved GotThis activity.
          </p>
        </div>

        <div className="rounded-2xl border border-[#EBEBEB] bg-white px-5 sm:px-7">
          {isLoading ? (
            <div className="space-y-5 py-6">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-14 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#F3F4F6]">
                <Target className="h-5 w-5 text-[#6B7280]" />
              </div>
              <h2 className="mt-4 text-sm font-semibold text-[#111827]">No activity yet</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#6B7280]">
                Send a check-in through the dashboard or WhatsApp and your progress will appear here.
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([label, group]) => (
              <section key={label}>
                <div className="border-b border-[#F3F4F6] py-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
                  {label}
                </div>
                <div className="divide-y divide-[#F3F4F6]">
                  {group.map((item) => <ActivityRow key={item.id} item={item} />)}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
