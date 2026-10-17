import type { LucideIcon } from "lucide-react";

export type AgentStatus = "waiting" | "working" | "done";

export type AgentId =
  | "ceo"
  | "creative"
  | "campaigner"
  | "copywriter"
  | "analyst"
  | "landing"
  | "assistant";

export interface AgentConfig {
  id: AgentId;
  name: string;
  /** Short description of what the agent does while working */
  task: string;
  icon: LucideIcon;
  /** Role color – used for the shirt and the icon bubble */
  color: string;
  skin: string;
  hair: string;
  /** Short role subtitle shown on the name tag, e.g. "במאי ראשי" */
  role?: string;
  /** Standing capability tags shown under the station, e.g. ["📅 יומן", "🧾 חשבוניות"] */
  badges?: string[];
}

export type AgentStatuses = Record<AgentId, AgentStatus>;
