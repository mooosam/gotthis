import {
  mysqlTable,
  text,
  int,
  boolean,
  timestamp,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plansTable = mysqlTable("plans", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  dailyMessageCap: int("daily_message_cap").notNull().default(5),
  monthlyTokenAllowance: int("monthly_token_allowance").notNull().default(50000),
  monthlySkipCredits: int("monthly_skip_credits").notNull().default(4),
  priceCents: int("price_cents").notNull().default(0),
  billingPeriod: text("billing_period").notNull().default("monthly"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;
