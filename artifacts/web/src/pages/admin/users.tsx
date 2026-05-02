import { useState } from "react";
import { Link } from "wouter";
import { Search, ChevronLeft, ChevronRight, Shield, ShieldOff, Eye } from "lucide-react";
import { useAdminListUsers } from "@workspace/api-client-react";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 25;

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("");
  const [page, setPage] = useState(0);

  const offset = page * PAGE_SIZE;
  const { data, isLoading, error } = useAdminListUsers({
    search: search || undefined,
    tier: tier || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="mb-2 -ml-3" data-testid="button-back-overview">
              <ChevronLeft className="h-4 w-4 mr-1" /> Overview
            </Button>
          </Link>
          <h1 className="text-3xl font-serif font-bold tracking-tight" data-testid="heading-admin-users">Users</h1>
          <p className="text-muted-foreground mt-2">Search, edit, suspend, or delete users.</p>
        </div>

        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif">Filters</CardTitle>
            <CardDescription>Search by email or Clerk ID; filter by tier.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search email or user ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
            <Input
              placeholder="Tier (e.g. free, pro)"
              value={tier}
              onChange={(e) => {
                setTier(e.target.value);
                setPage(0);
              }}
              className="md:w-48"
              data-testid="input-filter-tier"
            />
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-serif">All users</CardTitle>
              <CardDescription>{total.toLocaleString()} total · page {page + 1} of {totalPages}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)} data-testid="button-prev-page">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} data-testid="button-next-page">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive">Could not load users.</p>}
            {isLoading || !data ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded" />
                ))}
              </div>
            ) : data.users.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No users match these filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">Daily msgs</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.users.map((u) => (
                      <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                        <TableCell className="font-mono text-xs">
                          <div className="flex flex-col">
                            <span className="font-sans font-medium text-sm" data-testid={`text-email-${u.id}`}>{u.email || "(no email)"}</span>
                            <span className="text-muted-foreground truncate max-w-[200px]">{u.id}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{u.tier}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {u.dailyMessageCount} / {u.dailyMessageCap}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {u.monthlyTokenCount.toLocaleString()} / {u.monthlyTokenAllowance.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {u.isAdmin && (
                              <Badge variant="default" className="gap-1"><Shield className="h-3 w-3" /> admin</Badge>
                            )}
                            {u.isSuspended && (
                              <Badge variant="destructive" className="gap-1"><ShieldOff className="h-3 w-3" /> suspended</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/admin/users/${u.id}`}>
                            <Button variant="ghost" size="sm" data-testid={`button-view-${u.id}`}>
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
