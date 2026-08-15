import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { format, isToday, isYesterday } from "date-fns";
import { Archive, ArrowUpRight, CheckCircle2, MessageCircle, PlusCircle, RotateCcw, Target, Trash2, Activity as ActivityIcon } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

const BAR_WIDTH = 18;
type ActivityType = "check_in" | "goal_update" | "goal_created" | "goal_completed" | "goal_archived" | "goal_deleted" | "milestone_completed" | "milestone_created" | "milestone_reopened" | "milestone_edited" | "milestone_deleted";
type Filter = "all" | "goals" | "checkins";

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
  type: ActivityType;
  eventType?: string;
  source?: string;
  title: string;
  description: string;
  goalId?: string | null;
  milestoneId?: string | null;
  goalTitle?: string | null;
  progress?: number | null;
  currentValue?: number | null;
  targetValue?: number | null;
  targetUnit?: string | null;
  date: string;
  createdAt: string;
};

function iconFor(item: Activity) {
  if (item.type === "check_in") return MessageCircle;
  if (item.type === "goal_created" || item.type === "milestone_created") return PlusCircle;
  if (item.type === "goal_completed" || item.type === "milestone_completed") return CheckCircle2;
  if (item.type === "goal_archived") return Archive;
  if (item.type === "goal_deleted" || item.type === "milestone_deleted") return Trash2;
  if (item.type === "milestone_reopened") return RotateCcw;
  return Target;
}

function sourceLabel(source?: string) {
  if (source === "whatsapp") return "WhatsApp";
  if (source === "dashboard") return "Dashboard";
  if (source === "legacy") return "Earlier activity";
  return null;
}

function ActivityRow({ item }: { item: Activity }) {
  const Icon = iconFor(item);
  const source = sourceLabel(item.source);
  return (
    <div className="flex gap-4 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-white">
        <Icon className="h-4 w-4 text-[#374151]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[#111827]">{item.title}</p>
              {source ? <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold text-[#6B7280]">{source}</span> : null}
            </div>
            {item.goalId ? (
              <Link href={`/goal/${item.goalId}`} className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[#6B7280] hover:text-[#111827]">
                {item.goalTitle ?? "Open goal"}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
          <span className="text-[11px] text-[#9CA3AF]">{format(new Date(item.createdAt), "h:mm a")}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4B5563]">{item.description}</p>
        {typeof item.progress === "number" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-[#6B7280]">
            <span aria-label={`${item.progress}% progress`}>{progressBar(item.progress)}</span>
            <span className="font-sans font-semibold">{item.progress}%</span>
            {typeof item.currentValue === "number" && typeof item.targetValue === "number" ? (
              <span className="font-sans">{item.currentValue}/{item.targetValue}{item.targetUnit ? ` ${item.targetUnit}` : ""}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [items, setItems] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let active = true;
    apiFetch("/api/activity?limit=50")
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load activity");
        return response.json() as Promise<{ activities: Activity[] }>;
      })
      .then((result) => { if (active) setItems(result.activities ?? []); })
      .catch(() => { if (active) setItems([]); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredItems = useMemo(() => {
    if (filter === "goals") return items.filter((item) => item.type !== "check_in");
    if (filter === "checkins") return items.filter((item) => item.type === "check_in");
    return items;
  }, [filter, items]);

  const grouped = filteredItems.reduce<Record<string, Activity[]>>((groups, item) => {
    const label = dateLabel(item.createdAt);
    (groups[label] ??= []).push(item);
    return groups;
  }, {});

  const todayCount = items.filter((item) => isToday(new Date(item.createdAt))).length;
  const goalUpdateCount = items.filter((item) => item.type !== "check_in").length;
  const checkInCount = items.filter((item) => item.type === "check_in").length;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]"><ActivityIcon className="h-4 w-4" /> Activity</div>
          <h1 className="mt-2 font-serif text-[30px] font-semibold tracking-tight text-[#111827]">Your progress, in context.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B7280]">A chronological record of check-ins, goals, milestones, and progress across GotThis and WhatsApp.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-4"><div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">Today</div><div className="mt-1 font-serif text-2xl font-bold text-[#111827]">{todayCount}</div></div>
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-4"><div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">Goal activity</div><div className="mt-1 font-serif text-2xl font-bold text-[#111827]">{goalUpdateCount}</div></div>
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-4"><div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">Check-ins</div><div className="mt-1 font-serif text-2xl font-bold text-[#111827]">{checkInCount}</div></div>
        </div>

        <div className="flex flex-wrap gap-2">
          {([["all", "All"], ["goals", "Goals & milestones"], ["checkins", "Check-ins"]] as Array<[Filter, string]>).map(([value, label]) => (
            <button key={value} onClick={() => setFilter(value)} className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors" style={{ borderColor: filter === value ? "#111827" : "#E5E7EB", background: filter === value ? "#111827" : "#FFFFFF", color: filter === value ? "#FFFFFF" : "#6B7280" }}>{label}</button>
          ))}
        </div>

        <div className="rounded-2xl border border-[#EBEBEB] bg-white px-5 sm:px-7">
          {isLoading ? (
            <div className="space-y-5 py-6"><Skeleton className="h-5 w-24" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
          ) : filteredItems.length === 0 ? (
            <div className="py-14 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#F3F4F6]"><Target className="h-5 w-5 text-[#6B7280]" /></div><h2 className="mt-4 text-sm font-semibold text-[#111827]">No activity here yet</h2><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#6B7280]">Create or update a goal, complete a milestone, or send a check-in and it will appear here.</p></div>
          ) : (
            Object.entries(grouped).map(([label, group]) => (
              <section key={label}><div className="border-b border-[#F3F4F6] py-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">{label}</div><div className="divide-y divide-[#F3F4F6]">{group.map((item) => <ActivityRow key={item.id} item={item} />)}</div></section>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
