import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { getQR, getStatus, getPairingCode, disconnectWhatsApp, requestPairingCode } from "../lib/whatsapp/service.js";

const router: IRouter = Router();

router.get("/whatsapp/status", requireAuth, requireAdmin, (_req, res): void => {
  res.json({ status: getStatus(), hasQR: getQR() !== null, hasPairingCode: getPairingCode() !== null });
});

router.get("/whatsapp/qr", requireAuth, requireAdmin, (_req, res): void => {
  const qr = getQR();
  const status = getStatus();
  const code = getPairingCode();

  if (status === "open") {
    res.json({ status: "connected" });
    return;
  }

  res.json({ status: "connecting", qr: qr ?? null, pairingCode: code ?? null });
});

router.post("/whatsapp/pair", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { phone } = req.body as { phone?: string };
  if (!phone || !/^\+?\d{7,15}$/.test(phone.replace(/\s/g, ""))) {
    res.status(400).json({ error: "Provide a valid phone number with country code, e.g. +447700900000" });
    return;
  }
  try {
    const code = await requestPairingCode(phone.replace(/\s/g, ""));
    res.json({ code });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate pairing code";
    res.status(500).json({ error: message });
  }
});

router.post("/whatsapp/disconnect", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  await disconnectWhatsApp();
  res.json({ ok: true });
});

export default router;
