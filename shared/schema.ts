import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  uuid,
  integer,
  numeric,
  date,
  timestamp,
  pgEnum,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "staff",
  "volunteer",
]);

export const transactionTypeEnum = pgEnum("transaction_type", ["IN", "OUT"]);

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("volunteer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Inventory Items ─────────────────────────────────────────────────────────

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Uncategorized"),
  barcode: text("barcode").unique(),
  quantity: integer("quantity").notNull().default(0),
  weightPerUnitLbs: numeric("weight_per_unit_lbs", {
    precision: 10,
    scale: 4,
  })
    .notNull()
    .default("0"),
  valuePerUnitUsd: numeric("value_per_unit_usd", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("0"),
  reorderThreshold: integer("reorder_threshold"),
  allergens: text("allergens")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  expirationDate: date("expiration_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

// ─── Clients ─────────────────────────────────────────────────────────────────

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  identifier: text("identifier").notNull().unique(),
  contact: text("contact"),
  allergies: text("allergies")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertClientSchema = createInsertSchema(clients)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// ─── Transactions ────────────────────────────────────────────────────────────

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: transactionTypeEnum("type").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  source: text("source"),
  donor: text("donor"),
  clientId: uuid("client_id").references(() => clients.id),
  clientName: text("client_name"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  accuracy: doublePrecision("accuracy"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactions)
  .omit({ id: true, createdAt: true });

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// ─── Transaction Items ───────────────────────────────────────────────────────

export const transactionItems = pgTable("transaction_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id),
  inventoryItemId: uuid("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  weightPerUnitLbs: numeric("weight_per_unit_lbs", {
    precision: 10,
    scale: 4,
  }).notNull(),
  valuePerUnitUsd: numeric("value_per_unit_usd", {
    precision: 10,
    scale: 2,
  }).notNull(),
});

export const insertTransactionItemSchema = createInsertSchema(transactionItems)
  .omit({ id: true });

export type InsertTransactionItem = z.infer<typeof insertTransactionItemSchema>;
export type TransactionItem = typeof transactionItems.$inferSelect;

// ─── Relations ───────────────────────────────────────────────────────────────

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  client: one(clients, {
    fields: [transactions.clientId],
    references: [clients.id],
  }),
  items: many(transactionItems),
}));

export const transactionItemsRelations = relations(transactionItems, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionItems.transactionId],
    references: [transactions.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [transactionItems.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  transactions: many(transactions),
}));
