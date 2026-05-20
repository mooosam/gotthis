import { useState, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, Users, RefreshCcw, ArrowLeft,
  TrendingUp, CheckCircle2, XCircle, Clock,
  ChevronLeft, ChevronRight, Search, Key, Eye, EyeOff, Trash2, Sparkles,
} from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

// ── helpers ────────────────────────────────────────────────────────────────

function fmt(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency?.toUpperCase() || "USD",
    minimumFractionDigits: 2,
  }).format((cents ?? 0) / 100);
}

function fmtDate(ts: number | string | null) {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    succeeded:  { label: "Succeeded",  color: "#16a34a" },
    active:     { label: "Active",     color: "#16a34a" },
    pending:    { label: "Pending",    color: "#d97706" },
    past_due:   { label: "Past due",   color: "#d97706" },
    incomplete: { label: "Incomplete", color: "#d97706" },
    failed:     { label: "Failed",     color: "#dc2626" },
    canceled:   { label: "Canceled",   color: "#6b7280" },
    refunded:   { label: "Refunded",   color: "#6b7280" },
  };
  const v = map[status] ?? { label: status, color: "#6b7280" };
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: v.color + "18", color: v.color }}
    >
      {status === "succeeded" || status === "active"
        ? <CheckCircle2 className="h-3 w-3" />
        : status === "failed" || status === "canceled"
          ? <XCircle className="h-3 w-3" />
          : <Clock className="h-3 w-3" />}
      {v.label}
    </span>
  );
}

// ── queries ────────────────────────────────────────────────────────────────

const PAGE = 25;

function useStripeStatus() {
  return useQuery({
    queryKey: ["stripe-status"],
    queryFn: async () => {
      const r = await apiFetch("/api/admin/stripe/status");
      return r.json() as Promise<{ connected: boolean }>;
    },
    staleTime: 30_000,
  });
}

function useStoredKey() {
  return useQuery({
    queryKey: ["stripe-stored-key"],
    queryFn: async () => {
      const r = await apiFetch("/api/admin/stripe/key");
      return r.json() as Promise<{ stored: boolean; preview: string | null; updatedAt?: string }>;
    },
  });
}

function useStoredWebhookSecret() {
  return useQuery({
    queryKey: ["stripe-webhook-secret"],
    queryFn: async () => {
      const r = await apiFetch("/api/admin/stripe/webhook-secret");
      return r.json() as Promise<{ stored: boolean; preview: string | null; updatedAt?: string }>;
    },
  });
}

// ── API Key Panel ───────────────────────────────────────────────────────────

function ApiKeyPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: keyData, isLoading: keyLoading } = useStoredKey();
  const [inputKey, setInputKey] = useState("");
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      const r = await apiFetch("/api/admin/stripe/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Failed to save");
      }
      return r.json();
    },
    onSuccess: () => {
      setInputKey("");
      qc.invalidateQueries({ queryKey: ["stripe-stored-key"] });
      qc.invalidateQueries({ queryKey: ["stripe-status"] });
      toast({ title: "API key saved", description: "The server will use this key immediately." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const r = await apiFetch("/api/admin/stripe/key", { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to remove");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stripe-stored-key"] });
      qc.invalidateQueries({ queryKey: ["stripe-status"] });
      toast({ title: "API key removed" });
    },
    onError: () => toast({ title: "Error removing key", variant: "destructive" }),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const r = await apiFetch("/api/admin/stripe/seed-products", { method: "POST" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); }
      return r.json();
    },
    onSuccess: () => toast({ title: "Products created", description: "Free, Pro & Elite products and prices are ready on Stripe." }),
    onError: (err: Error) => toast({ title: "Seed failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="font-serif flex items-center gap-2 text-base">
          <Key className="h-4 w-4 text-muted-foreground" />
          Stripe API Key
        </CardTitle>
        <CardDescription>
          Enter your Stripe secret key directly — takes priority over the Integrations connector.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {keyLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : keyData?.stored ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 px-4 py-2.5">
            <div>
              <p className="text-sm font-medium font-mono">{keyData.preview}</p>
              {keyData.updatedAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Saved {new Date(keyData.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-8"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                type={show ? "text" : "password"}
                placeholder="sk_live_… or sk_test_…"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="pr-10 font-mono text-sm"
                onKeyDown={(e) => { if (e.key === "Enter" && inputKey.trim()) saveMutation.mutate(inputKey.trim()); }}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShow((s) => !s)}
              >
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <Button
              onClick={() => saveMutation.mutate(inputKey.trim())}
              disabled={!inputKey.trim().startsWith("sk_") || saveMutation.isPending}
              size="sm"
            >
              Save
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Find your key at{" "}
            <a
              href="https://dashboard.stripe.com/apikeys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              dashboard.stripe.com/apikeys
            </a>
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending || (!keyData?.stored)}
          >
            <Sparkles className="h-3 w-3" />
            {seedMutation.isPending ? "Creating…" : "Setup Products"}
          </Button>
        </div>
        {seedMutation.isSuccess && (
          <p className="text-xs text-green-600 dark:text-green-400">
            Products created. Users can now subscribe to Free, Pro & Elite plans.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Webhook Secret Panel ────────────────────────────────────────────────────

function WebhookSecretPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useStoredWebhookSecret();
  const [inputSecret, setInputSecret] = useState("");
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveMutation = useMutation({
    mutationFn: async (secret: string) => {
      const r = await apiFetch("/api/admin/stripe/webhook-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed to save"); }
      return r.json();
    },
    onSuccess: () => {
      setInputSecret("");
      qc.invalidateQueries({ queryKey: ["stripe-webhook-secret"] });
      toast({ title: "Webhook secret saved", description: "Billing events will now be verified." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const r = await apiFetch("/api/admin/stripe/webhook-secret", { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to remove");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stripe-webhook-secret"] });
      toast({ title: "Webhook secret removed" });
    },
    onError: () => toast({ title: "Error removing secret", variant: "destructive" }),
  });

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="font-serif flex items-center gap-2 text-base">
          <Key className="h-4 w-4 text-muted-foreground" />
          Billing Webhook Secret
        </CardTitle>
        <CardDescription>
          Required so Stripe can verify incoming billing events. Find yours in the Stripe webhook dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : data?.stored ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 px-4 py-2.5">
            <div>
              <p className="text-sm font-medium font-mono">{data.preview}</p>
              {data.updatedAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Saved {new Date(data.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-8"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                type={show ? "text" : "password"}
                placeholder="whsec_…"
                value={inputSecret}
                onChange={(e) => setInputSecret(e.target.value)}
                className="pr-10 font-mono text-sm"
                onKeyDown={(e) => { if (e.key === "Enter" && inputSecret.trim()) saveMutation.mutate(inputSecret.trim()); }}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShow((s) => !s)}
              >
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <Button
              onClick={() => saveMutation.mutate(inputSecret.trim())}
              disabled={!inputSecret.trim().startsWith("whsec_") || saveMutation.isPending}
              size="sm"
            >
              Save
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Find your signing secret at{" "}
          <a
            href="https://dashboard.stripe.com/webhooks"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            dashboard.stripe.com/webhooks
          </a>
          . Register endpoint: <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/billing/webhook</code>
        </p>
      </CardContent>
    </Card>
  );
}

function useOverview() {
  return useQuery({
    queryKey: ["stripe-overview"],
    queryFn: async () => {
      const r = await apiFetch("/api/admin/stripe/overview");
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{
        revenue:       { total: number; succeeded: number };
        transactions:  { total: number; succeeded: number; failed: number };
        subscriptions: { total: number; active: number; canceled: number; past_due: number };
        refunds:       { total: number; count: number };
        customers:     { total: number };
      }>;
    },
  });
}

function useCharges(page: number) {
  return useQuery({
    queryKey: ["stripe-charges", page],
    queryFn: async () => {
      const r = await apiFetch(`/api/admin/stripe/charges?limit=${PAGE}&offset=${page * PAGE}`);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ data: Record<string, unknown>[]; total: number }>;
    },
  });
}

function useSubscriptions(page: number) {
  return useQuery({
    queryKey: ["stripe-subscriptions", page],
    queryFn: async () => {
      const r = await apiFetch(`/api/admin/stripe/subscriptions?limit=${PAGE}&offset=${page * PAGE}`);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ data: Record<string, unknown>[]; total: number }>;
    },
  });
}

function useCustomers(page: number, search: string) {
  return useQuery({
    queryKey: ["stripe-customers", page, search],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE), ...(search ? { search } : {}) });
      const r = await apiFetch(`/api/admin/stripe/customers?${qs}`);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ data: Record<string, unknown>[]; total: number }>;
    },
  });
}

