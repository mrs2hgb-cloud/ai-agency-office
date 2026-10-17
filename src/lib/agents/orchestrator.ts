import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { AgentId } from "@/components/virtual-office/types";
import { CEO_PLANNER_SYSTEM, CEO_SUMMARY_SYSTEM, agentSystem } from "./prompts";
import {
  TEAM_IDS,
  type ApprovalRequest,
  type CampaignEvent,
  type PlannedTask,
  type TeamAgentId,
} from "./shared";
import {
  approvalTimeoutMs,
  executeToolCall,
  notifyApprovalRequest,
  toolDefinitionsFor,
  waitForApproval,
  type ApprovalDecision,
  type ApprovalDraft,
} from "@/lib/tools";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

/** Upper bound on model turns per agent, so a tool loop can't run away */
const MAX_AGENT_TURNS = 12;

/** If a request is declined by a safety classifier, the API retries it on a fallback model */
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
} satisfies Pick<Anthropic.Beta.MessageCreateParams, "betas" | "fallbacks">;

const PlanSchema = z.object({
  summary: z.string(),
  tasks: z.array(
    z.object({
      agent: z.enum(TEAM_IDS),
      title: z.string(),
      instructions: z.string(),
      dependsOn: z.array(z.enum(TEAM_IDS)),
    }),
  ),
});

type Emit = (event: CampaignEvent) => void;

class AgentError extends Error {
  constructor(
    readonly agent: AgentId,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Runs a full campaign: the CEO plans, the team works (in parallel where
 * dependencies allow), and the CEO writes the summary. Never throws; every
 * failure is reported as an `error` event, and the last event is always `done`.
 */
export async function runCampaign(brief: string, emit: Emit, signal: AbortSignal): Promise<void> {
  try {
    const client = new Anthropic();

    emit({ type: "status", agent: "ceo", status: "working", task: "מפרק את הבריף למשימות" });
    const plan = await planCampaign(client, brief, signal);
    emit({ type: "plan", ...plan });
    emit({ type: "status", agent: "ceo", status: "working", task: "מתאם את הצוות" });

    const outputs = await runTeam(client, brief, plan, emit, signal);
    if (outputs.size === 0) throw new AgentError("ceo", "אף סוכן לא השלים את המשימה שלו");

    emit({ type: "status", agent: "ceo", status: "working", task: "כותב סיכום קמפיין" });
    const summary = await runAgent(
      client,
      "ceo",
      "כותב סיכום קמפיין",
      CEO_SUMMARY_SYSTEM,
      `<brief>\n${brief}\n</brief>\n\n<strategy>${plan.summary}</strategy>\n\n${formatOutputs(outputs)}`,
      emit,
      signal,
    );
    emit({ type: "result", agent: "ceo", output: summary });
    emit({ type: "status", agent: "ceo", status: "done" });
  } catch (error) {
    if (!signal.aborted) {
      emit({
        type: "error",
        agent: error instanceof AgentError ? error.agent : "ceo",
        message: describeError(error),
      });
    }
  } finally {
    emit({ type: "done" });
  }
}

async function planCampaign(client: Anthropic, brief: string, signal: AbortSignal) {
  const response = await client.beta.messages.parse(
    {
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "high", format: betaZodOutputFormat(PlanSchema) },
      system: CEO_PLANNER_SYSTEM,
      messages: [{ role: "user", content: brief }],
    },
    { signal },
  );

  if (response.stop_reason === "refusal") {
    throw new AgentError("ceo", "המנכ״ל סירב לבריף הזה");
  }
  if (!response.parsed_output) {
    throw new AgentError("ceo", "המנכ״ל לא הצליח לבנות תוכנית עבודה");
  }
  return { summary: response.parsed_output.summary, tasks: normalizeTasks(response.parsed_output.tasks) };
}

/** One task per agent, and dependencies only on earlier tasks, which rules out cycles */
function normalizeTasks(tasks: PlannedTask[]): PlannedTask[] {
  const seen = new Set<TeamAgentId>();
  const result: PlannedTask[] = [];
  for (const task of tasks) {
    if (seen.has(task.agent)) continue;
    result.push({ ...task, dependsOn: [...new Set(task.dependsOn)].filter((d) => seen.has(d)) });
    seen.add(task.agent);
  }
  return result;
}

async function runTeam(
  client: Anthropic,
  brief: string,
  plan: { summary: string; tasks: PlannedTask[] },
  emit: Emit,
  signal: AbortSignal,
): Promise<Map<TeamAgentId, string>> {
  const outputs = new Map<TeamAgentId, string>();
  const pending = new Map<TeamAgentId, Promise<string | null>>();

  // Assigned agents show their task while they wait for dependencies
  for (const task of plan.tasks) {
    emit({ type: "status", agent: task.agent, status: "waiting", task: task.title });
  }

  for (const task of plan.tasks) {
    pending.set(
      task.agent,
      (async () => {
        const deps = await Promise.all(task.dependsOn.map((d) => pending.get(d)!));
        if (deps.some((output) => output === null)) {
          emit({ type: "error", agent: task.agent, message: "דילג על המשימה כי סוכן שהוא תלוי בו נכשל" });
          return null;
        }

        emit({ type: "status", agent: task.agent, status: "working", task: task.title });
        try {
          const depOutputs = new Map(task.dependsOn.map((d) => [d, outputs.get(d)!]));
          const output = await runAgent(
            client,
            task.agent,
            task.title,
            agentSystem(task.agent),
            `<brief>\n${brief}\n</brief>\n\n<strategy>${plan.summary}</strategy>\n\n<your_task title="${task.title}">\n${task.instructions}\n</your_task>${depOutputs.size ? `\n\n${formatOutputs(depOutputs)}` : ""}`,
            emit,
            signal,
          );
          outputs.set(task.agent, output);
          emit({ type: "result", agent: task.agent, output });
          emit({ type: "status", agent: task.agent, status: "done", task: task.title });
          return output;
        } catch (error) {
          if (signal.aborted) throw error;
          emit({ type: "error", agent: task.agent, message: describeError(error) });
          emit({ type: "status", agent: task.agent, status: "waiting", task: task.title });
          return null;
        }
      })(),
    );
  }

  await Promise.all(pending.values());
  return outputs;
}

/**
 * Runs one agent: streams its text to the client as `delta` events and, when
 * the agent has tools, executes the calls it makes until it's done. Returns
 * all the text the agent wrote.
 */
async function runAgent(
  client: Anthropic,
  agent: AgentId,
  task: string,
  system: string,
  content: string,
  emit: Emit,
  signal: AbortSignal,
): Promise<string> {
  const tools = toolDefinitionsFor(agent);
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content }];
  const texts: string[] = [];
  let jsonRetries = 0;

  try {
    for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
      const stream = client.beta.messages.stream(
        {
          model: MODEL,
          max_tokens: 64000,
          ...FALLBACK,
          output_config: { effort: "medium" },
          system,
          messages,
          ...(tools.length && { tools }),
        },
        { signal },
      );
      let turnText = "";
      stream.on("text", (text) => {
        if (!turnText && texts.length) emit({ type: "delta", agent, text: "\n\n" });
        turnText += text;
        emit({ type: "delta", agent, text });
      });

      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (error) {
        // With eager input streaming, a tool input that isn't parseable JSON
        // rejects here; re-issue that turn. API errors are real failures.
        if (error instanceof Anthropic.APIError || signal.aborted || jsonRetries++ >= 2) throw error;
        continue;
      }
      if (turnText) texts.push(turnText);

      if (message.stop_reason === "refusal") throw new AgentError(agent, "הבקשה נדחתה מסיבות בטיחות");
      const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (toolUses.length === 0) break;
      if (message.stop_reason === "max_tokens") throw new AgentError(agent, "קריאת כלי נקטעה באמצע");

      messages.push({ role: "assistant", content: message.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of toolUses) {
        results.push(
          await executeToolCall(
            block,
            { agent, signal, requestApproval: (draft) => askHuman(agent, task, block.name, draft, emit, signal) },
            {
              onActivity: (activity) => emit({ type: "activity", agent, activity }),
              onCall: (call) => emit({ type: "tool_call", agent, call }),
            },
          ),
        );
      }
      messages.push({ role: "user", content: results });
    }
  } finally {
    emit({ type: "activity", agent, activity: null });
  }
  return texts.join("\n\n");
}

