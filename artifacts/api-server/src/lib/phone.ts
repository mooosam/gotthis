import { createHmac } from "crypto";

const pepper = process.env.PHONE_PEPPER;

if (!pepper && process.env.NODE_ENV === "production") {
  throw new Error(
    "PHONE_PEPPER environment variable is required in production but was not provided.",
  );
}

const PHONE_PEPPER = pepper ?? "dev-only-not-for-production";

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, "").replace(/^\+/, "");
}

export function hashPhone(phone: string): string {
  return createHmac("sha256", PHONE_PEPPER)
    .update(normalizePhone(phone))
    .digest("hex");
}
