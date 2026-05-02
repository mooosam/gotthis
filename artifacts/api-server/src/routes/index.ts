import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import goalsRouter from "./goals";
import goalPauseRouter from "./goal-pause";
import goalAiRouter from "./goal-ai";
import milestonesRouter from "./milestones";
import dailyLogsRouter from "./daily-logs";
import memoryRouter from "./memory";
import dashboardRouter from "./dashboard";
import magicLinksRouter from "./magic-links";
import aiRouter from "./ai";
import whatsappRouter from "./whatsapp";
import emailRouter from "./email";
import shareRouter from "./share";
import skipCreditsRouter from "./skip-credits";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(goalsRouter);
router.use(goalPauseRouter);
router.use(goalAiRouter);
router.use(milestonesRouter);
router.use(dailyLogsRouter);
router.use(memoryRouter);
router.use(dashboardRouter);
router.use(magicLinksRouter);
router.use(aiRouter);
router.use(whatsappRouter);
router.use(emailRouter);
router.use(shareRouter);
router.use(skipCreditsRouter);
router.use(adminRouter);

export default router;
