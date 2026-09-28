"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Bell, BellOff, Bike, MessageSquare, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatUgx, ORDER_COLUMNS, toOrder } from "@/lib/restaurants/data";
import type { Order, OrderStatus } from "@/lib/restaurants/types";
import { cn } from "@/lib/utils";

// Live kitchen board. New orders arrive over Supabase Realtime (RLS applies, so
// an owner only hears about their own restaurant) with a chime, a browser
// notification and a count in the tab title. No email or SMS needed.

const COLUMNS: { status: OrderStatus; label: string; next?: { status: OrderStatus; label: string } }[] = [
  { status: "new", label: "New", next: { status: "accepted", label: "Accept" } },
  { status: "accepted", label: "Accepted", next: { status: "preparing", label: "Start cooking" } },
  { status: "preparing", label: "Preparing", next: { status: "ready", label: "Mark ready" } },
  { status: "ready", label: "Ready / on the way", next: { status: "completed", label: "Complete" } },
  { status: "completed", label: "Completed" },
];

function timeAgo(iso: string, now: number) {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : new Date(iso).toLocaleDateString();
}

const noopSubscribe = () => () => {};
const notificationsGranted = () => typeof Notification !== "undefined" && Notification.permission === "granted";

/** A short two-tone chime, generated so there's no audio file to load. */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    /* audio blocked until the page is clicked once */
  }
}

