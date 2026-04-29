import type { SDKMessage, TextBlock, ToolUseBlock } from "@cursor/sdk";
import type { Run } from "@cursor/sdk";

import { agents } from "@/server/dev-mode-agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendBody = {
  agentId?: unknown;
  prompt?: unknown;
};

function assistantTextBlocks(content: Array<TextBlock | ToolUseBlock>): string {
  let out = "";
  for (const block of content) {
    if (block.type === "text") {
      out += block.text;
    }
  }
  return out;
}

function mapSdkMessage(msg: SDKMessage): Record<string, unknown> | null {
  switch (msg.type) {
    case "assistant":
      return {
        type: "assistant",
        text: assistantTextBlocks(msg.message.content),
      };
    case "system":
      return {
        type: "system",
        model: msg.model,
        tools: msg.tools,
      };
    case "thinking":
      return {
        type: "thinking",
        text: msg.text,
      };
    case "tool_call":
      return {
        type: "tool_call",
        name: msg.name,
        status: msg.status,
        callId: msg.call_id,
      };
    case "status":
      return {
        type: "status",
        status: msg.status,
        message: msg.message,
      };
    case "task":
      return {
        type: "task",
        status: msg.status,
        text: msg.text,
      };
    case "user":
    case "request":
      return null;
    default: {
      const _never: never = msg;
      void _never;
      return null;
    }
  }
}

export async function POST(request: Request) {
  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const agentId =
    typeof body.agentId === "string" && body.agentId.length > 0
      ? body.agentId
      : null;
  const prompt =
    typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (!agentId) {
    return Response.json({ error: "agentId is required" }, { status: 400 });
  }
  if (!prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const agent = agents.get(agentId);
  if (!agent) {
    return Response.json({ error: "Unknown agent" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const enqueue = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    obj: Record<string, unknown>
  ) => {
    controller.enqueue(
      encoder.encode(`${JSON.stringify(obj)}\n`)
    );
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let run: Run | null = null;
      const onAbort = () => {
        void run?.cancel();
      };
      request.signal.addEventListener("abort", onAbort);

      try {
        run = await agent.send(prompt);

        for await (const msg of run.stream()) {
          if (request.signal.aborted) {
            await run.cancel();
            break;
          }
          const line = mapSdkMessage(msg);
          if (line) {
            enqueue(controller, line);
          }
        }

        const result = await run.wait();
        enqueue(controller, { type: "done", runStatus: result.status });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        enqueue(controller, { type: "error", message });
        if (run) {
          try {
            const result = await run.wait();
            enqueue(controller, { type: "done", runStatus: result.status });
          } catch {
            enqueue(controller, { type: "done", runStatus: "error" });
          }
        } else {
          enqueue(controller, { type: "done", runStatus: "error" });
        }
      } finally {
        request.signal.removeEventListener("abort", onAbort);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
