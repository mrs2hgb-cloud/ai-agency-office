import { connection } from "next/server";
import { listPendingApprovals } from "@/lib/tools";

/** Approvals still waiting for an answer (e.g. after a page reload) */
export async function GET() {
  await connection(); // in-memory state: never prerender
  return Response.json({ approvals: listPendingApprovals() });
}
