import { useState, useCallback, useRef, useEffect } from "react";
import { useGetDashboardStats, useListGoals } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { Link } from "wouter";
import { format, subDays, formatDistanceToNowStrict } from "date-fns";
import { ArrowUpRight, CheckCircle2, MessageCircle, Send, Sparkles, Target } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const MAX_DASHBOARD_MESSAGE_LENGTH = 1000;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { data: stats, isLoading, refetch: refetchStats } = useGetDashboardStats();
  const { refetch: refetchGoals } = useListGoals();
  const { toast } = useToast();

  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [aiReply, setAiReply] = useState("");
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [goalsUpdated, setGoalsUpdated] = useState(0);
  const [upgradePrompt, setUpgradePrompt] = useState<{
    message: string;
    checkoutPath: string;
  } | null>(null);
  const loadedAt = useRef(new Date());
  const [, setTick] = useState(0);

  // Re-render every 30 s so "Updated · X ago" stays live.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const handleSend = useCallback(async () => {
    const content = message.trim();
    if (!content) {
      toast({ title: "Write something first", variant: "destructive" });
      return;
    }

    if (content.length > MAX_DASHBOARD_MESSAGE_LENGTH) {
      toast({
        title: "Message is too long",
        description: `Please keep your message under ${MAX_DASHBOARD_MESSAGE_LENGTH.toLocaleString()} characters.`,
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    setUpgradePrompt(null);
    try {
      const response = await apiFetch("/api/ai/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      if (response.status === 402) {
        const body = await response.json().catch(() => null) as {
          error?: string; message?: string; checkoutPath?: string;
        } | null;
        setUpgradePrompt({
          message: body?.message ?? body?.error ?? "You've reached your plan limit.",
          checkoutPath: body?.checkoutPath ?? "/account#billing",
        });
        return;
      }
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Failed to send update");
      }
      const result = (await response.json()) as {
        reply?: string;
        intent?: string;
        updatedGoals?: number;
      };
      setAiReply(result.reply || "");
      setLastSentAt(new Date());
      setGoalsUpdated(result.updatedGoals ?? (result.intent === "goal_update" ? 1 : 0));
      setMessage("");
      await Promise.all([refetchStats(), refetchGoals()]);
      loadedAt.current = new Date();
    } catch {
      toast({ title: "Could not send update", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  }, [message, toast, refetchStats, refetchGoals]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // 7-day chart data — count logs per day.
  const weeklyChartData = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dateStr = format(d, "yyyy-MM-dd");
    const count = stats?.recentLogs.filter((log) => log.logDate === dateStr).length ?? 0;
    return {
      day: format(d, "EEEEE"),
      date: dateStr,
      count: count === 0 ? 0.08 : count,
      isToday: i === 6,
      isEmpty: count === 0,
    };
  });

  const updatedAgo = formatDistanceToNowStrict(loadedAt.current, { addSuffix: false })
    .replace(" minutes", " min")
    .replace(" minute", " min")
    .replace(" seconds", " sec")
    .replace(" second", " sec")
    .replace(" hours", " hr")
    .replace(" hour", " hr");

  const topGoal = stats?.topGoals?.[0];
  const totalActiveGoals = stats?.activeGoals ?? 0;
  const visibleGoals = stats?.topGoals ?? [];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-end justify-between">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-52 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header: orient the user around today, not just the date. */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              className="text-[30px] font-serif font-semibold tracking-tight"
              style={{ color: "#111827", lineHeight: 1.15 }}
              data-testid="heading-dashboard"
            >
              {getGreeting()} 👋
            </h1>
            <p style={{ marginTop: 6, fontSize: 14, color: "#6B7280" }}>
              {format(new Date(), "EEEE, MMMM d")} · Keep moving what matters forward.
            </p>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "#9CA3AF",
              textTransform: "uppercase",
            }}
          >
            Updated · {updatedAgo} ago
          </span>
        </div>

        {/* AI focus card: the dashboard's primary action. */}
        <div
          style={{
            background: "linear-gradient(135deg, #111827 0%, #1F2937 100%)",
            borderRadius: 18,
            padding: "24px",
            color: "#FFFFFF",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: "50%",
              right: -70,
              top: -90,
              background: "rgba(255,255,255,0.05)",
            }}
          />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between" style={{ position: "relative" }}>
            <div style={{ maxWidth: 620 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                <Sparkles style={{ width: 16, height: 16, color: "#86EFAC" }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A7F3D0" }}>
                  GotThis focus
                </span>
              </div>
              <h2 style={{ fontSize: 21, fontWeight: 650, letterSpacing: "-0.01em" }}>
                {topGoal ? "Keep your momentum going." : "What do you want to accomplish?"}
              </h2>
              <p style={{ marginTop: 7, fontSize: 14, lineHeight: 1.55, color: "#D1D5DB" }}>
                {topGoal
                  ? `Your dashboard is ready to help you keep moving on “${topGoal.title}”.`
                  : "Tell GotThis what you're working on and we'll help turn it into progress."}
              </p>
              {topGoal && (
                <div style={{ marginTop: 16, maxWidth: 430 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 7 }}>
                    <span style={{ fontSize: 12, color: "#D1D5DB" }}>Current progress</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}>{topGoal.progress}%</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, topGoal.progress))}%`, height: "100%", background: "#4ADE80", borderRadius: 99 }} />
                  </div>
                </div>
              )}
            </div>
            {topGoal ? (
              <Link href={`/goal/${topGoal.id}`}>
                <button
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 9,
                    padding: "9px 14px",
                    background: "#FFFFFF",
                    color: "#111827",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Continue <ArrowUpRight style={{ width: 14, height: 14 }} />
                </button>
              </Link>
            ) : (
              <Link href="/goals">
                <button
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 9,
                    padding: "9px 14px",
                    background: "#FFFFFF",
                    color: "#111827",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Create a goal <ArrowUpRight style={{ width: 14, height: 14 }} />
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* AI command center. */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #EBEBEB",
            borderRadius: 16,
            padding: "20px 24px",
            position: "relative",
          }}
        >
          <div className="flex items-center justify-between gap-3" style={{ marginBottom: 10 }}>
            <div>
              <div className="flex items-center gap-2">
                <MessageCircle style={{ width: 16, height: 16, color: "#374151" }} />
                <span style={{ fontSize: 14, fontWeight: 650, color: "#111827" }}>Ask GotThis</span>
              </div>
              <p style={{ marginTop: 4, fontSize: 12, color: "#9CA3AF" }}>
                Share an update, ask about your goals, or tell GotThis what you want to do next.
              </p>
            </div>
            <span style={{ fontSize: 11, color: message.length > 900 ? "#D97706" : "#9CA3AF", whiteSpace: "nowrap" }}>
              {message.length.toLocaleString()} / {MAX_DASHBOARD_MESSAGE_LENGTH.toLocaleString()}
            </span>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_DASHBOARD_MESSAGE_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder={`Try “What should I focus on?” or “I finished my first draft.”`}
            data-testid="textarea-dashboard-update"
            rows={3}
            style={{
              width: "100%",
              border: "1px solid #E5E7EB",
              borderRadius: 11,
              outline: "none",
              resize: "vertical",
              minHeight: 92,
              background: "#FAFAFA",
              fontSize: 14,
              lineHeight: 1.6,
              color: "#111827",
              fontFamily: "inherit",
              padding: "12px 14px",
            }}
            className="placeholder:text-[#9CA3AF] dark:text-foreground"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ marginTop: 10 }}>
            <div className="flex items-center gap-1.5">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                {lastSentAt ? `Sent · ${format(lastSentAt, "h:mm a")}` : "Press ⌘↵ or Ctrl↵ to send"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {goalsUpdated > 0 && lastSentAt && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#16A34A",
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    borderRadius: 99,
                    padding: "3px 10px",
                  }}
                >
                  {goalsUpdated} goal{goalsUpdated !== 1 ? "s" : ""} updated
                </span>
              )}
              <button
                onClick={handleSend}
                disabled={isSending || !message.trim()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  fontWeight: 700,
                  color: isSending || !message.trim() ? "#9CA3AF" : "#FFFFFF",
                  background: isSending || !message.trim() ? "#F3F4F6" : "#111827",
                  border: "1px solid #E5E7EB",
                  borderRadius: 9,
                  padding: "8px 15px",
                  cursor: isSending || !message.trim() ? "default" : "pointer",
                }}
              >
                <Send style={{ width: 13, height: 13 }} />
                {isSending ? "Sending…" : "Ask GotThis"}
              </button>
            </div>
          </div>

          {aiReply && (
            <div
              style={{
                marginTop: 12,
                background: "#F9FAFB",
                borderRadius: 10,
                border: "1px solid #EBEBEB",
                padding: "12px 16px",
                fontSize: 13,
                lineHeight: 1.6,
                color: "#374151",
                whiteSpace: "pre-wrap",
              }}
            >
              {aiReply}
            </div>
          )}

          {upgradePrompt && (
            <div
              style={{
                marginTop: 12,
                background: "#FFFBEB",
                borderRadius: 10,
                border: "1px solid #FCD34D",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 13, color: "#92400E", lineHeight: 1.5 }}>
                {upgradePrompt.message}
              </span>
              <Link
                href={upgradePrompt.checkoutPath}
                style={{
                  flexShrink: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  background: "#D97706",
                  borderRadius: 8,
                  padding: "5px 14px",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Upgrade
              </Link>
            </div>
          )}
        </div>

        {/* Quick status cards. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div style={{ background: "#FFFFFF", border: "1px solid #EBEBEB", borderRadius: 14, padding: "16px 18px" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 7 }}>
              <Target style={{ width: 15, height: 15, color: "#6B7280" }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#9CA3AF", textTransform: "uppercase" }}>Active goals</span>
            </div>
            <div style={{ fontSize: 25, fontWeight: 700, color: "#111827", fontFamily: "var(--font-serif, Georgia, serif)" }}>{totalActiveGoals}</div>
            <p style={{ marginTop: 3, fontSize: 12, color: "#9CA3AF" }}>Keep your attention on the goals that matter most.</p>
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid #EBEBEB", borderRadius: 14, padding: "16px 18px" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 7 }}>
              <CheckCircle2 style={{ width: 15, height: 15, color: "#16A34A" }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#9CA3AF", textTransform: "uppercase" }}>Weekly completion</span>
            </div>
            <div style={{ fontSize: 25, fontWeight: 700, color: "#111827", fontFamily: "var(--font-serif, Georgia, serif)" }}>{Math.round(stats?.weeklyCompletionRate ?? 0)}%</div>
            <p style={{ marginTop: 3, fontSize: 12, color: "#9CA3AF" }}>Your recent activity, at a glance.</p>
          </div>
        </div>

        {/* Goals first: this is the user's actionable work. */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #EBEBEB",
            borderRadius: 16,
            padding: "20px 24px",
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <span style={{ fontSize: 14, fontWeight: 650, color: "#111827" }}>Your goals</span>
              <p style={{ marginTop: 3, fontSize: 12, color: "#9CA3AF" }}>A quick view of what you're working toward.</p>
            </div>
            <Link href="/goals">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#6B7280" }}>
                All goals <ArrowUpRight style={{ width: 12, height: 12 }} />
              </span>
            </Link>
          </div>

          {visibleGoals.length > 0 ? (
            <div className="space-y-5">
              {visibleGoals.map((goal) => (
                <Link key={goal.id} href={`/goal/${goal.id}`}>
                  <div className="cursor-pointer" data-testid={`card-top-goal-${goal.id}`}>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{goal.title}</div>
                        <div style={{ marginTop: 3, fontSize: 11, color: "#9CA3AF" }}>View goal and milestones</div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", minWidth: 38, textAlign: "right" }}>{goal.progress}%</span>
                    </div>
                    <div style={{ width: "100%", height: 6, background: "#F3F4F6", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%`, height: "100%", background: goal.progress >= 100 ? "#22C55E" : "#111827", borderRadius: 99, transition: "width 0.4s ease" }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center" style={{ background: "#FAFAFA", borderRadius: 12 }}>
              <Target style={{ width: 20, height: 20, color: "#9CA3AF", marginBottom: 8 }} />
              <p style={{ fontSize: 13, color: "#6B7280" }}>No active goals yet.</p>
              <Link href="/goals">
                <button style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: "#FFFFFF", background: "#111827", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>
                  Create a goal
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* Analytics comes after the work, so it informs rather than distracts. */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #EBEBEB",
            borderRadius: 16,
            padding: "20px 24px 16px",
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <span style={{ fontSize: 14, fontWeight: 650, color: "#111827" }}>Weekly activity</span>
              <p style={{ marginTop: 3, fontSize: 12, color: "#9CA3AF" }}>Your check-ins and updates over the last 7 days.</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#9CA3AF", textTransform: "uppercase" }}>
              Last 7 days
            </span>
          </div>

          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="28%">
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF", fontWeight: 500 }} dy={6} />
                <Tooltip
                  cursor={false}
                  contentStyle={{ background: "#111827", border: "none", borderRadius: 8, fontSize: 12, color: "#F9FAFB", padding: "6px 12px" }}
                  labelStyle={{ color: "#9CA3AF", fontSize: 11 }}
                  formatter={(value: number, _: string, payload: { payload?: { isEmpty?: boolean } }) => [
                    payload.payload?.isEmpty ? "No entry" : `${Math.round(value)} log${value !== 1 ? "s" : ""}`,
                    "",
                  ]}
                />
                <Bar dataKey="count" radius={[4, 4, 2, 2]} maxBarSize={40}>
                  {weeklyChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isEmpty ? "#F3F4F6" : entry.isToday ? "#22C55E" : "#1C1C1E"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* WhatsApp is now a convenience CTA rather than an onboarding block. */}
        <a
          href="https://wa.me/message/XJSBCCYJ5KCPH1"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: 14,
            padding: "14px 16px",
            color: "#166534",
            textDecoration: "none",
          }}
          data-testid="link-connect-whatsapp"
        >
          <div className="flex items-center gap-3">
            <MessageCircle style={{ width: 20, height: 20, color: "#16A34A" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Prefer WhatsApp?</div>
              <div style={{ marginTop: 2, fontSize: 11, color: "#4B7A5A" }}>Message GotThis and keep your progress moving from your phone.</div>
            </div>
          </div>
          <ArrowUpRight style={{ width: 16, height: 16, flexShrink: 0 }} />
        </a>

        {/* Secondary stats stay available without competing with today's work. */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Active goals", value: stats.activeGoals.toString(), testId: "stat-active-goals" },
              { label: "Current streak", value: `${stats.currentStreak}d`, testId: "stat-current-streak" },
              { label: "Completion rate", value: `${Math.round(stats.weeklyCompletionRate)}%`, testId: "stat-completion-rate" },
              { label: "Total logs", value: stats.totalLogs.toString(), testId: "stat-total-logs" },
            ].map((s) => (
              <div key={s.testId} style={{ background: "#FFFFFF", border: "1px solid #EBEBEB", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                <div data-testid={s.testId} style={{ fontSize: 20, fontWeight: 700, color: "#111827", fontFamily: "var(--font-serif, Georgia, serif)", lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-green {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
      `}</style>
    </AppLayout>
  );
}
