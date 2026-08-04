import { generate, GEMINI_FAST } from "@workspace/integrations-gemini-ai";
import { logger } from "../logger.js";

export type MessageIntent =
  | "morning_ritual"
  | "evening_ritual"
  | "goal_update"
  | "check_in"
  | "off_topic"
  | "error";

const MORNING_PATTERNS = [
  /\bgood morning\b/i,
  /\bmorning ritual\b/i,
  /\bstart.*day\b/i,
  /\bbegin.*day\b/i,
  /\bwoke up\b/i,
  /\bjust woke\b/i,
  /\bmorning check\b/i,
  /\bready for.*day\b/i,
];

const EVENING_PATTERNS = [
  /\bgood evening\b/i,
  /\bevening ritual\b/i,
  /\bend.*day\b/i,
  /\bdaily review\b/i,
  /\bwrap.*up\b/i,
  /\bdone for.*day\b/i,
  /\bnight check\b/i,
  /\bgoing to bed\b/i,
  /\bbefore.*sleep\b/i,
  /\bday.*done\b/i,
  /\bthat'?s it for today\b/i,
  /\bfinished.*day\b/i,
  /\breflect.*day\b/i,
  /\ball done.*today\b/i,
  /\bday is over\b/i,
];

const GOAL_UPDATE_PATTERNS = [
  /\bcompleted?\b/i,
  /\bfinished?\b/i,
  /\bdone with\b/i,
  /\bworked on\b/i,
  /\bmade progress\b/i,
  /\bupdate.*goal\b/i,
  /\bgoal.*update\b/i,
  /\b\d+\s*%\b/i,
  /\bpercent\b/i,
  /\bi did\b/i,
  /\bi ran\b/i,
  /\bi walked\b/i,
  /\bi ate\b/i,
  /\bi read\b/i,
  /\bi wrote\b/i,
  /\bi practiced\b/i,
  /\bi studied\b/i,
  /\bi exercised\b/i,
  /\bi trained\b/i,
  /\bi spent\b/i,
  /\bi managed\b/i,
  /\btoday i\b/i,
  /\bjust did\b/i,
  /\bjust finished\b/i,
  /\bjust completed\b/i,
  /\b\d+\s*(pushup|push-up|pullup|pull-up|squat|rep|set|km|mile|minute|hour|page|chapter|word)\b/i,
];

const OFF_TOPIC_PATTERNS = [
  /\bweather\b/i,
  /\bstock.*price\b/i,
  /\blatest news\b/i,
  /\bwrite.*code\b/i,
  /\bhelp me.*code\b/i,
  /\bjoke\b/i,
  /\brecipe\b/i,
  /\btranslate\b/i,
  /\bessay\b/i,
  /\bpoem\b/i,
  /\bsong\b/i,
  /\blyrics\b/i,
  /\bstory\b/i,
  /\bnovel\b/i,
  /\bsummari[sz]e (?:this|the following|this article)\b/i,
  /\bexplain (?:quantum|relativity|the theory|the universe)\b/i,
  /\bhomework\b/i,
  /\bessay on\b/i,
  /\bemail (?:to|for) (?!me about my goal)/i,
];

const INJECTION_PATTERNS = [
  /\bignore (?:all |the |your |previous |above |prior )?(?:instructions?|prompts?|rules?|directives?)\b/i,
  /\bdisregard (?:all |the |your |previous |above |prior )?(?:instructions?|prompts?|rules?)\b/i,
  /\bforget (?:everything|all|your|the|previous|above|prior)\b/i,
  /\boverride (?:your|the|all|previous) (?:instructions?|prompts?|rules?|system)\b/i,
  /\b(?:reveal|show|print|repeat|output|display) (?:your|the|me your|me the) (?:system )?(?:prompt|instructions|rules)\b/i,
  /\bwhat (?:are|is) your (?:system )?(?:prompt|instructions|rules)\b/i,
  /\byou are (?:now |actually )?(?:a|an) (?!goal coach\b|the ritual ai\b)/i,
  /\bact as (?:a|an|if you are)\b/i,
  /\bpretend (?:to be|you are|you'?re)\b/i,
  /\broleplay as\b/i,
  /\bjailbreak\b/i,
  /\bDAN mode\b/i,
  /\bdeveloper mode\b/i,
  /\b<\/?system>\b/i,
  /\b<\/?instructions?>\b/i,
  /\bend of (?:user message|user input)\b/i,
  /\bnew (?:system )?(?:prompt|instructions?)\b/i,
];

function hasAnyKnownPattern(message: string): boolean {
  const text = message.toLowerCase();
  return (
    MORNING_PATTERNS.some((p) => p.test(text)) ||
    EVENING_PATTERNS.some((p) => p.test(text)) ||
    GOAL_UPDATE_PATTERNS.some((p) => p.test(text)) ||
    OFF_TOPIC_PATTERNS.some((p) => p.test(text)) ||
    INJECTION_PATTERNS.some((p) => p.test(text))
  );
}

export function looksLikeInjection(message: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(message));
}

