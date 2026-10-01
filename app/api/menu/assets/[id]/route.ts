import { NextResponse } from "next/server";
import { supabase as serviceDb } from "@/lib/supabase";
import { requireOwner, serverError } from "@/lib/restaurants/api";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  if (owner.error) return owner.error;
  const { id } = await params;
  const { data, error } = await owner.db.from("menu_assets").delete().eq("id", id).select("storage_path").maybeSingle();
  if (error) return serverError("DELETE /api/menu/assets", error, "Could not remove the photo");
  if (data) await serviceDb.storage.from("menus").remove([data.storage_path]);
  return new NextResponse(null, { status: 204 });
}
