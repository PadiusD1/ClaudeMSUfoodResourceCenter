import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  barcode?: string;
  quantity: number;
  weightPerUnitLbs: number;
  valuePerUnitUsd: number;
  reorderThreshold?: number;
  allergens?: string[];
  createdAt: string;
  updatedAt: string;
};

export type ClientRecord = {
  id: string;
  name: string;
  identifier: string;
  contact?: string;
  allergies?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type TransactionItem = {
  itemId: string;
  name: string;
  quantity: number;
  weightPerUnitLbs: number;
  valuePerUnitUsd: number;
};

export type TransactionType = "IN" | "OUT";

export type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  timestamp: string;
  items: TransactionItem[];
  source?: string;
  donor?: string;
  clientId?: string;
  clientName?: string;
  location?: GeoLocation;
};

export type Settings = {
  visitWarningDays: number;
};

export type BarcodeCacheEntry = {
  name?: string;
  category?: string;
  weightPerUnitLbs?: number;
  allergens?: string[];
  cachedAt: string;
};

export type RepositoryState = {
  inventory: InventoryItem[];
  clients: ClientRecord[];
  transactions: Transaction[];
  settings: Settings;
  barcodeCache: Record<string, BarcodeCacheEntry>;
  sources: string[];
  donors: string[];
};

const STORAGE_KEY = "morgan-state-repository:v1";

const defaultState: RepositoryState = {
  inventory: [],
  clients: [],
  transactions: [],
  settings: {
    visitWarningDays: 7,
  },
  barcodeCache: {},
  sources: ["Donation", "Purchase", "Transfer", "Other"],
  donors: ["Morgan State University", "Maryland Food Bank", "Local Grocery"],
};

function loadState(): RepositoryState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as RepositoryState;
    return {
      ...defaultState,
      ...parsed,
    };
  } catch {
    return defaultState;
  }
}

