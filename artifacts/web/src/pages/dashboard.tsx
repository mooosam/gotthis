import { useGetDashboardStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ArrowRight, Target, Flame, CheckCircle2, TrendingUp } from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { data: stats, isLoading } = useGetDashboardStats();

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
            <Skeleton className="h-96 rounded-lg" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground" data-testid="heading-dashboard">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Your progress at a glance.</p>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard 
              title="Active Goals" 
              value={stats.activeGoals.toString()} 
              icon={<Target className="h-4 w-4 text-muted-foreground" />} 
            />
            <StatCard 
              title="Current Streak" 
              value={`${stats.currentStreak} days`} 
              icon={<Flame className="h-4 w-4 text-muted-foreground" />} 
            />
            <StatCard 
              title="Completion Rate" 
              value={`${Math.round(stats.weeklyCompletionRate)}%`} 
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} 
            />
            <StatCard 
              title="Total Logs" 
              value={stats.totalLogs.toString()} 
              icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />} 
            />
          </div>
        )}

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
                  {stats.topGoals.map(goal => (
                    <Link key={goal.id} href={`/goal/${goal.id}`}>
                      <div className="flex flex-col space-y-2 p-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border cursor-pointer group" data-testid={`card-top-goal-${goal.id}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm group-hover:text-primary transition-colors">{goal.title}</span>
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{goal.category}</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5">
                          <div 
                            className="bg-primary h-1.5 rounded-full" 
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>No active goals.</p>
                  <Link href="/goals">
                    <Button variant="outline" size="sm" className="mt-4">Create Goal</Button>
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
              <Link href={`/review/${format(new Date(), 'yyyy-MM-dd')}`}>
                <Button variant="ghost" size="sm" className="text-xs">
                  Today <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {stats?.recentLogs && stats.recentLogs.length > 0 ? (
                <div className="space-y-4 mt-4">
                  {stats.recentLogs.map(log => (
                    <Link key={log.id} href={`/review/${log.logDate}`}>
                      <div className="flex flex-col space-y-2 p-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border cursor-pointer" data-testid={`card-recent-log-${log.id}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{format(new Date(log.logDate), 'MMM d, yyyy')}</span>
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

function StatCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-serif font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
