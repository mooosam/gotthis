import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Flame, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ShareGoal {
  id: string;
  title: string;
  category: string;
  progress: number;
  currentStreak: number;
  longestStreak: number;
  createdAt: string;
}

interface ShareMilestone {
  id: string;
  title: string;
  order: number;
  completed: boolean;
  completedAt: string | null;
}

interface ShareData {
  goal: ShareGoal;
  milestones: ShareMilestone[];
  sharedAt: string;
}

const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function getApiBase(): string {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
  return apiBase || "";
}

export default function SharePage({ token }: { token: string }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${getApiBase()}/api/share/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("This progress card is no longer available."))
      .finally(() => setLoading(false));
  }, [token]);

  const signUpUrl = `${basePath}/sign-up`;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Target className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">{error ?? "Something went wrong."}</p>
        </div>
      </div>
    );
  }

  const { goal, milestones } = data;
  const completedMilestones = milestones.filter((m) => m.completed).length;
  const progressLabel = `${goal.progress}% done today`;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start py-12 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Progress shared via</p>
          <h1 className="text-2xl font-serif font-bold tracking-tight">The Ritual AI</h1>
        </div>

        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="font-serif text-xl leading-snug">{goal.title}</CardTitle>
              <Badge variant="secondary" className="font-normal shrink-0">{goal.category}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Today's progress</span>
                <span className="text-lg font-serif font-bold text-primary">{progressLabel}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, goal.progress)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-full">
                  <Flame className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Streak</p>
                  <p className="text-lg font-serif font-bold">{goal.currentStreak} days</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2.5 rounded-full">
                  <Flame className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Best streak</p>
                  <p className="text-lg font-serif font-bold">{goal.longestStreak} days</p>
                </div>
              </div>
            </div>

            {milestones.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Milestones — {completedMilestones} of {milestones.length} done
                </p>
                <div className="space-y-2">
                  {milestones.map((m) => (
                    <div key={m.id} className="flex items-start gap-3">
                      {m.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                      )}
                      <span className={`text-sm ${m.completed ? "line-through text-muted-foreground" : ""}`}>
                        {m.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Track your own goals on WhatsApp — no app to download.</p>
          <Button asChild className="w-full">
            <a href={signUpUrl}>Start tracking for free</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