function saveState(state: RepositoryState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function uuid() {
  return crypto.randomUUID();
}

export type RepositoryContextValue = RepositoryState & {
  addOrUpdateItem: (partial: Partial<InventoryItem> & { name: string }) => InventoryItem;
  adjustItemQuantity: (itemId: string, delta: number) => void;
  recordInbound: (options: {
    itemId: string;
    quantity: number;
    source?: string;
    donor?: string;
    timestamp?: string;
    location?: GeoLocation;
  }) => void;
  recordOutbound: (options: {
    client: { id?: string; name: string; identifier: string; contact?: string };
    items: { itemId: string; quantity: number }[];
    timestamp?: string;
    location?: GeoLocation;
  }) => { client: ClientRecord } | undefined;
  upsertClient: (partial: Partial<ClientRecord> & { name: string; identifier: string }) => ClientRecord;
  updateSettings: (partial: Partial<Settings>) => void;
  upsertBarcodeCache: (barcode: string, entry: Omit<BarcodeCacheEntry, "cachedAt">) => void;
  addSource: (source: string) => void;
  addDonor: (donor: string) => void;
};

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

export function RepositoryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RepositoryState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo<RepositoryContextValue>(() => {
    function addOrUpdateItem(partial: Partial<InventoryItem> & { name: string }): InventoryItem {
      const now = new Date().toISOString();
      let existing =
        (partial.id && state.inventory.find((i) => i.id === partial.id)) ||
        (partial.barcode
          ? state.inventory.find((i) => i.barcode && i.barcode === partial.barcode)
          : undefined);

      if (existing) {
        const updated: InventoryItem = {
          ...existing,
          ...partial,
          updatedAt: now,
        };
        setState((prev) => ({
          ...prev,
          inventory: prev.inventory.map((i) => (i.id === existing!.id ? updated : i)),
        }));
        return updated;
      }

      const item: InventoryItem = {
        id: partial.id ?? uuid(),
        name: partial.name,
        category: partial.category ?? "Uncategorized",
        barcode: partial.barcode?.trim() || undefined,
        quantity: partial.quantity ?? 0,
        weightPerUnitLbs: partial.weightPerUnitLbs ?? 0,
        valuePerUnitUsd: partial.valuePerUnitUsd ?? 0,
        reorderThreshold: partial.reorderThreshold,
        allergens: partial.allergens,
        createdAt: now,
        updatedAt: now,
      };

      setState((prev) => ({ ...prev, inventory: [...prev.inventory, item] }));
      return item;
    }

    function adjustItemQuantity(itemId: string, delta: number) {
      setState((prev) => {
        const inventory = prev.inventory.map((item) => {
          if (item.id !== itemId) return item;
          const quantity = Math.max(0, item.quantity + delta);
          return { ...item, quantity, updatedAt: new Date().toISOString() };
        });
        return { ...prev, inventory };
      });
    }

    function upsertClient(partial: Partial<ClientRecord> & { name: string; identifier: string }): ClientRecord {
      const now = new Date().toISOString();
      let existing =
        (partial.id && state.clients.find((c) => c.id === partial.id)) ||
        state.clients.find((c) => c.identifier === partial.identifier);

      if (existing) {
        const updated: ClientRecord = {
          ...existing,
          ...partial,
          updatedAt: now,
        };
        setState((prev) => ({
          ...prev,
          clients: prev.clients.map((c) => (c.id === existing!.id ? updated : c)),
        }));
        return updated;
      }

      const client: ClientRecord = {
        id: partial.id ?? uuid(),
        name: partial.name,
        identifier: partial.identifier,
        contact: partial.contact,
        allergies: partial.allergies,
        notes: partial.notes,
        createdAt: now,
        updatedAt: now,
      };
      setState((prev) => ({ ...prev, clients: [...prev.clients, client] }));
      return client;
    }

    function recordInbound(options: {
      itemId: string;
      quantity: number;
      source?: string;
      donor?: string;
      timestamp?: string;
      location?: GeoLocation;
    }) {
      const { itemId, quantity, source, donor, location } = options;
      const timestamp = options.timestamp ?? new Date().toISOString();

      if (!quantity || quantity <= 0) return;

      setState((prev) => {
        const item = prev.inventory.find((i) => i.id === itemId);
        if (!item) return prev;

        const inventory = prev.inventory.map((i) =>
          i.id === itemId
            ? { ...i, quantity: i.quantity + quantity, updatedAt: timestamp }
            : i,
        );

        const tx: Transaction = {
          id: uuid(),
          type: "IN",
          timestamp,
          items: [
            {
              itemId: item.id,
              name: item.name,
              quantity,
              weightPerUnitLbs: item.weightPerUnitLbs,
              valuePerUnitUsd: item.valuePerUnitUsd,
            },
          ],
          source,
          donor,
          location,
        };

        return {
          ...prev,
          inventory,
          transactions: [tx, ...prev.transactions],
        };
      });
    }

    function recordOutbound(options: {
      client: { id?: string; name: string; identifier: string; contact?: string };
      items: { itemId: string; quantity: number }[];
      timestamp?: string;
      location?: GeoLocation;
    }): { client: ClientRecord } | undefined {
      const timestamp = options.timestamp ?? new Date().toISOString();

      if (!options.items.length) return undefined;

      let createdClient: ClientRecord | undefined;

      setState((prev) => {
        const client = upsertClient({
          id: options.client.id,
          name: options.client.name,
          identifier: options.client.identifier,
          contact: options.client.contact,
        });
        createdClient = client;

        const inventory = prev.inventory.map((item) => {
          const cartItem = options.items.find((i) => i.itemId === item.id);
          if (!cartItem) return item;
          const newQty = Math.max(0, item.quantity - cartItem.quantity);
          return { ...item, quantity: newQty, updatedAt: timestamp };
        });

        const txItems: TransactionItem[] = options.items
          .map((i) => {
            const base = prev.inventory.find((item) => item.id === i.itemId);
            if (!base) return undefined;
            return {
              itemId: base.id,
              name: base.name,
              quantity: i.quantity,
              weightPerUnitLbs: base.weightPerUnitLbs,
              valuePerUnitUsd: base.valuePerUnitUsd,
            };
          })
          .filter(Boolean) as TransactionItem[];

        if (!txItems.length) return prev;

        const tx: Transaction = {
          id: uuid(),
          type: "OUT",
          timestamp,
          clientId: client.id,
          clientName: client.name,
          items: txItems,
          location: options.location,
        };

        return {
          ...prev,
          inventory,
          clients: prev.clients.some((c) => c.id === client.id)
            ? prev.clients.map((c) => (c.id === client.id ? client : c))
            : [client, ...prev.clients],
          transactions: [tx, ...prev.transactions],
        };
      });

      return createdClient ? { client: createdClient } : undefined;
    }

    function updateSettings(partial: Partial<Settings>) {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, ...partial } }));
    }

    function upsertBarcodeCache(barcode: string, entry: Omit<BarcodeCacheEntry, "cachedAt">) {
      const cachedAt = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        barcodeCache: {
          ...prev.barcodeCache,
          [barcode]: { ...entry, cachedAt },
        },
      }));
    }

    function addSource(source: string) {
      setState((prev) => {
        if (prev.sources?.includes(source)) return prev;
        return { ...prev, sources: [...(prev.sources || []), source] };
      });
    }

    function addDonor(donor: string) {
      setState((prev) => {
        if (prev.donors?.includes(donor)) return prev;
        return { ...prev, donors: [...(prev.donors || []), donor] };
      });
    }

    return {
      ...state,
      addOrUpdateItem,
      adjustItemQuantity,
      recordInbound,
      recordOutbound,
      upsertClient,
      updateSettings,
      upsertBarcodeCache,
      addSource,
      addDonor,
    };
  }, [state]);

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

export function useRepository() {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error("useRepository must be used inside RepositoryProvider");
  return ctx;
}

export function useClientWithHistory(clientId: string | undefined) {
  const { clients, transactions } = useRepository();
  if (!clientId) return { client: undefined, visits: [] as Transaction[] };
  const client = clients.find((c) => c.id === clientId);
  const visits = transactions.filter((t) => t.type === "OUT" && t.clientId === clientId);
  return { client, visits };
}

export function useInventorySummary() {
  const { inventory } = useRepository();
  const distinctItems = inventory.length;
  const totalUnits = inventory.reduce((sum, i) => sum + i.quantity, 0);
  const totalWeightLbs = inventory.reduce((sum, i) => sum + i.quantity * i.weightPerUnitLbs, 0);
  return { distinctItems, totalUnits, totalWeightLbs };
}

export function isLowStock(item: InventoryItem): boolean {
  if (item.reorderThreshold == null) return false;
  return item.quantity <= item.reorderThreshold;
}

export async function getCurrentLocation(): Promise<GeoLocation | undefined> {
  if (!navigator.geolocation) return undefined;
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        enableHighAccuracy: true,
      });
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  } catch {
    return undefined;
  }
}
