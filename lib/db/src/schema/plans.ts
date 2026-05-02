import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plansTable = pgTable("plans", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  dailyMessageCap: integer("daily_message_cap").notNull().default(5),
  monthlyTokenAllowance: integer("monthly_token_allowance").notNull().default(50000),
  monthlySkipCredits: integer("monthly_skip_credits").notNull().default(4),
  priceCents: integer("price_cents").notNull().default(0),
  billingPeriod: text("billing_period").notNull().default("monthly"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
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
