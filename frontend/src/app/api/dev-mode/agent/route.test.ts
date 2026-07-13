import fs from "node:fs";

import type { Run, SDKAgent, SDKAgentInfo } from "@cursor/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { agents } from "@/server/dev-mode-agents";

const listMock = vi.fn();
const createMock = vi.fn();
const listRunsMock = vi.fn();

vi.mock("@cursor/sdk", () => ({
  Agent: {
    list: (...args: unknown[]) => listMock(...args),
    create: (...args: unknown[]) => createMock(...args),
    listRuns: (...args: unknown[]) => listRunsMock(...args),
  },
}));

import { DELETE, GET, POST } from "./route";

const MOCK_AGENT: SDKAgentInfo = {
  agentId: "agent-1",
  name: "Test Agent",
  summary: "Summary",
  lastModified: 1_700_000_000_000,
  createdAt: 1_699_900_000_000,
  status: "finished",
  archived: false,
  runtime: "cloud",
  repos: ["https://github.com/org/repo"],
};

function makeDeleteRequest(body: unknown): Request {
  return new Request("http://localhost/api/dev-mode/agent", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/dev-mode/agent", () => {
  beforeEach(() => {
    listMock.mockReset();
    listRunsMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 when CURSOR_API_KEY is missing", async () => {
    vi.stubEnv("CURSOR_API_KEY", "");

    const response = await GET();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toContain("CURSOR_API_KEY");
    expect(listMock).not.toHaveBeenCalled();
  });

  it("lists agents and enriches with latest run", async () => {
    vi.stubEnv("CURSOR_API_KEY", "test-key");
    listMock.mockResolvedValueOnce({
      items: [MOCK_AGENT],
      nextCursor: "cursor-2",
    });

    const run = {
      id: "run-1",
      status: "finished",
      createdAt: 1_699_910_000_000,
      conversation: vi.fn(async () => [
        {
          type: "agentConversationTurn",
          turn: {
            userMessage: { text: "Hello" },
            steps: [
              {
                type: "assistantMessage",
                message: { text: "Hi there" },
              },
            ],
          },
        },
      ]),
    } as unknown as Run;

    listRunsMock.mockResolvedValueOnce({ items: [run] });

    const response = await GET();
    const body = (await response.json()) as {
      agents: Array<{ agentId: string; latestRun?: { runId: string } }>;
      nextCursor: string;
    };

    expect(response.status).toBe(200);
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0]?.agentId).toBe("agent-1");
    expect(body.agents[0]?.latestRun?.runId).toBe("run-1");
    expect(body.nextCursor).toBe("cursor-2");
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-key", runtime: "cloud" })
    );
  });

  it("returns 500 when Agent.list throws", async () => {
    vi.stubEnv("CURSOR_API_KEY", "test-key");
    listMock.mockRejectedValueOnce(new Error("list failed"));

    const response = await GET();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe("list failed");
  });
});

describe("POST /api/dev-mode/agent", () => {
  beforeEach(() => {
    createMock.mockReset();
    agents.clear();
  });

  afterEach(() => {
    agents.clear();
    vi.unstubAllEnvs();
  });

  it("returns 503 when CURSOR_API_KEY is missing", async () => {
    vi.stubEnv("CURSOR_API_KEY", "");

    const response = await POST();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toContain("CURSOR_API_KEY");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns 400 when repository URL cannot be resolved", async () => {
    vi.stubEnv("CURSOR_API_KEY", "test-key");
    vi.stubEnv("CURSOR_DEV_MODE_REPO_URL", "");
    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);

    const response = await POST();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("repository URL");
    expect(createMock).not.toHaveBeenCalled();

    existsSpy.mockRestore();
  });

  it("creates an agent and stores it in devModeAgents", async () => {
    vi.stubEnv("CURSOR_API_KEY", "test-key");
    vi.stubEnv("CURSOR_DEV_MODE_REPO_URL", "https://github.com/org/repo");

    const mockAgent = {
      agentId: "new-agent",
      close: vi.fn(),
    } as unknown as SDKAgent;
    createMock.mockResolvedValueOnce(mockAgent);

    const response = await POST();
    const body = (await response.json()) as { agentId: string };

    expect(response.status).toBe(200);
    expect(body.agentId).toBe("new-agent");
    expect(agents.get("new-agent")).toBe(mockAgent);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "test-key",
        cloud: { repos: [{ url: "https://github.com/org/repo", startingRef: "main" }] },
      })
    );
  });

  it("returns 500 when Agent.create throws", async () => {
    vi.stubEnv("CURSOR_API_KEY", "test-key");
    vi.stubEnv("CURSOR_DEV_MODE_REPO_URL", "https://github.com/org/repo");
    createMock.mockRejectedValueOnce(new Error("create failed"));

    const response = await POST();
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe("create failed");
  });
});

describe("DELETE /api/dev-mode/agent", () => {
  afterEach(() => {
    agents.clear();
  });

  it("returns 400 for invalid JSON body", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/dev-mode/agent", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 400 when agentId is missing", async () => {
    const response = await DELETE(makeDeleteRequest({}));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("agentId is required");
  });

  it("closes and removes a known agent", async () => {
    const closeMock = vi.fn();
    agents.set("agent-del", { close: closeMock } as unknown as SDKAgent);

    const response = await DELETE(makeDeleteRequest({ agentId: "agent-del" }));

    expect(response.status).toBe(204);
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(agents.has("agent-del")).toBe(false);
  });

  it("returns 204 even when agent is not in the local map", async () => {
    const response = await DELETE(makeDeleteRequest({ agentId: "missing-agent" }));

    expect(response.status).toBe(204);
  });
});
