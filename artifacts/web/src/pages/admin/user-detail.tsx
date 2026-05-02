import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, Save, Trash2, RefreshCw, Shield, ShieldOff } from "lucide-react";
import { format } from "date-fns";
import {
  useAdminGetUser,
  useAdminUpdateUser,
  useAdminApplyPlan,
  useAdminDeleteUser,
  useAdminListPlans,
  getAdminGetUserQueryKey,
  getAdminListUsersQueryKey,
  getGetAdminStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function AdminUserDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminGetUser(id);
  const { data: plansData } = useAdminListPlans();

  const [tier, setTier] = useState("");
  const [dailyCap, setDailyCap] = useState(0);
  const [tokenCap, setTokenCap] = useState(0);
  const [skipCredits, setSkipCredits] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);

  useEffect(() => {
    if (!data?.user) return;
    setTier(data.user.tier);
    setDailyCap(data.user.dailyMessageCap);
    setTokenCap(data.user.monthlyTokenAllowance);
    setSkipCredits((data.user as { monthlySkipCredits?: number }).monthlySkipCredits ?? 0);
    setIsAdmin(data.user.isAdmin);
    setIsSuspended(data.user.isSuspended);
  }, [data]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(id) }),
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() }),
    ]);
  };

  const updateMutation = useAdminUpdateUser({
    mutation: {
      onSuccess: async () => {
        toast({ title: "User updated" });
        await invalidate();
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : "Update failed";
        toast({ title: "Update failed", description: message, variant: "destructive" });
      },
    },
  });

  const applyPlanMutation = useAdminApplyPlan({
    mutation: {
      onSuccess: async () => {
        toast({ title: "Plan defaults applied", description: "User caps reset to plan values." });
        await invalidate();
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to apply plan";
        toast({ title: "Could not apply plan", description: message, variant: "destructive" });
      },
    },
  });

  const deleteMutation = useAdminDeleteUser({
    mutation: {
      onSuccess: async () => {
        toast({ title: "User deleted" });
        await invalidate();
        setLocation("/admin/users");
      },
      onError: () => {
        toast({ title: "Delete failed", variant: "destructive" });
      },
    },
  });

  if (isLoading || !data) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-32 rounded" />
          <Skeleton className="h-64 rounded" />
        </div>
      </AppLayout>
    );
  }

  const u = data.user;
  const plans = plansData?.plans ?? [];

  const handleSave = () => {
    updateMutation.mutate({
      id,
      data: {
        tier,
        dailyMessageCap: dailyCap,
        monthlyTokenAllowance: tokenCap,
        monthlySkipCredits: skipCredits,
        isAdmin,
        isSuspended,
      },
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Link href="/admin/users">
            <Button variant="ghost" size="sm" className="mb-2 -ml-3" data-testid="button-back-users">
              <ChevronLeft className="h-4 w-4 mr-1" /> Users
            </Button>
          </Link>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-serif font-bold tracking-tight" data-testid="heading-user-detail">{u.email || "(no email)"}</h1>
              <p className="text-xs font-mono text-muted-foreground mt-1">{u.id}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {u.isAdmin && <Badge className="gap-1"><Shield className="h-3 w-3" /> admin</Badge>}
              {u.isSuspended && <Badge variant="destructive" className="gap-1"><ShieldOff className="h-3 w-3" /> suspended</Badge>}
              <Badge variant="secondary">{u.tier}</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <InfoStat label="Goals" value={data.counts.goals} />
          <InfoStat label="Daily logs" value={data.counts.logs} />
          <InfoStat label="Daily msgs" value={`${u.dailyMessageCount} / ${u.dailyMessageCap}`} />
          <InfoStat label="Joined" value={u.createdAt ? format(new Date(u.createdAt), "MMM d, yyyy") : "—"} />
        </div>

        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif">Edit user</CardTitle>
            <CardDescription>Update tier, caps, admin and suspension flags.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="user-tier">Tier</Label>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger id="user-tier" data-testid="select-tier"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.slug} value={p.slug}>{p.name} ({p.slug})</SelectItem>
                    ))}
                    {!plans.find((p) => p.slug === tier) && tier && (
                      <SelectItem value={tier}>{tier} (legacy)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="user-daily">Daily message cap</Label>
                <Input id="user-daily" type="number" min={0} value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))} data-testid="input-daily-cap" />
              </div>

              <div>
                <Label htmlFor="user-tokens">Monthly token allowance</Label>
                <Input id="user-tokens" type="number" min={0} value={tokenCap} onChange={(e) => setTokenCap(Number(e.target.value))} data-testid="input-token-cap" />
              </div>

              <div>
                <Label htmlFor="user-skips">Monthly skip credits</Label>
                <Input id="user-skips" type="number" min={0} value={skipCredits} onChange={(e) => setSkipCredits(Number(e.target.value))} data-testid="input-skip-credits" />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">Admin access</div>
                <div className="text-xs text-muted-foreground">Allow this user into the admin dashboard.</div>
              </div>
              <Switch checked={isAdmin} onCheckedChange={setIsAdmin} data-testid="switch-is-admin" />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">Suspended</div>
                <div className="text-xs text-muted-foreground">Block this user from making API requests.</div>
              </div>
              <Switch checked={isSuspended} onCheckedChange={setIsSuspended} data-testid="switch-is-suspended" />
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => applyPlanMutation.mutate({ id })}
                disabled={applyPlanMutation.isPending}
                data-testid="button-apply-plan"
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Reset caps to plan defaults
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-user">
                <Save className="h-4 w-4 mr-1" /> Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif">Recent goals</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No goals.</p>
            ) : (
              <div className="space-y-2">
                {data.recentGoals.map((g) => (
                  <div key={g.id} className="flex justify-between items-center p-2 rounded border border-border/40 text-sm">
                    <span className="font-medium">{g.title}</span>
                    <div className="flex gap-2 items-center">
                      <Badge variant="outline">{g.status}</Badge>
                      <span className="text-muted-foreground text-xs tabular-nums">{g.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif">Recent usage</CardTitle>
            <CardDescription>Last 30 days of token & message activity.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground">No usage recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Messages</TableHead>
                      <TableHead className="text-right">Input</TableHead>
                      <TableHead className="text-right">Output</TableHead>
                      <TableHead className="text-right">Cache</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentUsage.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{row.periodDate}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.messageCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.tokenInputCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.tokenOutputCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.tokenCacheHitCount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/40 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-destructive">Danger zone</CardTitle>
            <CardDescription>Permanently delete this user and all their owned data.</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" data-testid="button-delete-user">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete user
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this user?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Permanently removes the user and cascades their goals, daily logs, and usage records. The Clerk account is not deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate({ id })}
                    className="bg-destructive hover:bg-destructive/90"
                    data-testid="button-confirm-delete"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function InfoStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-border/40 shadow-sm">
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-serif font-bold tabular-nums mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
