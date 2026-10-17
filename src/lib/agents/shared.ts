/**
 * Types shared by the campaign API route (server) and the UI (client).
 * Keep this file free of runtime dependencies so both sides can import it.
 */
import type { AgentId, AgentStatus } from "@/components/virtual-office/types";

export const TEAM_IDS = [
  "creative",
  "campaigner",
  "copywriter",
  "analyst",
  "landing",
  "assistant",
] as const;

export type TeamAgentId = (typeof TEAM_IDS)[number];

export interface PlannedTask {
  agent: TeamAgentId;
  /** Short Hebrew title shown in the office UI */
  title: string;
  instructions: string;
  /** Teammates whose output this task needs first */
  dependsOn: TeamAgentId[];
}

/** What an agent is doing with an external tool right now; drives the icon above its head */
export interface AgentActivity {
  tool: string;
  icon: string;
  label: string;
  /** True while the call is blocked on a human approval */
  awaitingApproval?: boolean;
}

export type ToolMode = "live" | "demo";

export interface ToolCallRecord {
  id: string;
  tool: string;
  icon: string;
  label: string;
  outcome: "ok" | "error" | "rejected";
  mode?: ToolMode;
}

export type ApprovalKind = "whatsapp_broadcast" | "campaign_publish" | "financial_document" | "other";

export interface ApprovalRequest {
  id: string;
  agent: AgentId;
  tool: string;
  kind: ApprovalKind;
  /** One-paragraph, human-readable description of exactly what will happen */
  summary: string;
  details: Record<string, unknown>;
  expiresAt: string;
}

/** Every SSE message is one of these, JSON-encoded in a `data:` line */
export type CampaignEvent =
  | { type: "status"; agent: AgentId; status: AgentStatus; task?: string }
  | { type: "plan"; summary: string; tasks: PlannedTask[] }
  | { type: "delta"; agent: AgentId; text: string }
  | { type: "result"; agent: AgentId; output: string }
  | { type: "activity"; agent: AgentId; activity: AgentActivity | null }
  | { type: "tool_call"; agent: AgentId; call: ToolCallRecord }
  | { type: "approval_request"; approval: ApprovalRequest }
  | { type: "approval_resolved"; id: string; approved: boolean }
  | { type: "error"; agent?: AgentId; message: string }
  | { type: "done" };

export const MAX_BRIEF_LENGTH = 4000;
