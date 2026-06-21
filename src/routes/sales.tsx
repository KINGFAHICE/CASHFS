import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Save,
  RotateCcw,
  Clock,
  CreditCard,
  Banknote,
  Smartphone,
  Package,
  Film,
  Wrench,
  Lock,
  Music,
  AppWindow,
  Gamepad2,
  Wifi,
  Receipt,
  Undo2,
  RefreshCcw,
  Pencil,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  db,
  type Product,
  type Sale,
  type SaleItem,
  type DigitalContentItem,
  type ServiceItem,
  type User,
  formatUGX,

  getInitials,
  seedDatabase,
} from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { sounds } from "@/lib/sounds";
import { notify } from "@/lib/notify";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/sales")({
  component: SalesPage,
});

type Module = "electronics" | "digital" | "service";

interface CartItem {
  id: string;
  module: Module;
  subType?: string;
  productId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  total: number;
}

const INTERNET_VOUCHERS = [
  { id: "daily", label: "Daily (24 Hours)", price: 1000 },
  { id: "weekly", label: "Weekly (7 Days)", price: 6000 },
  { id: "monthly", label: "Monthly (30 Days)", price: 26000 },
];

function SalesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Module>("electronics");
  const [digitalSubTab, setDigitalSubTab] = useState<"movie" | "music" | "software" | "game" | "internet">("movie");
  const [products, setProducts] = useState<Product[]>([]);
  const [digitalItems, setDigitalItems] = useState<DigitalContentItem[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);

  type PayMethod = "cash" | "stk_push" | "merchant_pay";
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>("cash");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [mmProvider, setMmProvider] = useState<"mtn" | "airtel">("mtn");
  const [mmPhone, setMmPhone] = useState("");
  const [mmStatus, setMmStatus] = useState<"idle" | "prompted" | "waiting_pin" | "confirmed" | "failed">("idle");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [usersById, setUsersById] = useState<Record<string, User>>({});
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [billSaved, setBillSaved] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Movie/Music quick entry
  const [mediaName, setMediaName] = useState("");
  const [mediaAmount, setMediaAmount] = useState(0);

  // Custom service
  const [customServiceName, setCustomServiceName] = useState("");
  const [customServiceDesc, setCustomServiceDesc] = useState("");
  const [customServiceAmount, setCustomServiceAmount] = useState(0);

  // Internet voucher
  const [voucherChoice, setVoucherChoice] = useState<string>("daily");

  // Sale detail modal
  const [openSale, setOpenSale] = useState<Sale | null>(null);
  const [actionMode, setActionMode] = useState<null | "reverse" | "refund" | "edit">(null);
  const [actionReason, setActionReason] = useState("");
  const [editTotal, setEditTotal] = useState(0);

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const total = Math.max(0, subtotal - discountAmount);
  const change = Math.max(0, paymentAmount - total);

  const loadData = useCallback(async () => {
    await seedDatabase();
    setProducts(await db.products.toArray());
    setDigitalItems(await db.digitalContent.toArray());
    setServiceItems(await db.services.toArray());
    const allUsers = await db.users.toArray();
    setUsersById(Object.fromEntries(allUsers.map((u) => [u.id, u])));
  }, []);

  const loadRecentSales = useCallback(async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sales = await db.sales.where("createdAt").above(sevenDaysAgo).reverse().toArray();
    setRecentSales(sales);
  }, []);

  useEffect(() => { loadData(); loadRecentSales(); }, [loadData, loadRecentSales]);
  useEffect(() => { setPaymentAmount(total); }, [total]);

  // Auto-fill merchant code based on provider
  const merchantCode = useMemo(() => {
    if (!user) return "";
    return mmProvider === "mtn" ? user.merchantCodeMtn || "" : user.merchantCodeAirtel || "";
  }, [user, mmProvider]);

  const { reset: resetIdleTimer } = useIdleTimer(
    () => { if (cart.length > 0 && !billSaved) setShowIdleWarning(true); },
    60000,
    cart.length > 0 && !billSaved
  );

  // --- Cart helpers ---
  const addToCart = (item: Omit<CartItem, "id">) => {
    setCart((prev) => {
      // Merge if same productId / same module+name+price
      const idx = prev.findIndex(
        (c) =>
          c.module === item.module &&
          ((item.productId && c.productId === item.productId) ||
            (!item.productId && c.name === item.name && c.unitPrice === item.unitPrice))
      );
      if (idx >= 0) {
        const next = [...prev];
        const q = next[idx].quantity + item.quantity;
        next[idx] = { ...next[idx], quantity: q, total: q * next[idx].unitPrice };
        return next;
      }
      return [...prev, { ...item, id: crypto.randomUUID() }];
    });
    resetIdleTimer();
  };

  // Electronics: search + click adds immediately, search clears
  const filteredProducts = searchQuery.trim()
    ? products.filter(
        (p) =>
          (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchQuery.toLowerCase())) &&
          p.quantity > 0
      )
    : [];

  const handleSelectProduct = (p: Product) => {
    const inCart = cart.find((c) => c.productId === p.id);
    if (inCart && inCart.quantity >= p.quantity) {
      sounds.error();
      alert("No more stock available");
      return;
    }
    addToCart({
      module: "electronics",
      productId: p.id,
      name: p.name,
      quantity: 1,
      unitPrice: p.sellingPrice,
      costPrice: p.costPrice,
      total: p.sellingPrice,
    });
    setSearchQuery("");
    setSearchFocused(false);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const handleAddDigitalItem = (item: DigitalContentItem) => {
    addToCart({
      module: "digital",
      subType: item.type,
      name: item.name,
      quantity: 1,
      unitPrice: item.price,
      costPrice: 0,
      total: item.price,
    });
  };

  const handleAddMedia = (type: "movie" | "music") => {
    if (!mediaAmount || mediaAmount <= 0) return;
    const label = type === "movie" ? "Movie" : "Music";
    addToCart({
      module: "digital",
      subType: type,
      name: mediaName.trim() || `${label} sale`,
      quantity: 1,
      unitPrice: mediaAmount,
      costPrice: 0,
      total: mediaAmount,
    });
    setMediaName("");
    setMediaAmount(0);
  };

  const handleAddVoucher = () => {
    const v = INTERNET_VOUCHERS.find((x) => x.id === voucherChoice);
    if (!v) return;
    addToCart({
      module: "digital",
      subType: "internet",
      name: `Internet Voucher — ${v.label}`,
      quantity: 1,
      unitPrice: v.price,
      costPrice: 0,
      total: v.price,
    });
  };

  const handleAddService = (item: ServiceItem) => {
    addToCart({
      module: "service",
      subType: item.category,
      name: item.name,
      description: item.description,
      quantity: 1,
      unitPrice: item.price,
      costPrice: item.category === "pc_servicing" ? item.price * 0.2 : item.price * 0.5,
      total: item.price,
    });
  };

  const handleAddCustomService = () => {
    if (!customServiceName.trim() || !customServiceAmount) return;
    addToCart({
      module: "service",
      subType: "custom",
      name: customServiceName,
      description: customServiceDesc,
      quantity: 1,
      unitPrice: customServiceAmount,
      costPrice: customServiceAmount * 0.3,
      total: customServiceAmount,
    });
    setCustomServiceName("");
    setCustomServiceDesc("");
    setCustomServiceAmount(0);
  };

  const handleRemoveItem = (id: string) => setCart(cart.filter((c) => c.id !== id));
  const handleUpdateQty = (id: string, delta: number) => {
    setCart(cart.map((c) => {
      if (c.id !== id) return c;
      const q = Math.max(1, c.quantity + delta);
      return { ...c, quantity: q, total: q * c.unitPrice };
    }));
  };

  const handleApplyDiscount = () => {
    if (discountPercent > 0 && subtotal > 0) {
      setDiscountAmount(Math.round((subtotal * discountPercent) / 100));
    }
  };

  const filteredServices = serviceItems
    .filter((s) => s.isActive)
    .filter((s) =>
      serviceSearch.trim()
        ? s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
          s.description.toLowerCase().includes(serviceSearch.toLowerCase())
        : true
    );

  // --- STK push simulation ---
  const sendStkPrompt = () => {
    if (!mmPhone.trim()) { sounds.error(); alert("Enter the customer phone number"); return; }
    setMmStatus("prompted");
    setTimeout(() => setMmStatus("waiting_pin"), 900);
    setTimeout(() => { setMmStatus("confirmed"); sounds.success(); }, 3500);
  };
  const resetMm = () => setMmStatus("idle");

  const mmStatusLabel: Record<string, string> = {
    idle: "Not sent",
    prompted: "Prompt sent…",
    waiting_pin: "Waiting for customer PIN…",
    confirmed: "Confirmed",
    failed: "Failed",
  };

  // --- Save: split by module, share billId ---
  const handleClear = () => {
    setCart([]); setDiscountAmount(0); setDiscountPercent(0); setPaymentAmount(0);
    setCustomerName(""); setCustomerPhone(""); setSearchQuery(""); setBillSaved(false);
    setMmStatus("idle"); setMmPhone("");
  };

  const isMobile = (m: PayMethod) => m === "stk_push" || m === "merchant_pay";

  const handleSave = async () => {
    if (cart.length === 0) { sounds.error(); return; }
    if (isMobile(paymentMethod) && mmStatus !== "confirmed") {
      sounds.warn();
      const ok = confirm("Mobile payment not yet confirmed. Save anyway?");
      if (!ok) return;
    }
    setSaving(true);

    const billId = crypto.randomUUID();
    const modules: Module[] = ["electronics", "digital", "service"];
    const totalSubtotal = subtotal;

    for (const mod of modules) {
      const modItems = cart.filter((c) => c.module === mod);
      if (modItems.length === 0) continue;
      const modSub = modItems.reduce((s, i) => s + i.total, 0);
      // Apportion discount proportionally
      const modDiscount = totalSubtotal > 0 ? Math.round((discountAmount * modSub) / totalSubtotal) : 0;
      const modTotal = Math.max(0, modSub - modDiscount);
      const modCost = modItems.reduce((s, i) => s + i.costPrice * i.quantity, 0);
      const modPay = totalSubtotal > 0 ? Math.round((paymentAmount * modSub) / totalSubtotal) : 0;

      const sale: Sale = {
        id: crypto.randomUUID(),
        billId,
        type: mod,
        items: modItems.map<SaleItem>((i) => ({
          id: i.id, productId: i.productId, name: i.name, description: i.description,
          quantity: i.quantity, unitPrice: i.unitPrice, costPrice: i.costPrice, total: i.total,
          module: i.module, subType: i.subType,
        })),
        subtotal: modSub,
        discount: modDiscount,
        discountPercent: totalSubtotal > 0 ? Math.round((modDiscount / modSub) * 100) : 0,
        tax: 0,
        total: modTotal,
        costTotal: modCost,
        profit: modTotal - modCost,
        paymentMethod,
        paymentAmount: modPay,
        change: Math.max(0, modPay - modTotal),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        userId: user?.id ?? "",
        userName: user?.displayName ?? "",
        status: "locked",
        mmProvider: isMobile(paymentMethod) ? mmProvider : undefined,
        mmType: isMobile(paymentMethod) ? (paymentMethod as "merchant_pay" | "stk_push") : undefined,
        mmPhone: isMobile(paymentMethod) ? mmPhone : undefined,
        mmStatus: isMobile(paymentMethod) ? mmStatus : undefined,
        mmMerchantCode: isMobile(paymentMethod) ? merchantCode : undefined,
        createdAt: new Date(),
      };
      await db.sales.add(sale);

      if (mod === "electronics") {
        for (const it of modItems) {
          if (it.productId) {
            const p = await db.products.get(it.productId);
            if (p) await db.products.update(it.productId, {
              quantity: Math.max(0, p.quantity - it.quantity),
              updatedAt: new Date(),
            });
          }
        }
      }
    }

    setSaving(false);
    setBillSaved(true);
    sounds.success();
    notify("Bill saved", `Total ${formatUGX(total)} · ${cart.length} item(s)`, "success");
    await loadRecentSales();
    await loadData();
    setTimeout(() => { handleClear(); searchRef.current?.focus(); }, 1500);
  };

  // --- Sale action handlers ---
  const performReverse = async () => {
    if (!openSale || !actionReason.trim()) return;
    // Restock electronics
    if (openSale.type === "electronics") {
      for (const it of openSale.items) {
        if (it.productId) {
          const p = await db.products.get(it.productId);
          if (p) await db.products.update(it.productId, {
            quantity: p.quantity + it.quantity,
            updatedAt: new Date(),
          });
        }
      }
    }
    await db.sales.update(openSale.id, {
      status: "reversed",
      reversedAt: new Date(),
      reverseReason: actionReason,
      reversedBy: user?.displayName ?? "",
    });
    setOpenSale(null); setActionMode(null); setActionReason("");
    await loadRecentSales(); await loadData();
  };

  const performRefund = async () => {
    if (!openSale || !actionReason.trim()) return;
    if (openSale.type === "electronics") {
      for (const it of openSale.items) {
        if (it.productId) {
          const p = await db.products.get(it.productId);
          if (p) await db.products.update(it.productId, {
            quantity: p.quantity + it.quantity,
            updatedAt: new Date(),
          });
        }
      }
    }
    await db.sales.update(openSale.id, {
      status: "refunded",
      refundedAt: new Date(),
      refundReason: actionReason,
      refundedBy: user?.id,
    });
    setOpenSale(null); setActionMode(null); setActionReason("");
    await loadRecentSales(); await loadData();
  };

  const performEdit = async () => {
    if (!openSale || !actionReason.trim() || editTotal <= 0) return;
    const entry = {
      at: new Date(),
      by: user?.id ?? "",
      byName: user?.displayName ?? "",
      reason: actionReason,
      changes: `Total: ${openSale.total} → ${editTotal}`,
    };
    const history = [...(openSale.editHistory ?? []), entry];
    await db.sales.update(openSale.id, {
      total: editTotal,
      profit: editTotal - openSale.costTotal,
      status: "edited",
      editHistory: history,
    });
    setOpenSale(null); setActionMode(null); setActionReason(""); setEditTotal(0);
    await loadRecentSales();
  };

  const getSaleColor = (sale: Sale) => {
    if (sale.status === "refunded") return { bg: "bg-loss/10", text: "text-loss", label: "Refunded" };
    if (sale.status === "reversed") return { bg: "bg-muted", text: "text-muted-foreground", label: "Reversed" };
    if (sale.status === "edited") return { bg: "bg-discount/10", text: "text-discount", label: "Edited" };
    if (sale.profit < 0) return { bg: "bg-loss/10", text: "text-loss", label: "Loss" };
    if (sale.discount > 0) return { bg: "bg-discount/10", text: "text-discount", label: "Discount" };
    if (sale.profit > 0) return { bg: "bg-profit/10", text: "text-profit", label: "Profit" };
    return { bg: "bg-muted", text: "text-muted-foreground", label: "Normal" };
  };

  const formatStamp = (d: Date) => {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleString("en-UG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const moduleCount = (mod: Module) => cart.filter((c) => c.module === mod).length;

  const recentSalesPanel = (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
        <h3 className="font-semibold text-sm">Recent Sales (7 Days)</h3>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">When</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status · By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {recentSales.map((sale) => {
              const color = getSaleColor(sale);
              return (
                <tr
                  key={sale.id}
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() => { setOpenSale(sale); setActionMode(null); setActionReason(""); setEditTotal(sale.total); }}
                >
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {formatStamp(sale.createdAt)}
                  </td>
                  <td className="px-3 py-2 capitalize">{sale.type}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatUGX(sale.total)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${color.bg} ${color.text}`}>
                        {color.label}
                      </span>
                      {(() => {
                        const u = usersById[sale.userId];
                        if (u?.photo) {
                          return (
                            <img
                              src={u.photo}
                              alt={sale.userName}
                              title={sale.userName}
                              className="h-6 w-6 shrink-0 rounded-full object-cover"
                            />
                          );
                        }
                        return (
                          <div
                            title={sale.userName}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: u?.avatarColor ?? "#1E5BCB" }}
                          >
                            {getInitials(sale.userName || "?")}
                          </div>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              );
            })}
            {recentSales.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No sales in the last 7 days</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Sales</h1>
          <p className="text-sm text-muted-foreground">
            Primary workspace — mix any items into one bill, save splits them by module
          </p>
        </div>
        <div className="flex items-center gap-2">
          {billSaved && (
            <span className="flex items-center gap-1.5 rounded-full bg-profit/10 px-3 py-1 text-xs font-medium text-profit">
              <Lock className="h-3.5 w-3.5" /> Bill Saved
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Sale Entry Panel (always) */}
        <div className="lg:col-span-3 space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Module)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="electronics" className="gap-2">
                <Package className="h-4 w-4" /> Electronics
                {moduleCount("electronics") > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {moduleCount("electronics")}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="digital" className="gap-2">
                <Film className="h-4 w-4" /> Digital
                {moduleCount("digital") > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {moduleCount("digital")}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="service" className="gap-2">
                <Wrench className="h-4 w-4" /> Services
                {moduleCount("service") > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {moduleCount("service")}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ELECTRONICS */}
            <TabsContent value="electronics" className="mt-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  placeholder="Search product by name or SKU — click result to add to cart"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  className="pl-9"
                  disabled={billSaved}
                />
                {searchFocused && filteredProducts.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-72 overflow-y-auto">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-accent text-left"
                      >
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.sku} · {p.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatUGX(p.sellingPrice)}</p>
                          <p className="text-xs text-muted-foreground">{p.quantity} in stock</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Quick Add — Tap to add multiple
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {products.filter((p) => p.quantity > 0).map((p) => {
                    const inCart = cart.find((c) => c.productId === p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        disabled={billSaved}
                        className={`relative rounded-lg border p-3 text-left transition-colors hover:bg-accent disabled:opacity-50 ${
                          inCart ? "border-primary bg-primary/5" : "border-border bg-card"
                        }`}
                      >
                        {inCart && (
                          <span className="absolute right-2 top-2 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                            ×{inCart.quantity}
                          </span>
                        )}
                        <p className="font-medium text-sm line-clamp-1">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.sku}</p>
                        <p className="text-xs text-primary font-semibold mt-1">{formatUGX(p.sellingPrice)}</p>
                        <p className="text-[10px] text-muted-foreground">{p.quantity} in stock</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* DIGITAL */}
            <TabsContent value="digital" className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
                {([
                  { id: "movie", label: "Movies", icon: Film },
                  { id: "music", label: "Music", icon: Music },
                  { id: "software", label: "Software", icon: AppWindow },
                  { id: "game", label: "Games", icon: Gamepad2 },
                  { id: "internet", label: "Internet Vouchers", icon: Wifi },
                ] as const).map((t) => {
                  const Icon = t.icon;
                  const active = digitalSubTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setDigitalSubTab(t.id)}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {t.label}
                    </button>
                  );
                })}
              </div>

              {(digitalSubTab === "movie" || digitalSubTab === "music") && (
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {digitalSubTab === "movie" ? "Movie Sale" : "Music Sale"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Enter the amount charged per customer — no fixed catalog.
                    </p>
                  </div>
                  <Input
                    placeholder={`${digitalSubTab === "movie" ? "Movie" : "Music"} title / note (optional)`}
                    value={mediaName}
                    onChange={(e) => setMediaName(e.target.value)}
                    disabled={billSaved}
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Amount (UGX)"
                      value={mediaAmount || ""}
                      onChange={(e) => setMediaAmount(Number(e.target.value))}
                      className="flex-1"
                      disabled={billSaved}
                    />
                    <Button
                      onClick={() => handleAddMedia(digitalSubTab as "movie" | "music")}
                      disabled={billSaved || !mediaAmount}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add to Sale
                    </Button>
                  </div>
                </div>
              )}

              {(digitalSubTab === "software" || digitalSubTab === "game") && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {digitalItems
                    .filter((d) => d.type === digitalSubTab && d.isActive)
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleAddDigitalItem(item)}
                        disabled={billSaved}
                        className="rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-primary font-semibold mt-1">{formatUGX(item.price)}</p>
                      </button>
                    ))}
                  {digitalItems.filter((d) => d.type === digitalSubTab && d.isActive).length === 0 && (
                    <p className="col-span-full text-sm text-muted-foreground py-4 text-center">
                      No items in catalog — add some in Digital Content page.
                    </p>
                  )}
                </div>
              )}

              {digitalSubTab === "internet" && (
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">Internet Voucher</h3>
                    <p className="text-xs text-muted-foreground">
                      Select package — pricing is fixed. No manual entry.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {INTERNET_VOUCHERS.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setVoucherChoice(v.id)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          voucherChoice === v.id ? "border-primary bg-primary/5" : "border-border bg-background"
                        }`}
                      >
                        <p className="font-medium text-sm">{v.label}</p>
                        <p className="text-primary font-bold mt-1">{formatUGX(v.price)}</p>
                      </button>
                    ))}
                  </div>
                  <Button onClick={handleAddVoucher} disabled={billSaved} className="w-full">
                    <Plus className="h-4 w-4 mr-2" /> Add Voucher to Sale
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* SERVICES */}
            <TabsContent value="service" className="mt-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search services..."
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  className="pl-9"
                  disabled={billSaved}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Service Catalog
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredServices.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleAddService(item)}
                      disabled={billSaved}
                      className="rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      <p className="text-xs text-primary font-semibold mt-1">{formatUGX(item.price)}</p>
                    </button>
                  ))}
                  {filteredServices.length === 0 && (
                    <p className="col-span-full text-sm text-muted-foreground py-4 text-center">
                      No services match.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold">Custom Service</h3>
                <Input placeholder="Service name" value={customServiceName} onChange={(e) => setCustomServiceName(e.target.value)} disabled={billSaved} />
                <Input placeholder="Description (optional)" value={customServiceDesc} onChange={(e) => setCustomServiceDesc(e.target.value)} disabled={billSaved} />
                <div className="flex gap-2">
                  <Input
                    type="number" placeholder="Amount (UGX)"
                    value={customServiceAmount || ""}
                    onChange={(e) => setCustomServiceAmount(Number(e.target.value))}
                    className="flex-1" disabled={billSaved}
                  />
                  <Button onClick={handleAddCustomService} disabled={billSaved || !customServiceName.trim() || !customServiceAmount}>
                    <Plus className="h-4 w-4 mr-2" /> Add
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Bill panel when cart has items, otherwise Recent Sales */}
        <div className="lg:col-span-2 space-y-4">
        {cart.length > 0 ? (<>
          {/* Cart */}
          {cart.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between">
                <h3 className="font-semibold">Bill — {cart.length} item(s) across {new Set(cart.map((c) => c.module)).size} module(s)</h3>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Item</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Module</th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">Qty</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Price</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="px-4 py-2">
                        <p className="font-medium">{item.name}</p>
                        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium capitalize">
                          {item.module}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {!billSaved && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleUpdateQty(item.id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                          )}
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          {!billSaved && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleUpdateQty(item.id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">{formatUGX(item.unitPrice)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatUGX(item.total)}</td>
                      <td className="px-4 py-2 text-center">
                        {!billSaved && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleRemoveItem(item.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Payment & Totals */}
          {cart.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Customer Name</label>
                  <Input placeholder="Optional" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={billSaved} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Phone</label>
                  <Input placeholder="Optional" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} disabled={billSaved} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Discount</label>
                <div className="flex gap-2">
                  <Input type="number" placeholder="Percent %" value={discountPercent || ""} onChange={(e) => setDiscountPercent(Number(e.target.value))} className="w-28" disabled={billSaved} />
                  <Input type="number" placeholder="Amount UGX" value={discountAmount || ""} onChange={(e) => setDiscountAmount(Number(e.target.value))} className="flex-1" disabled={billSaved} />
                  <Button variant="outline" onClick={handleApplyDiscount} disabled={billSaved}>Apply</Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "cash" as const, label: "Cash", icon: Banknote },
                    { id: "stk_push" as const, label: "STK Push", icon: Smartphone },
                    { id: "merchant_pay" as const, label: "Merchant Pay", icon: CreditCard },
                  ]).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setPaymentMethod(m.id); if (m.id === "cash") setMmStatus("idle"); }}
                      disabled={billSaved}
                      className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
                        paymentMethod === m.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"
                      } disabled:opacity-50`}
                    >
                      <m.icon className="h-4 w-4" />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {isMobile(paymentMethod) && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        {paymentMethod === "stk_push" ? "STK Push Provider" : "Merchant Pay Provider"}
                      </label>
                      <select
                        value={mmProvider}
                        onChange={(e) => { setMmProvider(e.target.value as "mtn" | "airtel"); setMmStatus("idle"); }}
                        disabled={billSaved}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="mtn">MTN</option>
                        <option value="airtel">Airtel</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Merchant Code</label>
                      <Input
                        value={merchantCode || ""}
                        readOnly
                        placeholder={merchantCode ? "" : "Not set on profile"}
                        className="bg-background"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Customer Phone</label>
                    <Input
                      placeholder={mmProvider === "mtn" ? "07xx xxx xxx (MTN)" : "07xx xxx xxx (Airtel)"}
                      value={mmPhone}
                      onChange={(e) => setMmPhone(e.target.value)}
                      disabled={billSaved}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      {mmStatus === "confirmed" ? (
                        <CheckCircle2 className="h-4 w-4 text-profit" />
                      ) : mmStatus === "failed" ? (
                        <AlertTriangle className="h-4 w-4 text-loss" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={
                        mmStatus === "confirmed" ? "text-profit font-medium" :
                        mmStatus === "failed" ? "text-loss font-medium" :
                        "text-muted-foreground"
                      }>
                        Status: {mmStatusLabel[mmStatus]}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={resetMm} disabled={billSaved || mmStatus === "idle"}>
                        Reset
                      </Button>
                      <Button size="sm" onClick={sendStkPrompt} disabled={billSaved || mmStatus === "prompted" || mmStatus === "waiting_pin"}>
                        <Smartphone className="h-3.5 w-3.5 mr-1" />
                        {paymentMethod === "stk_push" ? "Send STK Prompt" : "Request Merchant Pay"}
                      </Button>
                    </div>
                  </div>
                  {!merchantCode && (
                    <p className="text-[11px] text-loss">
                      Set your {mmProvider === "mtn" ? "MTN" : "Airtel"} merchant code in the Users module to tie collections to your profile.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1.5 block">Payment Amount</label>
                <Input type="number" value={paymentAmount || ""} onChange={(e) => setPaymentAmount(Number(e.target.value))} disabled={billSaved} />
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatUGX(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-discount">Discount</span>
                    <span className="text-discount">-{formatUGX(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatUGX(total)}</span>
                </div>
                {paymentAmount > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Paid</span>
                      <span>{formatUGX(paymentAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Change</span>
                      <span className={change >= 0 ? "text-profit" : "text-loss"}>
                        {change >= 0 ? formatUGX(change) : `-${formatUGX(Math.abs(change))}`}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                {!billSaved ? (
                  <>
                    <Button onClick={handleSave} disabled={saving || total <= 0} className="flex-1">
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "Saving..." : "Save Bill"}
                    </Button>
                    <Button variant="outline" onClick={() => { if (confirm("Clear current bill?")) handleClear(); }} disabled={saving}>
                      <RotateCcw className="h-4 w-4 mr-2" /> Clear
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleClear} className="w-full">
                    <Plus className="h-4 w-4 mr-2" /> New Bill
                  </Button>
                )}
              </div>
            </div>
          )}
        </>) : (
          recentSalesPanel
        )}
        </div>
      </div>

      {/* When a bill is active, Recent Sales sits below full width */}
      {cart.length > 0 && (
        <div>{recentSalesPanel}</div>
      )}


      {/* Idle Warning */}
      <Dialog open={showIdleWarning} onOpenChange={() => { /* must act */ }}>
        <DialogContent
          className="sm:max-w-md [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onOpenAutoFocus={() => { sounds.warn(); notify("Idle bill", "Your bill has been idle for 1 minute.", "warn"); }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-discount" /> Idle Warning
            </DialogTitle>
            <DialogDescription>
              Your bill has been idle for 1 minute. Continue or clear?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setShowIdleWarning(false); handleClear(); }}>Clear Bill</Button>
            <Button onClick={() => setShowIdleWarning(false)}>Continue</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sale Detail / Action Dialog — closes only via explicit X / Cancel */}
      <Dialog open={!!openSale} onOpenChange={(o) => { if (!o) { setOpenSale(null); setActionMode(null); setActionReason(""); } }}>
        <DialogContent
          className="sm:max-w-xl max-h-[85vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onOpenAutoFocus={() => sounds.click()}
        >
          {openSale && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" /> Sale · {openSale.type}
                </DialogTitle>
                <DialogDescription>
                  {formatStamp(openSale.createdAt)} · by {openSale.userName}
                  {openSale.billId && ` · Bill #${openSale.billId.slice(0, 8)}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openSale.items.map((i) => (
                        <tr key={i.id} className="border-t border-border/50">
                          <td className="px-3 py-2">{i.name}</td>
                          <td className="px-3 py-2 text-center">{i.quantity}</td>
                          <td className="px-3 py-2 text-right">{formatUGX(i.unitPrice)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatUGX(i.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Subtotal:</span> {formatUGX(openSale.subtotal)}</div>
                  <div><span className="text-muted-foreground">Discount:</span> {formatUGX(openSale.discount)}</div>
                  <div><span className="text-muted-foreground">Total:</span> <span className="font-bold">{formatUGX(openSale.total)}</span></div>
                  <div><span className="text-muted-foreground">Profit:</span> {formatUGX(openSale.profit)}</div>
                  <div><span className="text-muted-foreground">Payment:</span> {openSale.paymentMethod}</div>
                  <div><span className="text-muted-foreground">Status:</span> <span className="capitalize">{openSale.status}</span></div>
                  {openSale.mmProvider && (
                    <>
                      <div><span className="text-muted-foreground">MM:</span> {openSale.mmProvider.toUpperCase()} · {openSale.mmType}</div>
                      <div><span className="text-muted-foreground">Phone:</span> {openSale.mmPhone}</div>
                    </>
                  )}
                  {openSale.refundReason && (
                    <div className="col-span-2"><span className="text-loss font-medium">Refund reason:</span> {openSale.refundReason}</div>
                  )}
                  {openSale.reverseReason && (
                    <div className="col-span-2"><span className="text-loss font-medium">Reverse reason:</span> {openSale.reverseReason}</div>
                  )}
                  {openSale.editHistory && openSale.editHistory.length > 0 && (
                    <div className="col-span-2 space-y-1">
                      <p className="text-muted-foreground font-medium">Edit history:</p>
                      {openSale.editHistory.map((e, idx) => (
                        <p key={idx} className="text-[11px]">
                          • {new Date(e.at).toLocaleString()} by {e.byName}: {e.reason} ({e.changes})
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {openSale.status !== "refunded" && openSale.status !== "reversed" && !actionMode && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <Button variant="outline" size="sm" onClick={() => setActionMode("reverse")}>
                      <Undo2 className="h-3.5 w-3.5 mr-1" /> Reverse
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setActionMode("refund")}>
                      <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Refund
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setActionMode("edit")}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  </div>
                )}

                {actionMode && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <p className="text-sm font-semibold capitalize">
                      {actionMode === "reverse" ? "Reverse transaction" : actionMode === "refund" ? "Refund customer" : "Edit sale"}
                    </p>
                    {actionMode === "reverse" && (
                      <p className="text-xs text-muted-foreground">
                        Will restock electronics items and mark the sale as reversed.
                      </p>
                    )}
                    {actionMode === "refund" && (
                      <p className="text-xs text-muted-foreground">
                        Will restock electronics and mark the sale as refunded.
                      </p>
                    )}
                    {actionMode === "edit" && (
                      <div>
                        <label className="text-xs font-medium">New Total (UGX)</label>
                        <Input type="number" value={editTotal || ""} onChange={(e) => setEditTotal(Number(e.target.value))} />
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-medium">Reason (required)</label>
                      <Input
                        placeholder="Why is this change being made?"
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setActionMode(null); setActionReason(""); }}>Cancel</Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (actionMode === "reverse") performReverse();
                          else if (actionMode === "refund") performRefund();
                          else if (actionMode === "edit") performEdit();
                        }}
                        disabled={!actionReason.trim() || (actionMode === "edit" && editTotal <= 0)}
                      >
                        Confirm
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
