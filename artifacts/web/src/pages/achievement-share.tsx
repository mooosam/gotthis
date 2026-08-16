import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SharedAchievement {
  title: string;
  subtitle: string | null;
  value: number | null;
  valueLabel: string | null;
  goalTitle: string | null;
}

export default function AchievementSharePage({ token }: { token: string }) {
  const [data, setData] = useState<SharedAchievement | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/achievement-share/${token}`)
      .then((response) => {
        if (!response.ok) throw new Error("Not found");
        return response.json();
      })
      .then(setData)
      .catch(() => setError(true));
  }, [token]);

  if (error) {
    return <div className="min-h-screen flex items-center justify-center p-6"><div className="text-center"><Award className="h-10 w-10 mx-auto mb-3 text-muted-foreground" /><p className="text-muted-foreground">This achievement is no longer shared.</p></div></div>;
  }
  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#f7f7f8] flex items-center justify-center p-5">
      <div className="w-full max-w-lg space-y-5">
        <img src={`/api/achievement-share/${token}/card.svg`} alt={`${data.title} achievement card`} className="w-full rounded-[28px] shadow-xl" />
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">A real milestone tracked with GotThis.</p>
          <Button asChild className="w-full"><a href="/sign-up">Set a goal with GotThis</a></Button>
        </div>
      </div>
    </div>
  );
}
