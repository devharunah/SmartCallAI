import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner, serverError } from "@/lib/restaurants/api";
import { WorkflowGraph } from "@/lib/workflow/schema";
import { saveWorkflow } from "@/lib/workflow/store";

const Body = z.object({ graph: z.unknown(), version: z.number().int().min(0) });

/** Save the owner's workflow. Invalid graphs come back as a list of plain-language problems. */
export async function PUT(request: Request) {
  const owner = await requireOwner();
  if (owner.error) return owner.error;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const graph = WorkflowGraph.safeParse(body.data.graph);
  if (!graph.success) {
    const problems = [...new Set(graph.error.issues.map((i) => i.message))];
    return NextResponse.json({ error: "The workflow has problems", problems }, { status: 422 });
  }
  try {
    const result = await saveWorkflow(owner.db, owner.restaurant.id, graph.data, body.data.version);
    if (!result.ok) {
      return NextResponse.json({ error: "Someone else saved this workflow since you opened it. Reload to see their changes." }, { status: 409 });
    }
    return NextResponse.json({ version: result.version });
  } catch (err) {
    return serverError("PUT /api/workflow", err, "Could not save the workflow");
  }
}

/** Reset to the default workflow. */
export async function DELETE() {
  const owner = await requireOwner();
  if (owner.error) return owner.error;
  const { error } = await owner.db.from("workflows").delete().eq("restaurant_id", owner.restaurant.id);
  if (error) return serverError("DELETE /api/workflow", error, "Could not reset the workflow");
  return new NextResponse(null, { status: 204 });
}
