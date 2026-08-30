import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";

function NumberBox({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="block"><span className="block text-sm font-medium mb-2">{label}</span><input className="w-full rounded-xl border bg-background px-4 py-3" type="number" min="0" value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

export function ToolsHub() {
  const tools = [
    ["Goal progress calculator", "See how much of your goal is done.", "/tools/goal-progress-calculator"],
    ["Goal planner", "Turn one big goal into a small next step.", "/tools/goal-planner"],
    ["SMART goal helper", "Make a goal clear and easy to track.", "/tools/smart-goal-generator"],
    ["Accountability check-in", "Make a short check-in you can use today.", "/tools/accountability-check-in-generator"],
  ];
  return <PublicLayout><main className="min-h-screen"><div className="mx-auto max-w-5xl px-6 py-14"><Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link><header className="max-w-3xl mt-8 mb-12"><div className="text-sm font-medium text-muted-foreground mb-3">Free tools</div><h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Simple tools for your goals</h1><p className="mt-5 text-lg text-muted-foreground">Plan a goal. Check your progress. Make your next step clear.</p></header><div className="grid gap-5 md:grid-cols-2">{tools.map(([title, text, href]) => <Link key={href} href={href} className="block rounded-2xl border p-6 hover:bg-muted/40"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 text-muted-foreground">{text}</p></Link>)}</div></div></main></PublicLayout>;
}

export function GoalProgressCalculator() {
  const [target, setTarget] = useState(100); const [done, setDone] = useState(25);
  const percent = target > 0 ? Math.min(100, Math.max(0, Math.round((done / target) * 100))) : 0;
  return <Tool title="Goal progress calculator" intro="Enter your goal and what you have done so far."><div className="grid gap-5 sm:grid-cols-2"><NumberBox label="Goal amount" value={target} onChange={setTarget} /><NumberBox label="Done so far" value={done} onChange={setDone} /></div><Result>{percent}% done</Result><p className="text-muted-foreground">Example: Your goal is 100 pages. You read 25 pages. You are 25% done.</p></Tool>;
}

export function GoalPlanner() {
  const [goal, setGoal] = useState("Read 100 pages this month"); const [step, setStep] = useState("Read 10 pages today");
  return <Tool title="Goal planner" intro="Write the big goal. Then make the next step small."><TextBox label="My goal" value={goal} onChange={setGoal} /><TextBox label="My next step" value={step} onChange={setStep} /><Result>{step || "Add one small next step."}</Result></Tool>;
}

export function SmartGoalGenerator() {
  const [action, setAction] = useState("read"); const [amount, setAmount] = useState("10 pages"); const [when, setWhen] = useState("each day");
  const goal = useMemo(() => `I will ${action || "do my goal"} ${amount || ""} ${when || ""}.`.replace(/\s+/g, " "), [action, amount, when]);
  return <Tool title="SMART goal helper" intro="Make your goal clear. You should know what to do and when to do it."><TextBox label="What will you do?" value={action} onChange={setAction} /><TextBox label="How much?" value={amount} onChange={setAmount} /><TextBox label="When?" value={when} onChange={setWhen} /><Result>{goal}</Result></Tool>;
}

export function AccountabilityCheckInGenerator() {
  const [goal, setGoal] = useState("read 10 pages");
  return <Tool title="Accountability check-in" intro="Make a short question that asks about your goal."><TextBox label="What did you plan to do?" value={goal} onChange={setGoal} /><Result>Did you {goal || "work on your goal"} today?</Result><p className="text-muted-foreground">Keep the answer simple too. For example: “Yes, I read 10 pages.”</p></Tool>;
}

function TextBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block mb-5"><span className="block text-sm font-medium mb-2">{label}</span><input className="w-full rounded-xl border bg-background px-4 py-3" value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
function Result({ children }: { children: React.ReactNode }) { return <div className="my-7 rounded-2xl border bg-muted/30 p-6"><div className="text-sm font-medium text-muted-foreground mb-2">Your result</div><div className="text-2xl font-semibold">{children}</div></div>; }
function Tool({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) { return <PublicLayout><main className="min-h-screen"><div className="mx-auto max-w-3xl px-6 py-14"><nav className="text-sm text-muted-foreground mb-8"><Link href="/">Home</Link><span className="mx-2">/</span><Link href="/tools">Tools</Link><span className="mx-2">/</span><span className="text-foreground">{title}</span></nav><h1 className="text-4xl md:text-5xl font-semibold tracking-tight">{title}</h1><p className="mt-5 mb-10 text-lg text-muted-foreground">{intro}</p>{children}<section className="mt-14 border-t pt-10"><h2 className="text-2xl font-semibold">Want help keeping the goal in sight?</h2><p className="mt-3 text-muted-foreground">GotThis can check in about your goals through WhatsApp.</p><Link href="/sign-up" className="inline-block mt-5 font-semibold underline underline-offset-4">Try GotThis</Link></section></div></main></PublicLayout>; }
