import { z } from "zod";
import { parseExpr } from "./expr";

// A restaurant's bot as a graph, the way ElevenLabs Agents does it: nodes are
// stages (an agent with its own instructions and tools, or a fixed action) and
// edges say when to move on, either in plain language judged by the LLM or as
// a small expression checked in code.

export const NODE_TYPES = ["start", "agent", "send_menu", "confirm", "place_order", "handoff", "end"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const EDGE_KINDS = ["llm", "expr", "always", "success", "failure"] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

/** Tools an agent stage may be given. Handoff to a human is always available. */
export const AGENT_TOOLS = ["searchMenu", "addToCart", "removeFromCart", "viewCart", "setFulfillment", "checkHours", "sendMenu"] as const;
export type AgentToolName = (typeof AGENT_TOOLS)[number];

const Say = z.object({
  eng: z.string().max(1000).optional(),
  lug: z.string().max(1000).optional(),
});
export type SayText = z.infer<typeof Say>;

export const WorkflowNode = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/i),
  type: z.enum(NODE_TYPES),
  title: z.string().min(1).max(60),
  data: z
    .object({
      prompt: z.string().max(4000).optional(),
      tools: z.array(z.enum(AGENT_TOOLS)).optional(),
      say: Say.optional(),
    })
    .default({}),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});
export type WorkflowNode = z.infer<typeof WorkflowNode>;

export const WorkflowEdge = z.object({
  id: z.string().min(1).max(64),
  source: z.string(),
  target: z.string(),
  kind: z.enum(EDGE_KINDS),
  condition: z.string().max(300).optional(),
});
export type WorkflowEdge = z.infer<typeof WorkflowEdge>;

export const WorkflowGraph = z
  .object({
    nodes: z.array(WorkflowNode).min(2).max(40),
    edges: z.array(WorkflowEdge).max(120),
  })
  .superRefine((graph, ctx) => {
    for (const problem of validateGraph(graph)) ctx.addIssue({ code: "custom", message: problem });
  });
export type WorkflowGraph = z.infer<typeof WorkflowGraph>;

/** Structural rules the runtime relies on. Returns human-readable problems. */
export function validateGraph(graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }): string[] {
  const problems: string[] = [];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  if (byId.size !== graph.nodes.length) problems.push("Two nodes share the same id.");

  const starts = graph.nodes.filter((n) => n.type === "start");
  if (starts.length !== 1) problems.push("There must be exactly one Start node.");

  for (const e of graph.edges) {
    const source = byId.get(e.source);
    const target = byId.get(e.target);
    if (!source || !target) {
      problems.push(`The connection "${e.condition ?? e.id}" points to a node that doesn't exist.`);
      continue;
    }
    if ((e.kind === "llm" || e.kind === "expr") && !e.condition?.trim()) {
      problems.push(`The connection from "${source.title}" to "${target.title}" needs a condition.`);
    }
    if (e.kind === "expr" && e.condition) {
      try {
        parseExpr(e.condition);
      } catch (err) {
        problems.push(`"${e.condition}" isn't a valid check: ${(err as Error).message}`);
      }
    }
    if (e.kind === "llm" && source.type !== "agent") {
      problems.push(`"${source.title}" isn't an AI stage, so its connections can't use plain-language conditions.`);
    }
    if (target.type === "place_order" && source.type !== "confirm") {
      problems.push(`"${target.title}" can only be reached from a Confirm step, so customers always approve their order first.`);
    }
    if (target.type === "start") problems.push("Nothing can lead back into the Start node.");
  }

  // Everything must be reachable from Start.
  if (starts.length === 1) {
    const seen = new Set<string>([starts[0].id]);
    const queue = [starts[0].id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of graph.edges) {
        if (e.source === id && !seen.has(e.target)) {
          seen.add(e.target);
          queue.push(e.target);
        }
      }
    }
    for (const n of graph.nodes) {
      // Handoff is reachable from any agent stage through the built-in "talk to a person" rule.
      if (!seen.has(n.id) && n.type !== "handoff") problems.push(`"${n.title}" can't be reached from Start.`);
    }
  }

  for (const n of graph.nodes) {
    if (n.type === "agent" && !n.data.prompt?.trim()) problems.push(`"${n.title}" needs instructions.`);
    if (n.type === "confirm") {
      const out = graph.edges.filter((e) => e.source === n.id);
      if (!out.some((e) => e.kind === "success")) problems.push(`"${n.title}" needs a "yes" (success) connection.`);
      if (!out.some((e) => e.kind === "failure")) problems.push(`"${n.title}" needs a "change" (failure) connection.`);
    }
  }
  if (!graph.nodes.some((n) => n.type === "handoff")) problems.push("Keep a Handoff node so customers can always reach a person.");
  return problems;
}
