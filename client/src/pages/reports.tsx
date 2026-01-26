import React, { useMemo, useState } from "react";
import { useRepository } from "@/lib/repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ReportsPage() {
  const repo = useRepository();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rangeTx = useMemo(() => {
    return repo.transactions.filter((tx) => {
      const dateOnly = tx.timestamp.slice(0, 10);
      if (from && dateOnly < from) return false;
      if (to && dateOnly > to) return false;
      return tx.type === "OUT";
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
    const rows: string[] = [];
    rows.push("type,timestamp,client,clientIdentifier,itemName,quantity,weightPerUnitLbs,valuePerUnitUsd");
    for (const tx of repo.transactions) {
      for (const item of tx.items) {
        const client = tx.clientName ?? "";
        const clientRecord = tx.clientId ? repo.clients.find((c) => c.id === tx.clientId) : undefined;
        const identifier = clientRecord?.identifier ?? "";
        rows.push(
          [
            tx.type,
            tx.timestamp,
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
    a.download = "morgan-state-repository-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        window.localStorage.setItem("morgan-state-repository:v1", JSON.stringify(parsed));
        window.location.reload();
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
