import { Router, type IRouter, type Request } from "express";
import { pool } from "@workspace/db";
import { normalizeAuthDestination } from "../lib/whatsapp/auth-link.js";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();
const CODE_RE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{8}$/;

interface LockedAuthLink {
  id: string;
  user_id: string;
  destination: string;
  expires_at: Date | string;
  used_at: Date | string | null;
  is_suspended: number | boolean;
}

interface PendingClaimRow {
  id: string;
  phone_hash: string;
  whatsapp_jid: string;
  expires_at: Date | string;
  claimed_user_id: string | null;
  claimed_at: Date | string | null;
}

/**
 * Public, non-sensitive inspection endpoint used by /go/:code to decide whether
 * an anonymous visitor should sign in (existing account link) or sign up (a
 * WhatsApp sender who has not created an account yet).
 */
router.get("/auth-links/:code/status", async (req, res): Promise<void> => {
  const code = String(req.params.code ?? "");
  if (!CODE_RE.test(code)) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const connection = await pool.getConnection();
  try {
    const [accountRows] = await connection.execute(
      `SELECT l.expires_at, l.used_at, u.is_suspended
         FROM short_auth_links l
         JOIN users u ON u.id = l.user_id
        WHERE l.code = ?
        LIMIT 1`,
      [code],
    );
    const account = (accountRows as Array<{ expires_at: Date | string; used_at: Date | string | null; is_suspended: number | boolean }>)[0];
    if (account) {
      if (account.used_at || new Date(account.expires_at).getTime() <= Date.now()) {
        res.status(410).json({ error: "This link has expired or already been used" });
        return;
      }
      if (Boolean(account.is_suspended)) {
        res.status(403).json({ error: "Account unavailable" });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.json({ kind: "account" });
      return;
    }

    const [claimRows] = await connection.execute(
      `SELECT expires_at, claimed_at
         FROM pending_whatsapp_claims
        WHERE code = ?
        LIMIT 1`,
      [code],
    );
    const claim = (claimRows as Array<{ expires_at: Date | string; claimed_at: Date | string | null }>)[0];
    if (!claim) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    if (claim.claimed_at || new Date(claim.expires_at).getTime() <= Date.now()) {
      res.status(410).json({ error: "This link has expired or already been used" });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ kind: "claim" });
  } catch (error) {
    logger.error({ err: error }, "Failed to inspect short link");
    res.status(500).json({ error: "Could not open this link." });
  } finally {
    connection.release();
  }
});

/**
 * Existing-account links no longer mint a Clerk sign-in token. The user first
 * authenticates normally through Clerk, then this endpoint verifies that the
 * authenticated account actually owns the short link before returning its
 * destination.
 */
