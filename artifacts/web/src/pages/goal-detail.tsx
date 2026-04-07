import { useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, Edit, Trash, Target, Flame, CheckCircle2, Save, CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { 
  useGetGoal, 
  useUpdateGoal, 
  useDeleteGoal, 
  getGetGoalQueryKey,
  useListDailyLogs
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  
  // Fetch some recent logs to show related to this goal (mocking chart data for now based on goal progress)
  const { data: logs } = useListDailyLogs({ limit: 14 });
  
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [progressValue, setProgressValue] = useState<number[]>([0]);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);

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
  useState(() => {
    if (goal) {
      form.reset({
        title: goal.title,
        description: goal.description || "",
        category: goal.category,
        deadline: goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : "",
        successCriteria: goal.successCriteria || "",
        status: goal.status as any,
      });
      setProgressValue([goal.progress]);
    }
  });

  const onEditSubmit = async (data: EditGoalValues) => {
    try {
      await updateGoal.mutateAsync({
        id,
        data: {
          title: data.title,
          description: data.description || undefined,
          category: data.category,
          deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
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

  // Generate some fake chart data to show progression over time
  // In a real app, this would come from the backend based on historical log data
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      name: format(d, 'MMM d'),
      progress: Math.max(0, goal.progress - (6 - i) * 5 + Math.random() * 10)
    };
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
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => {
                  form.reset({
                    title: goal.title,
                    description: goal.description || "",
                    category: goal.category,
                    deadline: goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : "",
                    successCriteria: goal.successCriteria || "",
                    status: goal.status as any,
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
              
              <div className="h-64 w-full mt-8">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)"
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="progress" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorProgress)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
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
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
