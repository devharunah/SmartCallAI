"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import {
  Bot,
  CheckCircle2,
  CircleStop,
  ClipboardCheck,
  Hand,
  LayoutGrid,
  Play,
  Plus,
  RotateCcw,
  Save,
  ScrollText,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXPR_VARIABLES } from "@/lib/workflow/expr";
import {
  AGENT_TOOLS,
  validateGraph,
  type AgentToolName,
  type EdgeKind,
  type NodeType,
  type WorkflowEdge,
  type WorkflowGraph,
  type WorkflowNode,
} from "@/lib/workflow/schema";
import { cn } from "@/lib/utils";

// The owner's view of their bot, drawn like ElevenLabs' agent workflows:
// stages as boxes, arrows labelled with when the bot moves on. Click a box or
// arrow to edit it; Save validates the graph on the server before it goes live.

type StageData = { node: WorkflowNode; problem: boolean };
type StageNode = Node<StageData, "stage">;
type FlowEdge = Edge<{ edge: WorkflowEdge }>;

const NODE_W = 240;
const NODE_H = 96;

const TYPE_INFO: Record<NodeType, { label: string; icon: LucideIcon; blurb: string }> = {
  start: { label: "Start", icon: Play, blurb: "Where every new chat begins." },
  agent: { label: "AI stage", icon: Bot, blurb: "The AI talks to the customer with these instructions and tools." },
  send_menu: { label: "Send menu", icon: ScrollText, blurb: "Sends your menu pictures, then a short message." },
  confirm: { label: "Confirm order", icon: ClipboardCheck, blurb: "Shows the order and total from your menu prices, with Yes / Change buttons." },
  place_order: { label: "Place order", icon: CheckCircle2, blurb: "Puts the order on your board and sends the customer its reference." },
  handoff: { label: "Talk to a person", icon: Hand, blurb: "Pauses the AI and flags the chat for your staff in the Inbox." },
  end: { label: "End", icon: CircleStop, blurb: "Ends the conversation; the next message starts again from Start." },
};

const TOOL_LABELS: Record<AgentToolName, string> = {
  searchMenu: "Look up menu items",
  addToCart: "Add to order",
  removeFromCart: "Remove from order",
  viewCart: "See the order",
  setFulfillment: "Set pickup / delivery",
  checkHours: "Check opening hours",
  sendMenu: "Send the menu picture",
};

const KIND_LABELS: Record<EdgeKind, string> = {
  llm: "When (AI decides)",
  expr: "When (rule)",
  always: "Always",
  success: "Yes / done",
  failure: "Change / failed",
};

function kindsFor(source: NodeType | undefined): EdgeKind[] {
  switch (source) {
    case "agent":
      return ["llm", "expr", "always"];
    case "confirm":
    case "place_order":
      return ["success", "failure"];
    case "start":
      return ["expr", "always"];
    default:
      return ["always"];
  }
}

function summary(n: WorkflowNode) {
  if (n.type === "agent") return n.data.prompt?.split("\n")[0] ?? "";
  if (n.data.say?.eng) return `“${n.data.say.eng}”`;
  return TYPE_INFO[n.type].blurb;
}

function StageNodeView({ data, selected }: NodeProps<StageNode>) {
  const n = data.node;
  const info = TYPE_INFO[n.type];
  const Icon = info.icon;
  return (
    <div
      className={cn(
        "w-[240px] rounded-xl border bg-card px-3 py-2.5 text-left shadow-xs transition-shadow",
        selected && "ring-2 ring-ring",
        data.problem && !selected && "border-destructive/60",
        n.type === "start" && "bg-primary text-primary-foreground"
      )}
    >
      {n.type !== "start" && <Handle type="target" position={Position.Top} className="!size-2.5 !border-2 !border-background !bg-muted-foreground" />}
      <div className="flex items-center gap-2">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", n.type === "start" ? "bg-primary-foreground/15" : n.type === "agent" ? "bg-accent/20" : "bg-muted")}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{n.title}</p>
          <p className={cn("text-[11px]", n.type === "start" ? "text-primary-foreground/70" : "text-muted-foreground")}>{info.label}</p>
        </div>
      </div>
      {n.type !== "start" && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{summary(n)}</p>}
      {n.type !== "handoff" && n.type !== "end" && (
        <Handle type="source" position={Position.Bottom} className="!size-2.5 !border-2 !border-background !bg-foreground" />
      )}
    </div>
  );
}

const nodeTypes = { stage: StageNodeView };

function edgeLabel(e: WorkflowEdge) {
  if (e.kind === "always") return "";
  if (e.kind === "success") return e.condition || "Yes";
  if (e.kind === "failure") return e.condition || "Change";
  return e.condition || "(needs a condition)";
}

