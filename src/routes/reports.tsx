import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { BarChart3, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { db, formatUGX, seedDatabase } from "@/lib/db";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const [sales, setSales] = useState<Record<string, number>>({});
  const [expensesByCat, setExpensesByCat] = useState<Record<string, number>>({});
  const [totals, setTotals] = useState({ sales: 0, expenses: 0, profit: 0 });

  const loadData = useCallback(async () => {
    await seedDatabase();
    const allSales = await db.sales.toArray();
    const allExpenses = await db.expenses.toArray();

    const salesByType: Record<string, number> = {};
    allSales.forEach((s) => {
      salesByType[s.type] = (salesByType[s.type] || 0) + s.total;
    });

    const expByCat: Record<string, number> = {};
    allExpenses.forEach((e) => {
      expByCat[e.category] = (expByCat[e.category] || 0) + e.amount;
    });

    const totalSales = allSales.reduce((s, sale) => s + sale.total, 0);
    const totalExpenses = allExpenses.reduce((s, e) => s + e.amount, 0);
    const totalProfit = allSales.reduce((s, sale) => s + sale.profit, 0);

    setSales(salesByType);
    setExpensesByCat(expByCat);
    setTotals({ sales: totalSales, expenses: totalExpenses, profit: totalProfit });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const salesChartData = Object.entries(sales).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const expenseChartData = Object.entries(expensesByCat).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const COLORS = ["#D4AF37", "#1E5BCB", "#E11D2E", "#2D8A4E", "#8B5CF6", "#F59E0B"];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-display">Reports</h1>
        <p className="text-sm text-muted-foreground">Financial summaries and insights</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-profit/10">
            <DollarSign className="h-5 w-5 text-profit" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Total Sales</p>
            <p className="text-xl font-bold">{formatUGX(totals.sales)}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-loss/10">
            <TrendingDown className="h-5 w-5 text-loss" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Total Expenses</p>
            <p className="text-xl font-bold">{formatUGX(totals.expenses)}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Net Profit</p>
            <p className={`text-xl font-bold ${totals.profit - totals.expenses >= 0 ? "text-profit" : "text-loss"}`}>
              {formatUGX(Math.abs(totals.profit - totals.expenses))}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Sales by Type</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} tickFormatter={(v: number) => `UGX ${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }}
                  // FIXED: Formatter accepts 'any' and defaults to 0 if undefined
                  formatter={(value: any) => [formatUGX(Number(value ?? 0)), "Amount"]}
                />
                <Bar dataKey="value" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-4">Expenses by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {expenseChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }}
                  // FIXED: Formatter accepts 'any' and defaults to 0 if undefined
                  formatter={(value: any) => [formatUGX(Number(value ?? 0)), "Amount"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {expenseChartData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-muted-foreground">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}