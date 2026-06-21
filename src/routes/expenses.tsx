import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Trash2, TrendingDown } from "lucide-react";
import { db, type Expense, formatUGX, seedDatabase } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const expenseCategories = [
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "transport", label: "Transport" },
  { value: "repairs", label: "Repairs" },
  { value: "salaries", label: "Salaries" },
  { value: "miscellaneous", label: "Miscellaneous" },
];

export const Route = createFileRoute("/expenses")({
  component: ExpensesPage,
});

function ExpensesPage() {
  const { user, isAdmin, isManager } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [category, setCategory] = useState("rent");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const loadExpenses = useCallback(async () => {
    await seedDatabase();
    const all = await db.expenses.reverse().toArray();
    setExpenses(all);
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const filtered = expenses.filter(
    (e) =>
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals = expenseCategories.map((cat) => ({
    ...cat,
    total: expenses.filter((e) => e.category === cat.value).reduce((s, e) => s + e.amount, 0),
  }));

  const handleAdd = async () => {
    if (!description || !amount || !user) return;
    await db.expenses.add({
      id: crypto.randomUUID(),
      category: category as Expense["category"],
      description,
      amount: Number(amount),
      date,
      userId: user.id,
      userName: user.displayName,
      createdAt: new Date(),
    });
    setIsAddOpen(false);
    setDescription("");
    setAmount("");
    setCategory("rent");
    loadExpenses();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense record?")) return;
    await db.expenses.delete(id);
    loadExpenses();
  };

  const canEdit = isAdmin || isManager;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track all business costs</p>
        </div>
        {canEdit && (
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Expenses</p>
          <p className="text-2xl font-bold text-loss mt-1">{formatUGX(totalExpenses)}</p>
        </div>
        {categoryTotals.slice(0, 2).map((cat) => (
          <div key={cat.value} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground capitalize">{cat.label}</p>
            <p className="text-xl font-bold mt-1">{formatUGX(cat.total)}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search expenses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">By</th>
              {canEdit && <th className="px-4 py-3 w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((e) => (
              <tr key={e.id} className="hover:bg-muted/50">
                <td className="px-4 py-3 text-muted-foreground">{e.date}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium capitalize">
                    {e.category}
                  </span>
                </td>
                <td className="px-4 py-3">{e.description}</td>
                <td className="px-4 py-3 text-right font-medium text-loss">{formatUGX(e.amount)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{e.userName}</td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No expenses found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label className="text-sm font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {expenseCategories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Amount (UGX)</label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleAdd} disabled={!description || !amount}>Add Expense</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
