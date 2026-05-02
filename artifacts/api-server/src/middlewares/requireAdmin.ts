import type { Request, Response, NextFunction } from "express";
import type { User } from "@workspace/db";

const LEGACY_ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

// requireAdmin must run AFTER requireAuth (which attaches req.user).
//
// Admin status is now stored on the users table (isAdmin column). The legacy
// ADMIN_USER_IDS env var is still honoured as a break-glass override so the
// operator can rescue access if the DB flag gets cleared.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const userId = (req as typeof req & { userId?: string }).userId;
  const user = (req as typeof req & { user?: User }).user;

  if (!userId || !user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (user.isAdmin) {
    next();
    return;
  }

  if (LEGACY_ADMIN_USER_IDS.includes(userId)) {
    next();
    return;
  }

  res.status(403).json({ error: "Forbidden" });
}
