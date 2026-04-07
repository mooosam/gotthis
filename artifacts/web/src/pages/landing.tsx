import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/40">
        <div className="font-serif font-bold text-xl tracking-tight">The Ritual</div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" data-testid="link-sign-in">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button data-testid="link-sign-up">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center max-w-4xl mx-auto py-20">
        <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tight mb-6 max-w-3xl">
          Quiet clarity. Purposeful discipline.
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl font-light">
          A thoughtful AI coaching companion that lives in your WhatsApp, helping you show up every day.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <Link href="/sign-up">
            <Button size="lg" className="text-lg h-14 px-8" data-testid="button-hero-signup">
              Start Your Ritual
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 text-left border-t border-border/40 pt-16 mt-8">
          <div>
            <h3 className="font-serif font-bold text-xl mb-3">WhatsApp First</h3>
            <p className="text-muted-foreground leading-relaxed">
              No new apps to install. Your coach checks in with you where you already spend your time, making reflection effortless.
            </p>
          </div>
          <div>
            <h3 className="font-serif font-bold text-xl mb-3">Daily Accountability</h3>
            <p className="text-muted-foreground leading-relaxed">
              A structured daily log that tracks your progress, identifies patterns, and keeps your most important goals in focus.
            </p>
          </div>
          <div>
            <h3 className="font-serif font-bold text-xl mb-3">Deep Insights</h3>
            <p className="text-muted-foreground leading-relaxed">
              Review your progress on a dense, thoughtful dashboard. See your streaks, read your narratives, and understand your trajectory.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
