import type { Request, Response, NextFunction } from "express";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const userId = (req as typeof req & { userId?: string }).userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (ADMIN_USER_IDS.length === 0) {
    if (IS_PRODUCTION) {
      res.status(403).json({ error: "Forbidden: admin access not configured" });
      return;
    }
    next();
    return;
  }

  if (!ADMIN_USER_IDS.includes(userId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}
