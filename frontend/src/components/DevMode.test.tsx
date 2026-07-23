import type { ReactNode } from "react";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DevMode } from "@/components/DevMode";
import { DevModeProvider } from "@/context/dev-mode";

function setDesktopViewport() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => {
      const isMd =
        /min-width:\s*48rem|min-width:\s*768px|768px/.test(query) ||
        query === "(min-width: 768px)";
      return {
        matches: isMd,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as MediaQueryList;
    },
  });
}

function ndjsonResponse(lines: Record<string, unknown>[]) {
  const encoder = new TextEncoder();
  const payload = lines.map((o) => `${JSON.stringify(o)}\n`).join("");
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(payload));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }
  );
}

function TestRoot({ children }: { children: ReactNode }) {
  return (
    <div>
      <div data-testid="host">
        {children}
      </div>
      <DevModeProvider>
        <DevMode />
      </DevModeProvider>
    </div>
  );
}

const fetchMock = vi.fn();

const MOCK_HISTORY_AGENTS = [
  {
    agentId: "bc-history-1",
    name: "Demo Agent",
    summary: "A test cloud agent",
    lastModified: 1_700_000_000_000,
    createdAt: 1_699_900_000_000,
    status: "finished" as const,
    archived: false,
    runtime: "cloud" as const,
    repos: ["https://github.com/org/repo"],
    latestRun: {
      runId: "run-bc-1",
      status: "finished",
      createdAt: 1_699_910_000_000,
      outputSummary: "Shipped the chocolate checkout fix.",
      eventPreview: ["User: Hello", "Assistant: Done."],
    },
  },
  {
    agentId: "bc-history-2",
    name: "No Runs Yet",
    summary: "",
    lastModified: 1_699_800_000_000,
    createdAt: 1_699_700_000_000,
    status: "finished" as const,
    archived: false,
    runtime: "cloud" as const,
    repos: [],
  },
];

