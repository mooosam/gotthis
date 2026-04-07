import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format, parseISO, addDays } from "date-fns";
import { ChevronLeft, ChevronRight, Save, Calendar as CalendarIcon, Sparkles, StickyNote } from "lucide-react";
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

const notesSchema = z.object({
  notes: z.string().optional(),
});

type NotesValues = z.infer<typeof notesSchema>;

function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime());
}

export default function ReviewPage({ date }: { date: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNotesEditor, setShowNotesEditor] = useState(false);

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

  const logNotFound = !isLoading && !log && error !== null;

  const form = useForm<NotesValues>({
    resolver: zodResolver(notesSchema),
    defaultValues: { notes: "" },
  });

  useEffect(() => {
    if (log) {
      const logData = log.data as Record<string, unknown> | null;
      form.reset({ notes: (logData?.personalNotes as string) || "" });
    }
  }, [log, form]);

  const navigateDate = (days: number) => {
    const currentDate = parseISO(date);
    const newDate = addDays(currentDate, days);
    setLocation(`/review/${format(newDate, "yyyy-MM-dd")}`);
  };

  const onSaveNotes = async (data: NotesValues) => {
    const existingData = (log?.data as Record<string, unknown>) || {};
    const updatedData = { ...existingData, personalNotes: data.notes || "" };

    try {
      if (log) {
        await updateLog.mutateAsync({
          date,
          data: {
            narrative: log.narrative || undefined,
            data: updatedData,
          },
        });
        toast({ title: "Notes saved" });
      } else {
        await createLog.mutateAsync({
          data: {
            logDate: date,
            data: updatedData,
          },
        });
        toast({ title: "Notes saved" });
      }
      queryClient.invalidateQueries({ queryKey: getGetDailyLogQueryKey(date) });
      setShowNotesEditor(false);
    } catch {
      toast({ title: "Failed to save notes", variant: "destructive" });
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
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  const parsedDate = parseISO(date);
  const formattedDate = isValidDate(parsedDate)
    ? format(parsedDate, "EEEE, MMMM d, yyyy")
    : "Invalid Date";

  const logDataObj = log?.data as Record<string, unknown> | null;
  const personalNotes = logDataObj?.personalNotes as string | undefined;

  const goalStatuses = logDataObj?.goalStatuses as
    | Array<{ goalId: string; title: string; progressNote: string; status?: string }>
    | undefined;

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

        {/* AI Narrative — primary content */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Coaching Summary
            </CardTitle>
            <CardDescription>
              Generated from your WhatsApp conversation on this day.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {log?.narrative ? (
              <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-foreground whitespace-pre-wrap">
                {log.narrative}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Sparkles className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium mb-1">No AI summary for this date</p>
                <p className="text-xs">
                  {logNotFound
                    ? "There was no WhatsApp session recorded on this day."
                    : "Your coaching narrative will appear here after your morning or evening ritual."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-goal status for this day */}
        {goalStatuses && goalStatuses.length > 0 && (
          <Card className="border-border/40 shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Goal Check-ins</CardTitle>
              <CardDescription>Progress notes from your ritual conversation.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {goalStatuses.map((gs, i) => (
                  <div
                    key={gs.goalId || i}
                    className="p-3 rounded-md border border-border/30 bg-muted/20 space-y-1"
                    data-testid={`goal-status-${gs.goalId || i}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{gs.title}</p>
                      {gs.status && (
                        <Badge variant="secondary" className="text-xs font-normal capitalize">
                          {gs.status}
                        </Badge>
                      )}
                    </div>
                    {gs.progressNote && (
                      <p className="text-xs text-muted-foreground">{gs.progressNote}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active goals snapshot — shown when no AI goal statuses */}
        {(!goalStatuses || goalStatuses.length === 0) && activeGoals && activeGoals.length > 0 && (
          <Card className="border-border/40 shadow-sm bg-muted/10">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Active Goals</CardTitle>
              <CardDescription>Your ongoing pursuits at the time of this review.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/20"
                    data-testid={`review-goal-row-${goal.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{goal.title}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 bg-secondary rounded-full h-1">
                          <div
                            className="bg-primary h-1 rounded-full"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{goal.progress}%</span>
                      </div>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {goal.category}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Personal notes */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-muted-foreground" />
                Personal Notes
              </CardTitle>
              <CardDescription className="mt-1">Your own reflections for this day.</CardDescription>
            </div>
            {!showNotesEditor && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNotesEditor(true)}
                data-testid="button-edit-notes"
              >
                {personalNotes ? "Edit" : "Add notes"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {showNotesEditor ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSaveNotes)} className="space-y-3">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="What stood out today? Any reflections or intentions..."
                            className="min-h-[160px] resize-none text-base leading-relaxed"
                            {...field}
                            data-testid="textarea-personal-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNotesEditor(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={updateLog.isPending || createLog.isPending}
                      data-testid="button-save-notes"
                    >
                      <Save className="mr-2 h-3.5 w-3.5" />
                      {updateLog.isPending || createLog.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </form>
              </Form>
            ) : personalNotes ? (
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {personalNotes}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No personal notes for this day. Click "Add notes" to write your reflections.
              </p>
            )}
          </CardContent>
        </Card>

        {log && (
          <div className="text-xs text-muted-foreground text-center">
            Last updated: {format(new Date(log.updatedAt), "MMM d, yyyy h:mm a")}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