function isAmbiguous(message: string): boolean {
  if (hasAnyKnownPattern(message)) return false;
  return message.trim().length >= 10;
}

export function classifyIntentKeywords(message: string): MessageIntent {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) return "off_topic";
  }
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(message)) return "off_topic";
  }
  for (const pattern of MORNING_PATTERNS) {
    if (pattern.test(message)) return "morning_ritual";
  }
  for (const pattern of EVENING_PATTERNS) {
    if (pattern.test(message)) return "evening_ritual";
  }
  for (const pattern of GOAL_UPDATE_PATTERNS) {
    if (pattern.test(message)) return "goal_update";
  }
  return "check_in";
}

export interface ClassificationResult {
  intent: MessageIntent;
  inputTokens: number;
  outputTokens: number;
}

const MIN_TOKENS_FOR_AI_FALLBACK = 500;

export async function classifyIntentWithFallback(
  message: string,
  monthlyTokenRemaining?: number,
): Promise<ClassificationResult> {
  const trimmed = message.trim();

  if (trimmed.length < 10 && !hasAnyKnownPattern(trimmed)) {
    logger.info({ event: "classifier_path", path: "short_message" }, "classifier path");
    return { intent: "off_topic", inputTokens: 0, outputTokens: 0 };
  }

  if (looksLikeInjection(trimmed)) {
    logger.info({ event: "classifier_path", path: "injection_block" }, "classifier path");
    return { intent: "off_topic", inputTokens: 0, outputTokens: 0 };
  }

  const keywordResult = classifyIntentKeywords(message);

  if (keywordResult !== "check_in" || !isAmbiguous(message)) {
    logger.info({ event: "classifier_path", path: "keyword_match", intent: keywordResult }, "classifier path");
    return { intent: keywordResult, inputTokens: 0, outputTokens: 0 };
  }

  if (monthlyTokenRemaining !== undefined && monthlyTokenRemaining < MIN_TOKENS_FOR_AI_FALLBACK) {
    logger.info({ event: "classifier_path", path: "fallback_skipped_low_budget" }, "classifier path");
    return { intent: keywordResult, inputTokens: 0, outputTokens: 0 };
  }

  try {
    const { text, inputTokens, outputTokens } = await generate({
      model: GEMINI_FAST,
      userContent: `Classify this message from a goal coaching app user into exactly one category. Reply with only the category name and nothing else.

Categories:
- morning_ritual: user is starting their day or doing a morning check-in
- evening_ritual: user is ending their day or doing an evening reflection
- goal_update: user is reporting progress on a goal
- check_in: general goal-related question or mid-day message
- off_topic: message has nothing to do with goals or daily rituals

Message: "${message}"

Category:`,
      maxOutputTokens: 20,
    });

    const raw = text.trim().toLowerCase();
    const valid: MessageIntent[] = [
      "morning_ritual",
      "evening_ritual",
      "goal_update",
      "check_in",
      "off_topic",
    ];
    const matched = valid.find((v) => raw.includes(v));

    logger.info(
      {
        event: "classifier_path",
        path: "ai_fallback",
        intent: matched ?? "check_in",
        inputTokens,
        outputTokens,
      },
      "classifier path",
    );

    return { intent: matched ?? "check_in", inputTokens, outputTokens };
  } catch (error) {
    logger.error({ err: error, event: "classifier_fallback_failed" }, "Intent classification fallback failed");
    return { intent: "error", inputTokens: 0, outputTokens: 0 };
  }
}
