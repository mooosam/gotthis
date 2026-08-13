import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { getStatus, getConnectedPhone } from "../lib/whatsapp/service.js";

const router: IRouter = Router();

// Public — no auth. Landing page uses this to build the wa.me link.
router.get("/whatsapp/bot-number", (_req, res): void => {
  res.json({ phone: getConnectedPhone() });
});

router.get("/whatsapp/status", requireAuth, requireAdmin, (_req, res): void => {
  res.json({ status: getStatus(), connectedPhone: getConnectedPhone() });
});

export default router;
