import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AgentId } from "@/components/virtual-office/types";
import { createExternalTask } from "../data/external-task";
import { crmSync } from "../data/crm-sync";
import { sheetsLogger } from "../data/sheets-logger";
import { manageLandingPage } from "../marketing/landing-page";
import { socialBroadcast } from "../marketing/social-broadcast";
import { sendWhatsappMessage } from "../marketing/whatsapp";
import { generateVisualAsset } from "../media/visual-asset";
import { manageCalendar } from "../operations/calendar";
import { invoiceAction } from "../operations/invoice";
import { requestHumanApproval } from "../oversight/human-approval";
import type { ToolDefinition } from "./types";

export const ALL_TOOLS = [
  // 1. Marketing, content and distribution
  sendWhatsappMessage,
  manageLandingPage,
  socialBroadcast,
  // 2. Data, memory and task management
  sheetsLogger,
  createExternalTask,
  crmSync,
  // 3. Media and visual assets
  generateVisualAsset,
  // Office operations
  manageCalendar,
  invoiceAction,
  // 4. Oversight (human in the loop)
  requestHumanApproval,
] as ToolDefinition[];

type ToolName = (typeof ALL_TOOLS)[number]["name"];

/** Which tools each agent may call. The executor rejects anything outside this list. */
export const AGENT_TOOLS: Record<AgentId, ToolName[]> = {
  ceo: ["sheets_logger", "create_external_task", "request_human_approval"],
  creative: ["generate_visual_asset", "social_broadcast"],
  campaigner: ["social_broadcast", "send_whatsapp_message", "sheets_logger", "request_human_approval"],
  copywriter: [],
  analyst: ["sheets_logger", "crm_sync"],
  landing: ["manage_landing_page", "crm_sync"],
  assistant: [
    "manage_calendar",
    "send_whatsapp_message",
    "crm_sync",
    "invoice_action",
    "create_external_task",
    "request_human_approval",
  ],
};

export function findTool(agent: AgentId, name: string): ToolDefinition | undefined {
  return AGENT_TOOLS[agent].includes(name) ? ALL_TOOLS.find((t) => t.name === name) : undefined;
}

const definitionCache = new Map<string, Anthropic.Beta.BetaTool>();

/** Claude tool definitions (JSON Schema generated from each tool's Zod schema) */
export function toolDefinitionsFor(agent: AgentId): Anthropic.Beta.BetaTool[] {
  return AGENT_TOOLS[agent].map((name) => {
    let definition = definitionCache.get(name);
    if (!definition) {
      const tool = ALL_TOOLS.find((t) => t.name === name)!;
      const inputSchema = z.toJSONSchema(tool.schema);
      delete inputSchema.$schema; // the API takes the bare schema
      definition = {
        name: tool.name,
        description: tool.description,
        input_schema: inputSchema as Anthropic.Beta.BetaTool.InputSchema,
        eager_input_streaming: true,
      };
      definitionCache.set(name, definition);
    }
    return definition;
  });
}
