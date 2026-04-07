import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, ChevronRight } from "lucide-react";
import {
  useCompleteOnboarding,
  useUpdateMyProfile,
  useGetMyProfile,
  useCreateGoal,
  getGetMyProfileQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const CATEGORIES = ["Health", "Career", "Finance", "Learning", "Relationships", "Creative", "Other"];

const setupSchema = z.object({
  timezone: z.string().min(1, "Timezone is required"),
  phone: z.string().optional(),
});

const goalRowSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.string().min(1, "Category is required"),
  deadline: z.string().optional(),
  successCriteria: z.string().optional(),
});

type SetupValues = z.infer<typeof setupSchema>;
type GoalRowValues = z.infer<typeof goalRowSchema>;

export default function OnboardingPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [goalRows, setGoalRows] = useState<GoalRowValues[]>([
    { title: "", category: "Health", deadline: "", successCriteria: "" },
  ]);
  const [goalErrors, setGoalErrors] = useState<(string | null)[]>([null]);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useGetMyProfile();
  const updateProfile = useUpdateMyProfile();
  const completeOnboarding = useCompleteOnboarding();
  const createGoal = useCreateGoal();

  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      phone: "",
    },
  });

  useEffect(() => {
    if (!isLoading && profile?.onboardingCompleted) {
      setLocation("/dashboard");
    }
  }, [profile, isLoading, setLocation]);

  if (isLoading || profile?.onboardingCompleted) {
    return null;
  }

  const onSetupSubmit = async (data: SetupValues) => {
    try {
      await updateProfile.mutateAsync({
        data: {
          timezone: data.timezone,
          ...(data.phone ? { phone: data.phone } : {}),
        },
      });
      setStep(2);
    } catch {
      toast({ title: "Failed to save settings. Please try again.", variant: "destructive" });
    }
  };

  const updateGoalRow = (index: number, field: keyof GoalRowValues, value: string) => {
    setGoalRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    setGoalErrors((errs) => errs.map((e, i) => (i === index ? null : e)));
  };

  const addGoalRow = () => {
    if (goalRows.length < 3) {
      setGoalRows((rows) => [...rows, { title: "", category: "Health", deadline: "", successCriteria: "" }]);
      setGoalErrors((errs) => [...errs, null]);
    }
  };

  const removeGoalRow = (index: number) => {
    setGoalRows((rows) => rows.filter((_, i) => i !== index));
    setGoalErrors((errs) => errs.filter((_, i) => i !== index));
  };

  const onGoalsSubmit = async () => {
    const filledRows = goalRows.filter((r) => r.title.trim().length > 0);

    if (filledRows.length === 0) {
      setGoalErrors(goalRows.map((_, i) => (i === 0 ? "At least one goal title is required" : null)));
      return;
    }

    const newErrors = goalRows.map((r) =>
      r.title.trim() === "" && filledRows.length > 0 ? null : null
    );
    setGoalErrors(newErrors);
    if (newErrors.some(Boolean)) return;

    try {
      for (const row of filledRows) {
        await createGoal.mutateAsync({
          data: {
            title: row.title.trim(),
            category: row.category,
            deadline: row.deadline || undefined,
            successCriteria: row.successCriteria || undefined,
          },
        });
      }

      await completeOnboarding.mutateAsync();
      queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });

      toast({ title: "Setup complete", description: "Welcome to The Ritual." });
      setLocation("/dashboard");
    } catch {
      toast({ title: "Failed to complete setup. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-xl space-y-4">
        <div className="flex items-center gap-2 justify-center mb-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            1 Setup
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            2 First Goals
          </span>
        </div>

        {step === 1 && (
          <Card className="border-border/40 shadow-sm" data-testid="onboarding-step-1">
            <CardHeader className="space-y-2 pb-6">
              <CardTitle className="font-serif text-3xl font-bold">Set up your Ritual</CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                Configure how your AI coach will interact with you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSetupSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timezone</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-timezone">
                              <SelectValue placeholder="Select a timezone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz} value={tz}>
                                {tz}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Determines when your daily prompts arrive.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+1234567890" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormDescription>
                          For the WhatsApp integration. Leave blank to use the web dashboard only.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={updateProfile.isPending}
                    data-testid="button-next-setup"
                  >
                    {updateProfile.isPending ? "Saving..." : "Next: Set your goals"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-border/40 shadow-sm" data-testid="onboarding-step-2">
            <CardHeader className="space-y-2 pb-4">
              <CardTitle className="font-serif text-3xl font-bold">Your first goals</CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                Add 1 to 3 goals to get started. You can add more later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {goalRows.map((row, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border/40 p-4 space-y-3 bg-muted/20"
                    data-testid={`goal-row-${index}`}
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">Goal {index + 1}</Badge>
                      {goalRows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeGoalRow(index)}
                          data-testid={`button-remove-goal-${index}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Title</label>
                        <Input
                          placeholder="What do you want to achieve?"
                          value={row.title}
                          onChange={(e) => updateGoalRow(index, "title", e.target.value)}
                          className="mt-1"
                          data-testid={`input-goal-title-${index}`}
                        />
                        {goalErrors[index] && (
                          <p className="text-xs text-destructive mt-1">{goalErrors[index]}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium">Category</label>
                          <Select
                            value={row.category}
                            onValueChange={(v) => updateGoalRow(index, "category", v)}
                          >
                            <SelectTrigger className="mt-1" data-testid={`select-goal-category-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Deadline (optional)</label>
                          <Input
                            type="date"
                            value={row.deadline}
                            onChange={(e) => updateGoalRow(index, "deadline", e.target.value)}
                            className="mt-1"
                            data-testid={`input-goal-deadline-${index}`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Success criteria (optional)</label>
                        <Input
                          placeholder="How will you know you've succeeded?"
                          value={row.successCriteria}
                          onChange={(e) => updateGoalRow(index, "successCriteria", e.target.value)}
                          className="mt-1"
                          data-testid={`input-goal-criteria-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {goalRows.length < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={addGoalRow}
                  data-testid="button-add-goal"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add another goal
                </Button>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                  disabled={createGoal.isPending || completeOnboarding.isPending}
                  data-testid="button-back-setup"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={onGoalsSubmit}
                  disabled={createGoal.isPending || completeOnboarding.isPending}
                  data-testid="button-complete-onboarding"
                >
                  {createGoal.isPending || completeOnboarding.isPending
                    ? "Starting your ritual..."
                    : "Begin my Ritual"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
