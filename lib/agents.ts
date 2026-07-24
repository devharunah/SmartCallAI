import { supabase } from "./supabase";
import type { Agent, Category } from "./types";

interface AgentRow {
  id: string;
  name: string;
  phone: string;
  department: string;
  categories: string[];
  available: boolean;
}

function toAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    department: row.department as Category,
    categories: row.categories as Category[],
    available: row.available,
  };
}

export async function listAgents(): Promise<Agent[]> {
  const { data, error } = await supabase.from("agents").select("*").order("name");
  if (error) throw error;
  return (data as AgentRow[]).map(toAgent);
}

export async function findAvailableAgent(category: Category): Promise<Agent | null> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .contains("categories", [category])
    .eq("available", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toAgent(data as AgentRow) : null;
}

export async function setAgentAvailability(id: string, available: boolean): Promise<Agent> {
  const { data, error } = await supabase
    .from("agents")
    .update({ available })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toAgent(data as AgentRow);
}

export interface AgentInput {
  name: string;
  phone: string;
  department: Category;
  categories: Category[];
  available: boolean;
}

export async function createAgent(input: AgentInput): Promise<Agent> {
  const { data, error } = await supabase.from("agents").insert(input).select().single();
  if (error) throw error;
  return toAgent(data as AgentRow);
}

export async function updateAgent(id: string, input: Partial<AgentInput>): Promise<Agent> {
  const { data, error } = await supabase
    .from("agents")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toAgent(data as AgentRow);
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabase.from("agents").delete().eq("id", id);
  if (error) throw error;
}
