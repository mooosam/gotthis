import { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, Plus, Save, Trash2 } from "lucide-react";
import {
  useAdminListPlans,
  useAdminCreatePlan,
  useAdminUpdatePlan,
  useAdminDeletePlan,
  getAdminListPlansQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Plan } from "@workspace/api-client-react";

export default function AdminPlansPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useAdminListPlans();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminListPlansQueryKey() });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="mb-2 -ml-3" data-testid="button-back-overview-plans">
              <ChevronLeft className="h-4 w-4 mr-1" /> Overview
            </Button>
          </Link>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-serif font-bold tracking-tight" data-testid="heading-admin-plans">Pricing tiers</h1>
              <p className="text-muted-foreground mt-2">
                Define the limits, price, and billing period for each subscription tier.
              </p>
            </div>
            <CreatePlanDialog onCreated={invalidate} />
          </div>
        </div>

        {isLoading || !data ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded" />)}
          </div>
        ) : data.plans.length === 0 ? (
          <Card className="border-border/40">
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              No plans yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.plans.map((plan) => (
              <PlanCard key={plan.slug} plan={plan} onChanged={invalidate} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function PlanCard({ plan, onChanged }: { plan: Plan; onChanged: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [dailyCap, setDailyCap] = useState(plan.dailyMessageCap);
  const [tokenCap, setTokenCap] = useState(plan.monthlyTokenAllowance);
  const [skips, setSkips] = useState(plan.monthlySkipCredits);
  const [priceCents, setPriceCents] = useState(plan.priceCents);
  const [billingPeriod, setBillingPeriod] = useState(plan.billingPeriod);
  const [isActive, setIsActive] = useState(plan.isActive);
  const [sortOrder, setSortOrder] = useState(plan.sortOrder);

  const update = useAdminUpdatePlan({
    mutation: {
      onSuccess: () => {
        toast({ title: `Updated ${plan.slug}` });
        onChanged();
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    },
  });

  const remove = useAdminDeletePlan({
    mutation: {
      onSuccess: () => {
        toast({ title: `Deleted ${plan.slug}` });
        onChanged();
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : "Cannot delete plan";
        toast({ title: "Delete blocked", description: message, variant: "destructive" });
      },
    },
  });

  return (
    <Card className="border-border/40 shadow-sm" data-testid={`card-plan-${plan.slug}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="font-serif">{plan.name}</CardTitle>
            <CardDescription className="font-mono text-xs">{plan.slug}</CardDescription>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
            data-testid={`switch-active-${plan.slug}`}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Display name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} data-testid={`input-name-${plan.slug}`} />
        </div>
        <div>
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} data-testid={`input-desc-${plan.slug}`} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Daily msgs</Label>
            <Input type="number" min={0} value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))} data-testid={`input-dailycap-${plan.slug}`} />
          </div>
          <div>
            <Label>Skip credits</Label>
            <Input type="number" min={0} value={skips} onChange={(e) => setSkips(Number(e.target.value))} data-testid={`input-skips-${plan.slug}`} />
          </div>
          <div className="col-span-2">
            <Label>Monthly tokens</Label>
            <Input type="number" min={0} value={tokenCap} onChange={(e) => setTokenCap(Number(e.target.value))} data-testid={`input-tokens-${plan.slug}`} />
          </div>
          <div>
            <Label>Price (¢)</Label>
            <Input type="number" min={0} value={priceCents} onChange={(e) => setPriceCents(Number(e.target.value))} data-testid={`input-price-${plan.slug}`} />
          </div>
          <div>
            <Label>Billing</Label>
            <Select value={billingPeriod} onValueChange={setBillingPeriod}>
              <SelectTrigger data-testid={`select-billing-${plan.slug}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Sort order</Label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} data-testid={`input-sort-${plan.slug}`} />
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive" data-testid={`button-delete-${plan.slug}`}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete plan "{plan.slug}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Plans with users assigned cannot be deleted. Move users to a different tier first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => remove.mutate({ slug: plan.slug })}
                  className="bg-destructive hover:bg-destructive/90"
                  data-testid={`button-confirm-delete-${plan.slug}`}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            size="sm"
            onClick={() =>
              update.mutate({
                slug: plan.slug,
                data: {
                  name,
                  description,
                  dailyMessageCap: dailyCap,
                  monthlyTokenAllowance: tokenCap,
                  monthlySkipCredits: skips,
                  priceCents,
                  billingPeriod,
                  isActive,
                  sortOrder,
                },
              })
            }
            disabled={update.isPending}
            data-testid={`button-save-${plan.slug}`}
          >
            <Save className="h-3 w-3 mr-1" /> Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CreatePlanDialog({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [priceCents, setPriceCents] = useState(0);
  const [dailyCap, setDailyCap] = useState(5);
  const [tokenCap, setTokenCap] = useState(50000);

  const create = useAdminCreatePlan({
    mutation: {
      onSuccess: () => {
        toast({ title: "Plan created" });
        setOpen(false);
        setSlug("");
        setName("");
        onCreated();
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not create plan";
        toast({ title: "Create failed", description: message, variant: "destructive" });
      },
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-plan">
          <Plus className="h-4 w-4 mr-1" /> New plan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new plan</DialogTitle>
          <DialogDescription>
            Slug is the machine ID used to assign this plan to users (lowercase, e.g. "starter").
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="starter" data-testid="input-new-slug" />
          </div>
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Starter" data-testid="input-new-name" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Price (¢)</Label>
              <Input type="number" min={0} value={priceCents} onChange={(e) => setPriceCents(Number(e.target.value))} data-testid="input-new-price" />
            </div>
            <div>
              <Label>Daily msgs</Label>
              <Input type="number" min={0} value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))} data-testid="input-new-daily" />
            </div>
            <div>
              <Label>Tokens/mo</Label>
              <Input type="number" min={0} value={tokenCap} onChange={(e) => setTokenCap(Number(e.target.value))} data-testid="input-new-tokens" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() =>
              create.mutate({
                data: {
                  slug,
                  name,
                  priceCents,
                  dailyMessageCap: dailyCap,
                  monthlyTokenAllowance: tokenCap,
                },
              })
            }
            disabled={create.isPending || !slug || !name}
            data-testid="button-create-plan"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
