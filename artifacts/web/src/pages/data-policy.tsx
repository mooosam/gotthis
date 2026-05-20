import PublicLayout from "@/components/public-layout";
import { Link } from "wouter";

const toc = [
  { id: "who", label: "1. Who We Are" },
  { id: "collect", label: "2. Data We Collect" },
  { id: "use", label: "3. How We Use Your Data" },
  { id: "sharing", label: "4. Data Sharing" },
  { id: "retention", label: "5. Data Retention" },
  { id: "security", label: "6. Security" },
  { id: "rights", label: "7. Your Rights" },
  { id: "international", label: "8. International Transfers" },
  { id: "children", label: "9. Children" },
  { id: "changes", label: "10. Changes" },
  { id: "contact", label: "11. Contact" },
];

export default function DataPolicyPage() {
  return (
    <PublicLayout>
      <div className="pub-legal-hero pub-section">
        <div className="pub-wrap">
          <h1>Data Use Policy</h1>
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
            <p>This Data Use Policy explains what personal data Paceify Ltd. collects, why we collect it, how we use it, and the rights you have over it. We are committed to handling your data with care, transparency, and respect.</p>

            <h2 id="who">1. Who We Are</h2>
            <p>Paceify Ltd. is the data controller for personal data collected through the paceify.app website and service. If you have questions about this policy, contact us at <a href="mailto:privacy@paceify.app">privacy@paceify.app</a>.</p>

            <h2 id="collect">2. Data We Collect</h2>
            <p>We collect the following categories of personal data:</p>
            <ul>
              <li><strong>Account information</strong> — Your email address, name (if provided), and account creation date.</li>
              <li><strong>WhatsApp connection data</strong> — Your phone number (stored as a one-way cryptographic hash — we cannot reverse it to recover your original number), device session credentials (encrypted at rest), and connection timestamp.</li>
              <li><strong>Goal and progress data</strong> — The goals you create, your progress updates, notes, milestones, streaks, and completion records.</li>
              <li><strong>Message content</strong> — Text messages you send to the bot. These are processed by our AI system and then stored to populate your dashboard and context window.</li>
              <li><strong>Usage data</strong> — Message counts, token usage, feature interactions, and timestamps. Used to enforce plan limits and improve the service.</li>
              <li><strong>Device and browser data</strong> — IP address, browser type, and operating system. Collected automatically for security and analytics.</li>
              <li><strong>Payment data</strong> — Handled entirely by Stripe. We store only your subscription status and plan identifier — never card numbers or banking details.</li>
            </ul>

            <h2 id="use">3. How We Use Your Data</h2>
            <p>We use your data to:</p>
            <ul>
              <li>Provide and operate the service (process messages, update goals, serve the dashboard)</li>
              <li>Send check-in nudges and summaries via WhatsApp (where enabled)</li>
              <li>Enforce plan limits and calculate usage</li>
              <li>Improve the accuracy of our AI goal-routing system (using aggregated, anonymised patterns only)</li>
              <li>Send transactional emails (account confirmation, billing receipts, password resets)</li>
              <li>Detect and prevent fraud and abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p>We do not use your data for targeted advertising. We do not sell your data to third parties. We do not train generative AI models on your personal message content without explicit consent.</p>

            <h2 id="sharing">4. Data Sharing</h2>
            <p>We share data only with the following categories of third parties, and only to the extent necessary:</p>
            <ul>
              <li><strong>Anthropic</strong> — Your message content is sent to Anthropic's Claude API for AI processing. Anthropic's data processing agreements are in place and their API is not used to train models on customer data.</li>
              <li><strong>Clerk</strong> — Authentication and session management.</li>
              <li><strong>Stripe</strong> — Payment processing and subscription management.</li>
              <li><strong>Infrastructure providers</strong> — Cloud hosting (servers, databases) under appropriate data processing agreements.</li>
              <li><strong>Legal authorities</strong> — If required by law or valid legal process.</li>
            </ul>
            <p>We do not share your data with marketing companies, data brokers, or analytics platforms that build individual profiles.</p>

            <h2 id="retention">5. Data Retention</h2>
            <p>We retain your data for as long as your account is active. When you delete your account:</p>
            <ul>
              <li>Your profile, goals, logs, and message history are scheduled for permanent deletion within 30 days.</li>
              <li>Anonymised, aggregated usage statistics may be retained indefinitely.</li>
              <li>Billing records are retained for 7 years as required by financial regulations.</li>
            </ul>
            <p>You can request early deletion by contacting <a href="mailto:privacy@paceify.app">privacy@paceify.app</a>.</p>

            <h2 id="security">6. Security</h2>
            <p>We take security seriously and implement the following measures:</p>
            <ul>
              <li>All data in transit is encrypted using TLS 1.2 or higher.</li>
              <li>Phone numbers are stored as one-way hashed values and are never stored in plaintext.</li>
              <li>WhatsApp session credentials are encrypted at rest.</li>
              <li>Access to production systems is restricted and logged.</li>
              <li>We perform regular security reviews and dependency audits.</li>
            </ul>
            <p>Despite these measures, no system is completely secure. Please notify us immediately at <a href="mailto:security@paceify.app">security@paceify.app</a> if you believe your account has been compromised.</p>

            <h2 id="rights">7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
            <ul>
              <li><strong>Access</strong> — Request a copy of the data we hold about you.</li>
              <li><strong>Rectification</strong> — Ask us to correct inaccurate data.</li>
              <li><strong>Erasure</strong> — Request deletion of your data ("right to be forgotten").</li>
              <li><strong>Portability</strong> — Export your data in a machine-readable format (Elite plan users can do this directly from the dashboard).</li>
              <li><strong>Restriction</strong> — Ask us to limit how we process your data in certain circumstances.</li>
              <li><strong>Objection</strong> — Object to certain types of processing.</li>
              <li><strong>Withdraw consent</strong> — Where processing is based on consent, withdraw it at any time.</li>
            </ul>
            <p>To exercise any of these rights, contact us at <a href="mailto:privacy@paceify.app">privacy@paceify.app</a>. We will respond within 30 days.</p>

            <h2 id="international">8. International Data Transfers</h2>
            <p>Our infrastructure is primarily based in the European Union. Where data is transferred outside the EU/EEA (for example, to Anthropic's API infrastructure in the United States), we ensure appropriate safeguards are in place, including Standard Contractual Clauses approved by the European Commission.</p>

            <h2 id="children">9. Children</h2>
            <p>Paceify is not intended for children under the age of 16. We do not knowingly collect personal data from anyone under 16. If you believe a child has provided us with personal data, please contact us immediately and we will delete it.</p>

            <h2 id="changes">10. Changes to This Policy</h2>
            <p>We may update this Data Use Policy from time to time. We will notify you of significant changes via email or an in-app notice at least 14 days before they take effect. The "last updated" date at the top of this page always reflects the most recent version.</p>

            <h2 id="contact">11. Contact</h2>
            <p>For any privacy-related questions or requests, contact our Data Protection contact at <a href="mailto:privacy@paceify.app">privacy@paceify.app</a>, or via our <Link href="/contact">Contact page</Link>.</p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
