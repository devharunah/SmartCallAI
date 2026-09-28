import { cache } from "react";
import { getClaims } from "../auth";
import { createClient } from "../supabase/server";
import { getRestaurantBy } from "./data";
import type { Restaurant } from "./types";

/**
 * The signed-in owner's restaurant, read through their own session so RLS
 * applies. One restaurant per owner for now. Cached per request.
 */
export const getMyRestaurant = cache(async (): Promise<Restaurant | null> => {
  const claims = await getClaims();
  if (!claims) return null;
  const db = await createClient();
  return getRestaurantBy(db, "owner_id", claims.sub);
});
