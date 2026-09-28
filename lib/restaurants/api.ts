import { NextResponse } from "next/server";
import { requireApiUser } from "../auth";
import { createClient } from "../supabase/server";
import { getRestaurantBy } from "./data";
import type { Restaurant } from "./types";

/**
 * Route-handler guard for dashboard APIs: the signed-in owner, their
 * restaurant, and a user-session client (so RLS applies to every query).
 */
export async function requireOwner() {
  const { claims, unauthorized } = await requireApiUser();
  if (unauthorized) return { error: unauthorized } as const;
  const db = await createClient();
  const restaurant: Restaurant | null = await getRestaurantBy(db, "owner_id", claims.sub);
  if (!restaurant) return { error: NextResponse.json({ error: "Set up your restaurant first" }, { status: 404 }) } as const;
  return { db, restaurant, error: null } as const;
}

export function serverError(where: string, err: unknown, message = "Something went wrong") {
  console.error(`[${where}]`, err);
  return NextResponse.json({ error: message }, { status: 500 });
}
