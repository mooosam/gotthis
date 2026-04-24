import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, Edit, Trash, Target, Flame, CheckCircle2, Save, CalendarIcon, Circle, Plus, Share2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { 
  useGetGoal, 
  useUpdateGoal, 
  useDeleteGoal, 
  getGetGoalQueryKey,
  useListDailyLogs
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface Milestone {
  id: string;
  goalId: string;
  userId: string;
  title: string;
  order: number;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  "Health", "Career", "Finance", "Learning", "Relationships", "Creative", "Other"
];

const editGoalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  deadline: z.string().optional(),
  successCriteria: z.string().optional(),
  status: z.enum(["active", "completed", "paused"]),
});

type EditGoalValues = z.infer<typeof editGoalSchema>;

export default function GoalDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: goal, isLoading } = useGetGoal(id, { 
    query: { enabled: !!id, queryKey: getGetGoalQueryKey(id) } 
  });
  
  const { data: logs } = useListDailyLogs({ limit: 14 });
  
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [progressValue, setProgressValue] = useState<number[]>([0]);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);

  const fetchMilestones = useCallback(async () => {
    if (!id) return;
    const r = await apiFetch(`${API_BASE}/api/goals/${id}/milestones`);
    if (r.ok) {
      const data = await r.json();
      setMilestones(data);
    }
  }, [id]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  const handleAddMilestone = async () => {
    if (!newMilestoneTitle.trim()) return;
    setAddingMilestone(true);
    try {
      const r = await apiFetch(`${API_BASE}/api/goals/${id}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newMilestoneTitle.trim() }),
      });
      if (r.ok) {
        setNewMilestoneTitle("");
        setShowAddMilestone(false);
        await fetchMilestones();
      } else {
        toast({ title: "Failed to add milestone", variant: "destructive" });
      }
    } finally {
      setAddingMilestone(false);
    }
  };

  const handleToggleMilestone = async (milestone: Milestone) => {
    const r = await apiFetch(`${API_BASE}/api/goals/${id}/milestones/${milestone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !milestone.completed }),
    });
    if (r.ok) {
      await fetchMilestones();
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    const r = await apiFetch(`${API_BASE}/api/goals/${id}/milestones/${milestoneId}`, {
      method: "DELETE",
    });
    if (r.ok) {
      await fetchMilestones();
    }
  };

  const handleCopyShareLink = () => {
    if (!goal?.shareToken) return;
    const base = window.location.origin + (import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "");
    const url = `${base}/share/${goal.shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Share link copied" });
    });
  };

  const form = useForm<EditGoalValues>({
    resolver: zodResolver(editGoalSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "Health",
      deadline: "",
      successCriteria: "",
      status: "active",
    },
  });

  // Update form values when goal data loads
  useEffect(() => {
    if (goal) {
      const status = (["active", "completed", "paused"] as const).includes(
        goal.status as "active" | "completed" | "paused"
      )
        ? (goal.status as "active" | "completed" | "paused")
        : "active";
      form.reset({
        title: goal.title,
        description: goal.description || "",
        category: goal.category,
        deadline: goal.deadline ? new Date(goal.deadline).toISOString().split("T")[0] : "",
        successCriteria: goal.successCriteria || "",
        status,
      });
      setProgressValue([goal.progress]);
    }
  }, [goal, form]);

  const onEditSubmit = async (data: EditGoalValues) => {
    try {
      await updateGoal.mutateAsync({
        id,
        data: {
          title: data.title,
          description: data.description || undefined,
          category: data.category,
          deadline: data.deadline || undefined,
          successCriteria: data.successCriteria || undefined,
          status: data.status,
        }
      });
      
      queryClient.invalidateQueries({ queryKey: getGetGoalQueryKey(id) });
      setIsEditOpen(false);
      toast({ title: "Goal updated successfully" });
    } catch (error) {
      toast({ title: "Failed to update goal", variant: "destructive" });
    }
  };

  const handleProgressUpdate = async () => {
    if (!goal) return;
    setIsUpdatingProgress(true);
    try {
      await updateGoal.mutateAsync({
        id,
        data: { progress: progressValue[0] }
      });
      queryClient.invalidateQueries({ queryKey: getGetGoalQueryKey(id) });
      toast({ title: "Progress updated" });
    } catch (error) {
      toast({ title: "Failed to update progress", variant: "destructive" });
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteGoal.mutateAsync({ id });
      toast({ title: "Goal deleted" });
      setLocation("/goals");
    } catch (error) {
      toast({ title: "Failed to delete goal", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-24" />
          <div className="flex gap-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-1/4" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-64 md:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!goal) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <Target className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-2xl font-serif font-bold text-foreground">Goal not found</h2>
          <p className="text-muted-foreground mt-2 mb-6">The goal you are looking for does not exist or has been deleted.</p>
          <Link href="/goals">
            <Button>Return to Goals</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const recentLogDates = new Set(logs?.map((l) => l.logDate) ?? []);
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = format(d, "yyyy-MM-dd");
    return { label: format(d, "MMM d"), dateStr, hasLog: recentLogDates.has(dateStr) };
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/goals" className="hover:text-foreground flex items-center transition-colors">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Goals
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="secondary" className="font-normal">{goal.category}</Badge>
              <Badge 
                variant={goal.status === 'completed' ? 'default' : goal.status === 'paused' ? 'outline' : 'secondary'} 
                className="font-normal capitalize"
              >
                {goal.status}
              </Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-foreground" data-testid="goal-title">
              {goal.title}
            </h1>
            {goal.description && (
              <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed mt-2" data-testid="goal-description">
                {goal.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyShareLink}>
              <Share2 className="mr-2 h-4 w-4" /> Share
            </Button>
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => {
                  const status = (["active", "completed", "paused"] as const).includes(
                    goal.status as "active" | "completed" | "paused"
                  )
                    ? (goal.status as "active" | "completed" | "paused")
                    : "active";
                  form.reset({
                    title: goal.title,
                    description: goal.description || "",
                    category: goal.category,
                    deadline: goal.deadline ? new Date(goal.deadline).toISOString().split("T")[0] : "",
                    successCriteria: goal.successCriteria || "",
                    status,
                  });
                }}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="font-serif">Edit Goal</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {CATEGORIES.map(cat => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="deadline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deadline (Optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea className="resize-none" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="successCriteria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Success Criteria (Optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="How will you know when you've achieved this?" 
                              className="resize-none" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={updateGoal.isPending}>
                        {updateGoal.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive">
                  <Trash className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your goal and remove its data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <Card className="md:col-span-2 border-border/40 shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif">Progress Tracking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Current Progress</span>
                  <span className="text-2xl font-serif font-bold text-primary">{progressValue[0]}%</span>
                </div>
                <div className="flex gap-4 items-center">
                  <Slider 
                    value={progressValue} 
                    onValueChange={setProgressValue} 
                    max={100} 
                    step={1} 
                    className="flex-1"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleProgressUpdate} 
                    disabled={isUpdatingProgress || progressValue[0] === goal.progress}
                  >
                    <Save className="mr-2 h-4 w-4" /> Save
                  </Button>
                </div>
              </div>
              
              <div className="mt-6">
                <p className="text-sm font-medium mb-3 text-muted-foreground">Activity — last 7 days</p>
                <div className="flex gap-2 items-end">
                  {last7Days.map((day) => (
                    <div key={day.dateStr} className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className={`w-full rounded-sm h-6 ${day.hasLog ? "bg-primary" : "bg-secondary"}`}
                        title={day.hasLog ? `Log on ${day.label}` : `No log on ${day.label}`}
                      />
                      <span className="text-xs text-muted-foreground">{day.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {last7Days.filter((d) => d.hasLog).length} of 7 days logged
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/40 shadow-sm">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                      <Flame className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Current Streak</p>
                      <p className="text-2xl font-serif font-bold">{goal.currentStreak} Days</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="bg-muted p-3 rounded-full">
                      <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Longest Streak</p>
                      <p className="text-2xl font-serif font-bold">{goal.longestStreak} Days</p>
                    </div>
                  </div>
                  {goal.deadline && (
                    <div className="flex items-center gap-4">
                      <div className="bg-muted p-3 rounded-full">
                        <CalendarIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Deadline</p>
                        <p className="text-lg font-serif font-medium">{format(new Date(goal.deadline), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {goal.successCriteria && (
              <Card className="border-border/40 shadow-sm bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-primary">Success Criteria</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{goal.successCriteria}</p>
                </CardContent>
              </Card>
            )}

            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-serif text-base">Milestones</CardTitle>
                  <button
                    onClick={() => setShowAddMilestone((v) => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Add milestone"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {milestones.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {milestones.filter((m) => m.completed).length} of {milestones.length} completed
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {milestones.length === 0 && !showAddMilestone && (
                  <p className="text-sm text-muted-foreground">
                    No milestones yet. Break your goal into steps.
                  </p>
                )}
                {milestones.map((m, i) => (
                  <div key={m.id} className="flex items-start gap-2 group">
                    <button
                      onClick={() => handleToggleMilestone(m)}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {m.completed
                        ? <CheckCircle2 className="h-4 w-4 text-primary" />
                        : <Circle className="h-4 w-4" />}
                    </button>
                    <span className={`text-sm flex-1 leading-snug ${m.completed ? "line-through text-muted-foreground" : ""}`}>
                      <span className="text-xs text-muted-foreground mr-1">Step {i + 1}.</span>
                      {m.title}
                    </span>
                    <button
                      onClick={() => handleDeleteMilestone(m.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                      title="Remove"
                    >
                      <Trash className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {showAddMilestone && (
                  <div className="flex gap-2 pt-1">
                    <Input
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      placeholder="e.g. Run 3x this week"
                      className="text-sm h-8"
                      onKeyDown={(e) => e.key === "Enter" && handleAddMilestone()}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={handleAddMilestone}
                      disabled={addingMilestone || !newMilestoneTitle.trim()}
                    >
                      Add
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
