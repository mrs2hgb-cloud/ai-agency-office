import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AgentActivity, ToolCallRecord } from "@/lib/agents/shared";
import { auditToolCall } from "./audit";
import { findTool } from "./registry";
import { IntegrationError, ToolInputError, type ToolContext } from "./types";

export interface ExecutorHooks {
  onActivity: (activity: AgentActivity) => void;
  onCall: (call: ToolCallRecord) => void;
}

/**
 * Runs one tool_use block and returns its tool_result. Validation, the
 * per-agent allow list, and approval gating all happen here, so they hold
 * regardless of what the model asks for.
 */
export async function executeToolCall(
  block: Anthropic.Beta.BetaToolUseBlock,
  ctx: ToolContext,
  hooks: ExecutorHooks,
): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  const result = (content: string, isError = false): Anthropic.Beta.BetaToolResultBlockParam => ({
    type: "tool_result",
    tool_use_id: block.id,
    content,
    is_error: isError || undefined,
  });

  const tool = findTool(ctx.agent, block.name);
  if (!tool) return result(`Tool "${block.name}" is not available to you.`, true);

  // With eager input streaming the API doesn't validate inputs, so validate here
  const parsed = tool.schema.safeParse(block.input);
  if (!parsed.success) return result(`Invalid input:\n${z.prettifyError(parsed.error)}`, true);
  const input = parsed.data;

  const { icon, label } = tool.activity(input);
  const record = (outcome: ToolCallRecord["outcome"], mode?: ToolCallRecord["mode"]) => {
    const call = { id: block.id, tool: tool.name, icon, label, outcome, mode };
    hooks.onCall(call);
    auditToolCall(ctx.agent, call);
  };
  hooks.onActivity({ tool: tool.name, icon, label });

  const draft = tool.approval?.(input);
  if (draft) {
    const decision = await ctx.requestApproval(draft);
    hooks.onActivity({ tool: tool.name, icon, label });
    if (!decision.approved) {
      record("rejected");
      return result(
        `REJECTED: the agency owner did not approve this action${decision.note ? ` (${decision.note})` : ""}. ` +
          "Do not retry it. Mention in your report that it was not carried out.",
      );
    }
  }

  try {
    const output = await tool.run(input, ctx);
    record("ok", output.mode);
    const note =
      output.mode === "demo"
        ? { note: "DEMO MODE: this integration isn't configured, so nothing was sent or saved. Say so in your report." }
        : {};
    return result(JSON.stringify({ ...output, ...note }));
  } catch (error) {
    if (ctx.signal.aborted) throw error;
    record("error");
    const message =
      error instanceof ToolInputError || error instanceof IntegrationError ? error.message : "Unexpected tool error";
    if (!(error instanceof ToolInputError)) console.error(`[tools] ${tool.name} failed`, error);
    return result(`Tool failed: ${message}`, true);
  }
}
