import { NextResponse } from "next/server";
import { requireOwner, serverError } from "@/lib/restaurants/api";

/** Items in a deleted section stay on the menu, under "More". */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  if (owner.error) return owner.error;
  const { id } = await params;
  const { error } = await owner.db.from("menu_categories").delete().eq("id", id);
  if (error) return serverError("DELETE /api/menu/categories", error, "Could not delete the section");
  return new NextResponse(null, { status: 204 });
}
