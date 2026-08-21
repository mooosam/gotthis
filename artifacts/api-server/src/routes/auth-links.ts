import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { pool } from "@workspace/db";
import { normalizeAuthDestination } from "../lib/whatsapp/auth-link.js";
import { logger } from "../lib/logger.js";

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

router.post("/auth-links/:code/redeem", async (req, res): Promise<void> => {
  const code = String(req.params.code ?? "");
  if (!CODE_RE.test(code)) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

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

    // Mint the Clerk credential only after the short link is opened. Do not mark
    // the short link used yet: the browser may still fail to establish the Clerk
    // session. The client confirms successful sign-in via /consume below.
    const signInToken = await clerkClient.signInTokens.createSignInToken({
      userId: link.user_id,
      expiresInSeconds: 60,
    });

    res.setHeader("Cache-Control", "no-store");
    res.json({ ticket: signInToken.token, destination });
  } catch (error) {
    logger.error({ err: error }, "Failed to redeem short authenticated link");
    res.status(500).json({ error: "Could not open this link. Please request a new one from WhatsApp." });
  } finally {
    connection.release();
  }
});

router.post("/auth-links/:code/consume", async (req, res): Promise<void> => {
  const code = String(req.params.code ?? "");
  if (!CODE_RE.test(code)) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

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
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback failure; the original error is the useful one.
    }
    logger.error({ err: error }, "Failed to consume short authenticated link");
    res.status(500).json({ error: "Could not finish opening this link." });
  } finally {
    connection.release();
  }
});

export default router;