async function defaultDevModeFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  if (url.includes("/api/dev-mode/agent/send")) {
    return ndjsonResponse([
      { type: "system", model: { id: "composer-2" }, tools: ["grep"] },
      { type: "assistant", text: "Hello" },
      { type: "assistant", text: " world" },
      { type: "done", runStatus: "finished" },
    ]);
  }
  if (url.includes("/api/dev-mode/agent")) {
    const method = init?.method ?? "GET";
    if (method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    if (method === "GET") {
      return new Response(
        JSON.stringify({ agents: MOCK_HISTORY_AGENTS }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    if (method === "POST") {
      return new Response(JSON.stringify({ agentId: "bc-test-agent" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
  return new Response("not found", { status: 404 });
}

function historyGetCallCount(): number {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const url = typeof input === "string" ? input : input.toString();
    if (!url.includes("/api/dev-mode/agent")) {
      return false;
    }
    return (init?.method ?? "GET") === "GET";
  }).length;
}

describe("DevMode", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  beforeEach(() => {
    setDesktopViewport();
    fetchMock.mockImplementation(defaultDevModeFetch);
    vi.stubGlobal("fetch", fetchMock);
  });

  it("toggle starts in off state and enables dev mode on click", async () => {
    const user = userEvent.setup();
    render(
      <TestRoot>
        <p>Hello</p>
      </TestRoot>
    );

    const toggle = screen.getByRole("switch", { name: "Dev mode off" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Dev mode on" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("dev-mode-rail")).toBeInTheDocument();
    expect(screen.getByTestId("dev-mode-rail")).toHaveClass("bg-card-01/95");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/dev-mode/agent",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("streams agent events when submitting a prompt", async () => {
    const user = userEvent.setup();
    render(
      <TestRoot>
        <p>Host</p>
      </TestRoot>
    );

    await user.click(screen.getByRole("switch", { name: "Dev mode off" }));

    await waitFor(() => {
      expect(screen.getByTestId("dev-mode-agent-status")).toHaveTextContent(
        "Agent: connected"
      );
    });

    await user.type(screen.getByTestId("dev-mode-agent-prompt"), "Say hi");

    await waitFor(() => {
      expect(screen.getByTestId("dev-mode-agent-submit")).not.toBeDisabled();
    });

    await user.click(screen.getByTestId("dev-mode-agent-submit"));

    const rail = screen.getByTestId("dev-mode-rail");

    await waitFor(() => {
      expect(within(rail).getByTestId("dev-mode-agent-answer")).toHaveTextContent(
        "Hello world"
      );
    });

    expect(within(rail).getByText("Say hi")).toBeInTheDocument();
    expect(within(rail).getByTestId("dev-mode-agent-answer")).toHaveTextContent(
      "Hello world"
    );

    expect(screen.queryAllByTestId("dev-mode-agent-event")).toHaveLength(0);

    await user.click(within(rail).getByText("Details"));

    await waitFor(() => {
      expect(
        within(rail).getAllByTestId("dev-mode-agent-event").length
      ).toBeGreaterThan(0);
    });

    expect(screen.getByTestId("dev-mode-agent-prompt")).toHaveValue("");
    expect(screen.getByTestId("dev-mode-agent-submit")).toBeDisabled();

    await user.type(screen.getByTestId("dev-mode-agent-prompt"), "Again");

    expect(screen.getByTestId("dev-mode-agent-submit")).not.toBeDisabled();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/dev-mode/agent/send",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            agentId: "bc-test-agent",
            prompt: "Say hi",
          }),
        })
      );
    });
  });

  it("shows streaming progress and keeps raw events out of the DOM until Details is opened", async () => {
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/dev-mode/agent/send")) {
          const encoder = new TextEncoder();
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    `${JSON.stringify({
                      type: "tool_call",
                      name: "grep",
                      status: "running",
                      callId: "c1",
                    })}\n`
                  )
                );
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }
          );
        }
        return defaultDevModeFetch(input, init);
      }
    );

    const user = userEvent.setup();
    render(
      <TestRoot>
        <p>Host</p>
      </TestRoot>
    );

    await user.click(screen.getByRole("switch", { name: "Dev mode off" }));

    await waitFor(() => {
      expect(screen.getByTestId("dev-mode-agent-status")).toHaveTextContent(
        "Agent: connected"
      );
    });

    await user.type(screen.getByTestId("dev-mode-agent-prompt"), "Find code");
    await user.click(screen.getByTestId("dev-mode-agent-submit"));

    const rail = screen.getByTestId("dev-mode-rail");

    await waitFor(() => {
      expect(within(rail).getByTestId("dev-mode-agent-progress")).toHaveTextContent(
        /Running grep/i
      );
    });

    expect(screen.queryAllByTestId("dev-mode-agent-event")).toHaveLength(0);
  });

  it("disables submit while the cloud agent is connecting", async () => {
    let unblock!: () => void;
    const gate = new Promise<void>((resolve) => {
      unblock = resolve;
    });

    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/dev-mode/agent/send")) {
          return ndjsonResponse([{ type: "done", runStatus: "finished" }]);
        }
        if (url.includes("/api/dev-mode/agent")) {
          const method = init?.method ?? "GET";
          if (method === "DELETE") {
            return new Response(null, { status: 204 });
          }
          if (method === "GET") {
            return defaultDevModeFetch(input, init);
          }
          await gate;
          return new Response(JSON.stringify({ agentId: "bc-test-agent" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("not found", { status: 404 });
      }
    );

    const user = userEvent.setup();
    render(
      <TestRoot>
        <p>Hello</p>
      </TestRoot>
    );

    await user.click(screen.getByRole("switch", { name: "Dev mode off" }));

    expect(screen.getByTestId("dev-mode-agent-submit")).toBeDisabled();

    unblock();

    await waitFor(() => {
      expect(screen.getByTestId("dev-mode-agent-status")).toHaveTextContent(
        "Agent: connected"
      );
    });

    await user.type(screen.getByTestId("dev-mode-agent-prompt"), "x");

    await waitFor(() => {
      expect(screen.getByTestId("dev-mode-agent-submit")).not.toBeDisabled();
    });
  });

  it("keeps submit disabled when agent provisioning fails", async () => {
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/dev-mode/agent/send")) {
          return ndjsonResponse([{ type: "done", runStatus: "finished" }]);
        }
        if (url.includes("/api/dev-mode/agent")) {
          const method = init?.method ?? "GET";
          if (method === "DELETE") {
            return new Response(null, { status: 204 });
          }
          if (method === "GET") {
            return defaultDevModeFetch(input, init);
          }
          return new Response(JSON.stringify({ error: "no key" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("not found", { status: 404 });
      }
    );

    const user = userEvent.setup();
    render(
      <TestRoot>
        <p>Hello</p>
      </TestRoot>
    );

    await user.click(screen.getByRole("switch", { name: "Dev mode off" }));

    await waitFor(() => {
      expect(screen.getByTestId("dev-mode-agent-status")).toHaveTextContent(
        "Agent: error"
      );
    });

    expect(screen.getByTestId("dev-mode-agent-submit")).toBeDisabled();
  });

  it("with dev mode on, selecting an element shows a collapsed inspector in the rail", async () => {
    const user = userEvent.setup();
    render(
      <TestRoot>
        <p id="pick" className="prose" data-foo="bar">
          target text
        </p>
      </TestRoot>
    );

    await user.click(screen.getByRole("switch", { name: "Dev mode off" }));

    const rail = screen.getByTestId("dev-mode-rail");
    expect(rail).toBeInTheDocument();
    expect(screen.getByTestId("dev-mode-rail-primary-slot")).toBeInTheDocument();

    const p = within(screen.getByTestId("host")).getByText("target text");
    await user.click(p);

    const details = screen.getByTestId("dev-mode-element-details");
    expect(details).not.toHaveAttribute("open");
    expect(within(rail).getByText("#pick")).toBeInTheDocument();
    expect(within(rail).getByText(/p#pick\.prose/)).toBeInTheDocument();

    await user.click(screen.getByTestId("dev-mode-element-details-summary"));
    expect(details).toHaveAttribute("open");
    expect(within(rail).getByText("Tag & identity")).toBeInTheDocument();
    expect(rail.textContent).toMatch(/<p>/);
    expect(rail.textContent).toContain("pick");
    expect(
      within(rail).getByText("prose", { selector: "p.text-muted-foreground" })
    ).toBeInTheDocument();
    expect(within(rail).getByText("data-foo")).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Dev mode on" }));
    expect(screen.queryByTestId("dev-mode-rail")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dev-mode-element-details")).not.toBeInTheDocument();
    const toggles = screen.getAllByRole("switch", { name: "Dev mode off" });
    expect(toggles[0]).toHaveAttribute("aria-checked", "false");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/dev-mode/agent",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ agentId: "bc-test-agent" }),
        })
      );
    });
  });

  it("loads history once on first open and reuses cached data on tab re-open", async () => {
    const user = userEvent.setup();
    render(
      <TestRoot>
        <p>Hello</p>
      </TestRoot>
    );

    await user.click(screen.getByRole("switch", { name: "Dev mode off" }));

    await waitFor(() => {
      expect(screen.getByTestId("dev-mode-agent-status")).toHaveTextContent(
        "Agent: connected"
      );
    });

    expect(historyGetCallCount()).toBe(0);

    await user.click(screen.getByTestId("dev-mode-tab-history"));

    await waitFor(() => {
      expect(historyGetCallCount()).toBe(1);
    });

    const rail = screen.getByTestId("dev-mode-rail");
    await waitFor(() => {
      expect(
        within(rail).getAllByTestId("dev-mode-agent-history-card").length
      ).toBe(2);
    });
    expect(within(rail).getByText("Demo Agent")).toBeInTheDocument();
    expect(within(rail).getByText("bc-history-1")).toBeInTheDocument();
    expect(within(rail).getByText(/github\.com\/org\/repo/)).toBeInTheDocument();

    const cards = within(rail).getAllByTestId("dev-mode-agent-history-card");
    expect(cards.length).toBe(2);
    expect(
      within(cards[0]!).getByTestId("dev-mode-agent-history-latest-run")
    ).toHaveTextContent("run-bc-1");
    expect(
      within(cards[0]!).getByText(/Shipped the chocolate checkout fix/)
    ).toBeInTheDocument();
    expect(
      within(cards[1]!).getByTestId("dev-mode-agent-history-no-run")
    ).toBeInTheDocument();
    await user.click(screen.getByTestId("dev-mode-tab-agent"));
    await user.click(screen.getByTestId("dev-mode-tab-history"));
    expect(historyGetCallCount()).toBe(1);
  });

  it("refetches history once after a prompt stream completes when History was loaded", async () => {
    const user = userEvent.setup();
    render(
      <TestRoot>
        <p>Hello</p>
      </TestRoot>
    );

    await user.click(screen.getByRole("switch", { name: "Dev mode off" }));

    await waitFor(() => {
      expect(screen.getByTestId("dev-mode-agent-status")).toHaveTextContent(
        "Agent: connected"
      );
    });

    await user.click(screen.getByTestId("dev-mode-tab-history"));

    await waitFor(() => {
      expect(historyGetCallCount()).toBe(1);
    });

    await user.click(screen.getByTestId("dev-mode-tab-agent"));

    await user.type(screen.getByTestId("dev-mode-agent-prompt"), "Say hi");

    await waitFor(() => {
      expect(screen.getByTestId("dev-mode-agent-submit")).not.toBeDisabled();
    });

    await user.click(screen.getByTestId("dev-mode-agent-submit"));

    const rail = screen.getByTestId("dev-mode-rail");

    await waitFor(() => {
      expect(within(rail).getByTestId("dev-mode-agent-answer")).toHaveTextContent(
        "Hello world"
      );
    });

    await waitFor(() => {
      expect(historyGetCallCount()).toBe(2);
    });
  });

  it("shows per-agent detail error when latest run enrichment fails", async () => {
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/dev-mode/agent/send")) {
          return ndjsonResponse([{ type: "done", runStatus: "finished" }]);
        }
        if (url.includes("/api/dev-mode/agent")) {
          const method = init?.method ?? "GET";
          if (method === "DELETE") {
            return new Response(null, { status: 204 });
          }
          if (method === "GET") {
            return new Response(
              JSON.stringify({
                agents: [
                  {
                    agentId: "bc-bad",
                    name: "Broken detail",
                    summary: "",
                    lastModified: 1,
                    detailError: "cannot list runs",
                  },
                ],
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
          return new Response(JSON.stringify({ agentId: "bc-test-agent" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("not found", { status: 404 });
      }
    );

    const user = userEvent.setup();
    render(
      <TestRoot>
        <p>Hello</p>
      </TestRoot>
    );

    await user.click(screen.getByRole("switch", { name: "Dev mode off" }));

    await waitFor(() => {
      expect(screen.getByTestId("dev-mode-agent-status")).toHaveTextContent(
        "Agent: connected"
      );
    });

    await user.click(screen.getByTestId("dev-mode-tab-history"));

    await waitFor(() => {
      expect(
        screen.getByTestId("dev-mode-agent-history-detail-error")
      ).toHaveTextContent("cannot list runs");
    });
  });

  it("shows history error when listing agents fails", async () => {
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/dev-mode/agent/send")) {
          return ndjsonResponse([{ type: "done", runStatus: "finished" }]);
        }
        if (url.includes("/api/dev-mode/agent")) {
          const method = init?.method ?? "GET";
          if (method === "DELETE") {
            return new Response(null, { status: 204 });
          }
          if (method === "GET") {
            return new Response(JSON.stringify({ error: "list failed" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ agentId: "bc-test-agent" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("not found", { status: 404 });
      }
    );

    const user = userEvent.setup();
    render(
      <TestRoot>
        <p>Hello</p>
      </TestRoot>
    );

    await user.click(screen.getByRole("switch", { name: "Dev mode off" }));

    await waitFor(() => {
      expect(screen.getByTestId("dev-mode-agent-status")).toHaveTextContent(
        "Agent: connected"
      );
    });

    await user.click(screen.getByTestId("dev-mode-tab-history"));

    await waitFor(() => {
      expect(screen.getByTestId("dev-mode-agent-history-error")).toHaveTextContent(
        "list failed"
      );
    });
  });
});
