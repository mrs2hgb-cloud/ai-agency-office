import { absoluteAppUrl, isLocalUrl } from "@/lib/app-url";
import { approvalLinkToken } from "@/lib/auth/approvals-auth";
import type { ApprovalRequest } from "@/lib/agents/shared";
import { modeFor, requestJson } from "../core/http";
import { normalizeIsraeliPhone } from "../core/locale";

/** Absolute link that opens the office with this approval, signed so it works on a phone */
export function approvalLink(id: string): string | null {
  const token = approvalLinkToken(id);
  return absoluteAppUrl("/", token ? { approval: id, t: token } : { approval: id });
}

/**
 * Pings the agency owner on WhatsApp when an approval is waiting. Best effort:
 * a failed notification never blocks the run, since the request also shows
 * up in the office UI.
 */
export async function notifyApprovalRequest(request: ApprovalRequest): Promise<void> {
  const url = process.env.LYCHEE_WEBHOOK_URL;
  const phone = normalizeIsraeliPhone(process.env.APPROVAL_NOTIFY_PHONE ?? "");
  if (!phone || modeFor(url, "write") === "demo") return;

  const link = approvalLink(request.id);
  if (!link) {
    console.warn("[approvals] APP_BASE_URL is not a valid absolute URL; the alert is sent without a link");
  } else if (process.env.NODE_ENV === "production" && isLocalUrl(link)) {
    console.warn(`[approvals] APP_BASE_URL points to a local address (${new URL(link).host}); phones can't open it`);
  }

  const apiKey = process.env.LYCHEE_API_KEY;
  try {
    await requestJson(url!, {
      body: {
        message_type: "approval_request",
        messages: [
          {
            phone,
            name: "בעל הסוכנות",
            text: `✋ בקשת אישור מהסוכנים:\n${request.summary}${link ? `\n\nלאישור או דחייה: ${link}` : ""}`,
          },
        ],
      },
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("[approvals] WhatsApp notification failed", error);
  }
}
