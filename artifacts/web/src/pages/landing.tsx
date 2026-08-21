import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import PublicLayout from "@/components/public-layout";

const WHATSAPP_LINK = "https://wa.me/message/OCLPODRTGF7WH1";

export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const bar1Ref = useRef<HTMLElement>(null);
  const pct1Ref = useRef<HTMLSpanElement>(null);
  const deepSecRef = useRef<HTMLElement>(null);
  const typingRef = useRef<HTMLDivElement>(null);
  const liveBubbleRef = useRef<HTMLDivElement>(null);
  const counterValRef = useRef<HTMLDivElement>(null);
  const counterDeltaRef = useRef<HTMLDivElement>(null);
  // Sticky CTA after hero scroll
  useEffect(() => {
    const cta = ctaRef.current;
    const hero = heroRef.current;
    if (!cta || !hero) return;
    const onScroll = () => {
      const past = window.scrollY > hero.offsetHeight - 80;
      cta.classList.toggle("pub-cta-show", past);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-driven progress bar
  useEffect(() => {
    const bar = bar1Ref.current;
    const pct = pct1Ref.current;
    const deep = deepSecRef.current;
    if (!bar || !pct || !deep) return;
    const update = () => {
      const rect = deep.getBoundingClientRect();
      const vh = window.innerHeight;
      const t = Math.max(0, Math.min(1, (vh * 1.2 - rect.top) / (vh * 0.8)));
      const p = Math.round(20 + t * 70);
      bar.style.width = p + "%";
      pct.textContent = p + "%";
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  // Chat animation loop
  useEffect(() => {
    const typing = typingRef.current;
    const live = liveBubbleRef.current;
    const counter = counterValRef.current;
    const delta = counterDeltaRef.current;
    if (!typing || !live || !counter || !delta) return;
    let active = true;
    let n = 120;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    async function cycle() {
      while (active) {
        typing.style.display = "flex";
        live.style.display = "none";
        await sleep(2200);
        if (!active) break;
        typing.style.display = "none";
        live.style.display = "block";
        n += 50;
        counter.textContent = String(n);
        delta.textContent = "+50";
        counter.animate(
          [{ transform: "translateY(-4px)", opacity: "0.4" }, { transform: "translateY(0)", opacity: "1" }],
          { duration: 400, easing: "cubic-bezier(.2,.7,.2,1)" }
        );
        await sleep(3500);
        if (!active) break;
        n = 120;
        counter.textContent = "120";
        delta.textContent = "+50";
        await sleep(800);
      }
    }
    cycle();
    return () => { active = false; };
  }, []);

  return (
    <PublicLayout>
      {/* Sticky Get Started CTA */}
      <Link
        href="/sign-up"
        ref={ctaRef}
        className="pub-sticky-cta pub-btn pub-btn-green"
        style={{ display: "inline-flex" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h7v7h-7z" />
        </svg>
        Scan to Start
      </Link>

      {/* ===== HERO ===== */}
      <section className="pub-section pub-hero" ref={heroRef} id="start">
        <div className="pub-wrap pub-hero-grid">
          {/* Left: copy */}
          <div>
            <span className="pub-eyebrow">
              <span className="pub-pulse" />
              Now in beta · 1,247 rituals tracked today
            </span>
            <h1 className="pub-headline">
              Track your goals<br />via <em>WhatsApp.</em>
            </h1>
            <p className="pub-sub">
              No new apps. No logins. Just text your progress and watch your dashboard grow.
            </p>
            <a
              href={WHATSAPP_LINK}
              className="pub-qr-card"
              style={{ display: "flex", alignItems: "center", gap: 22, textDecoration: "none", cursor: "pointer" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="pub-qr-frame">
                <QRCodeSVG
                  value={WHATSAPP_LINK}
                  size={120}
                  bgColor="#ffffff"
                  fgColor="#121212"
                  style={{ display: "block", width: "100%", height: "100%" }}
                />
              </div>
              <div>
                <div className="pub-qr-title">
                  ↳ Scan to open WhatsApp
                </div>
                <div className="pub-qr-headline">Create your GotThis account in 10 seconds.</div>
                <div className="pub-qr-micro">No download required.</div>
              </div>
            </a>
            <div style={{ display: "flex", gap: 12, marginTop: 24, alignItems: "center" }}>
              <Link href="/sign-up" className="pub-btn pub-btn-lg">Get Started Free</Link>
              <Link href="/pricing" className="pub-btn pub-btn-ghost pub-btn-lg" style={{ opacity: 0.7 }}>
                View Pricing →
              </Link>
            </div>
          </div>

          {/* Right: visual */}
          <div className="pub-visual">
            {/* Counter chip */}
            <div className="pub-counter-chip">
              <div>
                <div className="pub-counter-lbl">Pushups · this week</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div className="pub-counter-val" ref={counterValRef}>120</div>
                  <div className="pub-counter-delta" ref={counterDeltaRef}>+50</div>
                </div>
              </div>
            </div>

            {/* Browser mockup */}
            <div className="pub-browser">
              <div className="pub-browser-bar">
                <div className="pub-dots"><span /><span /><span /></div>
                <div className="pub-url">gotthis.one/dashboard</div>
              </div>
              <div className="pub-browser-body">
                <div className="pub-dash-header">
                  <div className="pub-dash-title">Active Goals</div>
                  <div className="pub-dash-sub">Live · synced</div>
                </div>

                <div className="pub-goal-row pub-goal-highlight">
                  <div className="pub-goal-name">
                    <div className="pub-goal-ico">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6"/><path d="M6 6l12 12"/></svg>
                    </div>
                    500 pushups this week
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="pub-progress"><i ref={bar1Ref} style={{ width: "20%" }} /></div>
                    <span className="pub-goal-pct" ref={pct1Ref}>20%</span>
                  </div>
                </div>
                <div className="pub-goal-row">
                  <div className="pub-goal-name">
                    <div className="pub-goal-ico">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6l2 5-3 2c1 3 4 6 7 7l2-3 5 2v6c-9 0-19-9-19-19z"/></svg>
                    </div>
                    Write 5 essays this month
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="pub-progress"><i style={{ width: "60%" }} /></div>
                    <span className="pub-goal-pct">60%</span>
                  </div>
                </div>
                <div className="pub-goal-row">
                  <div className="pub-goal-name">
                    <div className="pub-goal-ico">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                    </div>
                    Read 30 min / day
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="pub-progress"><i style={{ width: "85%" }} /></div>
                    <span className="pub-goal-pct">85%</span>
                  </div>
                </div>
                <div className="pub-goal-row">
                  <div className="pub-goal-name">
                    <div className="pub-goal-ico">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>
                    </div>
                    Run 20km this week
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="pub-progress"><i style={{ width: "42%" }} /></div>
                    <span className="pub-goal-pct">42%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="pub-phone">
              <div className="pub-phone-screen">
                <div className="pub-phone-notch" />
                <div className="pub-chat-header">
                  <div className="pub-avatar">R</div>
                  <div className="pub-chat-meta">
                    <div className="pub-chat-name">GotThis</div>
                    <div className="pub-chat-status">online · auto-syncing</div>
                  </div>
                </div>
                <div className="pub-chat-body">
                  <div className="pub-bubble pub-bubble-in">
                    Morning! What did you do today?
                    <span className="pub-bubble-time">9:42 AM</span>
                  </div>
                  <div className="pub-bubble pub-bubble-out">
                    Ran 4km before breakfast. Felt great
                    <span className="pub-bubble-time">9:43 AM</span>
                  </div>
                  <div className="pub-bubble pub-bubble-in">
                    Logged 4km to your <b>Run 20km</b> goal. You're at 42% for the week.
                    <span className="pub-bubble-time">9:43 AM</span>
                  </div>
                  <div className="pub-bubble pub-bubble-out" ref={liveBubbleRef} style={{ display: "none" }}>
                    I did 50 pushups
                    <span className="pub-bubble-time">now</span>
                  </div>
                  <div className="pub-bubble-typing" ref={typingRef}>
                    <span /><span /><span />
                  </div>
                </div>
                <div className="pub-chat-input">
                  <div className="pub-chat-field">Type a message</div>
                  <div className="pub-chat-send">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="pub-section pub-how">
        <div className="pub-wrap">
          <div className="pub-section-head">
            <div>
              <div className="pub-section-eyebrow">↳ How it works</div>
              <h2 className="pub-section-title">
                Three steps. <em>Ten seconds.</em><br />Then you forget the app exists.
              </h2>
            </div>
            <p className="pub-section-lede">
              The most frictionless way to stay honest with yourself. You already know what to do — we just remove the part where you stop doing it.
            </p>
          </div>
          <div className="pub-steps">
            <div className="pub-step">
              <div className="pub-step-num">01</div>
              <div className="pub-step-key">Sync</div>
              <h3 className="pub-step-title">Scan the QR code to link your phone.</h3>
              <p className="pub-step-body">One tap on your camera, one click to confirm. Your chat is now your input field — no install required.</p>
            </div>
            <div className="pub-step">
              <div className="pub-step-num">02</div>
              <div className="pub-step-key">Speak</div>
              <h3 className="pub-step-title">Text the bot your updates, notes, or blockers.</h3>
              <p className="pub-step-body">Write in plain English. "Did 50 pushups." "Skipped today, knee hurts." "Wrote 800 words on the essay."</p>
            </div>
            <div className="pub-step">
              <div className="pub-step-num">03</div>
              <div className="pub-step-key">See</div>
              <h3 className="pub-step-title">View weekly activity and completion rate.</h3>
              <p className="pub-step-body">Your dashboard fills in by itself. Streaks, completion %, and the chain you don't want to break.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== DEEP DIVE ===== */}
      <section className="pub-section pub-deep" ref={deepSecRef}>
        <div className="pub-wrap">
          <div className="pub-section-head">
            <div>
              <div className="pub-section-eyebrow">↳ The dashboard</div>
              <h2 className="pub-section-title">One screen. <em>Every signal.</em></h2>
            </div>
            <p className="pub-section-lede">
              The app reads your messages and updates the right goals. Your only job is to live, and to mention it in passing.
            </p>
          </div>
          <div className="pub-product">
            <div className="pub-product-bar">
              <div className="pub-dots"><span /><span /><span /></div>
              <div className="pub-product-label">gotthis.one · dashboard</div>
            </div>
            <div className="pub-product-body" style={{ position: "relative" }}>
              <aside className="pub-side">
                <div className="pub-side-me">
                  <div className="pub-side-av">A</div>
                  <div>
                    <div className="pub-side-name">Alex Chen</div>
                    <div className="pub-side-status">● Connected</div>
                  </div>
                </div>
                <nav className="pub-side-nav">
                  <a href="#" className="pub-side-link active"><span className="pub-side-d" />Dashboard</a>
                  <a href="#" className="pub-side-link"><span className="pub-side-d" />Goals</a>
                  <a href="#" className="pub-side-link"><span className="pub-side-d" />Notes</a>
                  <a href="#" className="pub-side-link"><span className="pub-side-d" />Streaks</a>
                  <a href="#" className="pub-side-link"><span className="pub-side-d" />Settings</a>
                </nav>
                <div className="pub-side-label">Goals</div>
                <nav className="pub-side-nav">
                  <a href="#" className="pub-side-link"><span className="pub-side-d" style={{ background: "#25D366" }} />Fitness</a>
                  <a href="#" className="pub-side-link"><span className="pub-side-d" style={{ background: "#3B82F6" }} />Writing</a>
                  <a href="#" className="pub-side-link"><span className="pub-side-d" style={{ background: "#FBBF24" }} />Reading</a>
                </nav>
              </aside>
              <div className="pub-panel" style={{ position: "relative" }}>
                <div className="pub-panel-h">
                  <h3>Tuesday, May 12</h3>
                  <div className="pub-panel-when">Updated · 2 min ago</div>
                </div>
                <div className="pub-write">
                  <div className="pub-write-ph">
                    Write an update…{" "}
                    <span style={{ color: "#94A3B8" }}>"50 pushups done before work. Still need to write the essay."</span>
                  </div>
                  <div className="pub-write-meta">
                    <span className="pub-chip"><span className="pub-chip-g" />From WhatsApp · 9:43 AM</span>
                    <span className="pub-chip" style={{ color: "#1FB856" }}>↳ 2 goals updated</span>
                  </div>
                </div>
                <div className="pub-cards-row">
                  <div className="pub-mini">
                    <div className="pub-mini-h">
                      Weekly Activity <span className="pub-mini-meta">last 7 days</span>
                    </div>
                    <div className="pub-bars">
                      <i style={{ height: "35%" }} />
                      <i style={{ height: "62%" }} />
                      <i style={{ height: "48%" }} />
                      <i style={{ height: "78%" }} />
                      <i style={{ height: "55%" }} />
                      <i className="today" style={{ height: "85%" }} />
                      <i className="empty" style={{ height: "8%" }} />
                    </div>
                    <div className="pub-bars-labels">
                      {["W","T","F","S","S","M","T"].map((d, i) => <span key={i}>{d}</span>)}
                    </div>
                  </div>
                  <div className="pub-mini">
                    <div className="pub-mini-h">
                      Active Goals <span className="pub-mini-meta">3 of 12</span>
                    </div>
                    <div className="pub-active-list">
                      <div className="pub-active">
                        <span className="pub-active-name">Pushups</span>
                        <span className="pub-active-bar"><i style={{ width: "30%" }} /></span>
                        <span className="pub-active-val">30%</span>
                      </div>
                      <div className="pub-active">
                        <span className="pub-active-name">Essays</span>
                        <span className="pub-active-bar"><i style={{ width: "60%" }} /></span>
                        <span className="pub-active-val">60%</span>
                      </div>
                      <div className="pub-active">
                        <span className="pub-active-name">Reading</span>
                        <span className="pub-active-bar"><i style={{ width: "85%" }} /></span>
                        <span className="pub-active-val">85%</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Hotspots */}
                <div className="pub-hotspot" style={{ top: 110, left: 310 }}>
                  <div className="pub-hotspot-tip">
                    <strong className="pub-hotspot-tip-label">Write an Update</strong>
                    AI-powered logs. Just vent — we'll categorize, tag, and route the right numbers to the right goals.
                  </div>
                </div>
                <div className="pub-hotspot" style={{ top: 360, left: 200 }}>
                  <div className="pub-hotspot-tip">
                    <strong className="pub-hotspot-tip-label">Weekly Activity</strong>
                    Visual momentum. Don't break the chain. Days you logged anything count.
                  </div>
                </div>
                <div className="pub-hotspot" style={{ top: 360, right: 40 }}>
                  <div className="pub-hotspot-tip" style={{ left: "auto", right: 0, transform: "translate(0, 6px)" }}>
                    <strong className="pub-hotspot-tip-label">Active Goals</strong>
                    Top-level focus. Only what matters this week — the rest stays out of your sightline.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="pub-section pub-features">
        <div className="pub-wrap">
          <div className="pub-section-head">
            <div>
              <div className="pub-section-eyebrow">↳ Why messaging</div>
              <h2 className="pub-section-title">The messaging-first <em>advantage.</em></h2>
            </div>
            <p className="pub-section-lede">You already have a thumb on the keyboard. Use it where you already are.</p>
          </div>
          <div className="pub-feat-grid">
            <div className="pub-feat">
              <div className="pub-feat-ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
              </div>
              <h3>End-to-end ease.</h3>
              <p>Update while walking, at the gym, or in bed. If you can text a friend, you can log a rep.</p>
            </div>
            <div className="pub-feat">
              <div className="pub-feat-ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>
              </div>
              <h3>Zero app fatigue.</h3>
              <p>You already use your messaging app 50× a day. We meet you there instead of asking for another login.</p>
            </div>
            <div className="pub-feat">
              <div className="pub-feat-ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h12l4 4v12H4z"/><path d="M9 12h6"/><path d="M9 16h6"/><path d="M9 8h3"/></svg>
              </div>
              <h3>Note-to-goal engine.</h3>
              <p>Our system parses your natural-language notes and automatically updates your active goals. The app reads it and routes the right numbers.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PHRASE ===== */}
      <section className="pub-phrase">
        <div className="pub-wrap">
          <blockquote>"The app will read it and update the right goals."</blockquote>
          <div className="pub-phrase-attr">↳ The whole product, in one sentence</div>
        </div>
      </section>

      {/* ===== CTA BAND ===== */}
      <div className="pub-cta-band">
        <div className="pub-wrap">
          <h2>Ready to start your <em>ritual?</em></h2>
          <p>Join thousands building real habits without downloading another app.</p>
          <div className="pub-cta-band-btns">
            <Link href="/sign-up" className="pub-btn pub-btn-green pub-btn-lg">Get Started Free</Link>
            <Link href="/pricing" className="pub-btn pub-btn-lg" style={{ background: "rgba(255,255,255,.1)", borderColor: "rgba(255,255,255,.15)", color: "#fff" }}>
              See Pricing
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
