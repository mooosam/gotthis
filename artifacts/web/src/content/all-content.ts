import { contentEntries as coreContent, type ContentEntry, type ContentKind } from "./content";
import { authorityGuides } from "./guides";

export type { ContentEntry, ContentKind } from "./content";

export const contentEntries: ContentEntry[] = [...coreContent, ...authorityGuides];

export function getContent(kind: ContentKind, slug: string) {
  return contentEntries.find((entry) => entry.kind === kind && entry.slug === slug);
}

export function getContentByKind(kind: ContentKind) {
  return contentEntries.filter((entry) => entry.kind === kind);
}

export function contentPath(entry: ContentEntry) {
  const roots: Record<ContentKind, string> = {
    question: "/questions",
    guide: "/guides",
    landing: "/features",
    comparison: "/compare",
  };
  return `${roots[entry.kind]}/${entry.slug}`;
}