import { useEffect, useState } from "react";
import { Award, Check, Share2, Shield, Trophy } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Achievement {
  id: string;
  achievementType: string;
  title: string;
  subtitle: string | null;
  value: number | null;
  valueLabel: string | null;
  goalTitle: string | null;
  shareToken: string | null;
  createdAt: string;
}

async function svgToPngFile(svgUrl: string, fileName: string): Promise<File | null> {
  try {
    const response = await fetch(svgUrl);
    if (!response.ok) return null;
    const svg = await response.blob();
    const url = URL.createObjectURL(svg);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Unable to render card"));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(image, 0, 0, 1080, 1080);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
      return png ? new File([png], fileName, { type: "image/png" }) : null;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

export default function AchievementsPage() {
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [hideGoalName, setHideGoalName] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/achievements");
      if (!response.ok) throw new Error("Failed to load achievements");
      const data = await response.json() as { achievements: Achievement[] };
      setItems(data.achievements);
    } catch {
      toast({ title: "Could not load achievements", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const shareAchievement = async (achievement: Achievement) => {
    setSharingId(achievement.id);
    try {
      const response = await apiFetch(`/api/achievements/${achievement.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hideGoalName }),
      });
      if (!response.ok) throw new Error("Unable to enable sharing");
      const data = await response.json() as { shareToken: string; publicPath: string; cardPath: string };
      const publicUrl = `${window.location.origin}${data.publicPath}`;
      const cardUrl = `${window.location.origin}${data.cardPath}`;
      const file = await svgToPngFile(cardUrl, `gotthis-${achievement.achievementType}.png`);

      if (file && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: achievement.title,
          text: "A small win worth celebrating — tracked with GotThis.",
          url: publicUrl,
          files: [file],
        });
      } else if (navigator.share) {
        await navigator.share({ title: achievement.title, text: "Tracked with GotThis.", url: publicUrl });
      } else {
        await navigator.clipboard.writeText(publicUrl);
        toast({ title: "Share link copied" });
      }
      await load();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast({ title: "Could not share achievement", variant: "destructive" });
    } finally {
      setSharingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-7">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-violet-600"><Trophy className="h-5 w-5" /><span className="text-sm font-semibold">Your wins</span></div>
            <h1 className="text-3xl font-serif font-bold tracking-tight">Achievements</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">Meaningful milestones GotThis has verified from your real progress. Nothing here is public unless you choose to share it.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground border rounded-lg px-3 py-2 bg-background">
            <Checkbox checked={hideGoalName} onCheckedChange={(value) => setHideGoalName(value === true)} />
            Hide goal name when sharing
          </label>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Shield className="h-4 w-4" /><span>Private by default. Sharing can be disabled later.</span></div>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading achievements…</div>
        ) : items.length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-16 text-center"><Award className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" /><h2 className="font-semibold">Your first achievement is on the way</h2><p className="text-sm text-muted-foreground mt-1">Complete milestones, build streaks, and reach your recurring goals.</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((achievement) => (
              <Card key={achievement.id} className="overflow-hidden border-border/50">
                <CardContent className="p-0">
                  <div className="p-5 bg-gradient-to-br from-slate-950 to-slate-800 text-white min-h-[220px] flex flex-col justify-between">
                    <div className="flex justify-between gap-3 items-start">
                      <span className="text-xs tracking-[0.2em] font-bold text-slate-300">GOTTHIS</span>
                      <Badge className="bg-white/10 text-white hover:bg-white/10 border-white/10"><Check className="h-3 w-3 mr-1" />Unlocked</Badge>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{achievement.title}</div>
                      <div className="text-slate-300 mt-1">{achievement.goalTitle ?? achievement.subtitle}</div>
                      {achievement.value !== null && <div className="mt-5 text-3xl font-bold">{achievement.value} <span className="text-base font-medium text-slate-300">{achievement.valueLabel}</span></div>}
                    </div>
                    <div className="h-2 rounded-full bg-white/15 overflow-hidden"><div className="h-full w-full bg-violet-500 rounded-full" /></div>
                  </div>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">Earned {new Date(achievement.createdAt).toLocaleDateString()}</div>
                    <Button size="sm" onClick={() => void shareAchievement(achievement)} disabled={sharingId === achievement.id}>
                      <Share2 className="h-4 w-4 mr-2" />{sharingId === achievement.id ? "Preparing…" : "Share"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