function useRefunds(page: number) {
  return useQuery({
    queryKey: ["stripe-refunds", page],
    queryFn: async () => {
      const r = await apiFetch(`/api/admin/stripe/refunds?limit=${PAGE}&offset=${page * PAGE}`);
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{ data: Record<string, unknown>[]; total: number }>;
    },
  });
}

// ── components ─────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon }: { title: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-serif font-bold tabular-nums">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / PAGE);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-xs text-muted-foreground">
        {page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} of {total}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground text-sm">{label}</div>
  );
}

// ── tabs ───────────────────────────────────────────────────────────────────

function ChargesTab() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useCharges(page);
  const rows = data?.data ?? [];

  return (
    <div>
      {isLoading ? <TableSkeleton cols={5} /> : rows.length === 0 ? (
        <EmptyState label="No transactions yet. They'll appear here once you have payments." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Amount</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id as string} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-medium">{(r.customer_name as string) || "—"}</div>
                    <div className="text-xs text-muted-foreground">{(r.customer_email as string) || ""}</div>
                  </td>
                  <td className="py-2.5 px-3 tabular-nums font-medium">
                    {fmt(r.amount_received as number || r.amount as number, r.currency as string)}
                  </td>
                  <td className="py-2.5 px-3"><StatusBadge status={r.status as string} /></td>
                  <td className="py-2.5 px-3 text-muted-foreground">{fmtDate(r.created as number)}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{(r.id as string).slice(-12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={data?.total ?? 0} onPage={setPage} />
    </div>
  );
}

function SubscriptionsTab() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useSubscriptions(page);
  const rows = data?.data ?? [];

  return (
    <div>
      {isLoading ? <TableSkeleton cols={5} /> : rows.length === 0 ? (
        <EmptyState label="No subscriptions yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Plan</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Amount</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Renews</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rec = r.recurring as { interval?: string } | null;
                return (
                  <tr key={r.id as string} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-medium">{(r.customer_name as string) || "—"}</div>
                      <div className="text-xs text-muted-foreground">{(r.customer_email as string) || ""}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium">{(r.product_name as string) || "—"}</div>
                      {rec?.interval && <div className="text-xs text-muted-foreground capitalize">/{rec.interval}</div>}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums font-medium">
                      {r.unit_amount ? fmt(r.unit_amount as number, r.currency as string) : "—"}
                    </td>
                    <td className="py-2.5 px-3"><StatusBadge status={r.status as string} /></td>
                    <td className="py-2.5 px-3 text-muted-foreground">{fmtDate(r.current_period_end as number)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={data?.total ?? 0} onPage={setPage} />
    </div>
  );
}

function CustomersTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [committed, setCommitted] = useState("");
  const { data, isLoading } = useCustomers(page, committed);
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="pl-8 h-8 text-sm"
          placeholder="Search by email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setPage(0); setCommitted(search); } }}
        />
      </div>
      {isLoading ? <TableSkeleton cols={4} /> : rows.length === 0 ? (
        <EmptyState label="No customers yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Customer</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Total spent</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Payments</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Subscriptions</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id as string} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-medium">{(r.name as string) || "—"}</div>
                    <div className="text-xs text-muted-foreground">{(r.email as string) || ""}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium">
                    {fmt(r.total_spent as number, r.currency as string || "usd")}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{r.payment_count as number}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{r.subscription_count as number}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{fmtDate(r.created as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={data?.total ?? 0} onPage={setPage} />
    </div>
  );
}

function RefundsTab() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useRefunds(page);
  const rows = data?.data ?? [];

  return (
    <div>
      {isLoading ? <TableSkeleton cols={5} /> : rows.length === 0 ? (
        <EmptyState label="No refunds yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Amount</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Reason</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id as string} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-medium">{(r.customer_name as string) || "—"}</div>
                    <div className="text-xs text-muted-foreground">{(r.customer_email as string) || ""}</div>
                  </td>
                  <td className="py-2.5 px-3 tabular-nums font-medium">
                    {fmt(r.amount as number, r.currency as string)}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground capitalize">
                    {(r.reason as string)?.replace(/_/g, " ") || "—"}
                  </td>
                  <td className="py-2.5 px-3"><StatusBadge status={r.status as string} /></td>
                  <td className="py-2.5 px-3 text-muted-foreground">{fmtDate(r.created as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={data?.total ?? 0} onPage={setPage} />
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function AdminStripePage() {
  const { data: statusData } = useStripeStatus();
  const { data: overview, isLoading: overviewLoading } = useOverview();

  const connected = statusData?.connected ?? false;

  return (
    <AppLayout>
      <div className="space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin">
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-3 w-3" /> Admin
                </button>
              </Link>
            </div>
            <h1 className="text-3xl font-serif font-bold tracking-tight">Stripe</h1>
            <p className="text-muted-foreground mt-1">Transactions, subscriptions, customers and refunds.</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{
                background: connected ? "#16a34a18" : "#6b728018",
                color:      connected ? "#16a34a"   : "#6b7280",
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: connected ? "#16a34a" : "#6b7280",
                  display: "inline-block",
                }}
              />
              {connected ? "Connected" : "Not connected"}
            </span>
            {!connected && (
              <Badge variant="outline" className="text-xs font-normal">
                Connect Stripe via the Integrations tab
              </Badge>
            )}
          </div>
        </div>

        {/* API Key Panel — always visible */}
        <ApiKeyPanel />

        {/* Webhook Secret Panel */}
        <WebhookSecretPanel />

        {/* Not-connected banner */}
        {!connected && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 shadow-none">
            <CardContent className="pt-5 pb-5">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Stripe not connected</p>
              <p className="text-sm text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                Enter your Stripe secret key above, or open the Integrations tab and connect your Stripe account.
                Once connected, restart the API server and data will sync automatically.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Overview stats */}
        {overviewLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : overview ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Total revenue"
              value={fmt(Number(overview.revenue?.succeeded ?? 0))}
              sub={`${Number(overview.transactions?.succeeded ?? 0)} successful payments`}
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Active subscriptions"
              value={String(Number(overview.subscriptions?.active ?? 0))}
              sub={`${Number(overview.subscriptions?.total ?? 0)} total`}
              icon={<RefreshCcw className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Customers"
              value={String(Number(overview.customers?.total ?? 0))}
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Refunded"
              value={fmt(Number(overview.refunds?.total ?? 0))}
              sub={`${Number(overview.refunds?.count ?? 0)} refunds`}
              icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        ) : null}

        {/* Tabs */}
        <Tabs defaultValue="transactions">
          <TabsList className="mb-4">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="refunds">Refunds</TabsTrigger>
          </TabsList>

          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-serif">
                {/* dynamic title via tab */}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TabsContent value="transactions" className="mt-0">
                <CardDescription className="mb-4">All payment intents, most recent first.</CardDescription>
                <ChargesTab />
              </TabsContent>
              <TabsContent value="subscriptions" className="mt-0">
                <CardDescription className="mb-4">Recurring billing subscriptions.</CardDescription>
                <SubscriptionsTab />
              </TabsContent>
              <TabsContent value="customers" className="mt-0">
                <CardDescription className="mb-4">All Stripe customers with lifetime spend.</CardDescription>
                <CustomersTab />
              </TabsContent>
              <TabsContent value="refunds" className="mt-0">
                <CardDescription className="mb-4">Refunds issued across all payments.</CardDescription>
                <RefundsTab />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>

      </div>
    </AppLayout>
  );
}
