import { supabase } from "./supabase";
import type { Call, Category } from "./types";

interface CallRow {
  id: string;
  transcript: string;
  category: string;
  summary: string;
  confidence: number;
  reason: string;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  routing_time_ms: number | null;
  created_at: string;
}

function toCall(row: CallRow): Call {
  return {
    id: row.id,
    transcript: row.transcript,
    category: row.category as Category,
    summary: row.summary,
    confidence: Number(row.confidence),
    reason: row.reason,
    assignedAgentId: row.assigned_agent_id,
    assignedAgentName: row.assigned_agent_name,
    routingTimeMs: row.routing_time_ms,
    createdAt: row.created_at,
  };
}

export async function recordCall(input: {
  transcript: string;
  category: Category;
  summary: string;
  confidence: number;
  reason: string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  routingTimeMs: number;
}): Promise<Call> {
  const { data, error } = await supabase
    .from("calls")
    .insert({
      transcript: input.transcript,
      category: input.category,
      summary: input.summary,
      confidence: input.confidence,
      reason: input.reason,
      assigned_agent_id: input.assignedAgentId,
      assigned_agent_name: input.assignedAgentName,
      routing_time_ms: input.routingTimeMs,
    })
    .select()
    .single();

  if (error) throw error;
  return toCall(data as CallRow);
}

export interface Analytics {
  totalCalls: number;
  callsToday: number;
  callsByDepartment: { category: string; count: number }[];
  activeAgents: number;
  busyAgents: number;
  avgConfidence: number;
  avgRoutingTimeMs: number;
  mostCommonCategory: string | null;
  recentCalls: Call[];
}

export async function getAnalytics(): Promise<Analytics> {
  const [{ data: callRows, error: callsError }, { data: agentRows, error: agentsError }] =
    await Promise.all([
      supabase.from("calls").select("*").order("created_at", { ascending: false }),
      supabase.from("agents").select("available"),
    ]);

  if (callsError) throw callsError;
  if (agentsError) throw agentsError;

  const calls = (callRows as CallRow[]).map(toCall);
  const agents = agentRows as { available: boolean }[];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const callsToday = calls.filter((c) => new Date(c.createdAt) >= todayStart).length;

  const byDepartment = new Map<string, number>();
  for (const c of calls) {
    byDepartment.set(c.category, (byDepartment.get(c.category) ?? 0) + 1);
  }
  const callsByDepartment = Array.from(byDepartment.entries()).map(([category, count]) => ({
    category,
    count,
  }));

  const mostCommonCategory =
    callsByDepartment.length > 0
      ? callsByDepartment.reduce((a, b) => (b.count > a.count ? b : a)).category
      : null;

  const avgConfidence =
    calls.length > 0
      ? Math.round(calls.reduce((sum, c) => sum + c.confidence, 0) / calls.length)
      : 0;

  const avgRoutingTimeMs =
    calls.length > 0
      ? Math.round(
          calls.reduce((sum, c) => sum + (c.routingTimeMs ?? 0), 0) / calls.length
        )
      : 0;

  return {
    totalCalls: calls.length,
    callsToday,
    callsByDepartment,
    activeAgents: agents.filter((a) => a.available).length,
    busyAgents: agents.filter((a) => !a.available).length,
    avgConfidence,
    avgRoutingTimeMs,
    mostCommonCategory,
    recentCalls: calls.slice(0, 10),
  };
}
