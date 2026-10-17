import type { NextRequest } from "next/server";
import type { ApprovalRequest } from "@/lib/agents/shared";
import { authorizeRequest } from "@/lib/auth/office-auth";
import { approvalLink, approvalTimeoutMs, notifyApprovalRequest, waitForApproval } from "@/lib/tools";

/**
 * Creates a harmless approval request, to check the approval panel and the
 * WhatsApp alert without running agents. Answering it does nothing beyond
 * logging the decision. Disabled in production unless ENABLE_APPROVAL_TEST=true.
 */
export async function POST(httpRequest: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_APPROVAL_TEST !== "true") {
    return Response.json({ error: "Not available in production" }, { status: 404 });
  }
  const denied = authorizeRequest(httpRequest);
  if (denied) return denied;

  const request: ApprovalRequest = {
    id: crypto.randomUUID(),
    agent: "assistant",
    tool: "request_human_approval",
    kind: "other",
    summary: "בקשת בדיקה: אם ההודעה הזו הגיעה אליך והפאנל מופיע במסך, מנגנון האישורים מחובר. אפשר לאשר או לדחות, שום דבר לא יקרה.",
    details: { test: "true", created_at: new Date().toISOString() },
    expiresAt: new Date(Date.now() + approvalTimeoutMs()).toISOString(),
  };

  await notifyApprovalRequest(request);
  void waitForApproval(request, new AbortController().signal).then((decision) =>
    console.log(`[approvals] test request ${request.id}: ${decision.approved ? "approved" : "rejected"}`, decision.note ?? ""),
  );

  return Response.json({
    id: request.id,
    link: approvalLink(request.id),
    notified: Boolean(process.env.APPROVAL_NOTIFY_PHONE),
  });
}
