import { z } from "zod";
import { modeFor, postToMake } from "../core/http";
import { normalizeIsraeliPhone } from "../core/locale";
import { defineTool, ToolInputError } from "../core/types";

export const manageLandingPage = defineTool({
  name: "manage_landing_page",
  description:
    "Work with the agency's landing pages (Rav Messer / Landy, through a Make webhook). update_template saves new content for a page's sections without publishing it. publish_page makes a page live and waits for human approval automatically. register_lead records a lead that came from a page.",
  schema: z.object({
    action: z.enum(["update_template", "publish_page", "register_lead"]),
    page_id: z.string().optional().describe("The page id or slug; required for update_template and publish_page"),
    sections: z
      .array(
        z.object({
          section: z.string().describe("e.g. hero, benefits, testimonials, faq, form"),
          headline: z.string().optional(),
          body: z.string().optional(),
          cta: z.string().optional(),
        }),
      )
      .optional()
      .describe("Section content for update_template"),
    lead: z
      .object({
        name: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        source: z.string().optional().describe("Campaign or UTM source"),
      })
      .optional()
      .describe("Lead details for register_lead"),
  }),
  activity: (input) => ({
    icon: input.action === "register_lead" ? "🙋" : "🖥️",
    label:
      input.action === "publish_page"
        ? "פרסום דף נחיתה"
        : input.action === "register_lead"
          ? `רישום ליד: ${input.lead?.name ?? ""}`
          : "עדכון תבנית דף נחיתה",
  }),
  approval: (input) =>
    input.action === "publish_page"
      ? {
          kind: "campaign_publish",
          summary: `פרסום דף הנחיתה "${input.page_id}" לאוויר`,
          details: { page_id: input.page_id },
        }
      : null,
  async run(input, { signal }) {
    if (input.action !== "register_lead" && !input.page_id) throw new ToolInputError("page_id is required");
    if (input.action === "update_template" && !input.sections?.length) throw new ToolInputError("sections are required");
    if (input.action === "register_lead") {
      if (!input.lead) throw new ToolInputError("lead is required");
      if (!input.lead.phone && !input.lead.email) throw new ToolInputError("a lead needs a phone or an email");
    }
    const payload = {
      ...input,
      lead: input.lead && {
        ...input.lead,
        phone: input.lead.phone ? (normalizeIsraeliPhone(input.lead.phone) ?? input.lead.phone) : undefined,
      },
    };

    const url = process.env.LANDING_PAGE_WEBHOOK_URL;
    const mode = modeFor(url, "write");
    if (mode === "demo") return { mode, saved: false, would_send: payload };
    return { mode, saved: true, ...(await postToMake(url!, payload, signal)) };
  },
});
