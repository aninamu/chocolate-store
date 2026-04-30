import type { Run, SDKAgent, SDKMessage } from "@cursor/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import { agents } from "@/server/dev-mode-agents";

import { POST } from "./route";

const REQUEST_URL = "http://localhost/api/dev-mode/agent/send";

function makeRequest(
  agentId: string,
  prompt: string,
  signal?: AbortSignal
): Request {
  return new Request(REQUEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, prompt }),
    signal,
  });
}

async function readNdjson(response: Response): Promise<Record<string, unknown>[]> {
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("POST /api/dev-mode/agent/send", () => {
  afterEach(() => {
    agents.clear();
    vi.restoreAllMocks();
  });

  it("closes the stream without calling wait after request abort", async () => {
    const agentId = "agent-abort";
    let releaseStream: (() => void) | null = null;
    const waitMock = vi.fn(() => new Promise<never>(() => {}));
    const cancelMock = vi.fn(async () => {
      releaseStream?.();
    });

    const run = {
      stream: async function* (): AsyncGenerator<SDKMessage> {
        yield {
          type: "assistant",
          message: { content: [{ type: "text", text: "partial" }] },
        } as SDKMessage;
        await new Promise<void>((resolve) => {
          releaseStream = resolve;
        });
      },
      wait: waitMock,
      cancel: cancelMock,
    } as unknown as Run;
    const sendMock = vi.fn(async () => run);
    agents.set(agentId, { send: sendMock } as unknown as SDKAgent);

    const ac = new AbortController();
    const response = await POST(makeRequest(agentId, "hello", ac.signal));
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const firstChunk = await reader!.read();
    expect(firstChunk.done).toBe(false);

    ac.abort();

    const doneChunk = await Promise.race([
      reader!.read(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timed out waiting for stream close")), 300);
      }),
    ]);

    expect(doneChunk.done).toBe(true);
    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(waitMock).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("does not call wait a second time when wait throws", async () => {
    const agentId = "agent-wait-fail";
    const waitMock = vi.fn(async () => {
      throw new Error("wait failed");
    });

    const run = {
      stream: async function* (): AsyncGenerator<SDKMessage> {},
      wait: waitMock,
      cancel: vi.fn(async () => {}),
    } as unknown as Run;
    const sendMock = vi.fn(async () => run);
    agents.set(agentId, { send: sendMock } as unknown as SDKAgent);

    const response = await POST(makeRequest(agentId, "hello"));
    const lines = await readNdjson(response);

    expect(waitMock).toHaveBeenCalledTimes(1);
    expect(lines).toContainEqual({ type: "error", message: "wait failed" });
    expect(lines).toContainEqual({ type: "done", runStatus: "error" });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
