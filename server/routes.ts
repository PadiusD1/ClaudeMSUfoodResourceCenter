import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertInventoryItemSchema,
  insertClientSchema,
  insertTransactionSchema,
  insertTransactionItemSchema,
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // ─── Inventory Items ─────────────────────────────────────────────────

  app.get("/api/inventory", async (_req, res) => {
    const items = await storage.getInventoryItems();
    res.json(items);
  });

  app.get("/api/inventory/:id", async (req, res) => {
    const item = await storage.getInventoryItem(req.params.id);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  });

  app.post("/api/inventory", async (req, res) => {
    const result = insertInventoryItemSchema.safeParse(req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ message: "Invalid data", errors: result.error.errors });
    }
    const item = await storage.createInventoryItem(result.data);
    res.status(201).json(item);
  });

  app.patch("/api/inventory/:id", async (req, res) => {
    const result = insertInventoryItemSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ message: "Invalid data", errors: result.error.errors });
    }
    const updated = await storage.updateInventoryItem(
      req.params.id,
      result.data,
    );
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  // ─── Clients ─────────────────────────────────────────────────────────

  app.get("/api/clients", async (_req, res) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.get("/api/clients/:id", async (req, res) => {
    const client = await storage.getClient(req.params.id);
    if (!client) return res.status(404).json({ message: "Not found" });
    res.json(client);
  });

  app.post("/api/clients", async (req, res) => {
    const result = insertClientSchema.safeParse(req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ message: "Invalid data", errors: result.error.errors });
    }
    const client = await storage.createClient(result.data);
    res.status(201).json(client);
  });

  app.patch("/api/clients/:id", async (req, res) => {
    const result = insertClientSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ message: "Invalid data", errors: result.error.errors });
    }
    const updated = await storage.updateClient(req.params.id, result.data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  // ─── Transactions ────────────────────────────────────────────────────

  app.get("/api/transactions", async (_req, res) => {
    const transactions = await storage.getTransactions();
    res.json(transactions);
  });

  app.post("/api/transactions", async (req, res) => {
    const { items: rawItems, ...txBody } = req.body;

    const txResult = insertTransactionSchema.safeParse(txBody);
    if (!txResult.success) {
      return res
        .status(400)
        .json({ message: "Invalid data", errors: txResult.error.errors });
    }

    const transaction = await storage.createTransaction(txResult.data);

    const createdItems = [];
    if (Array.isArray(rawItems)) {
      for (const rawItem of rawItems) {
        const itemResult = insertTransactionItemSchema.safeParse({
          ...rawItem,
          transactionId: transaction.id,
        });
        if (!itemResult.success) {
          return res
            .status(400)
            .json({ message: "Invalid item data", errors: itemResult.error.errors });
        }
        const created = await storage.createTransactionItem(itemResult.data);
        createdItems.push(created);
      }
    }

    res.status(201).json({ ...transaction, items: createdItems });
  });

  app.get("/api/transactions/:id/items", async (req, res) => {
    const items = await storage.getTransactionItems(req.params.id);
    res.json(items);
  });

  return httpServer;
}
