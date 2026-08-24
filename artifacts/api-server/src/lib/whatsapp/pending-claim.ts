import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { hashPhone } from "../phone.js";
import { getBaseUrl } from "./magic-link.js";

const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function generateCode(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

export async function createPendingWhatsAppClaim(phone: string): Promise<string> {
  const phoneHash = hashPhone(phone);
  const connection = await pool.getConnection();
  try {
    const [existingRows] = await connection.execute(
      `SELECT code, expires_at
         FROM pending_whatsapp_claims
        WHERE phone_hash = ? AND claimed_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1`,
      [phoneHash],
    );
    const existing = (existingRows as Array<{ code: string; expires_at: Date | string }>)[0];
    if (existing) return `${getBaseUrl()}/go/${existing.code}`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateCode();
      const id = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + CLAIM_TTL_MS);
      try {
        await connection.execute(
          `INSERT INTO pending_whatsapp_claims
             (id, code, phone_hash, whatsapp_jid, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [id, code, phoneHash, phone, expiresAt],
        );
        return `${getBaseUrl()}/go/${code}`;
      } catch (error) {
        const value = error as { code?: string };
        if (value.code !== "ER_DUP_ENTRY") throw error;
      }
    }

    throw new Error("Could not allocate a unique WhatsApp claim code");
  } finally {
    connection.release();
  }
}
