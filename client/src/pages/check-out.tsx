import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRepository } from "@/lib/repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { CameraIcon, ShoppingCartIcon } from "lucide-react";

export default function CheckOutPage() {
  const { inventory, clients, recordOutbound, barcodeCache, upsertBarcodeCache, addOrUpdateItem } =
    useRepository();
  const { toast } = useToast();

  const [clientId, setClientId] = useState<string | "new" | "">("");
  const [clientName, setClientName] = useState("");
  const [clientIdentifier, setClientIdentifier] = useState("");
  const [clientContact, setClientContact] = useState("");

  const [cart, setCart] = useState<{ itemId: string; quantity: number }[]>([]);
  const [barcode, setBarcode] = useState("");

  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients],
  );

  const sortedInventory = useMemo(
    () => [...inventory].sort((a, b) => a.name.localeCompare(b.name)),
    [inventory],
  );

  useEffect(() => {
    if (!cameraOpen) {
      if (readerRef.current) {
        (readerRef.current as any).reset?.();
        readerRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
      return;
    }

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
        if (result) {
          const text = result.getText();
          handleBarcodeScanned(text);
        }
      })
      .catch(() => {
        // ignore camera errors for now
      });

    return () => {
      (reader as any).reset?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  function setClientFromId(id: string) {
    setClientId(id);
    if (!id || id === "new") {
      setClientName("");
      setClientIdentifier("");
      setClientContact("");
      return;
    }
    const c = clients.find((c) => c.id === id);
    if (c) {
      setClientName(c.name);
      setClientIdentifier(c.identifier);
      setClientContact(c.contact || "");
    }
  }

  function addToCart(itemId: string, quantity: number = 1) {
    if (!itemId) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === itemId);
      if (existing) {
        return prev.map((c) =>
          c.itemId === itemId ? { ...c, quantity: c.quantity + quantity } : c,
        );
      }
      return [...prev, { itemId, quantity }];
    });
  }

  function handleBarcodeScanned(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;

    const existing = inventory.find((i) => i.barcode === trimmed);
    if (existing) {
      addToCart(existing.id, 1);
      toast({ title: "Item added", description: `${existing.name} added via barcode.` });
      return;
    }

    const cached = barcodeCache[trimmed];
    if (cached && cached.name) {
      const item = addOrUpdateItem({
        name: cached.name,
        category: cached.category ?? "Uncategorized",
        barcode: trimmed,
        quantity: 0,
        weightPerUnitLbs: cached.weightPerUnitLbs ?? 0,
      });
      addToCart(item.id, 1);
      toast({ title: "New item from cache", description: `${item.name} added via cached barcode.` });
      return;
    }

    fetchFromOpenFoodFacts(trimmed)
      .then((entry) => {
        if (!entry.name) {
          toast({
            title: "Barcode not found",
            description: "No product info was returned. You can create the item manually.",
          });
          return;
        }
        upsertBarcodeCache(trimmed, entry);
        const item = addOrUpdateItem({
          name: entry.name,
          category: entry.category ?? "Uncategorized",
          barcode: trimmed,
          quantity: 0,
          weightPerUnitLbs: entry.weightPerUnitLbs ?? 0,
        });
        addToCart(item.id, 1);
        toast({ title: "New item from Open Food Facts", description: `${item.name} added via scan.` });
      })
      .catch(() => {
        toast({
          title: "Barcode lookup failed",
          description: "We could not reach Open Food Facts. Add the item manually instead.",
        });
      });
  }

  async function fetchFromOpenFoodFacts(barcode: string) {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    if (!res.ok) throw new Error("network");
    const data = await res.json();
    if (data.status !== 1) return {} as any;
    const p = data.product;
    const name: string | undefined = p.product_name || p.generic_name || undefined;
    const category: string | undefined =
      (Array.isArray(p.categories_tags) && p.categories_tags[0]?.split(":").pop()) || undefined;
    const weightPerUnitLbs: number | undefined = (() => {
      const grams = p.product_quantity && p.product_quantity_unit === "g" ? Number(p.product_quantity) : undefined;
      if (!grams || isNaN(grams)) return undefined;
      return grams / 453.592;
    })();
    return { name, category, weightPerUnitLbs };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cart.length) {
      toast({
        title: "No items in cart",
        description: "Add at least one item before completing check-out.",
      });
      return;
    }

    const clientNameFinal = clientName.trim();
    const identifierFinal = clientIdentifier.trim() || clientNameFinal || "Unknown";
    if (!clientNameFinal) {
      toast({
        title: "Missing client name",
        description: "Enter the client's name before recording this check-out.",
      });
      return;
    }

    // Validate stock
    for (const line of cart) {
      const item = inventory.find((i) => i.id === line.itemId);
      if (!item) continue;
      if (line.quantity > item.quantity) {
        toast({
          title: "Insufficient stock",
          description: `Cannot check out ${line.quantity} of ${item.name}; only ${item.quantity} available.`,
        });
        return;
      }
    }

    const result = recordOutbound({
      client: {
        id: clientId && clientId !== "new" ? clientId : undefined,
        name: clientNameFinal,
        identifier: identifierFinal,
        contact: clientContact.trim() || undefined,
      },
      items: cart,
    });

    if (result?.client) {
      toast({
        title: "Check-out recorded",
        description: `Distribution recorded for ${result.client.name}.`,
      });
      setCart([]);
      setClientFromId(result.client.id);
    }
  }

  const totalUnits = cart.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <Card className="glass-panel" data-testid="card-check-out">
      <CardHeader>
        <CardTitle className="section-heading flex items-center gap-2">
          <ShoppingCartIcon className="h-4 w-4 text-[hsl(22_92%_60%)]" />
          Build distribution cart
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="client-select" data-testid="label-client">
                  Client
                </label>
                <Select value={clientId} onValueChange={setClientFromId}>
                  <SelectTrigger id="client-select" data-testid="select-client">
                    <SelectValue placeholder="Select client or choose New client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new" data-testid="option-client-new">
                      + New client
                    </SelectItem>
                    {sortedClients.map((c) => (
                      <SelectItem key={c.id} value={c.id} data-testid={`option-client-${c.id}`}>
                        {c.name}  b7 {c.identifier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="client-name" data-testid="label-client-name">
                  Client name
                </label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                  data-testid="input-client-name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="client-id" data-testid="label-client-identifier">
                  BearCard number / ID / email
                </label>
                <Input
                  id="client-id"
                  value={clientIdentifier}
                  onChange={(e) => setClientIdentifier(e.target.value)}
                  data-testid="input-client-identifier"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="client-contact" data-testid="label-client-contact">
                  Contact (optional)
                </label>
                <Input
                  id="client-contact"
                  value={clientContact}
                  onChange={(e) => setClientContact(e.target.value)}
                  data-testid="input-client-contact"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="item-select" data-testid="label-add-item">
                  Add item to cart
                </label>
                <div className="flex gap-2">
                  <Select onValueChange={(id) => addToCart(id)}>
                    <SelectTrigger id="item-select" data-testid="select-cart-item">
                      <SelectValue placeholder="Choose item" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedInventory.map((i) => (
                        <SelectItem key={i.id} value={i.id} data-testid={`option-cart-item-${i.id}`}>
                          {i.name}  b7 {i.quantity} on hand
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Scan or type barcode"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (barcode.trim()) {
                            handleBarcodeScanned(barcode);
                            setBarcode("");
                          }
                        }
                      }}
                      className="w-40"
                      data-testid="input-barcode"
                    />
                    <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          data-testid="button-open-camera-scanner"
                        >
                          <CameraIcon className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md" data-testid="dialog-camera-scanner">
                        <DialogHeader>
                          <DialogTitle>Scan barcode with camera</DialogTitle>
                        </DialogHeader>
                        <div className="aspect-video rounded-md overflow-hidden bg-muted flex items-center justify-center">
                          <video
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            autoPlay
                            muted
                            playsInline
                            data-testid="video-barcode-camera"
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground" data-testid="text-camera-scanner-help">
                          Point the barcode at the camera. Successful scans will add the item to the cart.
                        </p>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>

              <CartTable cart={cart} setCart={setCart} />
            </div>
          </section>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-muted-foreground" data-testid="text-check-out-help">
              This will reduce inventory and log an OUT transaction linked to this client.
            </p>
            <Button type="submit" disabled={!cart.length} data-testid="button-save-check-out">
              Complete check-out ({totalUnits} units)
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CartTable({
  cart,
  setCart,
}: {
  cart: { itemId: string; quantity: number }[];
  setCart: React.Dispatch<React.SetStateAction<{ itemId: string; quantity: number }[]>>;
}) {
  const { inventory } = useRepository();

  function updateQuantity(itemId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((c) => c.itemId !== itemId));
    } else {
      setCart((prev) => prev.map((c) => (c.itemId === itemId ? { ...c, quantity } : c)));
    }
  }

  return (
    <Card className="border-dashed" data-testid="card-check-out-cart">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
          <span>Cart</span>
          <span className="pill-muted" data-testid="text-cart-lines">
            {cart.length} line{cart.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cart.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-4 text-center text-xs text-muted-foreground"
                  data-testid="text-cart-empty"
                >
                  No items in cart yet.
                </TableCell>
              </TableRow>
            )}
            {cart.map((line) => {
              const item = inventory.find((i) => i.id === line.itemId);
              if (!item) return null;
              return (
                <TableRow key={line.itemId} data-testid={`row-cart-${line.itemId}`}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium" data-testid={`text-cart-item-name-${line.itemId}`}>
                        {item.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground" data-testid={`text-cart-item-category-${line.itemId}`}>
                        {item.category || "Uncategorized"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs" data-testid={`text-cart-item-available-${line.itemId}`}>
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <Input
                      type="number"
                      min={1}
                      max={item.quantity}
                      value={line.quantity}
                      onChange={(e) => updateQuantity(line.itemId, Number(e.target.value) || 0)}
                      className="h-7 w-20 ml-auto text-right"
                      data-testid={`input-cart-quantity-${line.itemId}`}
                    />
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => updateQuantity(line.itemId, 0)}
                      data-testid={`button-remove-cart-item-${line.itemId}`}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
