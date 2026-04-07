export type MessageIntent =
  | "morning_ritual"
  | "evening_ritual"
  | "goal_update"
  | "check_in"
  | "off_topic";

const MORNING_PATTERNS = [
  /\bgood morning\b/i,
  /\bmorning ritual\b/i,
  /\bstart.*day\b/i,
  /\bbegin.*day\b/i,
  /\bwoke up\b/i,
  /\bjust woke\b/i,
  /\bmorning check\b/i,
  /\bready for the day\b/i,
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
  /\bfinished.*day\b/i,
  /\breflect.*day\b/i,
];

const GOAL_UPDATE_PATTERNS = [
  /\bcompleted?\b/i,
  /\bfinished?\b/i,
  /\bdone with\b/i,
  /\bworked on\b/i,
  /\bmade progress\b/i,
  /\bupdate.*goal\b/i,
  /\bgoal.*update\b/i,
  /\b\d+%\b/i,
  /\bpercent\b/i,
];

const OFF_TOPIC_PATTERNS = [
  /\bweather\b/i,
  /\bstock.*price\b/i,
  /\blatest news\b/i,
  /\bwrite.*code\b/i,
  /\bhelp me.*code\b/i,
];

export function classifyIntent(message: string): MessageIntent {
  for (const pattern of MORNING_PATTERNS) {
    if (pattern.test(message)) return "morning_ritual";
  }

  for (const pattern of EVENING_PATTERNS) {
    if (pattern.test(message)) return "evening_ritual";
  }

  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(message)) return "off_topic";
  }

  for (const pattern of GOAL_UPDATE_PATTERNS) {
    if (pattern.test(message)) return "goal_update";
  }

  return "check_in";
}
