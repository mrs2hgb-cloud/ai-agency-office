import { z } from "zod";
import { modeFor, postToMake } from "../core/http";
import { defineTool, ToolInputError } from "../core/types";

const PLATFORMS = ["instagram", "facebook", "tiktok", "linkedin", "x", "manychat"] as const;

export const socialBroadcast = defineTool({
  name: "social_broadcast",
  description:
    "Send content to the agency's social automation (Make scenarios and ManyChat). save_draft stores a post for review without publishing. schedule_post and publish_now put content in front of the audience and wait for human approval automatically. For ManyChat, the content is sent as a broadcast to the given tag or flow.",
  schema: z.object({
    action: z.enum(["save_draft", "schedule_post", "publish_now"]),
    platforms: z.array(z.enum(PLATFORMS)).min(1),
    text: z.string().describe("Post caption or broadcast text"),
    media_urls: z.array(z.string()).optional().describe("Image or video URLs, e.g. from generate_visual_asset"),
    publish_at: z.string().optional().describe("For schedule_post: ISO 8601 local Israel time"),
    manychat_target: z.string().optional().describe("ManyChat tag or flow id to broadcast to"),
    hashtags: z.array(z.string()).optional(),
  }),
  activity: (input) => ({
    icon: input.action === "save_draft" ? "📝" : "📣",
    label:
      input.action === "save_draft"
        ? "שמירת טיוטת פוסט"
        : input.action === "schedule_post"
          ? `תזמון פוסט ל-${input.platforms.join(", ")}`
          : `פרסום ב-${input.platforms.join(", ")}`,
  }),
  approval: (input) =>
    input.action === "save_draft"
      ? null
      : {
          kind: "campaign_publish",
          summary:
            input.action === "schedule_post"
              ? `תזמון פוסט ל-${input.platforms.join(", ")} ב-${input.publish_at}: "${input.text.slice(0, 160)}"`
              : `פרסום מיידי ב-${input.platforms.join(", ")}: "${input.text.slice(0, 160)}"`,
          details: {
            platforms: input.platforms,
            text: input.text,
            media_urls: input.media_urls ?? [],
            publish_at: input.publish_at,
            manychat_target: input.manychat_target,
          },
        },
  async run(input, { signal }) {
    if (input.action === "schedule_post" && !input.publish_at) throw new ToolInputError("publish_at is required");
    if (input.platforms.includes("manychat") && input.action !== "save_draft" && !input.manychat_target) {
      throw new ToolInputError("manychat_target is required to broadcast on ManyChat");
    }

    const url = process.env.SOCIAL_WEBHOOK_URL;
    const mode = modeFor(url, "write");
    if (mode === "demo") return { mode, accepted: false, would_send: input };
    return { mode, accepted: true, ...(await postToMake(url!, input, signal)) };
  },
});
