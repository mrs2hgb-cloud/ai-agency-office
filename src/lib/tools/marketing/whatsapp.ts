import { z } from "zod";
import { modeFor, requestJson, asRecord } from "../core/http";
import { normalizeIsraeliPhone } from "../core/locale";
import { defineTool, ToolInputError } from "../core/types";

const MESSAGE_ICONS = {
  meeting_reminder: "📅",
  birthday_greeting: "🎂",
  campaign: "📢",
  general: "💬",
} as const;

export const sendWhatsappMessage = defineTool({
  name: "send_whatsapp_message",
  description:
    "Send WhatsApp messages through the agency's Lychee API / Make webhook: meeting reminders, birthday greetings, campaign messages, or general updates. Write in the recipients' language (usually Hebrew), short and warm. The message may contain {name}, which is replaced with each recipient's name. Only use phone numbers that came from the CRM, the calendar, or the user's request; never guess one. Sending to more than one recipient, or any campaign message, waits for human approval automatically.",
  schema: z.object({
    message_type: z.enum(["meeting_reminder", "birthday_greeting", "campaign", "general"]),
    recipients: z
      .array(z.object({ phone: z.string().describe("e.g. 0501234567 or +972501234567"), name: z.string() }))
      .min(1)
      .max(500),
    message: z.string().describe("Message text; {name} is replaced per recipient"),
    meeting_time: z.string().optional().describe("For meeting reminders: ISO 8601 local Israel time"),
  }),
  activity: (input) => ({
    icon: MESSAGE_ICONS[input.message_type],
    label:
      input.recipients.length > 1
        ? `שליחת וואטסאפ ל-${input.recipients.length} נמענים`
        : input.message_type === "birthday_greeting"
          ? `ברכת יום הולדת ל${input.recipients[0].name}`
          : input.message_type === "meeting_reminder"
            ? `תזכורת פגישה ל${input.recipients[0].name}`
            : `וואטסאפ ל${input.recipients[0].name}`,
  }),
  approval: (input) =>
    input.recipients.length > 1 || input.message_type === "campaign"
      ? {
          kind: "whatsapp_broadcast",
          summary: `שליחת הודעת וואטסאפ (${input.message_type}) ל-${input.recipients.length} נמענים: "${input.message.slice(0, 160)}"`,
          details: {
            recipients: input.recipients.slice(0, 20).map((r) => `${r.name} (${r.phone})`),
            more_recipients: Math.max(0, input.recipients.length - 20),
            message: input.message,
          },
        }
      : null,
  async run(input, { signal }) {
    const invalid = input.recipients.filter((r) => !normalizeIsraeliPhone(r.phone));
    if (invalid.length) {
      throw new ToolInputError(`Invalid phone numbers: ${invalid.map((r) => `${r.name}: ${r.phone}`).join(", ")}`);
    }
    const messages = input.recipients.map((r) => ({
      phone: normalizeIsraeliPhone(r.phone)!,
      name: r.name,
      text: input.message.replaceAll("{name}", r.name),
    }));

    const url = process.env.LYCHEE_WEBHOOK_URL;
    const mode = modeFor(url, "write");
    if (mode === "demo") {
      return { mode, sent: 0, would_send: messages.length, preview: messages.slice(0, 3) };
    }

    const apiKey = process.env.LYCHEE_API_KEY;
    const response = await requestJson(url!, {
      body: { message_type: input.message_type, meeting_time: input.meeting_time, messages },
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal,
    });
    return { mode, sent: messages.length, ...asRecord(response) };
  },
});
