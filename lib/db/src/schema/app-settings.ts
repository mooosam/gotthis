import { mysqlTable, text, varchar, timestamp } from "drizzle-orm/mysql-core";

export const appSettingsTable = mysqlTable("app_settings", {
  key:       varchar("key", { length: 255 }).primaryKey(),
  value:     text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AppSetting = typeof appSettingsTable.$inferSelect;
