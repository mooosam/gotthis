export type Tier = "free" | "pro" | "elite";

export const TIER_CONFIG = {
  free: {
    label: "Free",
    dailyMessageCap: 5,
    goalCountLimit: 3,
    monthlyTokenAllowance: 50_000,
    monthlySkipCredits: 4,
    emailChannel: false,
    proactiveNudges: false,
    priceCentsMonthly: null as number | null,
    priceCentsYearly: null as number | null,
  },
  pro: {
    label: "Pro",
    dailyMessageCap: 50,
    goalCountLimit: 10,
    monthlyTokenAllowance: 500_000,
    monthlySkipCredits: 10,
    emailChannel: true,
    proactiveNudges: false,
    priceCentsMonthly: 1200,
    priceCentsYearly: 9900,
  },
  elite: {
    label: "Elite",
    dailyMessageCap: 200,
    goalCountLimit: 0,
    monthlyTokenAllowance: 2_000_000,
    monthlySkipCredits: 30,
    emailChannel: true,
    proactiveNudges: true,
    priceCentsMonthly: 2900,
    priceCentsYearly: null as number | null,
  },
} as const satisfies Record<Tier, object>;

export function getTierConfig(tier: string) {
  return TIER_CONFIG[(tier as Tier) in TIER_CONFIG ? (tier as Tier) : "free"];
}

export function tierFromPriceKey(
  priceId: string,
  prices: Record<string, string>
): Tier {
  if (priceId === prices.stripe_price_pro_monthly) return "pro";
  if (priceId === prices.stripe_price_pro_yearly) return "pro";
  if (priceId === prices.stripe_price_elite_monthly) return "elite";
  return "free";
}
