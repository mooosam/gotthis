import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { rateLimit } from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { handleBillingWebhook } from "./routes/billing";

const app: Express = express();

// Webhook route MUST be registered before express.json() — Stripe requires the raw body.
// Configure https://gotthis.one/api/billing/webhook as the endpoint in Stripe dashboard.
// Events to enable: checkout.session.completed, customer.subscription.updated,
//                   customer.subscription.deleted, invoice.payment_failed
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    const sig = Array.isArray(signature) ? signature[0] : (signature ?? "");
    try {
      await handleBillingWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err }, "Billing webhook error");
      res.status(400).json({ error: msg });
    }
  }
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const allowedOrigins: (string | RegExp)[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [/localhost/, /\.replit\.dev$/, /\.repl\.co$/, /\.replit\.app$/, "https://gotthis.one", "https://www.gotthis.one"];

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = allowedOrigins.some((pattern) =>
        typeof pattern === "string" ? pattern === origin : pattern.test(origin),
      );
      callback(allowed ? null : new Error("CORS: origin not allowed"), allowed);
    },
  }),
);

// CORS error handler — must come immediately after cors() so it catches
// the Error thrown by the origin callback before Express's default handler
// turns it into a 500 HTML stack trace.
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof Error && err.message === "CORS: origin not allowed") {
    res.status(403).json({ error: "CORS: origin not allowed" });
    return;
  }
  next(err);
});

// Global rate limiter — 200 req/min per IP for all non-webhook routes.
// AI endpoints layer their own tighter per-user throttles on top of this.
// Webhook routes are registered before this middleware runs, so they're exempt.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});
app.use(globalLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

export default app;
