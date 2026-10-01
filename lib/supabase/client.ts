import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

export function createClient() {
  const { url, publishableKey } = requireSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}

/**
 * Browser client whose Realtime socket carries the signed-in user's token.
 * With the cookie-based SSR client the socket otherwise connects as anon, so
 * RLS hides every postgres_changes row and subscriptions stay silent.
 */
export async function createRealtimeClient() {
  const client = createClient();
  const { data } = await client.auth.getSession();
  if (data.session) await client.realtime.setAuth(data.session.access_token);
  return client;
}
