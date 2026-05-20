import { useState, useCallback, useRef } from "react";
import { useGetDashboardStats, useListGoals } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { Link } from "wouter";
import { format, subDays, formatDistanceToNowStrict } from "date-fns";
import { ArrowUpRight } from "lucide-react";
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

export default function DashboardPage() {
  const { data: stats, isLoading, refetch: refetchStats } = useGetDashboardStats();
  const { refetch: refetchGoals } = useListGoals();
  const { toast } = useToast();

  const [message, setMessage]   = useState("");
  const [isSending, setIsSending] = useState(false);
  const [aiReply, setAiReply]   = useState("");
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [goalsUpdated, setGoalsUpdated] = useState(0);
  const loadedAt = useRef(new Date());

  const handleSend = useCallback(async () => {
    const content = message.trim();
    if (!content) {
      toast({ title: "Write something first", variant: "destructive" });
      return;
    }
    setIsSending(true);
    try {
      const response = await apiFetch("/api/ai/message", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: content }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Failed to send update");
      }
      const result = (await response.json()) as { reply?: string; intent?: string; updatedGoals?: number };
      setAiReply(result.reply || "");
      setLastSentAt(new Date());
      setGoalsUpdated(result.updatedGoals ?? (result.intent === "goal_update" ? 1 : 0));
      setMessage("");
      await Promise.all([refetchStats(), refetchGoals()]);
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

  // 7-day chart data — count logs per day
  const weeklyChartData = Array.from({ length: 7 }).map((_, i) => {
    const d       = subDays(new Date(), 6 - i);
    const dateStr = format(d, "yyyy-MM-dd");
    const count   = stats?.recentLogs.filter((log) => log.logDate === dateStr).length ?? 0;
    return {
      day:     format(d, "EEEEE"),
      date:    dateStr,
      count:   count === 0 ? 0.08 : count, // keep 0-days faintly visible
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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-end justify-between">
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-36 rounded-2xl" />
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

        {/* ── Header ── */}
        <div className="flex items-baseline justify-between">
          <h1
            className="text-[28px] font-serif font-semibold tracking-tight"
            style={{ color: "#111827", lineHeight: 1.2 }}
            data-testid="heading-dashboard"
          >
            {format(new Date(), "EEEE, MMMM d")}
          </h1>
          <span
            style={{
              fontSize:      11,
              fontWeight:    600,
              letterSpacing: "0.08em",
              color:         "#9CA3AF",
              textTransform: "uppercase",
            }}
          >
            Updated · {updatedAgo} ago
          </span>
        </div>

        {/* ── Write an update ── */}
        <div
          style={{
            background:   "#FFFFFF",
            border:       "1px solid #EBEBEB",
            borderRadius: 16,
            padding:      "20px 24px",
            position:     "relative",
          }}
        >
          {/* Live pulse dot */}
          <span
            style={{
              position: "absolute",
              top:      18,
              right:    20,
              width:    10,
              height:   10,
              borderRadius: "50%",
              background: "#22C55E",
              boxShadow:  "0 0 0 0 rgba(34,197,94,0.4)",
              animation:  "pulse-green 2s infinite",
            }}
          />

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Write an update… "I finished the first draft and did a 5km run."`}
            data-testid="textarea-dashboard-update"
            rows={3}
            style={{
              width:       "100%",
              border:      "none",
              outline:     "none",
              resize:      "none",
              background:  "transparent",
              fontSize:    15,
              lineHeight:  1.6,
              color:       "#111827",
              fontFamily:  "inherit",
              paddingRight: 24,
            }}
            className="placeholder:text-[#9CA3AF] dark:text-foreground"
          />

          {/* Footer row */}
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid #F3F4F6" }}>
            <div className="flex items-center gap-1.5">
              <span
                style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", display: "inline-block" }}
              />
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                {lastSentAt
                  ? `Sent · ${format(lastSentAt, "h:mm a")}`
                  : "From dashboard · press ⌘↵ to send"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {goalsUpdated > 0 && lastSentAt && (
                <span
                  style={{
                    fontSize:     11,
                    fontWeight:   600,
                    color:        "#16A34A",
                    background:   "#F0FDF4",
                    border:       "1px solid #BBF7D0",
                    borderRadius: 99,
                    padding:      "2px 10px",
                    letterSpacing: "0.02em",
                  }}
                >
                  ↓ {goalsUpdated} goal{goalsUpdated !== 1 ? "s" : ""} updated
                </span>
              )}
              <button
                onClick={handleSend}
                disabled={isSending}
                style={{
                  fontSize:     12,
                  fontWeight:   600,
                  color:        isSending ? "#9CA3AF" : "#111827",
                  background:   isSending ? "#F9FAFB"  : "#F3F4F6",
                  border:       "1px solid #E5E7EB",
                  borderRadius: 8,
                  padding:      "5px 14px",
                  cursor:       isSending ? "default" : "pointer",
                  transition:   "background 0.15s",
                }}
              >
                {isSending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>

          {aiReply && (
            <div
              style={{
                marginTop:    12,
                background:   "#F9FAFB",
                borderRadius: 10,
                border:       "1px solid #EBEBEB",
                padding:      "12px 16px",
                fontSize:     13,
                lineHeight:   1.6,
                color:        "#374151",
                whiteSpace:   "pre-wrap",
              }}
            >
              {aiReply}
            </div>
          )}
        </div>

        {/* ── Two-column: Chart + Active Goals ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Weekly Activity */}
          <div
            style={{
              background:   "#FFFFFF",
              border:       "1px solid #EBEBEB",
              borderRadius: 16,
              padding:      "20px 24px 16px",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Weekly Activity</span>
              <span
                style={{
                  fontSize:      10,
                  fontWeight:    700,
                  letterSpacing: "0.08em",
                  color:         "#9CA3AF",
                  textTransform: "uppercase",
                }}
              >
                Last 7 days
              </span>
            </div>

            <div style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyChartData}
                  margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  barCategoryGap="28%"
                >
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9CA3AF", fontWeight: 500 }}
                    dy={6}
                  />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      background:   "#111827",
                      border:       "none",
                      borderRadius: 8,
                      fontSize:     12,
                      color:        "#F9FAFB",
                      padding:      "6px 12px",
                    }}
                    labelStyle={{ color: "#9CA3AF", fontSize: 11 }}
                    formatter={(value: number, _: string, payload: { payload?: { isEmpty?: boolean } }) => [
                      payload.payload?.isEmpty ? "No entry" : `${Math.round(value)} log${value !== 1 ? "s" : ""}`,
                      "",
                    ]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 2, 2]} maxBarSize={40}>
                    {weeklyChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isEmpty ? "#F3F4F6" : entry.isToday ? "#22C55E" : "#1C1C1E"}
                        fillOpacity={entry.isEmpty ? 1 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Active Goals */}
          <div
            style={{
              background:   "#FFFFFF",
              border:       "1px solid #EBEBEB",
              borderRadius: 16,
              padding:      "20px 24px",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Active Goals</span>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>
                  {stats?.topGoals?.length ?? 0} of {stats?.activeGoals ?? 0}
                </span>
                <Link href="/goals">
                  <button
                    style={{
                      display:      "flex",
                      alignItems:   "center",
                      gap:          2,
                      fontSize:     11,
                      fontWeight:   600,
                      color:        "#6B7280",
                      background:   "transparent",
                      border:       "none",
                      cursor:       "pointer",
                      padding:      0,
                    }}
                  >
                    All <ArrowUpRight style={{ width: 12, height: 12 }} />
                  </button>
                </Link>
              </div>
            </div>

            {stats?.topGoals && stats.topGoals.length > 0 ? (
              <div className="space-y-4">
                {stats.topGoals.map((goal) => (
                  <Link key={goal.id} href={`/goal/${goal.id}`}>
                    <div
                      className="cursor-pointer"
                      data-testid={`card-top-goal-${goal.id}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>
                          {goal.title}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", minWidth: 36, textAlign: "right" }}>
                          {goal.progress}%
                        </span>
                      </div>
                      <div
                        style={{
                          width:        "100%",
                          height:       4,
                          background:   "#F3F4F6",
                          borderRadius: 99,
                          overflow:     "hidden",
                        }}
                      >
                        <div
                          style={{
                            width:        `${goal.progress}%`,
                            height:       "100%",
                            background:   "#3B82F6",
                            borderRadius: 99,
                            transition:   "width 0.4s ease",
                          }}
                        />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>No active goals yet.</p>
                <Link href="/goals">
                  <button
                    style={{
                      marginTop:    12,
                      fontSize:     12,
                      fontWeight:   600,
                      color:        "#111827",
                      background:   "#F3F4F6",
                      border:       "1px solid #E5E7EB",
                      borderRadius: 8,
                      padding:      "6px 14px",
                      cursor:       "pointer",
                    }}
                  >
                    Create a goal
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats strip ── */}
        {stats && (
          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap:                 12,
            }}
          >
            {[
              { label: "Active goals",    value: stats.activeGoals.toString(),                    testId: "stat-active-goals"     },
              { label: "Current streak",  value: `${stats.currentStreak}d`,                       testId: "stat-current-streak"   },
              { label: "Completion rate", value: `${Math.round(stats.weeklyCompletionRate)}%`,    testId: "stat-completion-rate"  },
              { label: "Total logs",      value: stats.totalLogs.toString(),                      testId: "stat-total-logs"       },
            ].map((s) => (
              <div
                key={s.testId}
                style={{
                  background:   "#FFFFFF",
                  border:       "1px solid #EBEBEB",
                  borderRadius: 14,
                  padding:      "14px 18px",
                }}
              >
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {s.label}
                </div>
                <div
                  data-testid={s.testId}
                  style={{ fontSize: 22, fontWeight: 700, color: "#111827", fontFamily: "var(--font-serif, Georgia, serif)", lineHeight: 1 }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      <style>{`
        @keyframes pulse-green {
          0%   { box-shadow: 0 0 0 0   rgba(34,197,94,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(34,197,94,0);   }
          100% { box-shadow: 0 0 0 0   rgba(34,197,94,0);   }
        }
      `}</style>
    </AppLayout>
  );
}
