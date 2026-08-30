import { useEffect } from "react";
import { useLocation } from "wouter";

const SITE_URL = "https://gotthis.one";
const DEFAULT_IMAGE = `${SITE_URL}/opengraph.jpg`;

type SeoConfig = {
  title: string;
  description: string;
  index?: boolean;
  type?: "website" | "article";
};

const PUBLIC_SEO: Record<string, SeoConfig> = {
  "/": {
    title: "GotThis — AI Goal Tracking & Accountability Through WhatsApp",
    description: "Track goals, report progress and stay accountable through WhatsApp with GotThis, an AI-powered goal tracking and accountability assistant.",
  },
  "/pricing": {
    title: "Pricing | GotThis",
    description: "Compare GotThis plans for AI-powered goal tracking, WhatsApp check-ins, accountability and progress tracking.",
  },
  "/faq": {
    title: "Frequently Asked Questions | GotThis",
    description: "Answers to common questions about GotThis, WhatsApp goal tracking, AI accountability, goals, check-ins, plans and privacy.",
  },
  "/contact": {
    title: "Contact GotThis",
    description: "Contact the GotThis team for help with your account, WhatsApp goal tracking or general questions.",
  },
  "/terms": {
    title: "Terms of Service | GotThis",
    description: "Read the GotThis terms of service.",
  },
  "/cookies": {
    title: "Cookie Policy | GotThis",
    description: "Read the GotThis cookie policy.",
  },
  "/data-policy": {
    title: "Data & Privacy Policy | GotThis",
    description: "Learn how GotThis handles and protects account, goal and messaging data.",
  },
};

const PRIVATE_PREFIXES = [
  "/sign-in", "/sign-up", "/onboarding", "/dashboard", "/activity", "/achievements",
  "/goals", "/goal/", "/review/", "/account", "/admin", "/go/", "/share/", "/achievement/",
];

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attrs).forEach(([key, value]) => element!.setAttribute(key, value));
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

function setJsonLd(id: string, value: object | null) {
  document.getElementById(id)?.remove();
  if (!value) return;
  const script = document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.text = JSON.stringify(value);
  document.head.appendChild(script);
}

export default function SeoManager() {
  const [location] = useLocation();

  useEffect(() => {
    const path = location.split("?")[0] || "/";
    const config = PUBLIC_SEO[path];
    const isPrivate = PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
    const index = Boolean(config) && !isPrivate && config?.index !== false;
    const title = config?.title ?? "GotThis — AI Goal Tracking & Accountability Through WhatsApp";
    const description = config?.description ?? "GotThis helps you track goals and stay accountable through WhatsApp.";
    const canonical = `${SITE_URL}${path === "/" ? "" : path}`;

    document.title = title;
    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[name="robots"]', { name: "robots", content: index ? "index, follow" : "noindex, nofollow" });
    upsertMeta('meta[name="googlebot"]', { name: "googlebot", content: index ? "index, follow" : "noindex, nofollow" });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: config?.type ?? "website" });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: DEFAULT_IMAGE });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "GotThis" });
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: DEFAULT_IMAGE });
    upsertLink("canonical", canonical);

    setJsonLd("gotthis-website-schema", index ? {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "GotThis",
      url: SITE_URL,
      description: "AI-powered goal tracking and accountability through WhatsApp.",
    } : null);

    setJsonLd("gotthis-organization-schema", index ? {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "GotThis",
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.svg`,
    } : null);
  }, [location]);

  return null;
}
