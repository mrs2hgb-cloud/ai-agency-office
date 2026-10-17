import { resolveApproval } from "@/lib/tools";

/** Approve or reject a pending action: body { approved: boolean, note?: string } */
export async function POST(request: Request, ctx: RouteContext<"/api/approvals/[id]">) {
  const { id } = await ctx.params;
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("approved" in body) || typeof body.approved !== "boolean") {
    return Response.json({ error: "approved (boolean) is required" }, { status: 400 });
  }
  const note = "note" in body && typeof body.note === "string" ? body.note.slice(0, 500) : undefined;

  if (!resolveApproval(id, { approved: body.approved, note })) {
    return Response.json({ error: "No pending approval with this id (it may have expired)" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
