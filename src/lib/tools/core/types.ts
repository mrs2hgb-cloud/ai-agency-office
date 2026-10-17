import type { z } from "zod";
import type { AgentId } from "@/components/virtual-office/types";
import type { ApprovalKind, ToolMode } from "@/lib/agents/shared";

export interface ApprovalDecision {
  approved: boolean;
  note?: string;
}

export interface ApprovalDraft {
  kind: ApprovalKind;
  summary: string;
  details: Record<string, unknown>;
}

export interface ToolContext {
  agent: AgentId;
  signal: AbortSignal;
  /** Blocks until a human approves or rejects (or the request times out) */
  requestApproval: (draft: ApprovalDraft) => Promise<ApprovalDecision>;
}

export type ToolOutput = { mode: ToolMode } & Record<string, unknown>;

export interface ToolDefinition<Schema extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  schema: Schema;
  /** Icon and Hebrew label shown above the agent while this call runs */
  activity: (input: z.infer<Schema>) => { icon: string; label: string };
  /**
   * Return a draft when this particular call must be approved by a human
   * before it runs (distribution, publishing, financial documents). Enforced
   * by the executor, so the model cannot skip it.
   */
  approval?: (input: z.infer<Schema>) => ApprovalDraft | null;
  run: (input: z.infer<Schema>, ctx: ToolContext) => Promise<ToolOutput>;
}

/** Identity helper that keeps each tool's input type tied to its schema */
export const defineTool = <Schema extends z.ZodObject>(tool: ToolDefinition<Schema>) => tool;

/** Thrown by a tool when its input is valid JSON but doesn't make sense for the chosen action */
export class ToolInputError extends Error {}

/** Thrown when an external service fails */
export class IntegrationError extends Error {}
