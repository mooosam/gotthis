import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import goalsRouter from "./goals";
import milestonesRouter from "./milestones";
import dailyLogsRouter from "./daily-logs";
import memoryRouter from "./memory";
import dashboardRouter from "./dashboard";
import magicLinksRouter from "./magic-links";
import aiRouter from "./ai";
import whatsappRouter from "./whatsapp";
import emailRouter from "./email";
import shareRouter from "./share";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(goalsRouter);
router.use(milestonesRouter);
router.use(dailyLogsRouter);
router.use(memoryRouter);
router.use(dashboardRouter);
router.use(magicLinksRouter);
router.use(aiRouter);
router.use(whatsappRouter);
router.use(emailRouter);
router.use(shareRouter);

export default router;
