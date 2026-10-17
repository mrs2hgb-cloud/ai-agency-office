import type { AgentId } from "@/components/virtual-office/types";
import type { ToolCallRecord } from "@/lib/agents/shared";
import { agentName } from "./agents";
import { postToMake } from "./http";

/**
 * Appends every tool call to the Google Sheets activity log, so the team can
 * follow what the agents did in real time. On whenever SHEETS_WEBHOOK_URL is
 * set; SHEETS_AUDIT_LOG=false turns it off. Best effort: a failed write is
 * logged on the server and never affects the agent.
 */
export function auditToolCall(agent: AgentId, call: ToolCallRecord): void {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url || process.env.SHEETS_AUDIT_LOG === "false" || call.tool === "sheets_logger") return;

  const payload = {
    action: "log_event",
    message: call.label,
    tool: call.tool,
    outcome: call.outcome,
    mode: call.mode ?? "",
    logged_by: agentName(agent),
    logged_at: new Date().toISOString(),
  };
  postToMake(url, payload, AbortSignal.timeout(10_000)).catch((error: unknown) =>
    console.error("[audit] failed to log tool call to Sheets", error),
  );
}
