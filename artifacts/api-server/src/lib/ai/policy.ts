export const MAX_USER_MESSAGE_CHARS = 1000;
export const MAX_VOICE_TRANSCRIPTION_CHARS = 1000;
export const MAX_ACTIONS_PER_REQUEST = 5;

export type PolicyDecision =
  | { allowed: true; normalizedMessage: string }
  | { allowed: false; reason: "message_too_long" | "prompt_injection" | "bulk_request" | "destructive_request"; reply: string };

const INJECTION_PATTERNS = [
  /\bignore (?:all |the |your |previous |above |prior )?(?:instructions?|prompts?|rules?|directives?)\b/i,
  /\bdisregard (?:all |the |your |previous |above |prior )?(?:instructions?|prompts?|rules?)\b/i,
  /\bforget (?:everything|all|your|the|previous|above|prior)\b/i,
  /\boverride (?:your|the|all|previous) (?:instructions?|prompts?|rules?|system)\b/i,
  /\b(?:reveal|show|print|repeat|output|display) (?:your|the|me your|me the) (?:system )?(?:prompt|instructions|rules)\b/i,
  /\bwhat (?:are|is) your (?:system )?(?:prompt|instructions|rules)\b/i,
  /\b(?:you are|you're) (?:now |actually )?(?:a|an)\b/i,
  /\bact as (?:a|an|if you are)\b/i,
  /\bpretend (?:to be|you are|you're)\b/i,
  /\broleplay as\b/i,
  /\bjailbreak\b/i,
  /\bDAN mode\b/i,
  /\bdeveloper mode\b/i,
  /<\/?system>/i,
  /<\/?instructions?>/i,
  /\bend of (?:user message|user input)\b/i,
  /\bnew (?:system )?(?:prompt|instructions?)\b/i,
];

const BULK_PATTERNS = [
  /\b(?:create|add|make|generate)\s+(?:\d{2,}|many|hundreds?|thousands?)\b/i,
  /\b(?:delete|remove|complete|update)\s+(?:all|every|each|my entire)\b/i,
  /\b(?:do|perform|execute)\s+(?:\d{2,}|many|hundreds?|thousands?)\s+(?:actions?|requests?|operations?)\b/i,
];

const DESTRUCTIVE_PATTERNS = [
  /\bdelete\s+(?:all|every|everything|my goals?|my milestones?)\b/i,
  /\bremove\s+(?:all|every|everything|my goals?|my milestones?)\b/i,
  /\bclear\s+(?:all|everything|my goals?|my data|my account)\b/i,
  /\b(?:erase|wipe)\s+(?:all|everything|my data|my account)\b/i,
];

export function isPromptInjection(message: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

export function validateUserMessage(message: string): PolicyDecision {
  const normalized = message.trim();

  if (!normalized) {
    return {
      allowed: false,
      reason: "message_too_long",
      reply: "Please send a message and I’ll help you with your goals.",
    };
  }

  if (normalized.length > MAX_USER_MESSAGE_CHARS) {
    return {
      allowed: false,
      reason: "message_too_long",
      reply: `Your message is a little too long. Please keep it under ${MAX_USER_MESSAGE_CHARS} characters and send it again.`,
    };
  }

  if (isPromptInjection(normalized)) {
    return {
      allowed: false,
      reason: "prompt_injection",
      reply: "I'm your goal coach — let's focus on your targets.",
    };
  }

  if (BULK_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      allowed: false,
      reason: "bulk_request",
      reply: "I can help with one goal, milestone, or check-in at a time. Please send a smaller request.",
    };
  }

  if (DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      allowed: false,
      reason: "destructive_request",
      reply: "I won't make destructive changes through a chat request. Please use the dashboard to review and manage your goals.",
    };
  }

  return { allowed: true, normalizedMessage: normalized };
}

export function validateVoiceTranscription(text: string): PolicyDecision {
  const normalized = text.trim();
  if (!normalized) {
    return {
      allowed: false,
      reason: "message_too_long",
      reply: "I couldn't find any words in that voice note. Please try again.",
    };
  }
  if (normalized.length > MAX_VOICE_TRANSCRIPTION_CHARS) {
    return {
      allowed: false,
      reason: "message_too_long",
      reply: `That voice note transcribed to more than ${MAX_VOICE_TRANSCRIPTION_CHARS} characters. Please keep voice notes shorter and try again.`,
    };
  }
  return validateUserMessage(normalized);
}
