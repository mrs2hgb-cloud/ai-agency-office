import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { modeFor, postToMake, requestJson, asRecord } from "../core/http";
import { defineTool, IntegrationError } from "../core/types";

type Orientation = "square" | "portrait" | "landscape";

const ORIENTATION: Record<string, Orientation> = {
  "1:1": "square",
  "4:5": "portrait",
  "9:16": "portrait",
  "16:9": "landscape",
};

/** gpt-image models and DALL-E 3 accept different sizes */
function openAiSize(model: string, orientation: Orientation) {
  const dalle = model.startsWith("dall-e");
  if (orientation === "square") return "1024x1024";
  if (orientation === "portrait") return dalle ? "1024x1792" : "1024x1536";
  return dalle ? "1792x1024" : "1536x1024";
}

export const generateVisualAsset = defineTool({
  name: "generate_visual_asset",
  description:
    "Create a visual for the campaign: a banner, social post, story, or ad creative. With a Canva template configured in Make, the headline is placed on the template; otherwise an image is generated from the prompt. Write the prompt in English, describing subject, composition, style, colors and mood; don't ask the image model to render Hebrew text, put it in headline_text instead. Use output 'prompt_only' to hand a ready prompt to a designer without generating.",
  schema: z.object({
    asset_type: z.enum(["banner", "social_post", "story", "ad_creative", "logo_concept", "other"]),
    prompt: z.string().describe("Detailed English image prompt"),
    aspect_ratio: z.enum(["1:1", "4:5", "9:16", "16:9"]),
    headline_text: z.string().optional().describe("Text to overlay on a Canva template, in the campaign's language"),
    canva_template_id: z.string().optional(),
    output: z.enum(["image", "prompt_only"]),
  }),
  activity: (input) => ({
    icon: "🎨",
    label: input.output === "prompt_only" ? "כתיבת פרומפט גרפי" : `יצירת ${input.asset_type === "banner" ? "באנר" : "ויזואל"}`,
  }),
  async run(input, { signal }) {
    if (input.output === "prompt_only") return { mode: "live", prompt: input.prompt, aspect_ratio: input.aspect_ratio };

    // A Make scenario (e.g. Canva "Create a design from a brand template") takes precedence
    const webhook = process.env.VISUAL_WEBHOOK_URL;
    if (modeFor(webhook, "write") === "live") {
      return { mode: "live", provider: "make", ...(await postToMake(webhook!, input, signal)) };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (modeFor(apiKey, "write") === "demo") {
      return { mode: "demo", generated: false, prompt: input.prompt, aspect_ratio: input.aspect_ratio };
    }

    const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
    const response = asRecord(
      await requestJson("https://api.openai.com/v1/images/generations", {
        headers: { Authorization: `Bearer ${apiKey}` },
        body: { model, prompt: input.prompt, size: openAiSize(model, ORIENTATION[input.aspect_ratio]), n: 1 },
        signal,
      }),
    );
    const image = Array.isArray(response.data) ? asRecord(response.data[0]) : {};
    if (typeof image.url === "string") {
      return { mode: "live", provider: "openai", image_url: image.url, headline_text: input.headline_text };
    }
    if (typeof image.b64_json === "string") {
      return {
        mode: "live",
        provider: "openai",
        image_url: await saveGeneratedImage(image.b64_json),
        headline_text: input.headline_text,
      };
    }
    throw new IntegrationError("The image API returned no image");
  },
});

/**
 * Models that return base64 are saved under public/generated. That needs a
 * writable disk (local dev, a VM, a container); on serverless hosts, use
 * VISUAL_WEBHOOK_URL to store images in Canva, Drive or S3 instead.
 */
async function saveGeneratedImage(base64: string): Promise<string> {
  const dir = path.join(process.cwd(), "public", "generated");
  const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), Buffer.from(base64, "base64"));
  } catch {
    throw new IntegrationError("Image generated but the server can't store it; configure VISUAL_WEBHOOK_URL");
  }
  return `/generated/${fileName}`;
}
