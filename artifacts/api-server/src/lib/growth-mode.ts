/**
 * Growth mode keeps commercial limits dormant while preserving all usage
 * telemetry and billing infrastructure for later re-enablement.
 *
 * Defaults ON for the current acquisition phase. Set GROWTH_MODE=false to
 * restore tier budget enforcement without removing any billing code.
 */
export function isGrowthMode(): boolean {
  return process.env.GROWTH_MODE !== "false";
}

/**
 * Proactive WhatsApp is deliberately disabled in growth mode. This keeps the
 * product user-initiated while still allowing replies to inbound messages.
 */
export function proactiveWhatsAppEnabled(): boolean {
  return !isGrowthMode() && process.env.PROACTIVE_WHATSAPP !== "false";
}
