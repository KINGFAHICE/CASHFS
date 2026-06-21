import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Pencil, Trash2, Film } from "lucide-react";
import { db, type DigitalContentItem, formatUGX, seedDatabase } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const dcTypes = [
  { value: "movie", label: "Movies" },
  { value: "music", label: "Music" },
  { value: "software", label: "Software" },
  { value: "game", label: "Games" },
  { value: "internet", label: "Internet" },
];

export const Route = createFileRoute("/digital")({
  component: DigitalPage,
});

function DigitalPage() {
  const { isAdmin, isManager } = useAuth();
  const [items, setItems] = useState<DigitalContentItem[]>([]);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<DigitalContentItem | null>(null);
  const [form, setForm] = useState({ name: "", type: "movie" as DigitalContentItem["type"], price: "" });

  const loadItems = useCallback(async () => {
    await seedDatabase();
    const all = await db.digitalContent.toArray();
    setItems(all);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!form.name || !form.price) return;
    const data = { name: form.name, type: form.type, price: Number(form.price), isActive: true };
    if (editing) {
      await db.digitalContent.update(editing.id, data);
    } else {
      await db.digitalContent.add({ id: crypto.randomUUID(), ...data, createdAt: new Date() });
    }
    setIsAddOpen(false);
    setEditing(null);
    setForm({ name: "", type: "movie", price: "" });
    loadItems();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await db.digitalContent.delete(id);
    loadItems();
  };

  const canEdit = isAdmin || isManager;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Digital Content</h1>
          <p className="text-sm text-muted-foreground">Manage digital products catalog</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setForm({ name: "", type: "movie", price: "" }); setIsAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search digital content..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
              {canEdit && <th className="px-4 py-3 w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-muted/50">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium capitalize">
                    {item.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatUGX(item.price)}</td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(item); setForm({ name: item.name, type: item.type, price: String(item.price) }); setIsAddOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
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
            <DialogTitle>{editing ? "Edit Item" : "Add Digital Content"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as DigitalContentItem["type"] })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {dcTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Price (UGX)</label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <Button onClick={handleSave}>{editing ? "Update" : "Add Item"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
