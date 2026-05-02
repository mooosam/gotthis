import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Plus, Check, Target, Flame, PauseCircle, Trash2, Pencil, Minus, Repeat, TrendingUp, Activity, Flag } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  useListGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  getListGoalsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CATEGORIES = [
  "All",
  "Health",
  "Career",
  "Finance",
  "Learning",
  "Relationships",
  "Creative",
  "Other",
];

const goalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  deadline: z.string().optional(),
  successCriteria: z.string().optional(),
  cadence: z.enum(["daily", "ongoing"]),
  goalType: z.enum(["habit", "target", "average", "milestone"]),
  targetValue: z.number().int().nonnegative().optional(),
  targetUnit: z.string().optional(),
  parentGoalId: z.string().optional(),
});

const NONE_PARENT = "__none__";

const editGoalSchema = goalSchema.extend({
  progress: z.number().min(0).max(100),
  currentValue: z.number().int().nonnegative().optional(),
});

type GoalValues = z.infer<typeof goalSchema>;
type EditGoalValues = z.infer<typeof editGoalSchema>;

interface GoalRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  deadline: string | null;
  successCriteria: string | null;
  status: string;
  progress: number;
  currentStreak: number;
  cadence: string;
  goalType: string;
  targetValue: number | null;
  targetUnit: string | null;
  currentValue: number;
  parentGoalId: string | null;
}

const GOAL_TYPE_META: Record<
  string,
  { label: string; description: string; icon: typeof Repeat }
> = {
  habit: {
    label: "Habit",
    description: "Yes/no daily completion. Builds streaks.",
    icon: Repeat,
  },
  target: {
    label: "Target",
    description: "Quantitative — accumulate toward a number.",
    icon: TrendingUp,
  },
  average: {
    label: "Average",
    description: "Maintain a baseline value over time.",
    icon: Activity,
  },
  milestone: {
    label: "Milestone",
    description: "Project broken into ordered steps.",
    icon: Flag,
  },
};

