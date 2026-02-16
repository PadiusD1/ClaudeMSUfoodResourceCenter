import React, { useMemo, useState } from "react";
import { useRepository, InventoryItem, isLowStock, getCurrentLocation } from "@/lib/repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { PencilIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";

export default function InventoryPage() {
  const { inventory, addOrUpdateItem, adjustItemQuantity, recordInbound, upsertBarcodeCache, barcodeCache, sources, donors, addSource, addDonor } = useRepository();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(inventory.map((i) => i.category || "Uncategorized"))).sort(),
    [inventory],
  );

  const filtered = useMemo(
    () =>
      inventory.filter((item) => {
        const matchesCategory =
          categoryFilter === "all" || (item.category || "Uncategorized") === categoryFilter;
        const q = query.trim().toLowerCase();
        const matchesQuery =
          !q ||
          item.name.toLowerCase().includes(q) ||
          (item.category || "Uncategorized").toLowerCase().includes(q) ||
          (item.barcode && item.barcode.includes(q));
        return matchesCategory && matchesQuery;
      }),
    [inventory, query, categoryFilter],
  );

  async function handleSave(form: Partial<InventoryItem> & { name: string; initialQuantity?: number; source?: string; donor?: string }) {
    const item = addOrUpdateItem(form);
    
    // If it's a new item (implied if we pass initialQuantity > 0)
    if (form.initialQuantity && form.initialQuantity > 0) {
      if (form.source) addSource(form.source);
      if (form.donor && form.source === "Donation") addDonor(form.donor);

      const location = await getCurrentLocation();
      recordInbound({
        itemId: item.id,
        quantity: form.initialQuantity,
        source: form.source,
        donor: form.donor,
        location
      });
      toast({
        title: "Inventory added",
        description: `Created ${item.name} and recorded ${form.initialQuantity} received${location ? " with location" : ""}.`,
      });
    } else {
      toast({
        title: "Inventory updated",
        description: `Saved ${item.name}.`,
      });
    }
    setEditingItem(null);
  }

  return (
    <div className="space-y-4">
      <Card className="glass-panel" data-testid="card-inventory-filters">
        <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <SearchIcon className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name, category, or barcode"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
                data-testid="input-inventory-search"
              />
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(val) => setCategoryFilter(val as any)}
            >
              <SelectTrigger className="w-44" data-testid="select-category-filter">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-category-all">
                  All categories
                </SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c} data-testid={`option-category-${c}`}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="shrink-0"
                onClick={() => setEditingItem({
                  id: "",
                  name: "",
                  category: "Uncategorized",
                  barcode: "",
                  quantity: 0,
                  weightPerUnitLbs: 0,
                  valuePerUnitUsd: 0,
                  allergens: [],
                  createdAt: "",
                  updatedAt: "",
                })}
                data-testid="button-add-item"
              >
                <PlusIcon className="h-4 w-4" />
                New item
              </Button>
            </DialogTrigger>
            {editingItem && (
              <InventoryEditDialog
                item={editingItem}
                onCancel={() => setEditingItem(null)}
                onSave={handleSave}
                upsertBarcodeCache={upsertBarcodeCache}
                barcodeCache={barcodeCache}
                sources={sources}
                donors={donors}
              />
            )}
          </Dialog>
        </CardContent>
      </Card>

      <Card className="glass-panel" data-testid="card-inventory-table">
        <CardHeader className="py-3 px-4 border-b border-border/80">
          <CardTitle className="section-heading flex items-center justify-between">
            <span>Inventory items</span>
            <span className="pill-muted" data-testid="text-inventory-count">
              {filtered.length} of {inventory.length} items
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Weight / Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-sm text-muted-foreground"
                    data-testid="text-no-inventory"
                  >
                    No items yet. Use "New item" or Check-In to add inventory.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((item) => (
                <TableRow
                  key={item.id}
                  className={isLowStock(item) ? "low-stock-row" : undefined}
                  data-testid={`row-item-${item.id}`}
                >
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium" data-testid={`text-item-name-${item.id}`}>
                        {item.name}
                      </span>
                      {isLowStock(item) && (
                        <span className="text-[11px] text-amber-700" data-testid={`status-low-stock-${item.id}`}>
                          Low stock: at or below reorder threshold
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground" data-testid={`text-item-category-${item.id}`}>
                    {item.category || "Uncategorized"}
                  </TableCell>
                  <TableCell className="text-xs" data-testid={`text-item-barcode-${item.id}`}>
                    {item.barcode || <span className="text-muted-foreground">None</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold" data-testid={`text-item-quantity-${item.id}`}>
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground" data-testid={`text-item-weight-value-${item.id}`}>
                    {item.weightPerUnitLbs ? `${item.weightPerUnitLbs.toFixed(2)} lbs` : "-"} •
                    {" "}
                    {item.valuePerUnitUsd ? `$${item.valuePerUnitUsd.toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => adjustItemQuantity(item.id, -1)}
                        data-testid={`button-decrement-${item.id}`}
                      >
                        -1
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => adjustItemQuantity(item.id, 1)}
                        data-testid={`button-increment-${item.id}`}
                      >
                        +1
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setEditingItem(item)}
                        data-testid={`button-edit-item-${item.id}`}
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryEditDialog({
  item,
  onCancel,
  onSave,
  upsertBarcodeCache,
  barcodeCache,
  sources,
  donors
}: {
  item: InventoryItem;
  onCancel: () => void;
  onSave: (item: Partial<InventoryItem> & { name: string; initialQuantity?: number; source?: string; donor?: string }) => void;
  upsertBarcodeCache: any;
  barcodeCache: any;
  sources: string[];
  donors: string[];
}) {
  const isNew = !item.id;
  const [form, setForm] = useState({
    id: item.id || undefined,
    name: item.name || "",
    category: item.category || "Uncategorized",
    barcode: item.barcode || "",
    quantity: item.quantity,
    weightPerUnitLbs: item.weightPerUnitLbs,
    valuePerUnitUsd: item.valuePerUnitUsd,
    reorderThreshold: item.reorderThreshold ?? undefined,
    allergens: item.allergens || [] as string[],
    // extra fields for new item check-in
    initialQuantity: 0,
    source: "",
    donor: ""
  });
  const [isNewSource, setIsNewSource] = useState(false);
  const [isNewDonor, setIsNewDonor] = useState(false);
  const { toast } = useToast();

  async function handleBarcodeLookup(code: string) {
    if (!code) return;
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 1) {
          const p = data.product;
          const name = p.product_name || p.generic_name || "";
          const category = (Array.isArray(p.categories_tags) && p.categories_tags[0]?.split(":").pop()) || "Uncategorized";
          const grams = p.product_quantity && p.product_quantity_unit === "g" ? Number(p.product_quantity) : undefined;
          const weight = grams && !isNaN(grams) ? grams / 453.592 : 0;
          const allergens = (p.allergens_tags || []).map((a: string) => a.split(":").pop()?.replace(/-/g, " ") || a);

          setForm(prev => ({
            ...prev,
            name: name || prev.name,
            category: category || prev.category,
            weightPerUnitLbs: weight || prev.weightPerUnitLbs,
            allergens: allergens.length ? allergens : prev.allergens
          }));
          upsertBarcodeCache(code, { name, category, weightPerUnitLbs: weight, allergens });
          toast({ title: "Product found", description: "Prefilled details from global database." });
          return;
        }
      }
    } catch {}

    const cached = barcodeCache[code];
    if (cached) {
      setForm(prev => ({
        ...prev,
        name: cached.name || prev.name,
        category: cached.category || prev.category,
        weightPerUnitLbs: cached.weightPerUnitLbs || prev.weightPerUnitLbs,
        allergens: cached.allergens || prev.allergens
      }));
      toast({ title: "Cache found", description: "Prefilled details from local cache." });
    }
  }

  function handleChange<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      ...form,
      name: form.name.trim(),
      category: form.category.trim() || "Uncategorized",
      barcode: form.barcode?.trim() || undefined,
      source: form.source.trim() || undefined,
      donor: form.donor.trim() || undefined,
    });
  }

  return (
    <DialogContent className="max-w-lg" data-testid="dialog-edit-item">
      <DialogHeader>
        <DialogTitle data-testid="text-edit-item-heading">
          {item.id ? "Edit item" : "Add new item"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="item-barcode" data-testid="label-item-barcode">
            Barcode / UPC (optional)
          </label>
          <div className="flex gap-2">
            <Input
              id="item-barcode"
              value={form.barcode}
              onChange={(e) => handleChange("barcode", e.target.value)}
              onBlur={(e) => isNew && handleBarcodeLookup(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isNew) {
                  e.preventDefault();
                  handleBarcodeLookup(form.barcode);
                }
              }}
              placeholder={isNew ? "Scan to prefill..." : ""}
              autoFocus={isNew}
              data-testid="input-item-barcode"
            />
          </div>
          {isNew && <p className="text-[10px] text-muted-foreground">Scan or type and press Enter to lookup.</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="item-name" data-testid="label-item-name">
            Item name
          </label>
          <Input
            id="item-name"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            required
            data-testid="input-item-name"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="item-category" data-testid="label-item-category">
            Category
          </label>
          <Input
            id="item-category"
            value={form.category}
            onChange={(e) => handleChange("category", e.target.value)}
            data-testid="input-item-category"
          />
        </div>
        
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="item-weight" data-testid="label-item-weight">
              Weight per unit (lbs)
            </label>
            <Input
              id="item-weight"
              type="number"
              min={0}
              step="0.01"
              value={form.weightPerUnitLbs}
              onChange={(e) => handleChange("weightPerUnitLbs", Number(e.target.value) || 0)}
              data-testid="input-item-weight"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="item-value" data-testid="label-item-value">
              Value per unit ($)
            </label>
            <Input
              id="item-value"
              type="number"
              min={0}
              step="0.01"
              value={form.valuePerUnitUsd}
              onChange={(e) => handleChange("valuePerUnitUsd", Number(e.target.value) || 0)}
              data-testid="input-item-value"
            />
          </div>
        </div>

        <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="item-allergens">
              Allergens
            </label>
            <div className="flex flex-wrap gap-2 mb-2 p-2 border rounded-md min-h-[40px]">
              {form.allergens.map((allergen, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {allergen}
                  <button
                    type="button"
                    onClick={() => setForm(p => ({...p, allergens: p.allergens.filter((_, i) => i !== idx)}))}
                    className="hover:text-destructive"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Input
                type="text"
                className="border-none shadow-none focus-visible:ring-0 h-6 p-0 w-32 min-w-[80px]"
                placeholder="Add allergen..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (val && !form.allergens.includes(val)) {
                      setForm(p => ({...p, allergens: [...p.allergens, val]}));
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Type allergen and press Enter to add. Auto-filled from scan if found.</p>
        </div>

        {isNew ? (
          // For new items, allow setting initial quantity and source
          <div className="grid gap-3 pt-2 border-t border-dashed">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="initial-quantity">
                Initial Quantity
              </label>
              <Input
                id="initial-quantity"
                type="number"
                min={0}
                value={form.initialQuantity}
                onChange={(e) => handleChange("initialQuantity", Number(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="source">
                Source
              </label>
              <div className="flex gap-2">
                {!isNewSource ? (
                    <Select value={form.source} onValueChange={(val) => {
                        if (val === "new_source_custom") {
                            setIsNewSource(true);
                            setForm(p => ({...p, source: ""}));
                        } else {
                            setForm(p => ({...p, source: val}));
                        }
                    }}>
                        <SelectTrigger id="source">
                            <SelectValue placeholder="Select Source" />
                        </SelectTrigger>
                        <SelectContent>
                            {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            <SelectItem value="new_source_custom">+ Add New Source</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="flex gap-1 w-full">
                        <Input 
                            value={form.source} 
                            onChange={(e) => setForm(p => ({...p, source: e.target.value}))} 
                            placeholder="Enter new source"
                            autoFocus
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setIsNewSource(false)}>
                            <span className="sr-only">Cancel</span>
                            <XIcon className="h-4 w-4" />
                        </Button>
                    </div>
                )}
              </div>
            </div>
            
            {form.source === "Donation" && (
                <div className="space-y-1.5 border-l-2 border-indigo-100 pl-4 mt-2">
                     <div className="relative">
                        <div className="absolute -left-[21px] top-[14px] w-4 h-px bg-indigo-200"></div>
                        <label className="text-sm font-medium" htmlFor="donor">
                            Donor
                        </label>
                      </div>
                      <div className="flex gap-2">
                        {!isNewDonor ? (
                            <Select value={form.donor} onValueChange={(val) => {
                                if (val === "new_donor_custom") {
                                    setIsNewDonor(true);
                                    setForm(p => ({...p, donor: ""}));
                                } else {
                                    setForm(p => ({...p, donor: val}));
                                }
                            }}>
                                <SelectTrigger id="donor">
                                    <SelectValue placeholder="Select Donor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {donors.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    <SelectItem value="new_donor_custom">+ Add New Donor</SelectItem>
                                </SelectContent>
                            </Select>
                        ) : (
                            <div className="flex gap-1 w-full">
                                <Input 
                                    value={form.donor} 
                                    onChange={(e) => setForm(p => ({...p, donor: e.target.value}))} 
                                    placeholder="Enter new donor"
                                    autoFocus
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => setIsNewDonor(false)}>
                                    <span className="sr-only">Cancel</span>
                                    <XIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                      </div>
                </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="item-quantity" data-testid="label-item-quantity">
              Quantity on hand
            </label>
            <Input
              id="item-quantity"
              type="number"
              min={0}
              value={form.quantity}
              onChange={(e) => handleChange("quantity", Number(e.target.value) || 0)}
              data-testid="input-item-quantity"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="item-reorder" data-testid="label-item-reorder">
            Reorder threshold (optional)
          </label>
          <Input
            id="item-reorder"
            type="number"
            min={0}
            value={form.reorderThreshold ?? ""}
            onChange={(e) =>
              handleChange(
                "reorderThreshold",
                e.target.value === "" ? undefined : Number(e.target.value) || 0,
              )
            }
            data-testid="input-item-reorder"
          />
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            data-testid="button-cancel-edit-item"
          >
            Cancel
          </Button>
          <Button type="submit" data-testid="button-save-item">
            {isNew ? "Create Item" : "Save Changes"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
