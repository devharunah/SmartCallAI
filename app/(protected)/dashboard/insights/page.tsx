import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { getMyRestaurant } from "@/lib/restaurants/current";
import { formatUgx } from "@/lib/restaurants/data";
import type { DisplayEntry } from "@/lib/chat/types";
import { OrdersChart } from "@/components/dashboard/orders-chart";

export const metadata: Metadata = { title: `Insights · ${BRAND.name}` };

const DAYS = 14;
const FREE_SERVICE_MESSAGES = 1000; // per WhatsApp number per month, from 1 Oct 2026

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export default async function InsightsPage() {
  const restaurant = (await getMyRestaurant())!;
  const db = await createClient();
  const since = daysAgo(DAYS - 1);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [ordersRes, convRes] = await Promise.all([
    db
      .from("orders")
      .select("created_at, total, status, channel, order_items(name_snapshot, qty)")
      .eq("restaurant_id", restaurant.id)
      .gte("created_at", since.toISOString())
      .neq("status", "cancelled"),
    db
      .from("conversations")
      .select("channel, status, ai_paused, display_log, updated_at")
      .eq("restaurant_id", restaurant.id)
      .gte("updated_at", (since < monthStart ? since : monthStart).toISOString()),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  if (convRes.error) throw convRes.error;
  const orders = ordersRes.data ?? [];
  const conversations = convRes.data ?? [];

  const byDay = Array.from({ length: DAYS }, (_, i) => {
    const d = daysAgo(DAYS - 1 - i);
    return { key: d.toDateString(), label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), orders: 0, revenue: 0 };
  });
  const dayIndex = new Map(byDay.map((d, i) => [d.key, i]));
  const items = new Map<string, number>();
  for (const o of orders) {
    const i = dayIndex.get(new Date(o.created_at as string).toDateString());
    if (i !== undefined) {
      byDay[i].orders += 1;
      byDay[i].revenue += o.total as number;
    }
    for (const it of (o.order_items as { name_snapshot: string; qty: number }[]) ?? []) {
      items.set(it.name_snapshot, (items.get(it.name_snapshot) ?? 0) + it.qty);
    }
  }
  const revenue = orders.reduce((s, o) => s + (o.total as number), 0);
  const topItems = [...items.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  let customerMessages = 0;
  let voiceNotes = 0;
  let serviceMessagesThisMonth = 0;
  for (const c of conversations) {
    for (const e of (c.display_log as DisplayEntry[]) ?? []) {
      if (e.from === "customer") {
        customerMessages++;
        if (e.kind === "voice") voiceNotes++;
      } else if (c.channel === "whatsapp" && new Date(e.at) >= monthStart) {
        serviceMessagesThisMonth++;
      }
    }
  }
  const handedOff = conversations.filter((c) => c.ai_paused).length;

  const tiles = [
    { label: `Orders, last ${DAYS} days`, value: orders.length.toLocaleString() },
    { label: "Revenue", value: formatUgx(revenue) },
    { label: "Average order", value: orders.length ? formatUgx(revenue / orders.length) : "—" },
    {
      label: "Chats handled without staff",
      value: conversations.length ? `${Math.round(((conversations.length - handedOff) / conversations.length) * 100)}%` : "—",
    },
    { label: "Messages that were voice notes", value: customerMessages ? `${Math.round((voiceNotes / customerMessages) * 100)}%` : "—" },
  ];

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border p-4">
            <dt className="text-xs text-muted-foreground">{t.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{t.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl border p-4" aria-labelledby="orders-per-day">
          <h2 id="orders-per-day" className="font-semibold">Orders per day</h2>
          <p className="text-xs text-muted-foreground">Cancelled orders excluded. Test orders from the simulator included.</p>
          <OrdersChart data={byDay.map(({ label, orders, revenue }) => ({ label, orders, revenue }))} />
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border p-4" aria-labelledby="top-items">
            <h2 id="top-items" className="font-semibold">Top items</h2>
            {topItems.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <ol className="mt-2 space-y-1.5 text-sm">
                {topItems.map(([name, qty]) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="truncate">{name}</span>
                    <span className="tabular-nums text-muted-foreground">{qty}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-xl border p-4" aria-labelledby="wa-usage">
            <h2 id="wa-usage" className="font-semibold">WhatsApp replies this month</h2>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {serviceMessagesThisMonth.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">/ {FREE_SERVICE_MESSAGES.toLocaleString()} free</span>
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${serviceMessagesThisMonth} of ${FREE_SERVICE_MESSAGES} free replies used`}>
              <div className="h-full rounded-full bg-chart-2" style={{ width: `${Math.min(100, (serviceMessagesThisMonth / FREE_SERVICE_MESSAGES) * 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-pretty text-muted-foreground">
              Meta gives each number 1,000 free replies a month. After that each reply costs about $0.004 (Uganda).
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
