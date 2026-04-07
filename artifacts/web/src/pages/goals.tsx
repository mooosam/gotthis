import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Plus, Check, MoreVertical, Target } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { useListGoals, useCreateGoal, getListGoalsQueryKey } from "@workspace/api-client-react";
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
  "Health", "Career", "Finance", "Learning", "Relationships", "Creative", "Other"
];

const goalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  deadline: z.string().optional(),
  successCriteria: z.string().optional(),
});

type GoalValues = z.infer<typeof goalSchema>;

export default function GoalsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const { data: goals, isLoading } = useListGoals({ status: statusFilter !== "all" ? statusFilter : undefined });
  const createGoal = useCreateGoal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<GoalValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "Health",
      deadline: "",
      successCriteria: "",
    },
  });

  const onSubmit = async (data: GoalValues) => {
    try {
      await createGoal.mutateAsync({
        data: {
          title: data.title,
          description: data.description || undefined,
          category: data.category,
          deadline: data.deadline || undefined,
          successCriteria: data.successCriteria || undefined,
        }
      });
      
      queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey({ status: statusFilter }) });
      
      toast({ title: "Goal created" });
      setIsCreateOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: "Failed to create goal",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold tracking-tight" data-testid="heading-goals">Goals</h1>
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
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="E.g., Read 20 pages daily" {...field} data-testid="input-goal-title" />
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
                              <SelectTrigger data-testid="select-goal-category">
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
                      name="deadline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deadline (Optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-goal-deadline" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
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
                  
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={createGoal.isPending} data-testid="button-submit-goal">
                      {createGoal.isPending ? "Creating..." : "Create Goal"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="active" data-testid="tab-active">Active</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
            <TabsTrigger value="paused" data-testid="tab-paused">Paused</TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          </TabsList>
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          ) : goals && goals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {goals.map(goal => (
                <Link key={goal.id} href={`/goal/${goal.id}`}>
                  <Card className="h-full flex flex-col hover:border-primary/50 transition-colors cursor-pointer border-border/40 shadow-sm" data-testid={`card-goal-${goal.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-2">
                        <Badge variant="secondary" className="font-normal text-xs">{goal.category}</Badge>
                        {goal.status === "completed" && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <CardTitle className="text-lg font-serif mt-2 line-clamp-1">{goal.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 pb-3">
                      {goal.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {goal.description}
                        </p>
                      )}
                      
                      <div className="space-y-1 mt-auto">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
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
                      <div className="flex items-center gap-1">
                        <Flame className="h-3 w-3" /> 
                        <span>{goal.currentStreak} day streak</span>
                      </div>
                      {goal.deadline && (
                        <span>Due {format(new Date(goal.deadline), 'MMM d')}</span>
                      )}
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/30 rounded-lg border border-border/40 border-dashed">
              <Target className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No goals found</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {statusFilter === 'active' 
                  ? "You don't have any active goals yet." 
                  : `You don't have any ${statusFilter} goals.`}
              </p>
              {statusFilter === 'active' && (
                <Button onClick={() => setIsCreateOpen(true)} variant="outline">Create your first goal</Button>
              )}
            </div>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}

function Flame(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}