function toFlowEdge(e: WorkflowEdge): FlowEdge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    label: edgeLabel(e),
    data: { edge: e },
    animated: e.kind === "llm",
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    labelStyle: { fontSize: 11 },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 6,
    style: e.kind === "failure" ? { strokeDasharray: "5 4" } : undefined,
  };
}

function layout(nodes: StageNode[], edges: FlowEdge[]): StageNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 90 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: Math.round(p.x - NODE_W / 2), y: Math.round(p.y - NODE_H / 2) } };
  });
}

function toFlow(graph: WorkflowGraph) {
  const edges = graph.edges.map(toFlowEdge);
  const nodes: StageNode[] = graph.nodes.map((n) => ({
    id: n.id,
    type: "stage",
    position: n.position ?? { x: 0, y: 0 },
    data: { node: n, problem: false },
    deletable: n.type !== "start",
  }));
  return { nodes: graph.nodes.some((n) => !n.position) ? layout(nodes, edges) : nodes, edges };
}

function fromFlow(nodes: StageNode[], edges: FlowEdge[]): WorkflowGraph {
  return {
    nodes: nodes.map((n) => ({ ...n.data.node, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) } })),
    edges: edges.map((e) => ({ ...e.data!.edge, source: e.source, target: e.target })),
  };
}