export default function GoalsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<GoalRow | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: goals, isLoading } = useListGoals({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createForm = useForm<GoalValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "Health",
      deadline: "",
      successCriteria: "",
      cadence: "daily",
      goalType: "habit",
      targetValue: undefined,
      targetUnit: "",
      parentGoalId: NONE_PARENT,
    },
  });

  const editForm = useForm<EditGoalValues>({
    resolver: zodResolver(editGoalSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "Health",
      deadline: "",
      successCriteria: "",
      cadence: "daily",
      goalType: "habit",
      targetValue: undefined,
      targetUnit: "",
      progress: 0,
      currentValue: 0,
      parentGoalId: NONE_PARENT,
    },
  });

  const watchedCreateType = createForm.watch("goalType");
  const watchedEditType = editForm.watch("goalType");

  const invalidateGoals = () => {
    queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey({ status: statusFilter }) });
  };

  const onCreateSubmit = async (data: GoalValues) => {
    try {
      const isQuant = data.goalType === "target" || data.goalType === "average";
      const parentGoalId =
        data.parentGoalId && data.parentGoalId !== NONE_PARENT ? data.parentGoalId : undefined;
      await createGoal.mutateAsync({
        data: {
          title: data.title,
          description: data.description || undefined,
          category: data.category,
          deadline: data.deadline || undefined,
          successCriteria: data.successCriteria || undefined,
          cadence: data.cadence,
          goalType: data.goalType,
          targetValue: isQuant && data.targetValue ? data.targetValue : undefined,
          targetUnit: isQuant && data.targetUnit ? data.targetUnit : undefined,
          parentGoalId,
        },
      });
      invalidateGoals();
      toast({ title: "Goal created" });
      setIsCreateOpen(false);
      createForm.reset();
    } catch {
      toast({ title: "Failed to create goal", variant: "destructive" });
    }
  };

  const openEdit = (goal: GoalRow) => {
    setEditTarget(goal);
    const goalType = (["habit", "target", "average", "milestone"] as const).includes(
      goal.goalType as "habit" | "target" | "average" | "milestone",
    )
      ? (goal.goalType as "habit" | "target" | "average" | "milestone")
      : "habit";
    editForm.reset({
      title: goal.title,
      description: goal.description || "",
      category: goal.category,
      deadline: goal.deadline || "",
      successCriteria: goal.successCriteria || "",
      cadence: (goal.cadence === "ongoing" ? "ongoing" : "daily") as "daily" | "ongoing",
      goalType,
      targetValue: goal.targetValue ?? undefined,
      targetUnit: goal.targetUnit ?? "",
      progress: goal.progress,
      currentValue: goal.currentValue ?? 0,
      parentGoalId: goal.parentGoalId ?? NONE_PARENT,
    });
  };

  const onEditSubmit = async (data: EditGoalValues) => {
    if (!editTarget) return;
    try {
      const isQuant = data.goalType === "target" || data.goalType === "average";
      const parentGoalId =
        data.parentGoalId && data.parentGoalId !== NONE_PARENT ? data.parentGoalId : null;
      await updateGoal.mutateAsync({
        id: editTarget.id,
        data: {
          title: data.title,
          description: data.description || undefined,
          category: data.category,
          deadline: data.deadline || undefined,
          successCriteria: data.successCriteria || undefined,
          cadence: data.cadence,
          goalType: data.goalType,
          ...(isQuant && data.targetValue !== undefined ? { targetValue: data.targetValue } : {}),
          ...(isQuant && data.targetUnit ? { targetUnit: data.targetUnit } : {}),
          ...(isQuant ? { currentValue: data.currentValue ?? 0 } : {}),
          ...(isQuant ? {} : { progress: data.progress }),
          parentGoalId,
        },
      });
      invalidateGoals();
      toast({ title: "Goal updated" });
      setEditTarget(null);
    } catch {
      toast({ title: "Failed to update goal", variant: "destructive" });
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await updateGoal.mutateAsync({ id, data: { status: "paused" } });
      invalidateGoals();
      toast({ title: "Goal paused" });
    } catch {
      toast({ title: "Failed to pause goal", variant: "destructive" });
    }
  };

  const handleResume = async (id: string) => {
    try {
      await updateGoal.mutateAsync({ id, data: { status: "active" } });
      invalidateGoals();
      toast({ title: "Goal resumed" });
    } catch {
      toast({ title: "Failed to resume goal", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGoal.mutateAsync({ id });
      invalidateGoals();
      toast({ title: "Goal deleted" });
    } catch {
      toast({ title: "Failed to delete goal", variant: "destructive" });
    } finally {
      setDeleteTargetId(null);
    }
  };

  const filteredGoals = goals?.filter(
    (g) => categoryFilter === "All" || g.category === categoryFilter
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1
              className="text-3xl font-serif font-bold tracking-tight"
              data-testid="heading-goals"
            >
              Goals
            </h1>
            <p className="text-muted-foreground mt-2">Define your targets and track your progress.</p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-goal">
                <Plus className="mr-2 h-4 w-4" /> New Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="font-serif">Create a new goal</DialogTitle>
                <DialogDescription>
                  Define what you want to achieve and set the parameters for success.
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={createForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="E.g., Read 20 pages daily"
                            {...field}
                            data-testid="input-goal-title"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-goal-category">
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="deadline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deadline (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              data-testid="input-goal-deadline"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={createForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Why is this important?"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
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

                  <FormField
                    control={createForm.control}
                    name="goalType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Goal type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-goal-type">
                              <SelectValue placeholder="Choose how to track this goal" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(GOAL_TYPE_META).map(([value, meta]) => (
                              <SelectItem key={value} value={value}>
                                {meta.label} — {meta.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {(watchedCreateType === "target" || watchedCreateType === "average") && (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="targetValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {watchedCreateType === "target" ? "Target amount" : "Target average"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                inputMode="numeric"
                                placeholder="e.g. 5000"
                                value={field.value ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  field.onChange(v === "" ? undefined : Number(v));
                                }}
                                data-testid="input-target-value"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="targetUnit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="$ / km / hrs"
                                {...field}
                                data-testid="input-target-unit"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {watchedCreateType === "habit" && (
                    <FormField
                      control={createForm.control}
                      name="cadence"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tracking cadence</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select cadence" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="daily">Daily — resets each morning, builds streaks</SelectItem>
                              <SelectItem value="ongoing">Ongoing — accumulates over time, no daily reset</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={createForm.control}
                    name="parentGoalId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent goal (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? NONE_PARENT}>
                          <FormControl>
                            <SelectTrigger data-testid="select-parent-goal">
                              <SelectValue placeholder="No parent" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NONE_PARENT}>No parent — top-level goal</SelectItem>
                            {(goals ?? [])
                              .filter((g) => g.status === "active")
                              .map((g) => (
                                <SelectItem key={g.id} value={g.id}>
                                  {g.title}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      disabled={createGoal.isPending}
                      data-testid="button-submit-goal"
                    >
                      {createGoal.isPending ? "Creating..." : "Create Goal"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Status + Category filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="active" data-testid="tab-active">Active</TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
              <TabsTrigger value="paused" data-testid="tab-paused">Paused</TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger
              className="w-full sm:w-40"
              data-testid="select-category-filter"
            >
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : filteredGoals && filteredGoals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGoals.map((goal) => (
              <Card
                key={goal.id}
                className="h-full flex flex-col border-border/40 shadow-sm"
                data-testid={`card-goal-${goal.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="font-normal text-xs">
                        {goal.category}
                      </Badge>
                      {(() => {
                        const meta = GOAL_TYPE_META[goal.goalType ?? "habit"] ?? GOAL_TYPE_META.habit;
                        const Icon = meta.icon;
                        return (
                          <Badge
                            variant="outline"
                            className="font-normal text-xs gap-1"
                            data-testid={`badge-goal-type-${goal.id}`}
                          >
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                        );
                      })()}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-60 hover:opacity-100"
                          data-testid={`button-goal-menu-${goal.id}`}
                        >
                          <span className="sr-only">Open menu</span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <circle cx="12" cy="5" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="19" r="1.5" />
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openEdit(goal as GoalRow)}
                          data-testid={`menu-edit-${goal.id}`}
                        >
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        {goal.status !== "paused" && (
                          <DropdownMenuItem
                            onClick={() => handleArchive(goal.id)}
                            data-testid={`menu-archive-${goal.id}`}
                          >
                            <PauseCircle className="mr-2 h-4 w-4" /> Pause
                          </DropdownMenuItem>
                        )}
                        {goal.status === "paused" && (
                          <DropdownMenuItem
                            onClick={() => handleResume(goal.id)}
                            data-testid={`menu-resume-${goal.id}`}
                          >
                            <Check className="mr-2 h-4 w-4" /> Resume
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <Link href={`/goal/${goal.id}`}>
                            <span>View detail</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTargetId(goal.id)}
                          data-testid={`menu-delete-${goal.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Link href={`/goal/${goal.id}`}>
                    <CardTitle className="text-lg font-serif mt-2 line-clamp-1 hover:text-primary transition-colors cursor-pointer">
                      {goal.title}
                    </CardTitle>
                  </Link>
                </CardHeader>
                <CardContent className="flex-1 pb-3">
                  {goal.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {goal.description}
                    </p>
                  )}

                  <div className="space-y-1 mt-auto">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {(goal.goalType === "target" || goal.goalType === "average") && goal.targetValue
                          ? `${goal.currentValue ?? 0}${goal.targetUnit ?? ""} of ${goal.targetValue}${goal.targetUnit ?? ""}`
                          : "Progress"}
                      </span>
                      <span>{goal.progress}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 text-xs text-muted-foreground flex justify-between border-t border-border/40 px-6 py-3 mt-4 bg-muted/20">
                  <div className="flex items-center gap-2">
                    {(goal.goalType ?? "habit") === "habit" ? (
                      <div className="flex items-center gap-1">
                        <Flame className="h-3 w-3" />
                        <span>{goal.currentStreak} day streak</span>
                      </div>
                    ) : (
                      <span className="text-xs">
                        {GOAL_TYPE_META[goal.goalType]?.label ?? "Goal"}
                      </span>
                    )}
                    {goal.cadence === "ongoing" && (goal.goalType ?? "habit") === "habit" && (
                      <Badge variant="outline" className="text-xs py-0 h-4 font-normal">ongoing</Badge>
                    )}
                  </div>
                  {goal.deadline && (
                    <span>Due {format(new Date(goal.deadline), "MMM d")}</span>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-muted/30 rounded-lg border border-border/40 border-dashed">
            <Target className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No goals found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {statusFilter === "active"
                ? "You don't have any active goals yet."
                : `You don't have any ${statusFilter} goals.`}
            </p>
            {statusFilter === "active" && (
              <Button onClick={() => setIsCreateOpen(true)} variant="outline">
                Create your first goal
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit goal</DialogTitle>
            <DialogDescription>Update your goal details and adjust your progress.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-2">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-goal-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-goal-category">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deadline</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-edit-goal-deadline" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="successCriteria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Success Criteria</FormLabel>
                    <FormControl>
                      <Textarea placeholder="How will you know when you've achieved this?" className="resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="goalType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-goal-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(GOAL_TYPE_META).map(([value, meta]) => (
                          <SelectItem key={value} value={value}>
                            {meta.label} — {meta.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(watchedEditType === "target" || watchedEditType === "average") && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="targetValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {watchedEditType === "target" ? "Target amount" : "Target average"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              field.onChange(v === "" ? undefined : Number(v));
                            }}
                            data-testid="input-edit-target-value"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="targetUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <FormControl>
                          <Input placeholder="$ / km / hrs" {...field} data-testid="input-edit-target-unit" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {watchedEditType === "habit" && (
                <FormField
                  control={editForm.control}
                  name="cadence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tracking cadence</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily — resets each morning, builds streaks</SelectItem>
                          <SelectItem value="ongoing">Ongoing — accumulates over time, no daily reset</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {(watchedEditType === "target" || watchedEditType === "average") ? (
                <FormField
                  control={editForm.control}
                  name="currentValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Current value{editForm.getValues("targetUnit") ? ` (${editForm.getValues("targetUnit")})` : ""}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(Math.max(0, Number(e.target.value || 0)))}
                          data-testid="input-edit-current-value"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={editForm.control}
                  name="progress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Progress (%)</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0"
                            onClick={() => field.onChange(Math.max(0, field.value - 5))}
                            aria-label="Decrease progress"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={field.value}
                            onChange={(e) => field.onChange(Math.max(0, Math.min(100, Number(e.target.value))))}
                            className="text-center w-20"
                            data-testid="input-edit-goal-progress"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0"
                            onClick={() => field.onChange(Math.min(100, field.value + 5))}
                            aria-label="Increase progress"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <div className="flex-1 bg-secondary rounded-full h-2 ml-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${field.value}%` }}
                            />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={editForm.control}
                name="parentGoalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent goal (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? NONE_PARENT}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-parent-goal">
                          <SelectValue placeholder="No parent" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_PARENT}>No parent — top-level goal</SelectItem>
                        {(goals ?? [])
                          .filter((g) => g.status === "active" && g.id !== editTarget?.id)
                          .map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateGoal.isPending}
                  data-testid="button-save-goal-edit"
                >
                  {updateGoal.isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The goal and all associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTargetId && handleDelete(deleteTargetId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
