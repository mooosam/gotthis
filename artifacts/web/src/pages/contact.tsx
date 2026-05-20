import { useState } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/public-layout";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulated submission — swap for a real endpoint when ready
    await new Promise((r) => setTimeout(r, 1200));
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <PublicLayout>
      <div className="pub-contact-hero pub-section">
        <div className="pub-wrap">
          <span className="pub-eyebrow" style={{ marginBottom: 24, display: "inline-flex" }}>
            <span className="pub-pulse" />
            Get in touch
          </span>
          <h1>We'd love to <em>hear from you.</em></h1>
          <p>Questions, feedback, partnership ideas — drop us a message and we'll get back to you within one business day.</p>
        </div>
      </div>

      <div className="pub-contact-grid pub-section">
        {/* Left: info */}
        <aside className="pub-contact-aside">
          <div className="pub-contact-item">
            <h4>Email</h4>
            <a href="mailto:hello@theritual.app">hello@theritual.app</a>
          </div>
          <div className="pub-contact-item">
            <h4>Support hours</h4>
            <p>Monday – Friday<br />9:00 AM – 6:00 PM GMT</p>
          </div>
          <div className="pub-contact-item">
            <h4>Response time</h4>
            <p>We aim to reply within 24 hours on business days. Complex issues may take a little longer.</p>
          </div>
          <div className="pub-contact-item">
            <h4>Looking for answers fast?</h4>
            <p>
              Check our{" "}
              <Link href="/faq" style={{ color: "#121212", textDecoration: "underline" }}>FAQ page</Link>
              {" "}— most common questions are answered there.
            </p>
          </div>
        </aside>

        {/* Right: form */}
        <div>
          {submitted ? (
            <div className="pub-form-success">
              <div className="pub-form-success-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h3>Message sent!</h3>
              <p>Thanks for reaching out. We'll be in touch within one business day.</p>
              <button
                onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                className="pub-btn pub-btn-outline"
                style={{ marginTop: 24 }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form className="pub-form" onSubmit={submit}>
              <div className="pub-form-row">
                <div className="pub-field">
                  <label htmlFor="name">Your name</label>
                  <input
                    id="name" type="text" required
                    placeholder="Alex Chen"
                    value={form.name} onChange={set("name")}
                  />
                </div>
                <div className="pub-field">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email" type="email" required
                    placeholder="alex@example.com"
                    value={form.email} onChange={set("email")}
                  />
                </div>
              </div>
              <div className="pub-field">
                <label htmlFor="subject">Subject</label>
                <select id="subject" value={form.subject} onChange={set("subject")} required>
                  <option value="" disabled>Select a topic…</option>
                  <option value="general">General enquiry</option>
                  <option value="support">Technical support</option>
                  <option value="billing">Billing question</option>
                  <option value="feature">Feature request</option>
                  <option value="partnership">Partnership / press</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="pub-field">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message" required
                  placeholder="Tell us what's on your mind…"
                  value={form.message} onChange={set("message")}
                />
              </div>
              <button
                type="submit"
                className="pub-btn pub-btn-lg"
                disabled={submitting}
                style={{ alignSelf: "flex-start", opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
