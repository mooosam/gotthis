import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import goalsRouter from "./goals";
import dailyLogsRouter from "./daily-logs";
import memoryRouter from "./memory";
import dashboardRouter from "./dashboard";
import magicLinksRouter from "./magic-links";
import aiRouter from "./ai";
import whatsappRouter from "./whatsapp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(goalsRouter);
router.use(dailyLogsRouter);
router.use(memoryRouter);
router.use(dashboardRouter);
router.use(magicLinksRouter);
router.use(aiRouter);
router.use(whatsappRouter);

export default router;
