import type { NextRequest } from "next/server";
import { authorizeApprovals } from "@/lib/auth/approvals-auth";
import { getPendingApproval, resolveApproval } from "@/lib/tools";

/** One pending approval; the signed `t` link token is accepted for this id */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/approvals/[id]">) {
  const { id } = await ctx.params;
  const denied = authorizeApprovals(request, { approvalId: id, linkToken: request.nextUrl.searchParams.get("t") });
  if (denied) return denied;

  const approval = getPendingApproval(id);
  if (!approval) return Response.json({ error: "No pending approval with this id (it may have expired)" }, { status: 404 });
  return Response.json({ approval });
}

/** Approve or reject a pending action: body { approved: boolean, note?: string, token?: string } */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/approvals/[id]">) {
  const { id } = await ctx.params;
  const body: unknown = await request.json().catch(() => null);
  const field = (name: string) => (body && typeof body === "object" && name in body ? (body as Record<string, unknown>)[name] : undefined);

  const token = field("token");
  const denied = authorizeApprovals(request, { approvalId: id, linkToken: typeof token === "string" ? token : null });
  if (denied) return denied;

  const approved = field("approved");
  if (typeof approved !== "boolean") {
    return Response.json({ error: "approved (boolean) is required" }, { status: 400 });
  }
  const note = field("note");

  if (!resolveApproval(id, { approved, note: typeof note === "string" ? note.slice(0, 500) : undefined })) {
    return Response.json({ error: "No pending approval with this id (it may have expired)" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
