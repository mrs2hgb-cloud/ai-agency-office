import { connection, type NextRequest } from "next/server";
import { authorizeApprovals } from "@/lib/auth/approvals-auth";
import { listPendingApprovals } from "@/lib/tools";

/** Approvals still waiting for an answer (e.g. after a page reload) */
export async function GET(request: NextRequest) {
  await connection(); // in-memory state: never prerender
  const denied = authorizeApprovals(request);
  if (denied) return denied;
  return Response.json({ approvals: listPendingApprovals() });
}
