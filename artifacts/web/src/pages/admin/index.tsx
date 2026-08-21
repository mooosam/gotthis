import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { Users, Shield, ShieldOff, Target, MessageSquare, Coins, DollarSign, Activity, Smartphone, Trophy, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useGetAdminStats } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type GrowthData = {
  mode: { growthMode: boolean; paidTierEnforcement: boolean; proactiveWhatsApp: boolean; userInitiatedUsage: string };
  acquisition: { totalUsers: number; newUsers7d: number; newUsers30d: number; whatsappConnected: number; whatsappConnectionRate: number; onboarded: number; activationRate: number };
  engagement: { dau: number; wau: number; mau: number; messages30d: number; messagesPerMau: number };
  goals: { total: number; active: number; completed: number; completionRate: number; cadence: Array<{name:string;total:number}>; status: Array<{name:string;total:number}> };
  sharing: { achievements: number; sharedAchievements: number; shareRate: number };
  ai: { inputTokens30d: number; outputTokens30d: number; totalTokens30d: number };
  activity: { sources: Array<{name:string;total:number}>; eventTypes: Array<{name:string;total:number}> };
  usage30d: Array<{date:string;messages:number;activeUsers:number}>;
};

export default function AdminOverviewPage() {
  const { data, isLoading, error } = useGetAdminStats();
  const { getToken } = useAuth();
  const [growth, setGrowth] = useState<GrowthData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const r = await fetch("/api/admin/growth", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!r.ok) return;
        const json = await r.json();
        if (!cancelled) setGrowth(json);
      } catch { /* legacy admin stats still render if growth analytics fail */ }
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div><h1 className="text-3xl font-serif font-bold tracking-tight">Admin Overview</h1><p className="text-muted-foreground mt-2">Growth, engagement, product usage and system-wide stats.</p></div>
          <div className="flex gap-2"><Link href="/admin/users"><Button variant="outline" size="sm">Manage users</Button></Link><Link href="/admin/plans"><Button variant="outline" size="sm">Manage plans</Button></Link><Link href="/admin/stripe"><Button variant="outline" size="sm">Stripe</Button></Link></div>
        </div>

        {growth && (
          <Card className={growth.mode.growthMode ? "border-emerald-500/40" : "border-amber-500/40"}>
            <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4"/>Growth Mode <Badge>{growth.mode.growthMode ? "ON" : "OFF"}</Badge></CardTitle><CardDescription>Commercial restrictions stay dormant while telemetry continues collecting real usage.</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm"><Metric label="Paid tier enforcement" value={growth.mode.paidTierEnforcement ? "ON" : "OFF"}/><Metric label="Proactive WhatsApp" value={growth.mode.proactiveWhatsApp ? "ON" : "OFF"}/><Metric label="User-initiated usage" value={growth.mode.userInitiatedUsage === "unlimited" ? "Unlimited" : "Tier limited"}/><Metric label="WhatsApp connected" value={`${growth.acquisition.whatsappConnectionRate}%`}/></CardContent>
          </Card>
        )}

        {growth && <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="New Users (7d)" value={growth.acquisition.newUsers7d} icon={<Users className="h-4 w-4"/>}/><StatCard title="New Users (30d)" value={growth.acquisition.newUsers30d} icon={<Users className="h-4 w-4"/>}/><StatCard title="Activation" value={`${growth.acquisition.activationRate}%`} icon={<Zap className="h-4 w-4"/>}/><StatCard title="WhatsApp Connected" value={growth.acquisition.whatsappConnected} icon={<Smartphone className="h-4 w-4"/>}/>
            <StatCard title="DAU" value={growth.engagement.dau} icon={<Activity className="h-4 w-4"/>}/><StatCard title="WAU" value={growth.engagement.wau} icon={<Activity className="h-4 w-4"/>}/><StatCard title="MAU" value={growth.engagement.mau} icon={<Activity className="h-4 w-4"/>}/><StatCard title="Messages / MAU (30d)" value={growth.engagement.messagesPerMau} icon={<MessageSquare className="h-4 w-4"/>}/>
            <StatCard title="Goal Completion" value={`${growth.goals.completionRate}%`} icon={<Target className="h-4 w-4"/>}/><StatCard title="Achievements" value={growth.sharing.achievements} icon={<Trophy className="h-4 w-4"/>}/><StatCard title="Achievement Shares" value={growth.sharing.sharedAchievements} icon={<Trophy className="h-4 w-4"/>}/><StatCard title="Share Rate" value={`${growth.sharing.shareRate}%`} icon={<Trophy className="h-4 w-4"/>}/>
          </div>
          <Card><CardHeader><CardTitle>Growth — last 30 days</CardTitle><CardDescription>Daily messages and active users.</CardDescription></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={growth.usage30d}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip/><Bar dataKey="messages" fill="hsl(var(--primary))" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></CardContent></Card>
          <div className="grid md:grid-cols-3 gap-6">
            <Breakdown title="Goal cadence" rows={growth.goals.cadence}/><Breakdown title="Activity sources (30d)" rows={growth.activity.sources}/><Breakdown title="Top activity events (30d)" rows={growth.activity.eventTypes}/>
          </div>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Coins className="h-4 w-4"/>AI usage — 30 days</CardTitle><CardDescription>Telemetry continues even while user limits are disabled.</CardDescription></CardHeader><CardContent className="grid grid-cols-3 gap-4"><Metric label="Input tokens" value={growth.ai.inputTokens30d.toLocaleString()}/><Metric label="Output tokens" value={growth.ai.outputTokens30d.toLocaleString()}/><Metric label="Total tokens" value={growth.ai.totalTokens30d.toLocaleString()}/></CardContent></Card>
        </>}

        {error && <Card className="border-destructive/40"><CardContent className="pt-6 text-sm text-destructive">Failed to load admin stats. You may not have admin access.</CardContent></Card>}
        {isLoading || !data ? <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-28 rounded-lg"/>)}</div> : <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><StatCard title="Total Users" value={data.totals.users} icon={<Users className="h-4 w-4"/>}/><StatCard title="Active (7d)" value={data.totals.activeUsers} icon={<Activity className="h-4 w-4"/>}/><StatCard title="Admins" value={data.totals.admins} icon={<Shield className="h-4 w-4"/>}/><StatCard title="Suspended" value={data.totals.suspended} icon={<ShieldOff className="h-4 w-4"/>}/><StatCard title="Total Goals" value={data.totals.goals} icon={<Target className="h-4 w-4"/>}/><StatCard title="Active Goals" value={data.totals.activeGoals} icon={<Target className="h-4 w-4"/>}/><StatCard title="Messages Today" value={data.today.messages} icon={<MessageSquare className="h-4 w-4"/>}/><StatCard title="Est. MRR" value={`$${(data.mrrCents/100).toFixed(2)}`} icon={<DollarSign className="h-4 w-4"/>}/></div>
        </>}
      </div>
    </AppLayout>
  );
}

function StatCard({title,value,icon}:{title:string;value:string|number;icon:React.ReactNode}) { return <Card className="border-border/40 shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>{icon}</CardHeader><CardContent><div className="text-2xl font-serif font-bold tabular-nums">{value}</div></CardContent></Card>; }
function Metric({label,value}:{label:string;value:string|number}) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-serif font-bold tabular-nums">{value}</div></div>; }
function Breakdown({title,rows}:{title:string;rows:Array<{name:string;total:number}>}) { return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-2">{rows.length ? rows.map((r)=><div key={String(r.name)} className="flex justify-between border-b border-border/40 py-1.5 last:border-0"><span className="text-sm text-muted-foreground capitalize">{r.name || "unknown"}</span><span className="font-medium tabular-nums">{r.total}</span></div>) : <span className="text-sm text-muted-foreground">No data yet.</span>}</CardContent></Card>; }
