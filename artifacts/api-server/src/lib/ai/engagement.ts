import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const MAX_SAMPLES = 30;

interface EngagementSample {
  hour: number;
  responded: boolean;
  ts: string;
}

function getHourInTimezone(timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === "hour");
    return hourPart ? parseInt(hourPart.value, 10) % 24 : new Date().getUTCHours();
  } catch {
    return new Date().getUTCHours();
  }
}

/**
 * Record an inbound user message at the current local hour.
 * Bounded to the most recent MAX_SAMPLES samples and recomputes preferredPushHour
 * as the mode of the responded-true hours.
 *
 * Wrapped in a transaction with a row-level lock so that concurrent inbound
 * messages from the same user do not race and lose samples.
 */
export async function recordInboundEngagement(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .for("update");
    if (!user) return;

    const hour = getHourInTimezone(user.timezone);
    const sample: EngagementSample = {
      hour,
      responded: true,
      ts: new Date().toISOString(),
    };

    const existing = (user.engagementSamples ?? []) as EngagementSample[];
    const next = [...existing, sample].slice(-MAX_SAMPLES);

    // Compute mode of responded hours; ties broken by the more recent hour
    // (later samples win because we iterate in insertion order and use `>=`).
    const counts = new Map<number, number>();
    for (const s of next) {
      if (!s.responded) continue;
      counts.set(s.hour, (counts.get(s.hour) ?? 0) + 1);
    }
    let bestHour = user.preferredPushHour;
    let bestCount = 0;
    for (let i = next.length - 1; i >= 0; i--) {
      const s = next[i]!;
      if (!s.responded) continue;
      const c = counts.get(s.hour) ?? 0;
      if (c > bestCount) {
        bestCount = c;
        bestHour = s.hour;
      }
    }

    await tx
      .update(usersTable)
      .set({ engagementSamples: next, preferredPushHour: bestHour })
      .where(eq(usersTable.id, userId));
  });
}
