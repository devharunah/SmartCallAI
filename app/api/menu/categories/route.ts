import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner, serverError } from "@/lib/restaurants/api";

const Body = z.object({ name: z.string().trim().min(1).max(60), nameLg: z.string().trim().max(60).nullable().optional() });

export async function POST(request: Request) {
  const owner = await requireOwner();
  if (owner.error) return owner.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give the section a name" }, { status: 400 });
  const { data, error } = await owner.db
    .from("menu_categories")
    .insert({
      restaurant_id: owner.restaurant.id,
      name: parsed.data.name,
      name_lg: parsed.data.nameLg || null,
      position: Math.floor(Date.now() / 1000) % 1_000_000,
    })
    .select("id, name, name_lg, position")
    .single();
  if (error) return serverError("POST /api/menu/categories", error, "Could not add the section");
  return NextResponse.json({ id: data.id, name: data.name, nameLg: data.name_lg, position: data.position }, { status: 201 });
}
