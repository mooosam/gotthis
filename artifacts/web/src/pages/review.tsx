import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format, parseISO, addDays } from "date-fns";
import { ChevronLeft, ChevronRight, Save, Calendar as CalendarIcon, FileText, Activity } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  useGetDailyLog,
  useCreateDailyLog,
  useUpdateDailyLog,
  useListGoals,
  getGetDailyLogQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

const logSchema = z.object({
  narrative: z.string().optional(),
});

type LogValues = z.infer<typeof logSchema>;

function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime());
}

function renderLogData(data: unknown): React.ReactNode {
  if (!data || (typeof data === "object" && Object.keys(data as object).length === 0)) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No structured data for this date.
      </p>
    );
  }
  if (typeof data !== "object" || data === null) {
    return <p className="text-sm">{String(data)}</p>;
  }
  return (
    <div className="space-y-4">
      {Object.entries(data as Record<string, unknown>).map(([key, value]) => (
        <div key={key} className="border-b border-border/40 pb-2 last:border-0 last:pb-0">
          <h4 className="text-sm font-medium capitalize text-muted-foreground mb-1">
            {key.replace(/_/g, " ")}
          </h4>
          <div className="text-sm">
            {typeof value === "object" && value !== null ? (
              <pre className="bg-muted p-2 rounded-md overflow-auto text-xs mt-1">
                {JSON.stringify(value, null, 2)}
              </pre>
            ) : (
              String(value)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReviewPage({ date }: { date: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: log,
    isLoading,
    error,
  } = useGetDailyLog(date, {
    query: {
      enabled: !!date,
      queryKey: getGetDailyLogQueryKey(date),
      retry: false,
    },
  });

  const { data: activeGoals } = useListGoals({ status: "active" });

  const createLog = useCreateDailyLog();
  const updateLog = useUpdateDailyLog();

  // Treat any error (most likely 404) as "no log exists yet"
  const logNotFound = !isLoading && !log && error !== null;

  const form = useForm<LogValues>({
    resolver: zodResolver(logSchema),
    defaultValues: { narrative: "" },
  });

  useEffect(() => {
    if (log) {
      form.reset({ narrative: log.narrative || "" });
    }
  }, [log, form]);

  const navigateDate = (days: number) => {
    const currentDate = parseISO(date);
    const newDate = addDays(currentDate, days);
    setLocation(`/review/${format(newDate, "yyyy-MM-dd")}`);
  };

  const onSubmit = async (data: LogValues) => {
    try {
      if (log) {
        await updateLog.mutateAsync({
          date,
          data: {
            narrative: data.narrative || undefined,
            data: log.data,
          },
        });
        toast({ title: "Review updated" });
      } else {
        await createLog.mutateAsync({
          data: {
            logDate: date,
            narrative: data.narrative || undefined,
            data: {},
          },
        });
        toast({ title: "Review created" });
      }
      queryClient.invalidateQueries({ queryKey: getGetDailyLogQueryKey(date) });
    } catch {
      toast({ title: "Failed to save review", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-[400px] md:col-span-2" />
            <Skeleton className="h-[400px]" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const parsedDate = parseISO(date);
  const formattedDate = isValidDate(parsedDate)
    ? format(parsedDate, "EEEE, MMMM d, yyyy")
    : "Invalid Date";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <CalendarIcon className="h-6 w-6 text-muted-foreground" />
              Daily Review
            </h1>
            <p className="text-muted-foreground mt-2">{formattedDate}</p>
          </div>

          <div className="flex items-center gap-2 bg-muted/50 rounded-md p-1 border border-border/40">
            <Button variant="ghost" size="sm" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <div className="w-px h-4 bg-border/50 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation(`/review/${format(new Date(), "yyyy-MM-dd")}`)}
            >
              Today
            </Button>
            <div className="w-px h-4 bg-border/50 mx-1" />
            <Button variant="ghost" size="sm" onClick={() => navigateDate(1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Narrative form */}
            <Card className="border-border/40 shadow-sm">
              <CardHeader>
                <CardTitle className="font-serif flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Narrative
                </CardTitle>
                <CardDescription>Your personal reflection for the day.</CardDescription>
              </CardHeader>
              <CardContent>
                {logNotFound && !log && (
                  <p className="text-sm text-muted-foreground italic mb-4">
                    No review exists for this date yet. Write your reflection below to create one.
                  </p>
                )}
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="narrative"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              placeholder="What went well today? What could be improved? Write your thoughts here..."
                              className="min-h-[250px] resize-none text-base leading-relaxed p-4"
                              {...field}
                              data-testid="textarea-narrative"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={updateLog.isPending || createLog.isPending}
                        data-testid="button-save-review"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {updateLog.isPending || createLog.isPending ? "Saving..." : "Save Review"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Active goals status breakdown */}
            {activeGoals && activeGoals.length > 0 && (
              <Card className="border-border/40 shadow-sm">
                <CardHeader>
                  <CardTitle className="font-serif text-lg">Active Goals</CardTitle>
                  <CardDescription>Your ongoing pursuits — refer to these during your review.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activeGoals.map((goal) => (
                      <div
                        key={goal.id}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border/30"
                        data-testid={`review-goal-row-${goal.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{goal.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-24 bg-secondary rounded-full h-1">
                              <div
                                className="bg-primary h-1 rounded-full"
                                style={{ width: `${goal.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{goal.progress}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                          <Badge variant="secondary" className="text-xs font-normal">
                            {goal.category}
                          </Badge>
                          {goal.currentStreak > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {goal.currentStreak}d streak
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {/* Structured data from AI coach */}
            <Card className="border-border/40 shadow-sm bg-muted/20">
              <CardHeader>
                <CardTitle className="font-serif text-lg flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  AI Coach Data
                </CardTitle>
                <CardDescription>Structured information from your WhatsApp conversation.</CardDescription>
              </CardHeader>
              <CardContent>{log ? renderLogData(log.data) : (
                <p className="text-sm text-muted-foreground italic">
                  No log exists for this date yet.
                </p>
              )}</CardContent>
            </Card>

            {log && (
              <div className="text-xs text-muted-foreground text-center">
                Last updated: {format(new Date(log.updatedAt), "MMM d, yyyy h:mm a")}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
