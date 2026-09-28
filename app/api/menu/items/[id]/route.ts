import { NextResponse } from "next/server";
import { requireOwner, serverError } from "@/lib/restaurants/api";
import { toMenuItem } from "@/lib/restaurants/data";
import { ITEM_COLUMNS, ItemFields, itemRow } from "@/lib/restaurants/menu-fields";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  if (owner.error) return owner.error;
  const { id } = await params;
  const parsed = ItemFields.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid item" }, { status: 400 });
  try {
    const { data, error } = await owner.db.from("menu_items").update(itemRow(parsed.data)).eq("id", id).select(ITEM_COLUMNS).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    return NextResponse.json(toMenuItem(data));
  } catch (err) {
    return serverError("PATCH /api/menu/items", err, "Could not save the item");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  if (owner.error) return owner.error;
  const { id } = await params;
  const { error } = await owner.db.from("menu_items").delete().eq("id", id);
  if (error) return serverError("DELETE /api/menu/items", error, "Could not delete the item");
  return new NextResponse(null, { status: 204 });
}
