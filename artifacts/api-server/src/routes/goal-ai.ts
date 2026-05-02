import { Router, type IRouter } from "express";
import { eq, and, asc, gte } from "drizzle-orm";
import { db, goalsTable, milestonesTable, dailyLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { GenerateRoadmapBody } from "@workspace/api-zod";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { nanoid } from "nanoid";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

interface RoadmapStep {
  title: string;
  description: string;
  order: number;
}

router.post("/goals/:id/roadmap", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { id } = req.params;

  const parsed = GenerateRoadmapBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const commit = parsed.data.commit === true;

  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const prompt = `You are a goal coach. Break this goal into 3 to 7 concrete milestone steps that, completed in order, would achieve the goal.

Goal title: ${goal.title}
${goal.description ? `Description: ${goal.description}` : ""}
${goal.successCriteria ? `Success criteria: ${goal.successCriteria}` : ""}
${goal.targetValue ? `Target: ${goal.targetValue} ${goal.targetUnit ?? ""}` : ""}
${goal.deadline ? `Deadline: ${goal.deadline}` : ""}

Return ONLY a JSON object of the form:
{ "suggestions": [ { "title": "...", "description": "...", "order": 1 }, ... ] }

Rules:
- Between 3 and 7 steps.
- "title" is a short action phrase (max 60 chars).
- "description" explains the step in 1-2 sentences.
- "order" is the 1-indexed sequence position.
- No markdown, no commentary, JSON only.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  let suggestions: RoadmapStep[] = [];
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsedJson = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as { suggestions?: unknown };
    if (Array.isArray(parsedJson.suggestions)) {
      suggestions = parsedJson.suggestions
        .filter((s): s is { title: string; description?: string; order?: number } =>
          typeof s === "object" && s !== null && "title" in s && typeof (s as { title: unknown }).title === "string",
        )
        .map((s, i) => ({
          title: String(s.title).slice(0, 200),
          description: typeof s.description === "string" ? s.description.slice(0, 1000) : "",
          order: typeof s.order === "number" && s.order >= 1 ? s.order : i + 1,
        }))
        .slice(0, 7);
    }
  } catch (err) {
    logger.warn({ err, raw: raw.slice(0, 200) }, "Failed to parse roadmap JSON");
  }

  if (suggestions.length === 0) {
    res.status(502).json({ error: "AI did not return usable suggestions; please retry" });
    return;
  }

  if (commit) {
    // Atomic: read existing max order and insert all suggestions in one tx so a
    // partial failure cannot leave the user with half a roadmap.
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ order: milestonesTable.order })
        .from(milestonesTable)
        .where(and(eq(milestonesTable.goalId, id), eq(milestonesTable.userId, userId)))
        .orderBy(asc(milestonesTable.order));
      const baseOrder = existing.length > 0 ? Math.max(...existing.map((m) => m.order)) : 0;

      await tx.insert(milestonesTable).values(
        suggestions.map((s, i) => ({
          id: nanoid(),
          goalId: id,
          userId,
          title: s.title,
          order: baseOrder + i + 1,
        })),
      );
    });
  }

  res.json({ suggestions });
});

router.get("/goals/:id/forecast", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { id } = req.params;

  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, id), eq(goalsTable.userId, userId)));

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  if (goal.goalType !== "target" && goal.goalType !== "average") {
    res.json({
      eligible: false,
      predictedFinishDate: null,
      velocityPerDay: null,
      confidence: null,
      reason: "Forecast only applies to target or average goals",
    });
    return;
  }

  if (!goal.targetValue || goal.targetValue <= 0) {
    res.json({
      eligible: false,
      predictedFinishDate: null,
      velocityPerDay: null,
      confidence: null,
      reason: "No target value set",
    });
    return;
  }

  if (goal.currentValue >= goal.targetValue) {
    res.json({
      eligible: true,
      predictedFinishDate: new Date().toISOString().split("T")[0],
      velocityPerDay: 0,
      confidence: "high",
      reason: "Already at or past target",
    });
    return;
  }

  // Use last 30 days of daily-log progressDelta for this goal as velocity samples.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

  // Push the date filter to SQL so we don't load every log the user has ever made.
  const logs = await db
    .select({ data: dailyLogsTable.data })
    .from(dailyLogsTable)
    .where(
      and(eq(dailyLogsTable.userId, userId), gte(dailyLogsTable.logDate, cutoff)),
    );

  const recentDeltas: number[] = [];
  for (const log of logs) {
    const data = log.data as { goalProgress?: Record<string, { delta?: number }> } | null;
    const delta = data?.goalProgress?.[id]?.delta;
    if (typeof delta === "number" && delta > 0) recentDeltas.push(delta);
  }

  if (recentDeltas.length < 3) {
    res.json({
      eligible: false,
      predictedFinishDate: null,
      velocityPerDay: null,
      confidence: null,
      reason: "Need at least 3 days of progress data to forecast",
    });
    return;
  }

  const avgDelta = recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length;
  if (avgDelta <= 0) {
    res.json({
      eligible: false,
      predictedFinishDate: null,
      velocityPerDay: null,
      confidence: null,
      reason: "No positive velocity in recent logs",
    });
    return;
  }

  const remaining = goal.targetValue - goal.currentValue;
  const daysToFinish = Math.ceil(remaining / avgDelta);
  const finish = new Date();
  finish.setDate(finish.getDate() + daysToFinish);
  const predictedFinishDate = finish.toISOString().split("T")[0];

  // Confidence: more samples + lower variance = higher confidence.
  const variance =
    recentDeltas.reduce((a, b) => a + (b - avgDelta) ** 2, 0) / recentDeltas.length;
  const cv = Math.sqrt(variance) / avgDelta; // coefficient of variation
  let confidence: "low" | "medium" | "high" = "low";
  if (recentDeltas.length >= 14 && cv < 0.4) confidence = "high";
  else if (recentDeltas.length >= 7 && cv < 0.7) confidence = "medium";

  res.json({
    eligible: true,
    predictedFinishDate,
    velocityPerDay: Math.round(avgDelta * 100) / 100,
    confidence,
    reason: null,
  });
});

export default router;
