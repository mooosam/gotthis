import { Link } from "wouter";
import {
  Users,
  Shield,
  ShieldOff,
  Target,
  MessageSquare,
  Coins,
  DollarSign,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useGetAdminStats } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminOverviewPage() {
  const { data, isLoading, error } = useGetAdminStats();

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold tracking-tight" data-testid="heading-admin-overview">
              Admin Overview
            </h1>
            <p className="text-muted-foreground mt-2">
              System-wide stats. Manage users and pricing tiers from the links below.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/users">
              <Button variant="outline" size="sm" data-testid="button-go-users">Manage users</Button>
            </Link>
            <Link href="/admin/plans">
              <Button variant="outline" size="sm" data-testid="button-go-plans">Manage plans</Button>
            </Link>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 text-sm text-destructive">
              Failed to load admin stats. You may not have admin access.
            </CardContent>
          </Card>
        )}

        {isLoading || !data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Total Users" value={data.totals.users} icon={<Users className="h-4 w-4 text-muted-foreground" />} testId="stat-total-users" />
              <StatCard title="Active (7d)" value={data.totals.activeUsers} icon={<Activity className="h-4 w-4 text-muted-foreground" />} testId="stat-active-users" />
              <StatCard title="Admins" value={data.totals.admins} icon={<Shield className="h-4 w-4 text-muted-foreground" />} testId="stat-admins" />
              <StatCard title="Suspended" value={data.totals.suspended} icon={<ShieldOff className="h-4 w-4 text-muted-foreground" />} testId="stat-suspended" />
              <StatCard title="Total Goals" value={data.totals.goals} icon={<Target className="h-4 w-4 text-muted-foreground" />} testId="stat-goals" />
              <StatCard title="Active Goals" value={data.totals.activeGoals} icon={<Target className="h-4 w-4 text-muted-foreground" />} testId="stat-active-goals" />
              <StatCard title="Messages Today" value={data.today.messages} icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />} testId="stat-messages-today" />
              <StatCard title="Est. MRR" value={`$${(data.mrrCents / 100).toFixed(2)}`} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} testId="stat-mrr" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-2 border-border/40 shadow-sm">
                <CardHeader>
                  <CardTitle className="font-serif">Messages — last 7 days</CardTitle>
                  <CardDescription>Total messages processed across all users.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.usageByDay} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", fontSize: 12 }} />
                        <Bar dataKey="messages" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40 shadow-sm">
                <CardHeader>
                  <CardTitle className="font-serif">Tier breakdown</CardTitle>
                  <CardDescription>Users per pricing tier.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.tierBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No users yet.</p>
                  ) : (
                    data.tierBreakdown.map((row) => (
                      <div key={row.tier} className="flex items-center justify-between border-b border-border/40 py-2 last:border-b-0">
                        <Badge variant="secondary" data-testid={`tier-${row.tier}`}>{row.tier}</Badge>
                        <span className="font-medium tabular-nums">{row.total}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="font-serif flex items-center gap-2">
                  <Coins className="h-4 w-4" /> Token usage today
                </CardTitle>
                <CardDescription>Sum of input/output tokens billed by Anthropic today.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <Metric label="Input tokens" value={data.today.tokenInput} testId="metric-input" />
                <Metric label="Output tokens" value={data.today.tokenOutput} testId="metric-output" />
                <Metric label="Cache hits" value={data.today.tokenCacheHits} testId="metric-cache" />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, icon, testId }: { title: string; value: string | number; icon: React.ReactNode; testId: string }) {
  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-serif font-bold tabular-nums" data-testid={testId}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-serif font-bold tabular-nums" data-testid={testId}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
