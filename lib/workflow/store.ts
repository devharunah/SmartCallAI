import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_WORKFLOW } from "./default";
import { WorkflowGraph } from "./schema";

export interface StoredWorkflow {
  graph: WorkflowGraph;
  version: number;
  isDefault: boolean;
}

/** The restaurant's saved graph, or the default one if it never saved (or the saved one no longer validates). */
export async function getWorkflow(db: SupabaseClient, restaurantId: string): Promise<StoredWorkflow> {
  const { data, error } = await db.from("workflows").select("graph, version").eq("restaurant_id", restaurantId).maybeSingle();
  if (error) throw error;
  if (!data) return { graph: DEFAULT_WORKFLOW, version: 0, isDefault: true };
  const parsed = WorkflowGraph.safeParse(data.graph);
  if (!parsed.success) {
    console.error("[workflow] saved graph is invalid, using the default", restaurantId, parsed.error.issues);
    return { graph: DEFAULT_WORKFLOW, version: data.version, isDefault: true };
  }
  return { graph: parsed.data, version: data.version, isDefault: false };
}

/** Save a validated graph, bumping the version. `expectedVersion` guards against two editors overwriting each other. */
export async function saveWorkflow(
  db: SupabaseClient,
  restaurantId: string,
  graph: WorkflowGraph,
  expectedVersion: number
): Promise<{ ok: true; version: number } | { ok: false; conflict: true }> {
  const version = expectedVersion + 1;
  if (expectedVersion === 0) {
    const { error } = await db.from("workflows").insert({ restaurant_id: restaurantId, graph, version });
    if (error?.code === "23505") return { ok: false, conflict: true };
    if (error) throw error;
    return { ok: true, version };
  }
  const { data, error } = await db
    .from("workflows")
    .update({ graph, version, updated_at: new Date().toISOString() })
    .eq("restaurant_id", restaurantId)
    .eq("version", expectedVersion)
    .select("version");
  if (error) throw error;
  if (!data?.length) return { ok: false, conflict: true };
  return { ok: true, version };
}
