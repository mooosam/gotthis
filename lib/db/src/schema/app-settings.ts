import { mysqlTable, text, timestamp } from "drizzle-orm/mysql-core";

export const appSettingsTable = mysqlTable("app_settings", {
  key:       text("key").primaryKey(),
  value:     text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AppSetting = typeof appSettingsTable.$inferSelect;
