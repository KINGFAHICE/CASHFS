import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { ArrowDownLeft, ArrowUpRight, BookOpen, Calendar } from "lucide-react";
import { db, type Sale, type Expense, formatUGX, seedDatabase } from "@/lib/db";

export const Route = createFileRoute("/accounts")({
  component: AccountsPage,
});

interface Transaction {
  id: string;
  date: Date;
  type: "sale" | "expense";
  category: string;
  description: string;
  amount: number;
  profit?: number;
  userName: string;
}

function AccountsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<"all" | "sales" | "expenses">("all");
  const [yearFilter, setYearFilter] = useState<number | "all">("all");

  const loadData = useCallback(async () => {
    await seedDatabase();
    const sales = await db.sales.reverse().toArray();
    const expenses = await db.expenses.reverse().toArray();

    const txns: Transaction[] = [
      ...sales.map((s) => ({
        id: s.id,
        date: s.createdAt,
        type: "sale" as const,
        category: s.type,
        description: `${s.items.length} item(s) — ${s.customerName || "Walk-in"}`,
        amount: s.total,
        profit: s.profit,
        userName: s.userName,
      })),
      ...expenses.map((e) => ({
        id: e.id,
        date: e.createdAt,
        type: "expense" as const,
        category: e.category,
        description: e.description,
        amount: e.amount,
        userName: e.userName,
      })),
    ];

    txns.sort((a, b) => b.date.getTime() - a.date.getTime());
    setTransactions(txns);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const years = Array.from(new Set(transactions.map((t) => t.date.getFullYear()))).sort((a, b) => b - a);

  const filtered = transactions.filter((t) => {
    if (filter === "sales" && t.type !== "sale") return false;
    if (filter === "expenses" && t.type !== "expense") return false;
    if (yearFilter !== "all" && t.date.getFullYear() !== yearFilter) return false;
    return true;
  });

  const totalSales = filtered.filter((t) => t.type === "sale").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalProfit = filtered.filter((t) => t.type === "sale" && t.profit !== undefined).reduce((s, t) => s + (t.profit || 0), 0);
  const netProfit = totalProfit - totalExpenses;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-display">Accounts</h1>
        <p className="text-sm text-muted-foreground">Full transaction history across all years</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Total Sales</p>
          <p className="text-xl font-bold text-profit mt-1">{formatUGX(totalSales)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Total Expenses</p>
          <p className="text-xl font-bold text-loss mt-1">{formatUGX(totalExpenses)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Gross Profit</p>
          <p className="text-xl font-bold text-primary mt-1">{formatUGX(totalProfit)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Net Profit</p>
          <p className={`text-xl font-bold mt-1 ${netProfit >= 0 ? "text-profit" : "text-loss"}`}>
            {formatUGX(Math.abs(netProfit))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border bg-card p-1">
          {(["all", "sales", "expenses"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {f === "all" ? "All" : f === "sales" ? "Sales" : "Expenses"}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setYearFilter("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              yearFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            All Years
          </button>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYearFilter(y)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                yearFilter === y ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Profit</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-muted/50">
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {t.date.toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" })}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.type === "sale"
                      ? "bg-profit/10 text-profit"
                      : "bg-loss/10 text-loss"
                  }`}>
                    {t.type === "sale" ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownLeft className="h-3 w-3" />
                    )}
                    {t.type === "sale" ? "Sale" : "Expense"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{t.description}</p>
                  <p className="text-xs text-muted-foreground capitalize">{t.category}</p>
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatUGX(t.amount)}
                </td>
                <td className="px-4 py-3 text-right">
                  {t.profit !== undefined ? (
                    <span className={t.profit >= 0 ? "text-profit" : "text-loss"}>
                      {t.profit >= 0 ? "+" : ""}{formatUGX(t.profit)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{t.userName}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
