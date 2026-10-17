import { z } from "zod";
import { modeFor, postToMake } from "../core/http";
import { formatShekels, officeDay } from "../core/locale";
import { defineTool, ToolInputError } from "../core/types";

export const sheetsLogger = defineTool({
  name: "sheets_logger",
  description:
    "The agency's Google Sheets log (through a Google Apps Script web app or a Make webhook). log_event appends a line to the activity log. log_expense records campaign spend against the budget. get_metrics reads performance and budget figures for a campaign. Read real numbers with get_metrics before analyzing; never invent figures.",
  schema: z.object({
    action: z.enum(["log_event", "log_expense", "get_metrics"]),
    campaign: z.string().optional().describe("Campaign name; required for log_expense and get_metrics"),
    message: z.string().optional().describe("For log_event: what happened"),
    expense: z
      .object({
        category: z.string().describe("e.g. media, production, freelancers, tools"),
        amount: z.number().positive().describe("Amount in ILS"),
        description: z.string(),
        date: z.string().optional().describe("YYYY-MM-DD; defaults to today"),
      })
      .optional(),
    metrics: z
      .array(z.string())
      .optional()
      .describe("For get_metrics: which columns to return, e.g. impressions, clicks, leads, spend, cpl, roas"),
  }),
  activity: (input) => ({
    icon: input.action === "log_expense" ? "💸" : "📊",
    label:
      input.action === "get_metrics"
        ? `שליפת מדדים: ${input.campaign ?? ""}`
        : input.action === "log_expense"
          ? `רישום הוצאה ${input.expense ? formatShekels(input.expense.amount) : ""}`
          : "רישום ביומן הפעילות",
  }),
  async run(input, { signal, agent }) {
    if (input.action !== "log_event" && !input.campaign) throw new ToolInputError("campaign is required");
    if (input.action === "log_event" && !input.message) throw new ToolInputError("message is required");
    if (input.action === "log_expense" && !input.expense) throw new ToolInputError("expense is required");

    const payload = {
      ...input,
      expense: input.expense && { ...input.expense, date: input.expense.date ?? officeDay().iso },
      logged_by: agent,
      logged_at: new Date().toISOString(),
    };

    const url = process.env.SHEETS_WEBHOOK_URL;
    const mode = modeFor(url, input.action === "get_metrics" ? "read" : "write");
    if (mode === "live") return { mode, ...(await postToMake(url!, payload, signal)) };

    if (input.action === "get_metrics") {
      return {
        mode,
        campaign: input.campaign,
        sample_metrics: { impressions: 48200, clicks: 1310, leads: 87, spend_ils: 6400, cpl_ils: 73.6, budget_ils: 30000 },
      };
    }
    return { mode, logged: false, would_log: payload };
  },
});
