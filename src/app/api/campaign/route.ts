import { runCampaign } from "@/lib/agents/orchestrator";
import { MAX_BRIEF_LENGTH, type CampaignEvent } from "@/lib/agents/shared";

// A full run (plan, parallel agents, tool calls, waiting for human approvals) can take
// several minutes. Platforms cap this per plan; lower it if yours rejects 800.
export const maxDuration = 800;

const HEARTBEAT_MS = 15_000;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const brief =
    body && typeof body === "object" && "brief" in body && typeof body.brief === "string"
      ? body.brief.trim()
      : "";

  if (!brief) {
    return Response.json({ error: "יש לשלוח בריף לקמפיין" }, { status: 400 });
  }
  if (brief.length > MAX_BRIEF_LENGTH) {
    return Response.json({ error: `הבריף ארוך מדי (עד ${MAX_BRIEF_LENGTH} תווים)` }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const write = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          open = false; // client disconnected
        }
      };
      const send = (event: CampaignEvent) => write(`data: ${JSON.stringify(event)}\n\n`);

      // SSE comment lines keep proxies from closing an idle connection
      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      try {
        await runCampaign(brief, send, request.signal);
      } finally {
        clearInterval(heartbeat);
        if (open) controller.close();
        open = false;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
