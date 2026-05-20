import PublicLayout from "@/components/public-layout";
import { Link } from "wouter";

const toc = [
  { id: "acceptance", label: "1. Acceptance of Terms" },
  { id: "service", label: "2. The Service" },
  { id: "account", label: "3. Your Account" },
  { id: "prohibited", label: "4. Prohibited Uses" },
  { id: "ip", label: "5. Intellectual Property" },
  { id: "payment", label: "6. Payment & Billing" },
  { id: "termination", label: "7. Termination" },
  { id: "disclaimers", label: "8. Disclaimers" },
  { id: "liability", label: "9. Limitation of Liability" },
  { id: "changes", label: "10. Changes to Terms" },
  { id: "contact", label: "11. Contact" },
];

export default function TermsPage() {
  return (
    <PublicLayout>
      <div className="pub-legal-hero pub-section">
        <div className="pub-wrap">
          <h1>Terms &amp; Conditions</h1>
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
            <p>Please read these Terms &amp; Conditions carefully before using The Ritual. By accessing or using our service, you agree to be bound by these terms.</p>

            <h2 id="acceptance">1. Acceptance of Terms</h2>
            <p>By creating an account or using The Ritual in any way, you confirm that you are at least 16 years old and that you agree to these Terms &amp; Conditions and our <Link href="/data-policy">Data Use Policy</Link>. If you do not agree, please do not use the service.</p>

            <h2 id="service">2. The Service</h2>
            <p>The Ritual provides a WhatsApp-integrated goal tracking platform. We reserve the right to modify, suspend, or discontinue any part of the service at any time with reasonable notice. We will not be liable to you or any third party for any modification, suspension, or discontinuation of the service.</p>
            <p>The Ritual is provided "as is." While we work hard to keep things running smoothly, we cannot guarantee uninterrupted availability.</p>

            <h2 id="account">3. Your Account</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorised use of your account. We are not liable for any loss arising from your failure to keep your credentials secure.</p>
            <p>You must provide accurate and current information when registering. You may not create accounts for others without their explicit consent.</p>

            <h2 id="prohibited">4. Prohibited Uses</h2>
            <p>You agree not to use The Ritual to:</p>
            <ul>
              <li>Transmit content that is illegal, harmful, abusive, defamatory, or otherwise objectionable</li>
              <li>Attempt to reverse-engineer, scrape, or systematically extract data from the service</li>
              <li>Use automated scripts or bots to interact with the service beyond what is explicitly permitted</li>
              <li>Attempt to gain unauthorised access to any part of the service or its infrastructure</li>
              <li>Violate any applicable law or regulation</li>
              <li>Impersonate any person or entity</li>
            </ul>
            <p>We reserve the right to terminate accounts that violate these rules without notice or refund.</p>

            <h2 id="ip">5. Intellectual Property</h2>
            <p>The Ritual, its logo, interface design, and underlying software are owned by The Ritual AI Ltd. and are protected by copyright and other intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written permission.</p>
            <p>You retain full ownership of the content you create (your goals, notes, and messages). By using the service, you grant us a limited licence to process and store that content solely for the purpose of providing the service to you.</p>

            <h2 id="payment">6. Payment &amp; Billing</h2>
            <p>Paid plans are billed in advance on a monthly or annual basis. All prices are shown exclusive of any applicable taxes. We reserve the right to change pricing with 30 days' notice to existing subscribers.</p>
            <p>Refunds are not provided for partial periods. If you cancel, your paid access continues until the end of the current billing period. You may downgrade to the Free tier at any time.</p>

            <h2 id="termination">7. Termination</h2>
            <p>You may close your account at any time from your Account settings. We may terminate or suspend your account immediately if we determine you have violated these Terms, without notice or refund.</p>
            <p>Upon termination, your access to the service ceases. We will retain your data for 30 days before permanent deletion, during which you may request an export.</p>

            <h2 id="disclaimers">8. Disclaimers</h2>
            <p>The Ritual is a productivity and goal-tracking tool. It is not a medical, psychological, or professional coaching service. Nothing in the service constitutes professional advice. You use The Ritual at your own risk.</p>
            <p>We do not guarantee that using The Ritual will result in any particular outcome, habit formation, or goal achievement.</p>

            <h2 id="liability">9. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, The Ritual AI Ltd. shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service. Our total liability to you for any claim shall not exceed the amount you paid us in the three months preceding the claim.</p>

            <h2 id="changes">10. Changes to Terms</h2>
            <p>We may update these Terms at any time. Significant changes will be notified via email or an in-app notice at least 14 days before they take effect. Your continued use of the service after the effective date constitutes acceptance of the new Terms.</p>

            <h2 id="contact">11. Contact</h2>
            <p>For questions about these Terms, please contact us at <a href="mailto:legal@theritual.app">legal@theritual.app</a> or via our <Link href="/contact">Contact page</Link>.</p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
