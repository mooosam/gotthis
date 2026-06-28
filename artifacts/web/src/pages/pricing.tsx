import { useState } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";

const CHECK = (
  <svg className="pub-plan-feat-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const plans = [
  {
    name: "Free",
    badge: "Get started",
    desc: "Everything you need to build a habit and see your dashboard grow.",
    monthly: 0,
    annual: 0,
    annualNote: null as string | null,
    cta: "Start for free",
    ctaLink: "/sign-up",
    featured: false,
    features: [
      "5 messages per day",
      "3 active goals",
      "WhatsApp connection",
      "Basic progress dashboard",
      "Community support",
    ],
  },
  {
    name: "Pro",
    badge: "Most popular",
    desc: "For serious goal-setters who want the full picture and daily accountability.",
    monthly: 12,
    annual: 8,
    annualNote: "$99 / year",
    cta: "Start Pro",
    ctaLink: "/sign-up",
    featured: true,
    features: [
      "50 messages per day",
      "10 active goals",
      "Email coaching channel",
      "Daily AI summaries",
      "Full progress charts",
      "Priority support",
    ],
  },
  {
    name: "Elite",
    badge: "Power users",
    desc: "Maximum capability for people who treat discipline as a craft.",
    monthly: 29,
    annual: 29,
    annualNote: "Monthly only",
    cta: "Start Elite",
    ctaLink: "/sign-up",
    featured: false,
    features: [
      "200 messages per day",
      "Unlimited active goals",
      "Everything in Pro",
      "Proactive nudges & check-ins",
      "Goal milestone planning",
      "Dedicated onboarding",
    ],
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <PublicLayout>
      <section className="pub-pricing-hero pub-section">
        <div className="pub-wrap">
          <span className="pub-eyebrow" style={{ margin: "0 auto 24px", display: "inline-flex" }}>
            <span className="pub-pulse" />
            Simple, honest pricing
          </span>
          <h1>One plan for every <em>ambition.</em></h1>
          <p>Start free. Upgrade when you're ready. No hidden fees, no lock-in.</p>

          <div className="pub-toggle-wrap">
            <span className={`pub-toggle-label${!annual ? " active" : ""}`}>Monthly</span>
            <button
              className={`pub-toggle-btn${annual ? " annual" : ""}`}
              onClick={() => setAnnual(!annual)}
              aria-label="Toggle annual billing"
            >
              <span className="pub-toggle-btn-knob" />
            </button>
            <span className={`pub-toggle-label${annual ? " active" : ""}`}>Annual</span>
            {annual && <span className="pub-save-badge">Save ~20%</span>}
          </div>
        </div>
      </section>

      <div className="pub-plans" style={{ maxWidth: 1100, margin: "0 auto" }}>
        {plans.map((plan) => (
          <div key={plan.name} className={`pub-plan${plan.featured ? " pub-plan-featured" : ""}`}>
            <div className="pub-plan-badge">
              {plan.featured && <span className="pub-pulse" />}
              {plan.badge}
            </div>
            <div className="pub-plan-name">{plan.name}</div>
            <div className="pub-plan-desc">{plan.desc}</div>
            <div className="pub-plan-price">
              <span className="pub-plan-price-amt">
                {plan.monthly === 0 ? "Free" : `$${annual ? plan.annual : plan.monthly}`}
              </span>
              {plan.monthly > 0 && (
                <span className="pub-plan-price-per">
                  {annual && plan.annualNote ? plan.annualNote : `/ month`}
                </span>
              )}
            </div>
            <div className="pub-plan-divider" />
            <div className="pub-plan-features">
              {plan.features.map((f) => (
                <div className="pub-plan-feat" key={f}>
                  {CHECK}
                  <span>{f}</span>
                </div>
              ))}
            </div>
            <Link
              href={plan.ctaLink}
              className={`pub-btn pub-plan-cta${plan.featured ? " pub-btn-green" : " pub-btn-outline"}`}
              style={{ justifyContent: "center" }}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* FAQ teaser */}
      <section className="pub-section" style={{ paddingBottom: 120, borderTop: "1px solid #E5E7EB", paddingTop: 80 }}>
        <div className="pub-wrap" style={{ textAlign: "center" }}>
          <div className="pub-section-eyebrow" style={{ marginBottom: 16 }}>↳ Questions?</div>
          <h2 className="pub-section-title" style={{ margin: "0 auto 20px", textAlign: "center" }}>
            Everything you need to <em>know.</em>
          </h2>
          <p style={{ color: "#64748B", fontSize: 17, marginBottom: 36, maxWidth: 420, margin: "0 auto 36px", lineHeight: 1.6 }}>
            We've answered the most common questions about plans, billing, and how GotThis works.
          </p>
          <Link href="/faq" className="pub-btn pub-btn-outline">Read the FAQ →</Link>
        </div>
      </section>

      <div className="pub-cta-band">
        <div className="pub-wrap">
          <h2>Start your <em>ritual</em> today.</h2>
          <p>No credit card required for the free tier. Cancel anytime.</p>
          <div className="pub-cta-band-btns">
            <Link href="/sign-up" className="pub-btn pub-btn-green pub-btn-lg">Get Started Free</Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
