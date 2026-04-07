import { createHmac } from "crypto";

const PHONE_PEPPER = process.env.PHONE_PEPPER ?? "dev-pepper-change-in-production";

export function hashPhone(phone: string): string {
  return createHmac("sha256", PHONE_PEPPER)
    .update(phone.trim().replace(/\s+/g, ""))
    .digest("hex");
}
