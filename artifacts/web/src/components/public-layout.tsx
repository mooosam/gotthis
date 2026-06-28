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

  const isActive = (path: string) =>
    location === path ? "pub-link pub-link-active" : "pub-link";

  return (
    <div className="pub">
      <header className={`pub-nav${scrolled ? " pub-nav-scrolled" : ""}`}>
        <Link href="/" className="pub-logo">
          <span className="pub-logo-dot" />
          GOTTHIS
        </Link>
        <nav className="pub-nav-links">
          <Link href="/" className={isActive("/")}>Home</Link>
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
              The most frictionless way to stay honest with yourself. Track your goals via WhatsApp — no new apps, no logins.
            </p>
          </div>
          <div className="pub-foot-col">
            <div className="pub-foot-col-title">Navigate</div>
            <Link href="/">Home</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/faq">FAQ</Link>
          </div>
          <div className="pub-foot-col">
            <div className="pub-foot-col-title">Legal</div>
            <Link href="/terms">Terms &amp; Conditions</Link>
            <Link href="/cookies">Cookies Policy</Link>
            <Link href="/data-policy">Data Use Policy</Link>
          </div>
          <div className="pub-foot-col">
            <div className="pub-foot-col-title">Company</div>
            <Link href="/contact">Contact Us</Link>
            <Link href="/sign-in">Login</Link>
            <Link href="/sign-up">Get Started</Link>
          </div>
        </div>
        <div className="pub-foot-bottom">
          <div>© {new Date().getFullYear()} GotThis Ltd. All rights reserved.</div>
          <div>Created for those who value the ritual.</div>
        </div>
      </footer>
    </div>
  );
}
