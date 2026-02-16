import {
  type User,
  type InsertUser,
  type InventoryItem,
  type InsertInventoryItem,
  type Client,
  type InsertClient,
  type Transaction,
  type InsertTransaction,
  type TransactionItem,
  type InsertTransactionItem,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Inventory
  getInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(
    id: string,
    item: Partial<InsertInventoryItem>,
  ): Promise<InventoryItem | undefined>;

  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getClientByIdentifier(identifier: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(
    id: string,
    client: Partial<InsertClient>,
  ): Promise<Client | undefined>;

  // Transactions
  getTransactions(): Promise<Transaction[]>;
  createTransaction(tx: InsertTransaction): Promise<Transaction>;

  // Transaction Items
  getTransactionItems(transactionId: string): Promise<TransactionItem[]>;
  createTransactionItem(item: InsertTransactionItem): Promise<TransactionItem>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private inventoryItemsMap: Map<string, InventoryItem>;
  private clientsMap: Map<string, Client>;
  private transactionsMap: Map<string, Transaction>;
  private transactionItemsMap: Map<string, TransactionItem>;

  constructor() {
    this.users = new Map();
    this.inventoryItemsMap = new Map();
    this.clientsMap = new Map();
    this.transactionsMap = new Map();
    this.transactionItemsMap = new Map();
  }

  // ─── Users ───────────────────────────────────────────────────────────────

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      username: insertUser.username,
      password: insertUser.password,
      role: insertUser.role ?? "volunteer",
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  // ─── Inventory ─────────────────────────────────────────────────────────

  async getInventoryItems(): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItemsMap.values());
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    return this.inventoryItemsMap.get(id);
  }

  async createInventoryItem(
    insert: InsertInventoryItem,
  ): Promise<InventoryItem> {
    const now = new Date();
    const item: InventoryItem = {
      id: randomUUID(),
      name: insert.name,
      category: insert.category ?? "Uncategorized",
      barcode: insert.barcode ?? null,
      quantity: insert.quantity ?? 0,
      weightPerUnitLbs: insert.weightPerUnitLbs ?? "0",
      valuePerUnitUsd: insert.valuePerUnitUsd ?? "0",
      reorderThreshold: insert.reorderThreshold ?? null,
      allergens: insert.allergens ?? [],
      expirationDate: insert.expirationDate ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.inventoryItemsMap.set(item.id, item);
    return item;
  }

  async updateInventoryItem(
    id: string,
    partial: Partial<InsertInventoryItem>,
  ): Promise<InventoryItem | undefined> {
    const existing = this.inventoryItemsMap.get(id);
    if (!existing) return undefined;

    const updated: InventoryItem = {
      ...existing,
      ...partial,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.inventoryItemsMap.set(id, updated);
    return updated;
  }

  // ─── Clients ───────────────────────────────────────────────────────────

  async getClients(): Promise<Client[]> {
    return Array.from(this.clientsMap.values());
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clientsMap.get(id);
  }

  async getClientByIdentifier(
    identifier: string,
  ): Promise<Client | undefined> {
    return Array.from(this.clientsMap.values()).find(
      (c) => c.identifier === identifier,
    );
  }

  async createClient(insert: InsertClient): Promise<Client> {
    const now = new Date();
    const client: Client = {
      id: randomUUID(),
      name: insert.name,
      identifier: insert.identifier,
      contact: insert.contact ?? null,
      allergies: insert.allergies ?? [],
      notes: insert.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.clientsMap.set(client.id, client);
    return client;
  }

  async updateClient(
    id: string,
    partial: Partial<InsertClient>,
  ): Promise<Client | undefined> {
    const existing = this.clientsMap.get(id);
    if (!existing) return undefined;

    const updated: Client = {
      ...existing,
      ...partial,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.clientsMap.set(id, updated);
    return updated;
  }

  // ─── Transactions ──────────────────────────────────────────────────────

  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactionsMap.values());
  }

  async createTransaction(insert: InsertTransaction): Promise<Transaction> {
    const now = new Date();
    const tx: Transaction = {
      id: randomUUID(),
      type: insert.type,
      timestamp: insert.timestamp ?? now,
      source: insert.source ?? null,
      donor: insert.donor ?? null,
      clientId: insert.clientId ?? null,
      clientName: insert.clientName ?? null,
      latitude: insert.latitude ?? null,
      longitude: insert.longitude ?? null,
      accuracy: insert.accuracy ?? null,
      createdAt: now,
    };
    this.transactionsMap.set(tx.id, tx);
    return tx;
  }

  // ─── Transaction Items ─────────────────────────────────────────────────

  async getTransactionItems(
    transactionId: string,
  ): Promise<TransactionItem[]> {
    return Array.from(this.transactionItemsMap.values()).filter(
      (ti) => ti.transactionId === transactionId,
    );
  }

  async createTransactionItem(
    insert: InsertTransactionItem,
  ): Promise<TransactionItem> {
    const item: TransactionItem = {
      id: randomUUID(),
      transactionId: insert.transactionId,
      inventoryItemId: insert.inventoryItemId,
      name: insert.name,
      quantity: insert.quantity,
      weightPerUnitLbs: insert.weightPerUnitLbs,
      valuePerUnitUsd: insert.valuePerUnitUsd,
    };
    this.transactionItemsMap.set(item.id, item);
    return item;
  }
}

export const storage = new MemStorage();
