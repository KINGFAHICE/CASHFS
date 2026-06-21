import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Pencil, Trash2, AlertTriangle, Package } from "lucide-react";
import { db, type Product, formatUGX, seedDatabase } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  const { user, isAdmin, isManager } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    costPrice: "",
    sellingPrice: "",
    quantity: "",
    minStock: "",
  });

  const loadProducts = useCallback(async () => {
    await seedDatabase();
    const all = await db.products.toArray();
    setProducts(all);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = filtered.filter((p) => p.quantity <= p.minStock);

  const handleSave = async () => {
    if (!form.name || !form.sku) return;
    const data = {
      name: form.name,
      sku: form.sku,
      category: form.category || "General",
      costPrice: Number(form.costPrice) || 0,
      sellingPrice: Number(form.sellingPrice) || 0,
      quantity: Number(form.quantity) || 0,
      minStock: Number(form.minStock) || 0,
    };

    if (editing) {
      await db.products.update(editing.id, { ...data, updatedAt: new Date() });
    } else {
      await db.products.add({
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    setIsAddOpen(false);
    setEditing(null);
    setForm({ name: "", sku: "", category: "", costPrice: "", sellingPrice: "", quantity: "", minStock: "" });
    loadProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await db.products.delete(id);
    loadProducts();
  };

  const canEdit = isAdmin || isManager;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Inventory</h1>
          <p className="text-sm text-muted-foreground">Manage electronics stock</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setForm({ name: "", sku: "", category: "", costPrice: "", sellingPrice: "", quantity: "", minStock: "" }); setIsAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        )}
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-lg border border-loss/30 bg-loss/10 p-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-loss shrink-0" />
          <div>
            <p className="text-sm font-medium text-loss">Low Stock Alert</p>
            <p className="text-xs text-loss/80">{lowStock.length} item(s) below minimum stock level</p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cost</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
              {canEdit && <th className="px-4 py-3 text-center font-medium text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-muted/50">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.sku}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                    {p.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{formatUGX(p.costPrice)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatUGX(p.sellingPrice)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={p.quantity <= p.minStock ? "text-loss font-bold" : ""}>
                    {p.quantity}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {p.quantity <= p.minStock ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-loss/10 px-2 py-0.5 text-xs font-medium text-loss">
                      <AlertTriangle className="h-3 w-3" />
                      Low
                    </span>
                  ) : p.quantity === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Out
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-profit/10 px-2 py-0.5 text-xs font-medium text-profit">
                      <Package className="h-3 w-3" />
                      OK
                    </span>
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(p);
                          setForm({
                            name: p.name,
                            sku: p.sku,
                            category: p.category,
                            costPrice: String(p.costPrice),
                            sellingPrice: String(p.sellingPrice),
                            quantity: String(p.quantity),
                            minStock: String(p.minStock),
                          });
                          setIsAddOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">SKU</label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Cost Price (UGX)</label>
                <Input type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Selling Price (UGX)</label>
                <Input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Quantity</label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Min Stock</label>
                <Input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleSave} className="w-full">
              {editing ? "Update Product" : "Add Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
