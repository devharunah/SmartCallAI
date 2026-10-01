import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ORDER_COLUMNS, toOrder } from "@/lib/restaurants/data";
import { ORDER_STATUSES } from "@/lib/restaurants/types";
import { notifyOrderStatus } from "@/lib/chat/notify";

const Body = z.object({ status: z.enum(ORDER_STATUSES) });

/** Move an order along the board and tell the customer. RLS limits it to the owner's orders. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireApiUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  try {
    const db = await createClient();
    const { data, error } = await db
      .from("orders")
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(ORDER_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const order = toOrder(data as Parameters<typeof toOrder>[0]);
    const notified = await notifyOrderStatus(order).catch((err) => {
      console.error("[PATCH /api/orders] notify failed", err);
      return { sent: false as const, reason: "failed" as const };
    });
    return NextResponse.json({ order, notified });
  } catch (err) {
    console.error("[PATCH /api/orders]", err);
    return NextResponse.json({ error: "Could not update the order" }, { status: 500 });
  }
}
