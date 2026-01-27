import React, { useMemo, useState, useRef } from "react";
import { useRepository, getCurrentLocation } from "@/lib/repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Import, SearchIcon } from "lucide-react";

export default function CheckInPage() {
  const { inventory, addOrUpdateItem, recordInbound, barcodeCache, upsertBarcodeCache } = useRepository();
  const { toast } = useToast();

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedId, setSelectedId] = useState<string | "">("");
  const [quantity, setQuantity] = useState<number>(0);
  const [source, setSource] = useState("");
  const [newItem, setNewItem] = useState({
    name: "",
    category: "Uncategorized",
    barcode: "",
    weightPerUnitLbs: 0,
    valuePerUnitUsd: 0,
  });
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const sortedInventory = useMemo(
    () => [...inventory].sort((a, b) => a.name.localeCompare(b.name)),
    [inventory],
  );

  async function handleBarcodeLookup(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;

    // 1. Global Lookup (Open Food Facts)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${trimmed}.json`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 1) {
          const p = data.product;
          const name = p.product_name || p.generic_name || "";
          const category = (Array.isArray(p.categories_tags) && p.categories_tags[0]?.split(":").pop()) || "Uncategorized";
          const grams = p.product_quantity && p.product_quantity_unit === "g" ? Number(p.product_quantity) : undefined;
          const weight = grams && !isNaN(grams) ? grams / 453.592 : 0;

          upsertBarcodeCache(trimmed, { name, category, weightPerUnitLbs: weight });

          // If in 'new' mode, prefill
          if (mode === "new") {
            setNewItem(prev => ({
              ...prev,
              name: name || prev.name,
              category: category || prev.category,
              barcode: trimmed,
              weightPerUnitLbs: weight || prev.weightPerUnitLbs
            }));
            toast({ title: "Product found", description: "Details prefilled from global database." });
            return; // Done
          }
        }
      }
    } catch (e) {
      // Ignore network errors, fall through
    }

    // 2. Local Inventory Fallback
    const existing = inventory.find((i) => i.barcode === trimmed);
    if (existing) {
      setMode("existing");
      setSelectedId(existing.id);
      toast({ title: "Item found", description: `Selected ${existing.name} from inventory.` });
      quantityInputRef.current?.focus();
      return;
    }

    // 3. Local Cache Fallback
    const cached = barcodeCache[trimmed];
    if (cached) {
      setMode("new");
      setNewItem({
        name: cached.name || "",
        category: cached.category || "Uncategorized",
        barcode: trimmed,
        weightPerUnitLbs: cached.weightPerUnitLbs || 0,
        valuePerUnitUsd: 0,
      });
      toast({ title: "Item found in cache", description: "Details prefilled from local cache." });
      return;
    }

    // 4. Not found anywhere
    setMode("new");
    setNewItem(prev => ({ ...prev, barcode: trimmed }));
    toast({ title: "New item", description: "Barcode not found. Please enter details." });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quantity || quantity <= 0) {
      toast({
        title: "Quantity required",
        description: "Enter a quantity greater than zero to record this check-in.",
      });
      return;
    }

    let itemId = selectedId;

    if (mode === "new") {
      if (!newItem.name.trim()) {
        toast({
          title: "Item name required",
          description: "Enter a name for the new item before recording stock.",
        });
        return;
      }
      const created = addOrUpdateItem({
        name: newItem.name.trim(),
        category: newItem.category.trim() || "Uncategorized",
        barcode: newItem.barcode?.trim() || undefined,
        quantity: 0,
        weightPerUnitLbs: newItem.weightPerUnitLbs,
        valuePerUnitUsd: newItem.valuePerUnitUsd,
      });
      itemId = created.id;
    }

    if (!itemId) return;

    const location = await getCurrentLocation();

    recordInbound({
      itemId,
      quantity,
      source: source.trim() || undefined,
      location,
    });

    toast({
      title: "Stock received",
      description: `Recorded ${quantity} units received${location ? " with location" : ""}.`,
    });

    setQuantity(0);
    setSource("");
    // Don't reset selectedId or new item details aggressively so they can add more batches if needed,
    // but typically reset quantity is enough.
    // If it was new, switch to existing for that item?
    if (mode === "new") {
      setMode("existing");
      setSelectedId(itemId);
      setNewItem({
        name: "",
        category: "Uncategorized",
        barcode: "",
        weightPerUnitLbs: 0,
        valuePerUnitUsd: 0,
      });
    }
  }

  return (
    <Card className="glass-panel max-w-2xl" data-testid="card-check-in">
      <CardHeader>
        <CardTitle className="section-heading flex items-center gap-2">
          <Import className="h-4 w-4 text-[hsl(221_63%_30%)]" />
          Record received stock
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
           <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Scan barcode to find or add..."
              className="pl-8"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleBarcodeLookup(e.currentTarget.value);
                  e.currentTarget.value = "";
                }
              }}
              autoFocus
              data-testid="input-checkin-barcode-scan"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 ml-1">
            USB Scanner: Focus this field and scan. Enter key triggers lookup.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4 border-dashed">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "existing" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("existing")}
              data-testid="button-mode-existing-item"
            >
              Existing item
            </Button>
            <Button
              type="button"
              variant={mode === "new" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("new")}
              data-testid="button-mode-new-item"
            >
              New item on the fly
            </Button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="select-item" data-testid="label-existing-item">
                Item
              </label>
              <Select
                value={selectedId}
                onValueChange={(val) => setSelectedId(val)}
              >
                <SelectTrigger id="select-item" data-testid="select-existing-item">
                  <SelectValue placeholder="Select an item" />
                </SelectTrigger>
                <SelectContent>
                  {sortedInventory.map((item) => (
                    <SelectItem key={item.id} value={item.id} data-testid={`option-existing-item-${item.id}`}>
                      {item.name} • {item.quantity} on hand
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="new-name" data-testid="label-new-item-name">
                  Item name
                </label>
                <Input
                  id="new-name"
                  value={newItem.name}
                  onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
                  data-testid="input-new-item-name"
                  required
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="new-category" data-testid="label-new-item-category">
                    Category
                  </label>
                  <Input
                    id="new-category"
                    value={newItem.category}
                    onChange={(e) => setNewItem((p) => ({ ...p, category: e.target.value }))}
                    data-testid="input-new-item-category"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="new-barcode" data-testid="label-new-item-barcode">
                    Barcode / UPC (optional)
                  </label>
                  <Input
                    id="new-barcode"
                    value={newItem.barcode}
                    onChange={(e) => setNewItem((p) => ({ ...p, barcode: e.target.value }))}
                    data-testid="input-new-item-barcode"
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="new-weight" data-testid="label-new-item-weight">
                    Weight per unit (lbs)
                  </label>
                  <Input
                    id="new-weight"
                    type="number"
                    min={0}
                    step="0.01"
                    value={newItem.weightPerUnitLbs}
                    onChange={(e) =>
                      setNewItem((p) => ({ ...p, weightPerUnitLbs: Number(e.target.value) || 0 }))
                    }
                    data-testid="input-new-item-weight"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="new-value" data-testid="label-new-item-value">
                    Value per unit ($)
                  </label>
                  <Input
                    id="new-value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={newItem.valuePerUnitUsd}
                    onChange={(e) =>
                      setNewItem((p) => ({ ...p, valuePerUnitUsd: Number(e.target.value) || 0 }))
                    }
                    data-testid="input-new-item-value"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="quantity" data-testid="label-quantity-received">
                Quantity received
              </label>
              <Input
                id="quantity"
                ref={quantityInputRef}
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                data-testid="input-quantity-received"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium" htmlFor="source" data-testid="label-source-donor">
                Source / donor (optional)
              </label>
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                data-testid="input-source-donor"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-muted-foreground" data-testid="text-check-in-help">
              This will increase on-hand quantity and log an IN transaction in Activity.
            </p>
            <Button type="submit" data-testid="button-save-check-in">
              Record check-in
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
