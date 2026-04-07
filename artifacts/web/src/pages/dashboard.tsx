import { useState } from "react";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format, subDays } from "date-fns";
import { ArrowRight, Target, Flame, CheckCircle2, TrendingUp, Sparkles } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { data: stats, isLoading } = useGetDashboardStats();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [aiReply, setAiReply] = useState("");

  const handleSend = async () => {
    const content = message.trim();
    if (!content) {
      toast({
        title: "Write something first",
        description: "Add your update, notes, or progress before sending.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/ai/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Failed to send update");
      }

      const result = (await response.json()) as { reply?: string };
      setAiReply(result.reply || "");
      window.location.reload();

      toast({
        title: "Update sent",
        description: "The app has processed your message.",
      });
      setMessage("");
    } catch {
      toast({
        title: "Could not send update",
        description: "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-72 rounded-lg" />
            <Skeleton className="h-72 rounded-lg" />
          </div>
        </div>
      </AppLayout>
    );
  }

  // Build 7-day activity chart from recentLogs
  const weeklyChartData = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dateStr = format(d, "yyyy-MM-dd");
    const hasLog = stats?.recentLogs.some((log) => log.logDate === dateStr) ?? false;
    return {
      day: format(d, "EEE"),
      date: dateStr,
      logged: hasLog ? 1 : 0,
    };
  });

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1
            className="text-3xl font-serif font-bold tracking-tight text-foreground"
            data-testid="heading-dashboard"
          >
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">Your progress at a glance.</p>
        </div>

        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Write an update
            </CardTitle>
            <CardDescription>
              Add notes, progress, blockers, or anything important. The app will read it and update the right goals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Example: I finished the first draft, got stuck on the outline, and want to focus more on fitness this week."
              className="min-h-[140px] resize-none"
              data-testid="textarea-dashboard-update"
            />
            <div className="flex justify-end">
              <Button onClick={handleSend} disabled={isSending}>
                {isSending ? "Sending..." : "Send update"}
              </Button>
            </div>
            {aiReply && (
              <div className="rounded-md border border-border/40 bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {aiReply}
              </div>
            )}
          </CardContent>
        </Card>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Active Goals"
              value={stats.activeGoals.toString()}
              icon={<Target className="h-4 w-4 text-muted-foreground" />}
              testId="stat-active-goals"
            />
            <StatCard
              title="Current Streak"
              value={`${stats.currentStreak} days`}
              icon={<Flame className="h-4 w-4 text-muted-foreground" />}
              testId="stat-current-streak"
            />
            <StatCard
              title="Completion Rate"
              value={`${Math.round(stats.weeklyCompletionRate)}%`}
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
              testId="stat-completion-rate"
            />
            <StatCard
              title="Total Logs"
              value={stats.totalLogs.toString()}
              icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
              testId="stat-total-logs"
            />
          </div>
        )}

        {/* Weekly Activity Chart */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif">Weekly Activity</CardTitle>
            <CardDescription>Your daily log activity over the past 7 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    domain={[0, 1]}
                    ticks={[0, 1]}
                    tickFormatter={(v: number) => (v === 1 ? "Yes" : "No")}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [value === 1 ? "Logged" : "No entry", "Activity"]}
                    labelFormatter={(label: string) => `Day: ${label}`}
                  />
                  <Bar
                    dataKey="logged"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="font-serif">Top Goals</CardTitle>
                <CardDescription>Your most active pursuits.</CardDescription>
              </div>
              <Link href="/goals">
                <Button variant="ghost" size="sm" className="text-xs">
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {stats?.topGoals && stats.topGoals.length > 0 ? (
                <div className="space-y-4 mt-4">
                  {stats.topGoals.map((goal) => (
                    <Link key={goal.id} href={`/goal/${goal.id}`}>
                      <div
                        className="flex flex-col space-y-2 p-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border cursor-pointer group"
                        data-testid={`card-top-goal-${goal.id}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm group-hover:text-primary transition-colors">
                            {goal.title}
                          </span>
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                            {goal.category}
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{goal.progress}% complete</span>
                          <span>{goal.currentStreak} day streak</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>No active goals.</p>
                  <Link href="/goals">
                    <Button variant="outline" size="sm" className="mt-4">
                      Create Goal
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="font-serif">Recent Logs</CardTitle>
                <CardDescription>Your latest daily reviews.</CardDescription>
              </div>
              <Link href={`/review/${format(new Date(), "yyyy-MM-dd")}`}>
                <Button variant="ghost" size="sm" className="text-xs">
                  Today <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {stats?.recentLogs && stats.recentLogs.length > 0 ? (
                <div className="space-y-4 mt-4">
                  {stats.recentLogs.map((log) => (
                    <Link key={log.id} href={`/review/${log.logDate}`}>
                      <div
                        className="flex flex-col space-y-2 p-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border cursor-pointer"
                        data-testid={`card-recent-log-${log.id}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">
                            {format(new Date(log.logDate), "MMM d, yyyy")}
                          </span>
                        </div>
                        {log.narrative && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {log.narrative}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>No recent logs.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({
  title,
  value,
  icon,
  testId,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  testId: string;
}) {
  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-serif font-bold" data-testid={testId}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