/** Puts the agent on hold in the office until the owner approves or rejects */
async function askHuman(
  agent: AgentId,
  task: string,
  tool: string,
  draft: ApprovalDraft,
  emit: Emit,
  signal: AbortSignal,
): Promise<ApprovalDecision> {
  const request: ApprovalRequest = {
    id: crypto.randomUUID(),
    agent,
    tool,
    ...draft,
    expiresAt: new Date(Date.now() + approvalTimeoutMs()).toISOString(),
  };

  emit({ type: "status", agent, status: "waiting", task: `ממתין לאישור: ${task}` });
  emit({ type: "activity", agent, activity: { tool, icon: "✋", label: "ממתין לאישור שלך", awaitingApproval: true } });
  emit({ type: "approval_request", approval: request });
  void notifyApprovalRequest(request);

  const decision = await waitForApproval(request, signal);
  emit({ type: "approval_resolved", id: request.id, approved: decision.approved });
  emit({ type: "status", agent, status: "working", task });
  return decision;
}

function formatOutputs(outputs: Map<TeamAgentId, string>): string {
  return [...outputs]
    .map(([agent, output]) => `<teammate_output agent="${agent}">\n${output}\n</teammate_output>`)
    .join("\n\n");
}

function describeError(error: unknown): string {
  if (error instanceof AgentError) return error.message;
  if (error instanceof Anthropic.AuthenticationError) return "מפתח ה-API של Anthropic חסר או לא תקין";
  if (error instanceof Anthropic.RateLimitError) return "חרגנו ממגבלת הקצב של ה-API, נסו שוב בעוד רגע";
  if (error instanceof Anthropic.APIConnectionError) return "אין חיבור ל-API של Anthropic";
  if (error instanceof Anthropic.APIError) {
    console.error("[campaign] Anthropic API error", error.status, error.message);
    return `שגיאת API של Anthropic (${error.status ?? "?"})`;
  }
  if (error instanceof Anthropic.AnthropicError) return error.message;
  return "שגיאה לא צפויה בשרת";
}
