import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, goalsTable, milestonesTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/share/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  if (!token || token.length < 4) {
    res.status(400).json({ error: "Invalid token" });
    return;
  }

  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.shareToken, token));

  if (!goal) {
    res.status(404).json({ error: "Progress card not found" });
    return;
  }

  const [user] = await db
    .select({ timezone: usersTable.timezone })
    .from(usersTable)
    .where(eq(usersTable.id, goal.userId));

  const milestones = await db
    .select()
    .from(milestonesTable)
    .where(and(eq(milestonesTable.goalId, goal.id), eq(milestonesTable.userId, goal.userId)))
    .orderBy(asc(milestonesTable.order));

  res.json({
    goal: {
      id: goal.id,
      title: goal.title,
      category: goal.category,
      progress: goal.progress,
      currentStreak: goal.currentStreak,
      longestStreak: goal.longestStreak,
      createdAt: goal.createdAt,
    },
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      order: m.order,
      completed: m.completed,
      completedAt: m.completedAt,
    })),
    sharedAt: new Date().toISOString(),
  });
});

export default router;
