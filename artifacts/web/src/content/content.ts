export type ContentKind = "question" | "guide" | "landing" | "comparison";

export type ContentSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type ContentEntry = {
  kind: ContentKind;
  slug: string;
  title: string;
  description: string;
  category: string;
  shortAnswer?: string;
  sections: ContentSection[];
  related?: string[];
  published: string;
  updated?: string;
};

export const contentEntries: ContentEntry[] = [
  {
    kind: "question",
    slug: "what-is-an-ai-accountability-partner",
    title: "What Is an AI Accountability Partner?",
    description: "Learn what an AI accountability partner is, how it works, and how regular check-ins can help you stay focused on your goals.",
    category: "AI Accountability",
    shortAnswer: "An AI accountability partner is a digital assistant that helps you follow through on goals by checking in, asking about progress, reminding you about commitments, and helping you decide what to do next. Unlike a passive tracker, it can make accountability part of an ongoing conversation.",
    sections: [
      { heading: "How does AI accountability work?", paragraphs: ["A useful accountability system starts with a clear goal and a repeatable check-in. You report what happened, identify what is blocking progress, and choose the next action instead of simply recording a streak."] },
      { heading: "What should an AI accountability partner do?", bullets: ["Keep goals visible", "Prompt regular progress check-ins", "Help turn goals into concrete next actions", "Make missed progress easier to recover from", "Keep a useful history of progress"] },
      { heading: "Where GotThis fits", paragraphs: ["GotThis brings goal tracking and accountability into WhatsApp so check-ins can happen in a conversation you already use instead of requiring another productivity dashboard to remember to open."] },
    ],
    related: ["how-to-stay-accountable-to-your-goals", "can-i-track-goals-through-whatsapp"],
    published: "2026-08-30",
  },
  {
    kind: "question",
    slug: "how-to-stay-accountable-to-your-goals",
    title: "How Do I Stay Accountable to My Goals?",
    description: "A practical approach to staying accountable to your goals with clear commitments, regular check-ins and simple progress tracking.",
    category: "Accountability",
    shortAnswer: "Stay accountable by making your goal specific, choosing a measurable next action, setting a regular check-in, and recording whether you followed through. The most useful system makes missed commitments visible and helps you quickly choose the next action rather than abandoning the goal.",
    sections: [
      { heading: "Create a simple accountability loop", bullets: ["Define the outcome you want", "Choose the next measurable action", "Decide when you will check in", "Report what actually happened", "Adjust the next action when needed"] },
      { heading: "Why consistency matters more than perfect streaks", paragraphs: ["Missing one action does not have to end a goal. A strong accountability process makes it easy to acknowledge a miss, understand why it happened, and resume with a realistic next step."] },
    ],
    related: ["what-is-an-ai-accountability-partner", "can-i-track-goals-through-whatsapp"],
    published: "2026-08-30",
  },
  {
    kind: "question",
    slug: "can-i-track-goals-through-whatsapp",
    title: "Can I Track My Goals Through WhatsApp?",
    description: "Learn how WhatsApp can be used for goal check-ins, reminders, progress updates and accountability without another daily productivity app.",
    category: "WhatsApp Goal Tracking",
    shortAnswer: "Yes. You can track goals through WhatsApp by using regular check-ins, reminders and progress updates in a conversation. GotThis is designed around this approach, bringing goal tracking and accountability into WhatsApp so you can report progress without repeatedly opening a separate tracking app.",
    sections: [
      { heading: "How WhatsApp goal tracking works", bullets: ["Set a goal", "Define what progress looks like", "Choose a check-in rhythm", "Receive a prompt", "Report your progress", "Continue with the next action"] },
      { heading: "Why use a conversation for goal tracking?", paragraphs: ["Traditional trackers depend on you remembering to visit them. Conversational tracking can move the check-in closer to where you already communicate, reducing the extra step between a reminder and a progress update."] },
    ],
    related: ["what-is-an-ai-accountability-partner", "how-to-stay-accountable-to-your-goals"],
    published: "2026-08-30",
  },
  {
    kind: "guide",
    slug: "how-to-track-your-goals",
    title: "How to Track Your Goals Without Making It Complicated",
    description: "A practical guide to tracking goals with clear outcomes, measurable actions, useful check-ins and a simple review process.",
    category: "Goal Tracking",
    shortAnswer: "Effective goal tracking does not require a complicated dashboard. Define the outcome, identify the actions that move it forward, record progress consistently, and review often enough to change course when something is not working.",
    sections: [
      { heading: "Start with an outcome you can recognize", paragraphs: ["A goal becomes easier to track when you can clearly tell whether you are moving toward it. Replace vague intentions with an outcome and a timeframe that make progress observable."] },
      { heading: "Track actions as well as outcomes", paragraphs: ["Long-term outcomes often move slowly. Tracking the actions you control gives you faster feedback and helps you distinguish a difficult goal from an inconsistent process."] },
      { heading: "Use check-ins to decide what happens next", paragraphs: ["A check-in should do more than record a number. Use it to identify progress, blockers and the next concrete commitment. That turns tracking into an accountability loop."] },
    ],
    related: ["how-to-stay-accountable-to-your-goals", "can-i-track-goals-through-whatsapp"],
    published: "2026-08-30",
  },
];

export function getContent(kind: ContentKind, slug: string) {
  return contentEntries.find((entry) => entry.kind === kind && entry.slug === slug);
}

export function getContentByKind(kind: ContentKind) {
  return contentEntries.filter((entry) => entry.kind === kind);
}

export function contentPath(entry: ContentEntry) {
  const roots: Record<ContentKind, string> = { question: "/questions", guide: "/guides", landing: "/features", comparison: "/compare" };
  return `${roots[entry.kind]}/${entry.slug}`;
}