router.post("/auth-links/:code/redeem", requireAuth, async (req, res): Promise<void> => {
  const code = String(req.params.code ?? "");
  if (!CODE_RE.test(code)) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const userId = (req as Request & { userId: string }).userId;
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT l.id, l.user_id, l.destination, l.expires_at, l.used_at, u.is_suspended
         FROM short_auth_links l
         JOIN users u ON u.id = l.user_id
        WHERE l.code = ?
        LIMIT 1`,
      [code],
    );
    const link = (rows as unknown as LockedAuthLink[])[0];

    if (!link) {
      res.status(404).json({ error: "Link not found" });
      return;
    }
    if (link.user_id !== userId) {
      res.status(403).json({ error: "This link belongs to a different GotThis account." });
      return;
    }
    if (link.used_at || new Date(link.expires_at).getTime() <= Date.now()) {
      res.status(410).json({ error: "This link has expired or already been used" });
      return;
    }
    if (Boolean(link.is_suspended)) {
      res.status(403).json({ error: "Account unavailable" });
      return;
    }

    const destination = normalizeAuthDestination(link.destination);
    if (!destination) {
      logger.error({ linkId: link.id }, "Rejected unsafe short auth link destination");
      res.status(400).json({ error: "Invalid link destination" });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ destination });
  } catch (error) {
    logger.error({ err: error, userId }, "Failed to redeem short authenticated link");
    res.status(500).json({ error: "Could not open this link. Please request a new one from WhatsApp." });
  } finally {
    connection.release();
  }
});

router.post("/auth-links/:code/consume", requireAuth, async (req, res): Promise<void> => {
  const code = String(req.params.code ?? "");
  if (!CODE_RE.test(code)) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const userId = (req as Request & { userId: string }).userId;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT l.id, l.user_id, l.destination, l.expires_at, l.used_at, u.is_suspended
         FROM short_auth_links l
         JOIN users u ON u.id = l.user_id
        WHERE l.code = ?
        LIMIT 1
        FOR UPDATE`,
      [code],
    );
    const link = (rows as unknown as LockedAuthLink[])[0];

    if (!link) {
      await connection.rollback();
      res.status(404).json({ error: "Link not found" });
      return;
    }
    if (link.user_id !== userId) {
      await connection.rollback();
      res.status(403).json({ error: "This link belongs to a different GotThis account." });
      return;
    }
    if (link.used_at) {
      await connection.rollback();
      res.status(410).json({ error: "This link has already been used" });
      return;
    }
    if (new Date(link.expires_at).getTime() <= Date.now()) {
      await connection.rollback();
      res.status(410).json({ error: "This link has expired" });
      return;
    }
    if (Boolean(link.is_suspended)) {
      await connection.rollback();
      res.status(403).json({ error: "Account unavailable" });
      return;
    }

    await connection.execute(
      "UPDATE short_auth_links SET used_at = NOW() WHERE id = ? AND used_at IS NULL",
      [link.id],
    );
    await connection.commit();

    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true });
  } catch (error) {
    try { await connection.rollback(); } catch { /* preserve original error */ }
    logger.error({ err: error, userId }, "Failed to consume short authenticated link");
    res.status(500).json({ error: "Could not finish opening this link." });
  } finally {
    connection.release();
  }
});

/** Attach a pending WhatsApp identity to the Clerk user who authenticated. */
router.post("/auth-links/:code/claim", requireAuth, async (req, res): Promise<void> => {
  const code = String(req.params.code ?? "");
  if (!CODE_RE.test(code)) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const userId = (req as Request & { userId: string }).userId;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [claimRows] = await connection.execute(
      `SELECT id, phone_hash, whatsapp_jid, expires_at, claimed_user_id, claimed_at
         FROM pending_whatsapp_claims
        WHERE code = ?
        LIMIT 1
        FOR UPDATE`,
      [code],
    );
    const claim = (claimRows as unknown as PendingClaimRow[])[0];
    if (!claim) {
      await connection.rollback();
      res.status(404).json({ error: "Link not found" });
      return;
    }
    if (claim.claimed_at || new Date(claim.expires_at).getTime() <= Date.now()) {
      await connection.rollback();
      res.status(410).json({ error: "This link has expired or already been used" });
      return;
    }

    const [conflictRows] = await connection.execute(
      "SELECT id FROM users WHERE phone_hash = ? AND id <> ? LIMIT 1",
      [claim.phone_hash, userId],
    );
    if ((conflictRows as Array<{ id: string }>).length > 0) {
      await connection.rollback();
      res.status(409).json({ error: "This WhatsApp number is already connected to another GotThis account." });
      return;
    }

    const [userRows] = await connection.execute(
      "SELECT onboarding_completed FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    const user = (userRows as Array<{ onboarding_completed: number | boolean }>)[0];
    if (!user) {
      await connection.rollback();
      res.status(404).json({ error: "Account not found" });
      return;
    }

    await connection.execute(
      "UPDATE users SET phone_hash = ?, whatsapp_jid = ?, updated_at = NOW() WHERE id = ?",
      [claim.phone_hash, claim.whatsapp_jid, userId],
    );
    await connection.execute(
      "UPDATE pending_whatsapp_claims SET claimed_user_id = ?, claimed_at = NOW() WHERE id = ? AND claimed_at IS NULL",
      [userId, claim.id],
    );
    await connection.commit();

    logger.info({ userId }, "Linked pending WhatsApp sender to authenticated account");
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, destination: Boolean(user.onboarding_completed) ? "/dashboard" : "/onboarding" });
  } catch (error) {
    try { await connection.rollback(); } catch { /* preserve original error */ }
    logger.error({ err: error, userId }, "Failed to claim pending WhatsApp identity");
    res.status(500).json({ error: "Could not connect this WhatsApp number. Please try again." });
  } finally {
    connection.release();
  }
});

export default router;
