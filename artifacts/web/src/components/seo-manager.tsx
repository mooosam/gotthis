import { useEffect } from "react";
import { useLocation } from "wouter";
import { contentEntries, contentPath } from "@/content/all-content";

const SITE_URL = "https://gotthis.one";
const DEFAULT_IMAGE = `${SITE_URL}/opengraph.jpg`;
type SeoConfig = { title: string; description: string; index?: boolean; type?: "website" | "article"; };
const PUBLIC_SEO: Record<string, SeoConfig> = {
  "/": { title: "GotThis — AI Goal Tracking & Accountability Through WhatsApp", description: "Track goals, report progress and stay accountable through WhatsApp with GotThis, an AI-powered goal tracking and accountability assistant." },
  "/pricing": { title: "Pricing | GotThis", description: "Compare GotThis plans for AI-powered goal tracking, WhatsApp check-ins, accountability and progress tracking." },
  "/faq": { title: "Frequently Asked Questions | GotThis", description: "Answers to common questions about GotThis, WhatsApp goal tracking, AI accountability, goals, check-ins, plans and privacy." },
  "/contact": { title: "Contact GotThis", description: "Contact the GotThis team for help with your account, WhatsApp goal tracking or general questions." },
  "/terms": { title: "Terms of Service | GotThis", description: "Read the GotThis terms of service." },
  "/cookies": { title: "Cookie Policy | GotThis", description: "Read the GotThis cookie policy." },
  "/data-policy": { title: "Data & Privacy Policy | GotThis", description: "Learn how GotThis handles and protects account, goal and messaging data." },
  "/questions": { title: "Goal & Accountability Questions | GotThis", description: "Simple answers about goal tracking, accountability, AI, reminders and WhatsApp." },
  "/guides": { title: "Goal Tracking & Accountability Guides | GotThis", description: "Simple guides for tracking goals, staying consistent and keeping your goals in sight." },
  "/features": { title: "GotThis Features", description: "See how GotThis helps with goal tracking, check-ins and WhatsApp progress updates." },
  "/compare": { title: "Goal Tracking & Accountability Comparisons | GotThis", description: "Simple comparisons for goal tracking and accountability tools." },
  "/tools": { title: "Free Goal Tools | GotThis", description: "Simple free tools to plan goals, check progress and make your next step clear." },
  "/tools/goal-progress-calculator": { title: "Goal Progress Calculator | GotThis", description: "See what percent of your goal is complete with a simple free calculator." },
  "/tools/goal-planner": { title: "Simple Goal Planner | GotThis", description: "Turn a big goal into one small next step with this free goal planner." },
  "/tools/smart-goal-generator": { title: "SMART Goal Helper | GotThis", description: "Make a goal clear and easy to track with a simple free SMART goal helper." },
  "/tools/accountability-check-in-generator": { title: "Accountability Check-In Generator | GotThis", description: "Make a short accountability check-in question for your goal." },
};
const PRIVATE_PREFIXES = ["/sign-in", "/sign-up", "/onboarding", "/dashboard", "/activity", "/achievements", "/goals", "/goal/", "/review/", "/account", "/admin", "/go/", "/share/", "/achievement/"];
function upsertMeta(selector: string, attrs: Record<string, string>) { let el = document.head.querySelector<HTMLMetaElement>(selector); if (!el) { el = document.createElement("meta"); document.head.appendChild(el); } Object.entries(attrs).forEach(([k,v]) => el!.setAttribute(k,v)); }
function upsertLink(rel: string, href: string) { let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`); if (!el) { el = document.createElement("link"); el.rel = rel; document.head.appendChild(el); } el.href = href; }
function setJsonLd(id: string, value: object | null) { document.getElementById(id)?.remove(); if (!value) return; const script = document.createElement("script"); script.id=id; script.type="application/ld+json"; script.text=JSON.stringify(value); document.head.appendChild(script); }
export default function SeoManager() {
  const [location] = useLocation();
  useEffect(() => {
    const path = location.split("?")[0] || "/";
    const entry = contentEntries.find((item) => contentPath(item) === path);
    const base = PUBLIC_SEO[path];
    const config: SeoConfig | undefined = entry ? { title: `${entry.title} | GotThis`, description: entry.description, type: "article" } : base;
    const isPrivate = PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
    const index = Boolean(config) && !isPrivate && config?.index !== false;
    const title = config?.title ?? "GotThis — AI Goal Tracking & Accountability Through WhatsApp";
    const description = config?.description ?? "GotThis helps you track goals and stay accountable through WhatsApp.";
    const canonical = `${SITE_URL}${path === "/" ? "" : path}`;
    document.title = title;
    upsertMeta('meta[name="description"]',{name:"description",content:description}); upsertMeta('meta[name="robots"]',{name:"robots",content:index?"index, follow":"noindex, nofollow"}); upsertMeta('meta[name="googlebot"]',{name:"googlebot",content:index?"index, follow":"noindex, nofollow"}); upsertMeta('meta[property="og:title"]',{property:"og:title",content:title}); upsertMeta('meta[property="og:description"]',{property:"og:description",content:description}); upsertMeta('meta[property="og:type"]',{property:"og:type",content:config?.type??"website"}); upsertMeta('meta[property="og:url"]',{property:"og:url",content:canonical}); upsertMeta('meta[property="og:image"]',{property:"og:image",content:DEFAULT_IMAGE}); upsertMeta('meta[property="og:site_name"]',{property:"og:site_name",content:"GotThis"}); upsertMeta('meta[name="twitter:card"]',{name:"twitter:card",content:"summary_large_image"}); upsertMeta('meta[name="twitter:title"]',{name:"twitter:title",content:title}); upsertMeta('meta[name="twitter:description"]',{name:"twitter:description",content:description}); upsertMeta('meta[name="twitter:image"]',{name:"twitter:image",content:DEFAULT_IMAGE}); upsertLink("canonical",canonical);
    setJsonLd("gotthis-website-schema", index && !entry ? {"@context":"https://schema.org","@type":"WebSite",name:"GotThis",url:SITE_URL,description:"AI-powered goal tracking and accountability through WhatsApp."}:null);
    setJsonLd("gotthis-organization-schema", index ? {"@context":"https://schema.org","@type":"Organization",name:"GotThis",url:SITE_URL,logo:`${SITE_URL}/favicon.svg`}:null);
    setJsonLd("gotthis-content-schema", entry ? {"@context":"https://schema.org","@type":"Article",headline:entry.title,description:entry.description,datePublished:entry.published,dateModified:entry.updated??entry.published,mainEntityOfPage:canonical,publisher:{"@type":"Organization",name:"GotThis",url:SITE_URL}}:null);
    setJsonLd("gotthis-breadcrumb-schema", entry ? {"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Home",item:SITE_URL},{"@type":"ListItem",position:2,name:entry.kind === "question"?"Questions":entry.kind === "guide"?"Guides":entry.kind === "landing"?"Features":"Comparisons",item:`${SITE_URL}/${entry.kind === "question"?"questions":entry.kind === "guide"?"guides":entry.kind === "landing"?"features":"compare"}`},{"@type":"ListItem",position:3,name:entry.title,item:canonical}]}:null);
  }, [location]);
  return null;
}