import { Link } from "wouter";
import NotFound from "@/pages/not-found";
import { ContentEntry, ContentKind, contentEntries, contentPath, getContent, getContentByKind } from "@/content/content";

const labels: Record<ContentKind, string> = { question: "Questions", guide: "Guides", landing: "Features", comparison: "Comparisons" };

function Breadcrumbs({ entry }: { entry?: ContentEntry }) {
  return <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-8">
    <Link href="/" className="hover:text-foreground">Home</Link>
    <span className="mx-2">/</span>
    {entry ? <><Link href={`/${labels[entry.kind].toLowerCase()}`} className="hover:text-foreground">{labels[entry.kind]}</Link><span className="mx-2">/</span><span className="text-foreground">{entry.title}</span></> : <span className="text-foreground">Resources</span>}
  </nav>;
}

function RelatedContent({ entry }: { entry: ContentEntry }) {
  const related = (entry.related ?? []).map((slug) => contentEntries.find((item) => item.slug === slug)).filter(Boolean) as ContentEntry[];
  if (!related.length) return null;
  return <section className="mt-14 border-t pt-10"><h2 className="text-2xl font-semibold mb-5">Related resources</h2><div className="grid gap-4 md:grid-cols-2">{related.map((item) => <Link key={`${item.kind}-${item.slug}`} href={contentPath(item)} className="block rounded-xl border p-5 hover:bg-muted/40"><div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{item.category}</div><div className="font-semibold">{item.title}</div><p className="text-sm text-muted-foreground mt-2">{item.description}</p></Link>)}</div></section>;
}

export function ContentHub({ kind }: { kind: ContentKind }) {
  const items = getContentByKind(kind);
  const descriptions: Record<ContentKind, string> = {
    question: "Clear answers to common questions about goals, accountability, AI, reminders and WhatsApp goal tracking.",
    guide: "Practical, in-depth guides for setting goals, tracking progress and building accountability.",
    landing: "Explore GotThis features and the problems they are designed to solve.",
    comparison: "Straightforward comparisons to help you choose the accountability and goal-tracking approach that fits you.",
  };
  return <main className="min-h-screen"><div className="mx-auto max-w-5xl px-6 py-14"><Breadcrumbs /><header className="max-w-3xl mb-12"><div className="text-sm font-medium text-muted-foreground mb-3">GotThis Resources</div><h1 className="text-4xl md:text-5xl font-semibold tracking-tight">{labels[kind]}</h1><p className="mt-5 text-lg text-muted-foreground">{descriptions[kind]}</p></header><div className="grid gap-5 md:grid-cols-2">{items.map((entry) => <Link key={entry.slug} href={contentPath(entry)} className="block rounded-2xl border p-6 hover:bg-muted/40"><div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{entry.category}</div><h2 className="text-xl font-semibold">{entry.title}</h2><p className="mt-3 text-muted-foreground">{entry.description}</p></Link>)}</div></div></main>;
}

export function ContentPage({ kind, slug }: { kind: ContentKind; slug: string }) {
  const entry = getContent(kind, slug);
  if (!entry) return <NotFound />;
  return <main className="min-h-screen"><article className="mx-auto max-w-3xl px-6 py-14"><Breadcrumbs entry={entry} /><header><div className="text-sm font-medium text-muted-foreground mb-3">{entry.category}</div><h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">{entry.title}</h1><p className="mt-5 text-lg text-muted-foreground">{entry.description}</p></header>{entry.shortAnswer && <section className="mt-10 rounded-2xl border bg-muted/30 p-6"><h2 className="font-semibold mb-2">Quick answer</h2><p className="text-lg leading-8">{entry.shortAnswer}</p></section>}<div className="mt-12 space-y-12">{entry.sections.map((section) => <section key={section.heading}><h2 className="text-2xl font-semibold tracking-tight mb-4">{section.heading}</h2>{section.paragraphs?.map((paragraph) => <p key={paragraph} className="text-lg leading-8 text-muted-foreground mb-4">{paragraph}</p>)}{section.bullets && <ul className="list-disc pl-6 space-y-2 text-lg text-muted-foreground">{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}</div><RelatedContent entry={entry} /><section className="mt-14 rounded-2xl border p-7"><h2 className="text-2xl font-semibold">Turn your goal into a conversation</h2><p className="mt-3 text-muted-foreground">GotThis helps you track goals, report progress and stay accountable through WhatsApp.</p><Link href="/sign-up" className="inline-block mt-5 font-semibold underline underline-offset-4">Get started with GotThis</Link></section></article></main>;
}
