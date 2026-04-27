import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRepository } from "@/lib/repository";
import { apiRequest } from "@/lib/queryClient";
import { toApiInventoryBody, toApiClientBody } from "@/lib/api-types";
import type { InventoryItem, ClientRecord, Transaction } from "@/lib/repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function ReportsPage() {
  const repo = useRepository();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rangeTx = useMemo(() => {
    return repo.transactions.filter((tx) => {
      if (tx.type !== "OUT") return false;
      // Use local date for filtering so it matches the date picker values
      const d = new Date(tx.timestamp);
      const dateOnly = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (from && dateOnly < from) return false;
      if (to && dateOnly > to) return false;
      return true;
    });
  }, [repo.transactions, from, to]);

  const byItem = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number }>();
    for (const tx of rangeTx) {
      for (const item of tx.items) {
        const current = map.get(item.itemId) || { name: item.name, quantity: 0 };
        current.quantity += item.quantity;
        map.set(item.itemId, current);
      }
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [rangeTx]);

  const byClient = useMemo(() => {
    const map = new Map<string, { name: string; visits: number; units: number }>();
    for (const tx of rangeTx) {
      const id = tx.clientId || tx.clientName || "unknown";
      const name = tx.clientName || "Unknown";
      const units = tx.items.reduce((sum, i) => sum + i.quantity, 0);
      const current = map.get(id) || { name, visits: 0, units: 0 };
      current.visits += 1;
      current.units += units;
      map.set(id, current);
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [rangeTx]);

  const totals = useMemo(() => {
    let totalWeight = 0;
    let totalValue = 0;
    for (const tx of rangeTx) {
      for (const item of tx.items) {
        totalWeight += item.weightPerUnitLbs * item.quantity;
        totalValue += item.valuePerUnitUsd * item.quantity;
      }
    }
    return { totalWeight, totalValue };
  }, [rangeTx]);

  function exportJson() {
    const payload = JSON.stringify(repo, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "morgan-state-repository-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    try {
      const rows: string[] = [];
      rows.push("type,timestamp,latitude,longitude,accuracy,client,clientIdentifier,itemName,quantity,weightPerUnitLbs,valuePerUnitUsd");
      for (const tx of repo.transactions) {
        const lat = tx.location?.latitude ?? "";
        const long = tx.location?.longitude ?? "";
        const acc = tx.location?.accuracy ?? "";

        for (const item of tx.items) {
          // Prefer stored clientName first (survives client deletion), fall back to lookup
          const clientRecord = tx.clientId ? repo.clients.find((c) => c.id === tx.clientId) : undefined;
          const client = tx.clientName ?? clientRecord?.name ?? "";
          const identifier = clientRecord?.identifier ?? "";
          rows.push(
            [
              tx.type,
              tx.timestamp,
              lat,
              long,
              acc,
              escapeCsv(client),
              escapeCsv(identifier),
              escapeCsv(item.name),
              item.quantity.toString(),
              item.weightPerUnitLbs.toString(),
              item.valuePerUnitUsd.toString(),
            ].join(","),
          );
        }
      }
      const blob = new Blob([rows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `frc-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export complete", description: `Exported ${rows.length - 1} transaction rows.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "CSV export failed";
      toast({ title: "Export failed", description: message, variant: "destructive" });
    }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));

        // Import inventory items
        const idMap = new Map<string, string>();
        if (Array.isArray(parsed.inventory)) {
          for (const item of parsed.inventory as InventoryItem[]) {
            const res = await apiRequest("POST", "/api/inventory", toApiInventoryBody(item));
            const created = await res.json();
            idMap.set(item.id, created.id);
          }
        }

        // Import clients
        const clientIdMap = new Map<string, string>();
        if (Array.isArray(parsed.clients)) {
          for (const client of parsed.clients as ClientRecord[]) {
            const res = await apiRequest("POST", "/api/clients", toApiClientBody(client));
            const created = await res.json();
            clientIdMap.set(client.id, created.id);
          }
        }

        // Import transactions
        if (Array.isArray(parsed.transactions)) {
          for (const tx of parsed.transactions as Transaction[]) {
            await apiRequest("POST", "/api/transactions", {
              type: tx.type,
              timestamp: tx.timestamp,
              source: tx.source ?? null,
              donor: tx.donor ?? null,
              clientId: (tx.clientId && clientIdMap.get(tx.clientId)) ?? tx.clientId ?? null,
              clientName: tx.clientName ?? null,
              latitude: tx.location?.latitude ?? null,
              longitude: tx.location?.longitude ?? null,
              accuracy: tx.location?.accuracy ?? null,
              items: tx.items.map((ti) => ({
                inventoryItemId: idMap.get(ti.itemId) ?? ti.itemId,
                name: ti.name,
                quantity: ti.quantity,
                weightPerUnitLbs: String(ti.weightPerUnitLbs),
                valuePerUnitUsd: String(ti.valuePerUnitUsd),
              })),
            });
          }
        }

        qc.invalidateQueries({ queryKey: ["/api/inventory"] });
        qc.invalidateQueries({ queryKey: ["/api/clients"] });
        qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      } catch {
        alert("Could not import data. Ensure the JSON file is a valid export.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-4">
      <Card className="glass-panel" data-testid="card-report-filters">
        <CardContent className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-end">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="from" data-testid="label-report-from">
              From date
            </label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              data-testid="input-report-from"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="to" data-testid="label-report-to">
              To date
            </label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              data-testid="input-report-to"
            />
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <Button type="button" variant="outline" onClick={exportJson} data-testid="button-export-json">
              Export JSON
            </Button>
            <Button type="button" variant="outline" onClick={exportCsv} data-testid="button-export-csv">
              Export CSV
            </Button>
          </div>
          <div className="flex flex-col gap-1 md:items-end">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="import-json"
              data-testid="label-import-json"
            >
              Import JSON backup
            </label>
            <Input id="import-json" type="file" accept="application/json" onChange={handleImport} data-testid="input-import-json" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-panel" data-testid="card-report-inventory-summary">
          <CardHeader className="py-3 px-4 border-b border-border/80">
            <CardTitle className="section-heading">Inventory summary (current)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm py-4 px-4">
            <div data-testid="text-report-items-count">Distinct items: {repo.inventory.length}</div>
            <div data-testid="text-report-total-units">
              Total units on hand: {repo.inventory.reduce((sum, i) => sum + i.quantity, 0)}
            </div>
            <div data-testid="text-report-total-weight">
              Total weight on hand: {repo.inventory
                .reduce((sum, i) => sum + i.quantity * i.weightPerUnitLbs, 0)
                .toFixed(1)}{" "}
              lbs
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel" data-testid="card-report-totals-range">
          <CardHeader className="py-3 px-4 border-b border-border/80">
            <CardTitle className="section-heading">Distributed totals (range)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm py-4 px-4">
            <div data-testid="text-report-range-tx-count">OUT transactions: {rangeTx.length}</div>
            <div data-testid="text-report-range-weight">
              Total weight distributed: {totals.totalWeight.toFixed(1)} lbs
            </div>
            <div data-testid="text-report-range-value">
              Estimated value distributed: ${totals.totalValue.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel" data-testid="card-report-by-item">
        <CardHeader className="py-3 px-4 border-b border-border/80">
          <CardTitle className="section-heading">Distribution by item</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Total units</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byItem.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="py-6 text-center text-sm text-muted-foreground"
                    data-testid="text-report-no-item"
                  >
                    No OUT transactions for this range.
                  </TableCell>
                </TableRow>
              )}
              {byItem.map((row) => (
                <TableRow key={row.id} data-testid={`row-report-item-${row.id}`}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right text-sm">{row.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="glass-panel" data-testid="card-report-by-client">
        <CardHeader className="py-3 px-4 border-b border-border/80">
          <CardTitle className="section-heading">Distribution by client</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Total units</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byClient.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-6 text-center text-sm text-muted-foreground"
                    data-testid="text-report-no-client"
                  >
                    No client visits for this range.
                  </TableCell>
                </TableRow>
              )}
              {byClient.map((row) => (
                <TableRow key={row.id} data-testid={`row-report-client-${row.id}`}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right text-sm">{row.visits}</TableCell>
                  <TableCell className="text-right text-sm">{row.units}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\"")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
