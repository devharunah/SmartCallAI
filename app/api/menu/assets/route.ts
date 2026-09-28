import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { supabase as serviceDb } from "@/lib/supabase";
import { requireOwner, serverError } from "@/lib/restaurants/api";

// Menu photos the bot sends instead of the generated menu image. WhatsApp
// accepts JPEG/PNG up to 5 MB. Ownership is checked with the user's session;
// the upload itself uses the service role (the bucket has no storage policies).

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const owner = await requireOwner();
  if (owner.error) return owner.error;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !TYPES[file.type]) return NextResponse.json({ error: "Upload a JPEG or PNG photo" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "The photo must be under 5 MB (WhatsApp's limit)" }, { status: 400 });

  try {
    const path = `${owner.restaurant.id}/${randomUUID()}.${TYPES[file.type]}`;
    const { error: uploadError } = await serviceDb.storage.from("menus").upload(path, file, { contentType: file.type });
    if (uploadError) throw uploadError;
    const { data, error } = await owner.db
      .from("menu_assets")
      .insert({ restaurant_id: owner.restaurant.id, storage_path: path, position: Math.floor(Date.now() / 1000) % 1_000_000 })
      .select("id")
      .single();
    if (error) {
      await serviceDb.storage.from("menus").remove([path]);
      throw error;
    }
    const url = serviceDb.storage.from("menus").getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ id: data.id, url }, { status: 201 });
  } catch (err) {
    return serverError("POST /api/menu/assets", err, "Could not upload the photo");
  }
}
