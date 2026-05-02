// Re-export only the Zod runtime schemas from `./generated/api`.
// `./generated/types/*` produces TypeScript interfaces with the SAME names as
// the Zod schemas (e.g. CreateGoalBody), which causes TS2308 ambiguity errors.
// Consumers needing TypeScript types should import them from
// `@workspace/api-client-react` instead. Do NOT re-add the types export here.
export * from "./generated/api";
