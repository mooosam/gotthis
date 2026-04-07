import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  phoneHash: text("phone_hash"),
  timezone: text("timezone").notNull().default("UTC"),
  tier: text("tier").notNull().default("free"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  dailyMessageCount: integer("daily_message_count").notNull().default(0),
  dailyMessageResetAt: timestamp("daily_message_reset_at", { withTimezone: true }),
  monthlyTokenCount: integer("monthly_token_count").notNull().default(0),
  monthlyTokenResetAt: timestamp("monthly_token_reset_at", { withTimezone: true }),
  dailyMessageCap: integer("daily_message_cap").notNull().default(5),
  monthlyTokenAllowance: integer("monthly_token_allowance").notNull().default(50000),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  newsletterCadence: text("newsletter_cadence").notNull().default("weekly"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