const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 7)}`;

export function WorkflowEditor({
  initialGraph,
  initialVersion,
  isDefault,
  defaultGraph,
}: {
  initialGraph: WorkflowGraph;
  initialVersion: number;
  isDefault: boolean;
  defaultGraph: WorkflowGraph;
}) {
  const initial = useMemo(() => toFlow(initialGraph), [initialGraph]);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<StageNode>(initial.nodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<FlowEdge>(initial.edges);
  const [version, setVersion] = useState(initialVersion);
  const [selected, setSelected] = useState<{ kind: "node" | "edge"; id: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string; problems?: string[] } | null>(
    isDefault ? { tone: "ok", text: "You're using the default workflow. Edit anything and save to make it yours." } : null
  );

  const problems = useMemo(() => validateGraph(fromFlow(nodes, edges)), [nodes, edges]);

  const onNodesChange = useCallback(
    (changes: NodeChange<StageNode>[]) => {
      if (changes.some((c) => c.type === "position" || c.type === "remove" || c.type === "add")) setDirty(true);
      onNodesChangeBase(changes);
    },
    [onNodesChangeBase]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) => {
      if (changes.some((c) => c.type === "remove" || c.type === "add")) setDirty(true);
      onEdgesChangeBase(changes);
    },
    [onEdgesChangeBase]
  );

  const onConnect = useCallback(
    (c: Connection) => {
      const source = nodes.find((n) => n.id === c.source)?.data.node;
      const kinds = kindsFor(source?.type);
      let kind = kinds[0];
      if (source?.type === "confirm" || source?.type === "place_order") {
        kind = edges.some((e) => e.source === c.source && e.data?.edge.kind === "success") ? "failure" : "success";
      }
      const edge: WorkflowEdge = { id: newId("e"), source: c.source, target: c.target, kind, ...(kind === "llm" && { condition: "" }) };
      setEdges((list) => [...list, toFlowEdge(edge)]);
      setSelected({ kind: "edge", id: edge.id });
      setDirty(true);
    },
    [nodes, edges, setEdges]
  );

  const selectedNode = selected?.kind === "node" ? nodes.find((n) => n.id === selected.id)?.data.node : undefined;
  const selectedEdge = selected?.kind === "edge" ? edges.find((e) => e.id === selected.id) : undefined;

  function updateNode(id: string, patch: (n: WorkflowNode) => WorkflowNode) {
    setNodes((list) => list.map((n) => (n.id === id ? { ...n, data: { ...n.data, node: patch(n.data.node) } } : n)));
    setDirty(true);
  }

  function updateEdge(id: string, patch: Partial<WorkflowEdge>) {
    setEdges((list) =>
      list.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e.data!.edge, ...patch };
        return { ...toFlowEdge(next), selected: e.selected };
      })
    );
    setDirty(true);
  }

  function addNode(type: NodeType) {
    const base = TYPE_INFO[type];
    const node: WorkflowNode = {
      id: newId(type),
      type,
      title: type === "agent" ? "New AI stage" : base.label,
      data: type === "agent" ? { prompt: "", tools: ["searchMenu"] } : {},
    };
    const maxY = Math.max(0, ...nodes.map((n) => n.position.y));
    setNodes((list) => [
      ...list.map((n) => ({ ...n, selected: false })),
      { id: node.id, type: "stage", position: { x: 40, y: maxY + NODE_H + 60 }, data: { node, problem: false }, selected: true },
    ]);
    setSelected({ kind: "node", id: node.id });
    setDirty(true);
  }

  function remove() {
    if (selectedNode && selectedNode.type !== "start") {
      setNodes((list) => list.filter((n) => n.id !== selectedNode.id));
      setEdges((list) => list.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    } else if (selectedEdge) {
      setEdges((list) => list.filter((e) => e.id !== selectedEdge.id));
    }
    setSelected(null);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/workflow", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph: fromFlow(nodes, edges), version }),
      });
      const data = (await res.json().catch(() => ({}))) as { version?: number; error?: string; problems?: string[] };
      if (!res.ok) {
        setStatus({ tone: "error", text: data.error ?? "Couldn't save", problems: data.problems });
        return;
      }
      setVersion(data.version!);
      setDirty(false);
      setStatus({ tone: "ok", text: "Saved. New messages use this workflow now." });
    } catch {
      setStatus({ tone: "error", text: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm("Replace your workflow with the default one? Your changes will be lost.")) return;
    const res = await fetch("/api/workflow", { method: "DELETE" });
    if (!res.ok) {
      setStatus({ tone: "error", text: "Couldn't reset the workflow" });
      return;
    }
    const fresh = toFlow(defaultGraph);
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setVersion(0);
    setSelected(null);
    setDirty(false);
    setStatus({ tone: "ok", text: "Back to the default workflow." });
  }

  function tidy() {
    setNodes((list) => layout(list, edges));
    setDirty(true);
  }

  const displayNodes = useMemo(() => {
    const flagged = new Set(nodes.filter((n) => problems.some((p) => p.includes(`"${n.data.node.title}"`))).map((n) => n.id));
    return nodes.map((n) => (n.data.problem === flagged.has(n.id) ? n : { ...n, data: { ...n.data, problem: flagged.has(n.id) } }));
  }, [nodes, problems]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void save()} disabled={saving || (!dirty && !isDefault)}>
          <Save className="size-4" /> {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" onClick={tidy}>
          <LayoutGrid className="size-4" /> Tidy up
        </Button>
        <Button variant="ghost" onClick={() => void reset()}>
          <RotateCcw className="size-4" /> Reset to default
        </Button>
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {dirty ? "Unsaved changes" : version > 0 ? `Version ${version}` : ""}
          {problems.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {problems.length} {problems.length === 1 ? "problem" : "problems"}
            </Badge>
          )}
        </span>
      </div>

      {status && (
        <div role={status.tone === "error" ? "alert" : "status"} className={cn("rounded-lg border px-3 py-2 text-sm", status.tone === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "bg-muted")}>
          {status.text}
          {status.problems && (
            <ul className="mt-1 list-disc pl-5">
              {status.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="h-[680px] overflow-hidden rounded-xl border bg-muted/30">
          <ReactFlow<StageNode, FlowEdge>
            nodes={displayNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelected({ kind: "node", id: n.id })}
            onEdgeClick={(_, e) => setSelected({ kind: "edge", id: e.id })}
            onPaneClick={() => setSelected(null)}
            onBeforeDelete={async ({ nodes: n, edges: e }) => ({ nodes: n.filter((x) => x.data.node.type !== "start"), edges: e })}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.3}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <aside className="rounded-xl border p-4 text-sm" aria-label="Edit">
          {selectedNode ? (
            <NodePanel node={selectedNode} onChange={(p) => updateNode(selectedNode.id, p)} onDelete={remove} />
          ) : selectedEdge ? (
            <EdgePanel
              edge={selectedEdge.data!.edge}
              sourceType={nodes.find((n) => n.id === selectedEdge.source)?.data.node.type}
              sourceTitle={nodes.find((n) => n.id === selectedEdge.source)?.data.node.title ?? ""}
              targetTitle={nodes.find((n) => n.id === selectedEdge.target)?.data.node.title ?? ""}
              onChange={(p) => updateEdge(selectedEdge.id, p)}
              onDelete={remove}
            />
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">How it works</h3>
                <p className="mt-1 text-pretty text-muted-foreground">
                  Each box is a step. Arrows say when the bot moves on. Click one to edit it, or drag from a box&apos;s bottom dot to another box to connect them.
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Add a step</h3>
                <div className="mt-2 grid gap-1.5">
                  {(["agent", "send_menu", "confirm", "place_order", "handoff", "end"] as const).map((t) => {
                    const Icon = TYPE_INFO[t].icon;
                    return (
                      <Button key={t} variant="outline" size="sm" className="justify-start" onClick={() => addNode(t)}>
                        <Plus className="size-3.5" /> <Icon className="size-3.5" /> {TYPE_INFO[t].label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              {problems.length > 0 && (
                <div>
                  <h3 className="font-semibold text-destructive">Fix before saving</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SayFields({ node, onChange }: { node: WorkflowNode; onChange: (p: (n: WorkflowNode) => WorkflowNode) => void }) {
  return (
    <>
      {(["eng", "lug"] as const).map((lang) => (
        <div key={lang} className="space-y-1.5">
          <Label htmlFor={`say-${lang}`}>{lang === "eng" ? "Message (English)" : "Message (Luganda)"}</Label>
          <textarea
            id={`say-${lang}`}
            rows={2}
            maxLength={1000}
            value={node.data.say?.[lang] ?? ""}
            onChange={(e) => onChange((n) => ({ ...n, data: { ...n.data, say: { ...n.data.say, [lang]: e.target.value || undefined } } }))}
            className="w-full rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      ))}
    </>
  );
}

function NodePanel({ node, onChange, onDelete }: { node: WorkflowNode; onChange: (p: (n: WorkflowNode) => WorkflowNode) => void; onDelete: () => void }) {
  const info = TYPE_INFO[node.type];
  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">{info.label}</p>
        <p className="mt-1 text-pretty text-muted-foreground">{info.blurb}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="node-title">Name</Label>
        <Input id="node-title" value={node.title} maxLength={60} onChange={(e) => onChange((n) => ({ ...n, title: e.target.value }))} />
      </div>
      {node.type === "agent" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="node-prompt">Instructions for the AI</Label>
            <textarea
              id="node-prompt"
              rows={8}
              maxLength={4000}
              value={node.data.prompt ?? ""}
              onChange={(e) => onChange((n) => ({ ...n, data: { ...n.data, prompt: e.target.value } }))}
              className="w-full rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">It always stays on your restaurant&apos;s topics, never invents prices, and replies in the customer&apos;s language.</p>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">What it can do</legend>
            {AGENT_TOOLS.map((t) => (
              <label key={t} className="flex min-h-8 items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-foreground"
                  checked={node.data.tools?.includes(t) ?? false}
                  onChange={(e) =>
                    onChange((n) => ({
                      ...n,
                      data: { ...n.data, tools: e.target.checked ? [...(n.data.tools ?? []), t] : (n.data.tools ?? []).filter((x) => x !== t) },
                    }))
                  }
                />
                {TOOL_LABELS[t]}
              </label>
            ))}
            <p className="text-xs text-muted-foreground">Handing the chat to a person is always available.</p>
          </fieldset>
          <details>
            <summary className="cursor-pointer text-sm font-medium">Opening message (optional)</summary>
            <p className="mt-1 mb-2 text-xs text-muted-foreground">Sent when the bot arrives here without a customer message to answer.</p>
            <div className="space-y-3">
              <SayFields node={node} onChange={onChange} />
            </div>
          </details>
        </>
      )}
      {(node.type === "send_menu" || node.type === "handoff" || node.type === "end") && <SayFields node={node} onChange={onChange} />}
      {node.type !== "start" && (
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="size-3.5" /> Delete step
        </Button>
      )}
    </div>
  );
}

function EdgePanel({
  edge,
  sourceType,
  sourceTitle,
  targetTitle,
  onChange,
  onDelete,
}: {
  edge: WorkflowEdge;
  sourceType: NodeType | undefined;
  sourceTitle: string;
  targetTitle: string;
  onChange: (p: Partial<WorkflowEdge>) => void;
  onDelete: () => void;
}) {
  const kinds = kindsFor(sourceType);
  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">Connection</p>
        <p className="mt-1">
          <span className="font-medium">{sourceTitle}</span> → <span className="font-medium">{targetTitle}</span>
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edge-kind">Moves on</Label>
        <select
          id="edge-kind"
          value={kinds.includes(edge.kind) ? edge.kind : kinds[0]}
          onChange={(e) => onChange({ kind: e.target.value as EdgeKind })}
          className="h-9 w-full rounded-md border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {kinds.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      {(edge.kind === "llm" || edge.kind === "expr") && (
        <div className="space-y-1.5">
          <Label htmlFor="edge-cond">{edge.kind === "llm" ? "When this is true" : "Rule"}</Label>
          {edge.kind === "llm" ? (
            <textarea
              id="edge-cond"
              rows={3}
              maxLength={300}
              value={edge.condition ?? ""}
              placeholder="e.g. The customer asks about delivery"
              onChange={(e) => onChange({ condition: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ) : (
            <Input id="edge-cond" value={edge.condition ?? ""} placeholder="cart.count > 0" className="font-mono" onChange={(e) => onChange({ condition: e.target.value })} />
          )}
          <p className="text-xs text-pretty text-muted-foreground">
            {edge.kind === "llm"
              ? "Write it in plain words. The AI checks it on every customer message."
              : `Checked in code. Use ${EXPR_VARIABLES.join(", ")} with ==, !=, >, <, joined by &&.`}
          </p>
        </div>
      )}
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
        <Trash2 className="size-3.5" /> Delete connection
      </Button>
    </div>
  );
}