export function OrdersBoard({ restaurantId, initialOrders }: { restaurantId: string; initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [live, setLive] = useState<"connecting" | "live" | "offline">("connecting");
  // Already-granted permission counts as "on" without a click.
  const granted = useSyncExternalStore(noopSubscribe, notificationsGranted, () => false);
  const [enabled, setEnabled] = useState(false);
  const alerts = granted || enabled;
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const alertsRef = useRef(alerts);
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const db = createClient();
    const loadOne = async (id: string) => {
      // order_items are inserted right after the order row, so give them a moment.
      await new Promise((r) => setTimeout(r, 600));
      const { data } = await db.from("orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle();
      return data ? toOrder(data as Parameters<typeof toOrder>[0]) : null;
    };
    const channel = db
      .channel(`orders:${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, async (payload) => {
        const id = (payload.new as { id?: string })?.id ?? (payload.old as { id?: string })?.id;
        if (!id) return;
        if (payload.eventType === "DELETE") {
          setOrders((o) => o.filter((x) => x.id !== id));
          return;
        }
        const order = await loadOne(id);
        if (!order) return;
        setOrders((o) => [order, ...o.filter((x) => x.id !== id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        if (payload.eventType === "INSERT") {
          setFresh((f) => new Set(f).add(id));
          chime();
          if (alertsRef.current && document.visibilityState !== "visible") {
            new Notification(`New order ${order.reference}`, {
              body: `${order.items.map((i) => `${i.qty}× ${i.name}`).join(", ")} · ${formatUgx(order.total)}`,
              tag: order.id,
            });
          }
        }
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED" ? "live" : status === "CLOSED" || status === "CHANNEL_ERROR" ? "offline" : "connecting"));
    return () => {
      void db.removeChannel(channel);
    };
  }, [restaurantId]);

  const newCount = orders.filter((o) => o.status === "new").length;
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = newCount ? `(${newCount}) ${base}` : base;
  }, [newCount]);

  const byStatus = useMemo(() => {
    const map = new Map<OrderStatus, Order[]>();
    for (const o of orders) map.set(o.status, [...(map.get(o.status) ?? []), o]);
    return map;
  }, [orders]);

  async function enableAlerts() {
    if (typeof Notification === "undefined") {
      setMessage("This browser doesn't support notifications. Keep this tab open to hear the chime.");
      return;
    }
    const permission = await Notification.requestPermission();
    setEnabled(permission === "granted");
    chime(); // also unlocks audio
    if (permission !== "granted") setMessage("Notifications are blocked. You'll still hear a chime while this tab is open.");
  }

  async function move(order: Order, status: OrderStatus) {
    setBusyId(order.id);
    setMessage(null);
    const previous = orders;
    setOrders((o) => o.map((x) => (x.id === order.id ? { ...x, status } : x)));
    setFresh((f) => {
      const n = new Set(f);
      n.delete(order.id);
      return n;
    });
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; notified?: { sent: boolean; reason?: string } | null };
      if (!res.ok) throw new Error(data.error ?? "Couldn't update the order");
      if (data.notified && !data.notified.sent) {
        setMessage(
          data.notified.reason === "window_closed"
            ? `${order.reference} updated. The customer wasn't messaged: WhatsApp only allows replies within 24 hours of their last message.`
            : `${order.reference} updated, but the customer couldn't be messaged.`
        );
      }
    } catch (err) {
      setOrders(previous);
      setMessage(err instanceof Error ? err.message : "Couldn't update the order");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <span
            aria-hidden
            className={cn("size-2 rounded-full", live === "live" ? "bg-accent" : live === "connecting" ? "animate-pulse bg-muted-foreground/50" : "bg-destructive")}
          />
          {live === "live" ? "Live: new orders appear here automatically" : live === "connecting" ? "Connecting…" : "Offline: refresh the page to reconnect"}
        </p>
        <Button variant={alerts ? "outline" : "default"} size="sm" onClick={() => void enableAlerts()} className="self-start">
          {alerts ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
          {alerts ? "Alerts on" : "Turn on order alerts"}
        </Button>
      </div>
      {message && (
        <p role="status" className="mb-4 rounded-lg border bg-muted px-3 py-2 text-sm text-pretty">
          {message}
        </p>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="grid min-w-[1100px] grid-cols-5 gap-3">
          {COLUMNS.map((col) => {
            const list = byStatus.get(col.status) ?? [];
            return (
              <section key={col.status} aria-label={col.label} className="flex min-h-[60vh] flex-col rounded-xl bg-muted/70 p-2">
                <h2 className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold">
                  {col.label}
                  <span className="rounded-full bg-background px-2 text-xs tabular-nums text-muted-foreground">{list.length}</span>
                </h2>
                <div className="mt-1 flex flex-col gap-2">
                  {list.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">No orders</p>}
                  {list.map((o) => (
                    <article
                      key={o.id}
                      className={cn(
                        "rounded-lg border bg-card p-3 text-sm transition-shadow",
                        fresh.has(o.id) && "ring-2 ring-accent motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-xs font-semibold">{o.reference}</p>
                        <span className="text-xs text-muted-foreground">{timeAgo(o.createdAt, now)}</span>
                      </div>
                      <ul className="mt-2 space-y-0.5">
                        {o.items.map((i, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="tabular-nums font-medium">{i.qty}×</span>
                            <span className="min-w-0">
                              {i.name}
                              {i.notes && <span className="block text-xs text-muted-foreground">{i.notes}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="gap-1">
                          {o.fulfillment === "delivery" ? <Bike className="size-3" /> : <ShoppingBag className="size-3" />}
                          {o.fulfillment === "delivery" ? "Delivery" : "Pickup"}
                        </Badge>
                        {o.channel === "web" && <Badge variant="secondary">Test</Badge>}
                      </div>
                      {o.address && <p className="mt-1.5 text-xs text-pretty text-muted-foreground">{o.address}</p>}
                      <p className="mt-2 font-semibold tabular-nums">{formatUgx(o.total)}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.customerName ?? "Customer"}
                        {o.customerPhone ? ` · ${o.customerPhone}` : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {col.next && (
                          <Button size="sm" disabled={busyId === o.id} onClick={() => void move(o, col.next!.status)}>
                            {col.next.label}
                          </Button>
                        )}
                        {o.conversationId && (
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/dashboard/inbox?c=${o.conversationId}`} aria-label={`Open chat for ${o.reference}`}>
                              <MessageSquare className="size-3.5" /> Chat
                            </Link>
                          </Button>
                        )}
                        {col.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={busyId === o.id}
                            onClick={() => {
                              if (confirm(`Cancel ${o.reference}? The customer will be told.`)) void move(o, "cancelled");
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
