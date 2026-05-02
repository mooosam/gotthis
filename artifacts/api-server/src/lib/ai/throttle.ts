// Per-minute per-user burst throttle for AI message processing.
//
// This sits in front of the classifier so a scripted attacker spamming our
// /ai/message endpoint or WhatsApp number cannot rack up Anthropic costs even
// before the daily-cap or token-budget checks kick in. Process-local in-memory
// state is sufficient because the API server runs as a single instance.

const WINDOW_MS = 60_000;
const DEFAULT_MAX_PER_MINUTE = 6;

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

// Hard cap on bucket-map size as a backstop in case the periodic cleanup is
// behind under heavy load (e.g. a botnet hitting many distinct userIds). When
// exceeded, we drop the oldest entries first.
const MAX_BUCKETS = 50_000;

// Periodically drop stale buckets so the map cannot grow unbounded.
const CLEANUP_INTERVAL_MS = 5 * 60_000;
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [userId, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS * 2) {
      buckets.delete(userId);
    }
  }
}, CLEANUP_INTERVAL_MS);
// Don't keep the event loop alive just for housekeeping.
cleanup.unref?.();

export interface ThrottleResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// NOTE: This function is intentionally fully synchronous (no `await`s). Node's
// single-threaded event loop guarantees that read-then-write on the bucket map
// is atomic with respect to other calls, so concurrent requests for the same
// userId cannot race past the cap.
export function checkPerMinuteThrottle(
  userId: string,
  maxPerMinute: number = DEFAULT_MAX_PER_MINUTE,
): ThrottleResult {
  const now = Date.now();
  const bucket = buckets.get(userId);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    // Backstop eviction so a flood of distinct userIds can't OOM the process
    // between cleanup ticks.
    if (buckets.size >= MAX_BUCKETS) {
      const firstKey = buckets.keys().next().value;
      if (firstKey !== undefined) buckets.delete(firstKey);
    }
    buckets.set(userId, { windowStart: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= maxPerMinute) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// Test/dev helper: clear all throttle state.
export function _resetThrottleForTests(): void {
  buckets.clear();
}
