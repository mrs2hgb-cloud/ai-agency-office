import { z } from "zod";
import { modeFor, postToMake, requestJson, asRecord } from "../core/http";
import { israelLocalToEpoch } from "../core/locale";
import { defineTool } from "../core/types";

const CLICKUP_PRIORITY = { urgent: 1, high: 2, normal: 3, low: 4 } as const;

export const createExternalTask = defineTool({
  name: "create_external_task",
  description:
    "Open a task for a human on the team in the agency's task manager (ClickUp, or a dedicated webhook): follow-ups, work that needs a person, or items waiting for a client's sign-off. This does not block your run; for a decision you need before continuing, use request_human_approval instead.",
  schema: z.object({
    title: z.string(),
    description: z.string().describe("What needs doing and the context a teammate needs"),
    type: z.enum(["handling", "approval", "follow_up"]),
    priority: z.enum(["urgent", "high", "normal", "low"]),
    due_date: z.string().optional().describe("ISO 8601 local Israel time"),
    assignee: z.string().optional().describe("Assignee name or email"),
    tags: z.array(z.string()).optional(),
  }),
  activity: (input) => ({ icon: "📋", label: `פתיחת משימה: ${input.title}` }),
  async run(input, { signal, agent }) {
    const due = input.due_date ? israelLocalToEpoch(input.due_date) : undefined;
    const token = process.env.CLICKUP_API_TOKEN;
    const listId = process.env.CLICKUP_LIST_ID;
    const webhook = process.env.TASKS_WEBHOOK_URL;

    // ClickUp's REST API when configured, otherwise a generic webhook
    if (token && listId && modeFor(token, "write") === "live") {
      const task = asRecord(
        await requestJson(`https://api.clickup.com/api/v2/list/${listId}/task`, {
          headers: { Authorization: token },
          body: {
            name: input.title,
            markdown_description: `${input.description}\n\n_נפתח על ידי הסוכן: ${agent}_`,
            priority: CLICKUP_PRIORITY[input.priority],
            due_date: due && !Number.isNaN(due) ? due : undefined,
            tags: [...(input.tags ?? []), input.type, "ai-agent"],
          },
          signal,
        }),
      );
      return { mode: "live", task_id: task.id, url: task.url };
    }

    const mode = modeFor(webhook, "write");
    const payload = { ...input, due_epoch_ms: due, opened_by: agent };
    if (mode === "demo") return { mode, created: false, would_create: payload };
    return { mode, created: true, ...(await postToMake(webhook!, payload, signal)) };
  },
});
