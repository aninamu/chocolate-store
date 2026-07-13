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

  it("returns 400 for invalid JSON body", async () => {
    const response = await POST(
      new Request(REQUEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 400 when agentId is missing", async () => {
    const response = await POST(
      new Request(REQUEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "hello" }),
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("agentId is required");
  });

  it("returns 400 when prompt is empty", async () => {
    const response = await POST(makeRequest("agent-1", "   "));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("prompt is required");
  });

  it("returns 404 for unknown agent", async () => {
    const response = await POST(makeRequest("missing-agent", "hello"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe("Unknown agent");
  });

  it("streams mapped SDK messages and done event on success", async () => {
    const agentId = "agent-happy";
    const waitMock = vi.fn(async () => ({ status: "finished" as const }));
    const run = {
      stream: async function* (): AsyncGenerator<SDKMessage> {
        yield {
          type: "assistant",
          message: { content: [{ type: "text", text: "Hello" }] },
        } as SDKMessage;
        yield {
          type: "thinking",
          text: "Hmm",
        } as SDKMessage;
        yield {
          type: "tool_call",
          name: "read_file",
          status: "completed",
          call_id: "call-1",
        } as SDKMessage;
        yield {
          type: "status",
          status: "running",
          message: "Working",
        } as SDKMessage;
        yield {
          type: "task",
          status: "done",
          text: "Finished task",
        } as SDKMessage;
        yield {
          type: "system",
          model: "composer-2",
          tools: [],
        } as SDKMessage;
      },
      wait: waitMock,
      cancel: vi.fn(async () => {}),
    } as unknown as Run;
    const sendMock = vi.fn(async () => run);
    agents.set(agentId, { send: sendMock } as unknown as SDKAgent);

    const response = await POST(makeRequest(agentId, "hello"));
    const lines = await readNdjson(response);

    expect(sendMock).toHaveBeenCalledWith("hello");
    expect(waitMock).toHaveBeenCalledTimes(1);
    expect(lines).toContainEqual({ type: "assistant", text: "Hello" });
    expect(lines).toContainEqual({ type: "thinking", text: "Hmm" });
    expect(lines).toContainEqual({
      type: "tool_call",
      name: "read_file",
      status: "completed",
      callId: "call-1",
    });
    expect(lines).toContainEqual({
      type: "status",
      status: "running",
      message: "Working",
    });
    expect(lines).toContainEqual({
      type: "task",
      status: "done",
      text: "Finished task",
    });
    expect(lines).toContainEqual({
      type: "system",
      model: "composer-2",
      tools: [],
    });
    expect(lines).toContainEqual({ type: "done", runStatus: "finished" });
  });
});
