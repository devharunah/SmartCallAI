import { NextResponse } from "next/server";
import { requireOwner, serverError } from "@/lib/restaurants/api";
import { toMenuItem } from "@/lib/restaurants/data";
import { ITEM_COLUMNS, ItemFields, itemRow } from "@/lib/restaurants/menu-fields";

export async function POST(request: Request) {
  const owner = await requireOwner();
  if (owner.error) return owner.error;
  const parsed = ItemFields.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the item's name and price" }, { status: 400 });
  try {
    const { data, error } = await owner.db
      .from("menu_items")
      .insert({ restaurant_id: owner.restaurant.id, ...itemRow(parsed.data), position: Math.floor(Date.now() / 1000) % 1_000_000 })
      .select(ITEM_COLUMNS)
      .single();
    if (error) throw error;
    return NextResponse.json(toMenuItem(data), { status: 201 });
  } catch (err) {
    return serverError("POST /api/menu/items", err, "Could not add the item");
  }
}
