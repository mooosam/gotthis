import {
  mysqlTable,
  text,
  int,
  boolean,
  timestamp,
  json,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = mysqlTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  phoneHash: text("phone_hash"),
  whatsappJid: text("whatsapp_jid"),
  timezone: text("timezone").notNull().default("UTC"),
  tier: text("tier").notNull().default("free"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isSuspended: boolean("is_suspended").notNull().default(false),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  dailyMessageCount: int("daily_message_count").notNull().default(0),
  dailyMessageResetAt: timestamp("daily_message_reset_at"),
  monthlyTokenCount: int("monthly_token_count").notNull().default(0),
  monthlyTokenResetAt: timestamp("monthly_token_reset_at"),
  dailyMessageCap: int("daily_message_cap").notNull().default(5),
  monthlyTokenAllowance: int("monthly_token_allowance").notNull().default(50000),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  newsletterCadence: text("newsletter_cadence").notNull().default("weekly"),
  lastWeeklyChartSentAt: timestamp("last_weekly_chart_sent_at"),
  lastNewsletterSentAt: timestamp("last_newsletter_sent_at"),
  monthlySkipCredits: int("monthly_skip_credits").notNull().default(4),
  skipCreditsUsed: int("skip_credits_used").notNull().default(0),
  skipCreditsResetAt: timestamp("skip_credits_reset_at"),
  preferredPushHour: int("preferred_push_hour").notNull().default(8),
  engagementSamples: json("engagement_samples").$type<Array<{ hour: number; responded: boolean; ts: string }>>().notNull().default([]),
  lastWeeklyInsightAt: timestamp("last_weekly_insight_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
