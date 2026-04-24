import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getQR, getStatus, disconnectWhatsApp } from "../lib/whatsapp/service.js";

const router: IRouter = Router();

router.get("/whatsapp/status", requireAuth, (_req, res): void => {
  res.json({ status: getStatus(), hasQR: getQR() !== null });
});

router.get("/whatsapp/qr", requireAuth, (_req, res): void => {
  const qr = getQR();
  const status = getStatus();

  if (status === "open") {
    res.json({ status: "connected" });
    return;
  }

  if (!qr) {
    res.json({ status: "connecting", qr: null });
    return;
  }

  res.json({ status: "connecting", qr });
});

router.post("/whatsapp/disconnect", requireAuth, async (_req, res): Promise<void> => {
  await disconnectWhatsApp();
  res.json({ ok: true });
});

export default router;
