import { useState } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";

interface FaqItem {
  q: string;
  a: string | JSX.Element;
}

interface FaqSection {
  id: string;
  title: string;
  items: FaqItem[];
}

const sections: FaqSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    items: [
      {
        q: "What is The Ritual?",
        a: "The Ritual is a WhatsApp-first goal tracking assistant. You set up your goals on the dashboard, then simply text your progress to a WhatsApp number. Our AI reads your messages, updates the right goals, and keeps your dashboard growing — no new apps, no habits to form other than the ones you already have.",
      },
      {
        q: "Do I need to download anything?",
        a: "No. You only need a WhatsApp account (which you already have) and access to a web browser to view your dashboard. The Ritual does not require you to install any app.",
      },
      {
        q: "How do I connect my WhatsApp?",
        a: "After signing up, go to the WhatsApp page in your dashboard. Scan the QR code with your phone camera — exactly like adding any WhatsApp contact. Once confirmed, you can start texting your progress straight away.",
      },
      {
        q: "How long does setup take?",
        a: "Most users are fully set up in under two minutes. Sign up, create your first goal, scan the QR code, and send your first message. That's it.",
      },
    ],
  },
  {
    id: "using-the-bot",
    title: "Using the Bot",
    items: [
      {
        q: "What kinds of messages can I send?",
        a: "Write naturally. \"Did 50 pushups before breakfast.\" \"Finished chapter 3 of my book.\" \"Skipped the gym today — knee issue.\" \"Wrote 1,200 words on the report.\" Our AI understands context and maps your update to the right goal automatically.",
      },
      {
        q: "What if the bot misunderstands my message?",
        a: "You can always correct it. Send a follow-up like \"actually that was for my running goal\" or simply open the dashboard to manually adjust the entry. We're continuously improving the AI's accuracy.",
      },
      {
        q: "Can I send voice notes?",
        a: "Not yet — text messages only for now. Voice transcription is on our roadmap for a future release.",
      },
      {
        q: "Will the bot message me first?",
        a: "Yes — if you've enabled daily check-ins in your settings, The Ritual will send you a morning nudge to log your progress. You can customise the time and frequency, or turn it off entirely.",
      },
      {
        q: "Is there a message limit?",
        a: (
          <>
            Yes, limits depend on your plan: Free users get 20 messages/day, Pro users get 100, and Elite users get unlimited. You can view and upgrade your plan on the{" "}
            <Link href="/pricing">Pricing page</Link>.
          </>
        ),
      },
    ],
  },
  {
    id: "goals",
    title: "Goals & Tracking",
    items: [
      {
        q: "How many goals can I have?",
        a: "Free accounts support up to 3 active goals. Pro accounts allow unlimited goals, and you can archive or pause any goal at any time so your dashboard stays focused.",
      },
      {
        q: "What goal types are supported?",
        a: "The Ritual supports habits (daily/weekly recurring), outcomes (one-time targets with a deadline), and milestones (multi-step projects). You can set a target value, unit, and cadence for each.",
      },
      {
        q: "What if I miss a day?",
        a: "Nothing drastic. Your streak will pause, but it won't be wiped unless you miss more than your configured grace period. We believe in building resilience, not shame. You can always pick back up.",
      },
      {
        q: "Can I share my progress with someone?",
        a: "Yes. Every goal has a shareable link you can send to an accountability partner, coach, or anyone who wants to follow your progress. No login required to view a shared goal.",
      },
    ],
  },
  {
    id: "billing",
    title: "Account & Billing",
    items: [
      {
        q: "Is there a free tier?",
        a: "Yes. The Free tier gives you 20 messages per day, 3 active goals, and access to the core dashboard — forever, with no credit card required.",
      },
      {
        q: "Can I cancel my subscription at any time?",
        a: "Absolutely. You can cancel from your Account page at any time. You'll retain Pro/Elite access until the end of your current billing period, then revert to Free.",
      },
      {
        q: "Do you offer a discount for annual billing?",
        a: "Yes — paying annually saves you around 20% compared to monthly billing. You can switch to annual from your Account page or on the Pricing page.",
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit and debit cards (Visa, Mastercard, Amex) via Stripe. Bank transfers and invoicing are available for annual Elite plans — contact us to arrange.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & Data",
    items: [
      {
        q: "Who can read my messages?",
        a: "Only you and the AI system that processes them. Your message content is used solely to update your goals — it is never sold, shared with third parties, or used to train models without explicit consent.",
      },
      {
        q: "Is my WhatsApp linked permanently?",
        a: "No. You can disconnect your WhatsApp number from the dashboard at any time. This immediately stops the bot from processing new messages and removes the session credentials.",
      },
      {
        q: "Can I export my data?",
        a: "Elite accounts can export all goal data, messages, and daily logs as CSV or JSON from the dashboard. We believe your data belongs to you.",
      },
      {
        q: "How do I delete my account?",
        a: "You can request full account deletion from the Account settings page. This permanently removes your profile, goals, logs, and WhatsApp credentials within 30 days. See our Data Use Policy for details.",
      },
    ],
  },
];

function AccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pub-faq-item">
      <button className="pub-faq-q" onClick={() => setOpen(!open)}>
        <span>{item.q}</span>
        <svg
          className={`pub-faq-chevron${open ? " open" : ""}`}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className={`pub-faq-a${open ? " open" : ""}`}>
        <div className="pub-faq-a-inner">{item.a}</div>
      </div>
    </div>
  );
}

export default function FaqPage() {
  const [activeSection, setActiveSection] = useState("getting-started");

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <PublicLayout>
      <div className="pub-faq-hero pub-section">
        <div className="pub-wrap">
          <span className="pub-eyebrow" style={{ margin: "0 auto 24px", display: "inline-flex" }}>
            <span className="pub-pulse" />
            Knowledge base
          </span>
          <h1>Everything you need to <em>know.</em></h1>
          <p>Common questions about The Ritual, how the bot works, and what to expect.</p>
        </div>
      </div>

      <div className="pub-faq-body pub-section">
        <div className="pub-faq-grid pub-wrap">
          {/* Category sidebar */}
          <aside className="pub-faq-cats">
            {sections.map((s) => (
              <button
                key={s.id}
                className={`pub-faq-cat-link${activeSection === s.id ? " active" : ""}`}
                onClick={() => scrollTo(s.id)}
              >
                {s.title}
              </button>
            ))}
          </aside>

          {/* Questions */}
          <div>
            {sections.map((section) => (
              <div key={section.id} id={section.id} className="pub-faq-section">
                <div className="pub-faq-section-title">{section.title}</div>
                {section.items.map((item) => (
                  <AccordionItem key={item.q} item={item} />
                ))}
              </div>
            ))}

            <div style={{ paddingTop: 48, borderTop: "1px solid #E5E7EB", marginTop: 20 }}>
              <div className="pub-section-eyebrow" style={{ marginBottom: 12 }}>Still have questions?</div>
              <p style={{ color: "#64748B", fontSize: 15, marginBottom: 20, lineHeight: 1.6 }}>
                Can't find what you're looking for? Our team is happy to help.
              </p>
              <Link href="/contact" className="pub-btn">Contact Us</Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
