/**
 * Runs a single agent tool against the real integrations, without Claude.
 * Useful for checking a Make/Lychee/Fireberry/Sheets connection end to end.
 *
 *   npm run tool -- --status
 *   npm run tool -- send_whatsapp_message '{"message_type":"birthday_greeting", ...}'
 *   npm run tool -- crm_sync --file payload.json
 *
 * Reads .env.local. Calls that need approval ask for it here in the terminal,
 * through the same gate the agents go through.
 */
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import type Anthropic from "@anthropic-ai/sdk";
import type { AgentId } from "@/components/virtual-office/types";
import { AGENT_TOOLS, ALL_TOOLS, executeToolCall } from "@/lib/tools";

/** Environment variables that switch each tool from demo to live */
const TOOL_ENV: Record<string, string[][]> = {
  send_whatsapp_message: [["LYCHEE_WEBHOOK_URL"]],
  manage_landing_page: [["LANDING_PAGE_WEBHOOK_URL"]],
  social_broadcast: [["SOCIAL_WEBHOOK_URL"]],
  sheets_logger: [["SHEETS_WEBHOOK_URL"]],
  create_external_task: [["CLICKUP_API_TOKEN", "CLICKUP_LIST_ID"], ["TASKS_WEBHOOK_URL"]],
  crm_sync: [["CRM_WEBHOOK_URL"], ["FIREBERRY_API_TOKEN"]],
  generate_visual_asset: [["VISUAL_WEBHOOK_URL"], ["OPENAI_API_KEY"]],
  manage_calendar: [["CALENDAR_WEBHOOK_URL"]],
  invoice_action: [["INVOICE_WEBHOOK_URL"]],
  request_human_approval: [],
};

function printStatus() {
  const dryRun = process.env.TOOLS_DRY_RUN === "true";
  console.log(`TOOLS_DRY_RUN=${dryRun}${dryRun ? "  (actions with side effects stay in demo mode)" : ""}\n`);
  for (const tool of ALL_TOOLS) {
    const options = TOOL_ENV[tool.name] ?? [];
    const match = options.find((vars) => vars.every((v) => process.env[v]));
    const state = options.length === 0 ? "built in" : match ? `live via ${match.join(" + ")}` : "demo (not configured)";
    console.log(`${tool.name.padEnd(24)} ${state}`);
  }
  const phone = process.env.APPROVAL_NOTIFY_PHONE;
  console.log(`\nApproval WhatsApp alerts: ${phone && process.env.LYCHEE_WEBHOOK_URL ? `to ${phone}` : "off"}`);
}

async function main() {
  const [name, ...rest] = process.argv.slice(2);
  if (!name || name === "--status") return printStatus();

  const tool = ALL_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool "${name}". Run with --status to list them.`);

  const raw = rest[0] === "--file" ? await readFile(rest[1], "utf8") : rest[0];
  if (!raw) throw new Error("Pass the tool input as a JSON string, or --file path.json");
  const input: unknown = JSON.parse(raw);

  // Run as an agent that is allowed to use this tool, preferring the office manager
  const agents = ["assistant", ...Object.keys(AGENT_TOOLS)] as AgentId[];
  const agent = agents.find((a) => AGENT_TOOLS[a].includes(name))!;
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const block: Anthropic.Beta.BetaToolUseBlock = { type: "tool_use", id: "cli", name, input };

  const result = await executeToolCall(
    block,
    {
      agent,
      signal: AbortSignal.timeout(60_000),
      async requestApproval(draft) {
        console.log(`\n✋ Approval needed (${draft.kind}): ${draft.summary}`);
        console.log(JSON.stringify(draft.details, null, 2));
        const answer = await terminal.question("Approve? [y/N] ");
        return { approved: answer.trim().toLowerCase() === "y" };
      },
    },
    {
      onActivity: (a) => console.log(`${a.icon}  ${a.label}`),
      onCall: (c) => console.log(`→ ${c.outcome}${c.mode ? ` (${c.mode})` : ""}`),
    },
  );
  terminal.close();

  console.log(result.is_error ? "\nTool error:" : "\nResult:");
  const content = String(result.content);
  try {
    console.log(JSON.stringify(JSON.parse(content), null, 2));
  } catch {
    console.log(content);
  }
  process.exitCode = result.is_error ? 1 : 0;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
