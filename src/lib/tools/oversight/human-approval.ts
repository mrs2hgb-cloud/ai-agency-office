import { z } from "zod";
import { defineTool } from "../core/types";

/**
 * Lets an agent ask for sign-off on a decision no other tool covers (for
 * example, launching a campaign plan). Tools that distribute content or issue
 * financial documents don't rely on this: the executor gates them itself.
 */
export const requestHumanApproval = defineTool({
  name: "request_human_approval",
  description:
    "Pause and ask the agency owner to approve an action before you take it, for decisions that commit money, publish something, or contact clients in bulk and that no other tool gates. Write a summary in Hebrew that says exactly what will happen, to whom, when, and at what cost. Wait for the answer and follow it: if rejected, don't do the action and explain why in your report. Sending WhatsApp broadcasts, publishing posts or pages, and issuing invoices already request approval on their own; don't call this before them.",
  schema: z.object({
    kind: z.enum(["whatsapp_broadcast", "campaign_publish", "financial_document", "other"]),
    summary: z.string().describe("One or two sentences in Hebrew describing exactly what will happen"),
    details: z.record(z.string(), z.string()).optional().describe("Key facts: audience, budget, dates, amounts"),
  }),
  activity: () => ({ icon: "✋", label: "ממתין לאישור" }),
  async run(input, ctx) {
    const decision = await ctx.requestApproval({
      kind: input.kind,
      summary: input.summary,
      details: input.details ?? {},
    });
    return { mode: "live", ...decision };
  },
});
