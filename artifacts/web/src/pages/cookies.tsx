import PublicLayout from "@/components/public-layout";
import { Link } from "wouter";

const toc = [
  { id: "what", label: "1. What Are Cookies" },
  { id: "types", label: "2. Types We Use" },
  { id: "third-party", label: "3. Third-Party Cookies" },
  { id: "manage", label: "4. Managing Cookies" },
  { id: "changes", label: "5. Changes to This Policy" },
  { id: "contact", label: "6. Contact" },
];

export default function CookiesPage() {
  return (
    <PublicLayout>
      <div className="pub-legal-hero pub-section">
        <div className="pub-wrap">
          <h1>Cookies Policy</h1>
          <p>Last updated: 1 May 2026</p>
        </div>
      </div>
      <div className="pub-legal-body pub-section">
        <div className="pub-legal-grid pub-wrap">
          <aside className="pub-legal-toc">
            <div className="pub-legal-toc-title">Contents</div>
            {toc.map((t) => <a key={t.id} href={`#${t.id}`}>{t.label}</a>)}
          </aside>
          <div className="pub-legal-content">
            <p>This Cookies Policy explains how The Ritual AI Ltd. ("we", "us", "our") uses cookies and similar tracking technologies when you visit our website or use our service.</p>

            <h2 id="what">1. What Are Cookies</h2>
            <p>Cookies are small text files stored on your device when you visit a website. They allow the website to remember your preferences and understand how you interact with it. Similar technologies include local storage, session storage, and pixels.</p>
            <p>Cookies can be "session" cookies (deleted when you close your browser) or "persistent" cookies (retained for a set period or until you delete them).</p>

            <h2 id="types">2. Types of Cookies We Use</h2>

            <p><strong>Strictly necessary cookies</strong> — These are essential for the website to function. They enable core features like authentication, session management, and security. You cannot opt out of these cookies as the service cannot function without them.</p>
            <ul>
              <li><strong>__clerk_session</strong> — Authentication session managed by Clerk. Expires when you sign out or after 30 days of inactivity.</li>
              <li><strong>__cf_bm</strong> — Cloudflare bot management. Session cookie.</li>
            </ul>

            <p><strong>Functional cookies</strong> — These allow us to remember your preferences such as theme (light/dark mode) and dashboard layout.</p>
            <ul>
              <li><strong>ritual_theme</strong> — Stores your UI theme preference. Persistent, 1 year.</li>
              <li><strong>ritual_prefs</strong> — Stores lightweight UI state. Persistent, 90 days.</li>
            </ul>

            <p><strong>Analytics cookies</strong> — These help us understand how users interact with the service so we can improve it. Data is aggregated and anonymised.</p>
            <ul>
              <li>We currently use privacy-first analytics that do not use tracking cookies or cross-site identifiers. No third-party analytics cookies are set at this time.</li>
            </ul>

            <p><strong>Marketing cookies</strong> — We do not currently use marketing or advertising cookies.</p>

            <h2 id="third-party">3. Third-Party Cookies</h2>
            <p>Our authentication provider, Clerk, may set cookies on our domain to manage sign-in sessions. These are governed by <a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer">Clerk's Privacy Policy</a>.</p>
            <p>Payment processing is handled by Stripe. Stripe may set cookies for fraud prevention and session continuity during checkout. These are governed by <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe's Privacy Policy</a>.</p>
            <p>We do not allow third-party advertising or tracking cookies on our service.</p>

            <h2 id="manage">4. Managing Cookies</h2>
            <p>You can control and delete cookies through your browser settings. Most browsers allow you to:</p>
            <ul>
              <li>View cookies stored on your device</li>
              <li>Delete all cookies or cookies from specific sites</li>
              <li>Block third-party cookies</li>
              <li>Block all cookies (note: this will break authentication)</li>
            </ul>
            <p>For instructions, refer to your browser's help documentation. Please note that disabling strictly necessary cookies will prevent you from using the service.</p>
            <p>To opt out of functional cookies, you can clear your browser's local storage for this domain. Your preferences will reset to defaults.</p>

            <h2 id="changes">5. Changes to This Policy</h2>
            <p>We may update this Cookies Policy as our technology or legal obligations change. Significant changes will be notified via the service or by email. The "last updated" date at the top of this page will always reflect the most recent version.</p>

            <h2 id="contact">6. Contact</h2>
            <p>If you have questions about our use of cookies, please contact us at <a href="mailto:privacy@theritual.app">privacy@theritual.app</a> or via our <Link href="/contact">Contact page</Link>.</p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
