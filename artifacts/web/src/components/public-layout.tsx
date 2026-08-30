import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import "@/styles/public.css";

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (location !== "/") return;
    const eyebrow = document.querySelector<HTMLElement>(".pub-eyebrow");
    if (eyebrow && eyebrow.textContent?.toLowerCase().includes("ritual")) {
      Array.from(eyebrow.childNodes).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
          node.textContent = node.textContent.replace(/rituals?/gi, "goals");
        }
      });
    }
    const cta = document.querySelector<HTMLElement>(".pub-cta-band h2");
    if (cta && cta.textContent?.toLowerCase().includes("ritual")) {
      cta.textContent = "Ready to start with GotThis?";
    }
  }, [location]);

  const isActive = (path: string) =>
    location === path || (path !== "/" && location.startsWith(`${path}/`))
      ? "pub-link pub-link-active"
      : "pub-link";

  return (
    <div className="pub">
      <header className={`pub-nav${scrolled ? " pub-nav-scrolled" : ""}`}>
        <Link href="/" className="pub-logo">
          <span className="pub-logo-dot" />
          GOTTHIS
        </Link>
        <nav className="pub-nav-links">
          <Link href="/" className={isActive("/")}>Home</Link>
          <Link href="/features" className={isActive("/features")}>Features</Link>
          <Link href="/questions" className={isActive("/questions")}>Learn</Link>
          <Link href="/tools" className={isActive("/tools")}>Tools</Link>
          <Link href="/pricing" className={isActive("/pricing")}>Pricing</Link>
          <Link href="/faq" className={isActive("/faq")}>FAQ</Link>
        </nav>
        <div className="pub-nav-right">
          <Link href="/sign-in" className="pub-btn pub-btn-ghost">Login</Link>
          <Link href="/sign-up" className="pub-btn">Get Started</Link>
        </div>
      </header>

      {children}

      <footer className="pub-footer">
        <div className="pub-foot-grid">
          <div className="pub-foot-col">
            <span className="pub-foot-brand-name">GOTTHIS</span>
            <p className="pub-foot-brand-desc">
              Track your goals through WhatsApp. Send an update, see your progress, and keep going.
            </p>
          </div>
          <div className="pub-foot-col">
            <div className="pub-foot-col-title">Explore</div>
            <Link href="/features">Features</Link>
            <Link href="/questions">Questions</Link>
            <Link href="/guides">Guides</Link>
            <Link href="/tools">Free Tools</Link>
            <Link href="/compare">Comparisons</Link>
          </div>
          <div className="pub-foot-col">
            <div className="pub-foot-col-title">Legal</div>
            <Link href="/terms">Terms &amp; Conditions</Link>
            <Link href="/cookies">Cookies Policy</Link>
            <Link href="/data-policy">Data Use Policy</Link>
          </div>
          <div className="pub-foot-col">
            <div className="pub-foot-col-title">Company</div>
            <Link href="/pricing">Pricing</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/contact">Contact Us</Link>
            <Link href="/sign-in">Login</Link>
            <Link href="/sign-up">Get Started</Link>
          </div>
        </div>
        <div className="pub-foot-bottom">
          <div>© {new Date().getFullYear()} GotThis Ltd. All rights reserved.</div>
          <div>Built to help you keep going.</div>
        </div>
      </footer>
    </div>
  );
}
