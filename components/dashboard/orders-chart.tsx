"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatUgx } from "@/lib/restaurants/data";

// One series, so no legend: the section title names it. Thin bars with a
// rounded data-end, hairline grid, and a per-bar tooltip.

interface Day {
  label: string;
  orders: number;
  revenue: number;
}

function DayTooltip({ active, payload }: { active?: boolean; payload?: { payload: Day }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{d.label}</p>
      <p className="tabular-nums">{d.orders} {d.orders === 1 ? "order" : "orders"}</p>
      <p className="tabular-nums text-muted-foreground">{formatUgx(d.revenue)}</p>
    </div>
  );
}

export function OrdersChart({ data }: { data: Day[] }) {
  const empty = data.every((d) => d.orders === 0);
  return (
    <div className="mt-4">
      <div className="h-64" aria-hidden={empty}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} tick={{ fill: "var(--muted-foreground)" }} />
            <Tooltip content={<DayTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="orders" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {empty && <p className="-mt-36 mb-28 text-center text-sm text-muted-foreground">No orders in the last two weeks yet.</p>}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">Show as table</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 text-right font-medium">Orders</th>
              <th className="py-1 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.map((d) => (
              <tr key={d.label} className="border-t">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right">{d.orders}</td>
                <td className="py-1 text-right">{formatUgx(d.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
