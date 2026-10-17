import type { ApprovalRequest } from "@/lib/agents/shared";
import { modeFor, requestJson } from "../core/http";
import { normalizeIsraeliPhone } from "../core/locale";

/**
 * Pings the agency owner on WhatsApp when an approval is waiting. Best effort:
 * a failed notification never blocks the run, since the request also shows
 * up in the office UI.
 */
export async function notifyApprovalRequest(request: ApprovalRequest): Promise<void> {
  const url = process.env.LYCHEE_WEBHOOK_URL;
  const phone = normalizeIsraeliPhone(process.env.APPROVAL_NOTIFY_PHONE ?? "");
  if (!phone || modeFor(url, "write") === "demo") return;

  const link = process.env.APP_BASE_URL ? `\n\nלאישור או דחייה: ${process.env.APP_BASE_URL}/?approval=${request.id}` : "";
  const apiKey = process.env.LYCHEE_API_KEY;
  try {
    await requestJson(url!, {
      body: {
        message_type: "approval_request",
        messages: [{ phone, name: "בעל הסוכנות", text: `✋ בקשת אישור מהסוכנים:\n${request.summary}${link}` }],
      },
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("[approvals] WhatsApp notification failed", error);
  }
}
