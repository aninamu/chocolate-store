"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MutableRefObject,
} from "react";

import { ChevronRight, Loader2, RefreshCw, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildElementSnapshot,
  isInsideDevModeUi,
  useDevMode,
  type DevModeElementSnapshot,
} from "@/context/dev-mode";

type HoverHighlight = {
  top: number;
  left: number;
  width: number;
  height: number;
  label: string;
};

const DEV_MODE_OUTLINE_BOX_SHADOW =
  "0 0 0 2px #f54e00, 0 0 0 4px rgba(245, 78, 0, 0.25)";

function DevModeHoverOutline({
  highlight,
}: {
  highlight: HoverHighlight | null;
}) {
  if (!highlight) {
    return null;
  }
  return (
    <div
      className="pointer-events-none fixed z-[59] rounded-sm"
      data-dev-mode-ui=""
      style={{
        top: highlight.top,
        left: highlight.left,
        width: highlight.width,
        height: highlight.height,
        boxShadow: DEV_MODE_OUTLINE_BOX_SHADOW,
      }}
      aria-hidden
    >
      <span className="absolute -top-6 left-0 rounded bg-[#f54e00] px-1.5 py-0.5 font-mono text-[0.7rem] font-medium text-white shadow-sm">
        {highlight.label}
      </span>
    </div>
  );
}

function DevModeSelectionOutline() {
  const { selected, selectedElementRef } = useDevMode();
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!selected) {
      setRect(null);
      return;
    }

    const readRect = () => {
      const el = selectedElementRef.current;
      if (el?.isConnected) {
        const r = el.getBoundingClientRect();
        setRect({
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        });
        return;
      }
      setRect({
        top: selected.rect.top,
        left: selected.rect.left,
        width: selected.rect.width,
        height: selected.rect.height,
      });
    };

    readRect();
    const onScroll = () => readRect();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", readRect);

    const el = selectedElementRef.current;
    let ro: ResizeObserver | null = null;
    if (el?.isConnected && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => readRect());
      ro.observe(el);
    }

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", readRect);
      ro?.disconnect();
    };
  }, [selected, selectedElementRef]);

  if (!selected || !rect) {
    return null;
  }

  return (
    <div
      data-dev-mode-ui=""
      className="pointer-events-none fixed z-[58] rounded-sm"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        boxShadow: DEV_MODE_OUTLINE_BOX_SHADOW,
      }}
      aria-hidden
    />
  );
}

const DEV_MODE_RAIL_WIDTH_REM = 18; // w-72

type DevModeRailTab = "agent" | "history";

/** Shape returned by GET /api/dev-mode/agent (SDK cloud agent list entries). */
type LatestRunInfo = {
  runId: string;
  status: string;
  createdAt?: number;
  outputSummary: string;
  eventPreview: string[];
};

type CloudAgentHistoryEntry = {
  agentId: string;
  name: string;
  summary: string;
  lastModified: number;
  createdAt?: number;
  status?: "running" | "finished" | "error";
  archived?: boolean;
  runtime?: "cloud";
  repos?: string[];
  latestRun?: LatestRunInfo;
  detailError?: string;
};

function formatAgentTimestamp(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms)) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return String(ms);
  }
}

type AgentStreamEvent =
  | { type: "system"; model?: unknown; tools?: string[] }
  | { type: "assistant"; text: string }
  | { type: "thinking"; text: string }
  | {
      type: "tool_call";
      name: string;
      status: string;
      callId: string;
    }
  | { type: "status"; status: string; message?: string }
  | { type: "task"; status?: string; text?: string }
  | { type: "error"; message: string }
  | { type: "done"; runStatus: string };

type AgentTurn = {
  id: string;
  prompt: string;
  events: AgentStreamEvent[];
  status: "streaming" | "done" | "error";
};

type TurnView = {
  assistantText: string;
  errorMessage: string | null;
  runStatus: string | null;
  toolCallCount: number;
};

function summarizeTurn(turn: AgentTurn): TurnView {
  let assistantText = "";
  let errorMessage: string | null = null;
  let runStatus: string | null = null;
  let toolCallCount = 0;

  for (const ev of turn.events) {
    switch (ev.type) {
      case "assistant":
        assistantText += ev.text;
        break;
      case "tool_call":
        toolCallCount += 1;
        break;
      case "error":
        if (!errorMessage) {
          errorMessage = ev.message;
        }
        break;
      case "done":
        runStatus = ev.runStatus;
        break;
      default:
        break;
    }
  }

  return {
    assistantText,
    errorMessage,
    runStatus,
    toolCallCount,
  };
}

function streamingProgressLabel(events: AgentStreamEvent[]): string {
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.type === "task") {
      const line = ev.text?.trim() || ev.status?.trim();
      if (line) {
        return line;
      }
    }
  }
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.type === "tool_call" && ev.name.length > 0) {
      return `Running ${ev.name}…`;
    }
  }
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.type === "thinking") {
      return "Thinking…";
    }
  }
  let assistantSoFar = "";
  for (const ev of events) {
    if (ev.type === "assistant") {
      assistantSoFar += ev.text;
    }
  }
  if (assistantSoFar.trim().length > 0) {
    return "Writing response…";
  }
  return "Working…";
}

function parseAgentStreamLine(raw: string): AgentStreamEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
    return null;
  }
  const t = (parsed as { type: unknown }).type;
  if (typeof t !== "string") {
    return null;
  }
  switch (t) {
    case "system":
      return {
        type: "system",
        model: (parsed as { model?: unknown }).model,
        tools: (parsed as { tools?: string[] }).tools,
      };
    case "assistant":
      return {
        type: "assistant",
        text: String((parsed as { text?: unknown }).text ?? ""),
      };
    case "thinking":
      return {
        type: "thinking",
        text: String((parsed as { text?: unknown }).text ?? ""),
      };
    case "tool_call":
      return {
        type: "tool_call",
        name: String((parsed as { name?: unknown }).name ?? ""),
        status: String((parsed as { status?: unknown }).status ?? ""),
        callId: String((parsed as { callId?: unknown }).callId ?? ""),
      };
    case "status": {
      const rec = parsed as Record<string, unknown>;
      const statusMsg = rec.message;
      return {
        type: "status",
        status: String(rec.status ?? ""),
        message: typeof statusMsg === "string" ? statusMsg : undefined,
      };
    }
    case "task": {
      const rec = parsed as Record<string, unknown>;
      const taskStatus = rec.status;
      const taskText = rec.text;
      return {
        type: "task",
        status: typeof taskStatus === "string" ? taskStatus : undefined,
        text: typeof taskText === "string" ? taskText : undefined,
      };
    }
    case "error":
      return {
        type: "error",
        message: String((parsed as { message?: unknown }).message ?? ""),
      };
    case "done":
      return {
        type: "done",
        runStatus: String((parsed as { runStatus?: unknown }).runStatus ?? ""),
      };
    default:
      return null;
  }
}

function DevModeAgentEventRow({ ev }: { ev: AgentStreamEvent }) {
  switch (ev.type) {
    case "assistant":
      return (
        <div
          data-testid="dev-mode-agent-event"
          className="border-border/40 rounded border bg-card-02/40 px-2 py-1 font-mono text-[0.65rem] dark:bg-card-01/30"
        >
          <span className="text-primary">assistant</span>
          <pre className="text-foreground mt-0.5 max-h-32 overflow-auto whitespace-pre-wrap break-all">
            {ev.text}
          </pre>
        </div>
      );
    case "system":
      return (
        <div
          data-testid="dev-mode-agent-event"
          className="border-border/40 rounded border bg-card-02/40 px-2 py-1 font-mono text-[0.65rem] dark:bg-card-01/30"
        >
          <span className="text-primary">system</span>
          <pre className="text-muted-foreground mt-0.5 max-h-24 overflow-auto text-[0.65rem] break-all whitespace-pre-wrap">
            {JSON.stringify({ model: ev.model, tools: ev.tools }, null, 2)}
          </pre>
        </div>
      );
    case "thinking":
      return (
        <div
          data-testid="dev-mode-agent-event"
          className="border-border/40 rounded border bg-card-02/40 px-2 py-1 font-mono text-[0.65rem] dark:bg-card-01/30"
        >
          <span className="text-primary">thinking</span>
          <pre className="text-muted-foreground mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap break-all">
            {ev.text}
          </pre>
        </div>
      );
    case "tool_call":
      return (
        <div
          data-testid="dev-mode-agent-event"
          className="border-border/40 rounded border bg-card-02/40 px-2 py-1 font-mono text-[0.65rem] dark:bg-card-01/30"
        >
          <span className="text-primary">tool_call</span>{" "}
          <span className="text-foreground">{ev.name}</span>{" "}
          <span className="text-muted-foreground">{ev.status}</span>{" "}
          <span className="text-muted-foreground/80">{ev.callId}</span>
        </div>
      );
    case "status":
      return (
        <div
          data-testid="dev-mode-agent-event"
          className="border-border/40 rounded border bg-card-02/40 px-2 py-1 font-mono text-[0.65rem] dark:bg-card-01/30"
        >
          <span className="text-primary">status</span>{" "}
          <span className="text-foreground">{ev.status}</span>
          {ev.message ? (
            <span className="text-muted-foreground"> · {ev.message}</span>
          ) : null}
        </div>
      );
    case "task":
      return (
        <div
          data-testid="dev-mode-agent-event"
          className="border-border/40 rounded border bg-card-02/40 px-2 py-1 font-mono text-[0.65rem] dark:bg-card-01/30"
        >
          <span className="text-primary">task</span>
          {ev.status ? (
            <span className="text-foreground"> {ev.status}</span>
          ) : null}
          {ev.text ? (
            <pre className="text-muted-foreground mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap break-all">
              {ev.text}
            </pre>
          ) : null}
        </div>
      );
    case "error":
      return (
        <div
          data-testid="dev-mode-agent-event"
          className="border-destructive/40 rounded border bg-destructive/10 px-2 py-1 font-mono text-[0.65rem]"
        >
          <span className="text-destructive">error</span>{" "}
          <span className="text-foreground">{ev.message}</span>
        </div>
      );
    case "done":
      return (
        <div
          data-testid="dev-mode-agent-event"
          className="text-muted-foreground font-mono text-[0.65rem]"
        >
          <span className="text-primary">done</span> {ev.runStatus}
        </div>
      );
    default: {
      const _exhaustive: never = ev;
      void _exhaustive;
      return null;
    }
  }
}

function DevModeAgentTurnCard({ turn }: { turn: AgentTurn }) {
  const view = useMemo(() => summarizeTurn(turn), [turn]);
  const [rawDetailsOpen, setRawDetailsOpen] = useState(false);

  const progressLabel = useMemo(
    () => streamingProgressLabel(turn.events),
    [turn.events]
  );

  const doneFooter =
    turn.status === "done" && !view.errorMessage ? (
      view.runStatus || view.toolCallCount > 0 ? (
        <p className="text-muted-foreground mt-2 text-[0.65rem]">
          {view.runStatus ? (
            <>
              <span className="capitalize">{view.runStatus}</span>
              {view.toolCallCount > 0 ? (
                <>
                  {" "}
                  · {view.toolCallCount}{" "}
                  {view.toolCallCount === 1 ? "tool" : "tools"} used
                </>
              ) : null}
            </>
          ) : (
            <>
              {view.toolCallCount}{" "}
              {view.toolCallCount === 1 ? "tool" : "tools"} used
            </>
          )}
        </p>
      ) : null
    ) : null;

  return (
    <div className="border-border/60 bg-background/30 space-y-1.5 rounded-lg border p-2">
      <div className="text-muted-foreground text-[0.6rem] font-semibold uppercase">
        You
      </div>
      <p className="text-foreground text-xs break-words">{turn.prompt}</p>

      {turn.status === "streaming" ? (
        <div
          data-testid="dev-mode-agent-progress"
          className="border-border/40 bg-card-02/40 flex items-center gap-2 rounded border px-2 py-2 dark:bg-card-01/30"
        >
          <Loader2
            aria-hidden
            className="text-primary size-4 shrink-0 animate-spin"
          />
          <span className="text-foreground text-xs">{progressLabel}</span>
        </div>
      ) : null}

      {turn.status === "error" && view.errorMessage ? (
        <div
          data-testid="dev-mode-agent-error"
          className="border-destructive/40 rounded border bg-destructive/10 px-2 py-2 text-sm"
        >
          <span className="text-destructive font-medium">Error</span>
          <p className="text-foreground mt-1 text-xs break-words">
            {view.errorMessage}
          </p>
        </div>
      ) : null}

      {turn.status !== "streaming" && turn.status !== "error" ? (
        <div className="space-y-1">
          <div className="text-muted-foreground text-[0.6rem] font-semibold uppercase">
            Agent
          </div>
          <div className="border-border/40 bg-card-02/50 rounded border px-2.5 py-2 dark:bg-card-01/40">
            <p
              data-testid="dev-mode-agent-answer"
              className="text-foreground whitespace-pre-wrap break-words text-sm leading-relaxed"
            >
              {view.assistantText.trim().length > 0
                ? view.assistantText
                : "—"}
            </p>
            {doneFooter}
          </div>
        </div>
      ) : null}

      {turn.events.length > 0 ? (
        <details
          data-testid="dev-mode-agent-turn-details"
          open={rawDetailsOpen}
          onToggle={(e) => {
            setRawDetailsOpen(e.currentTarget.open);
          }}
          className="group text-xs"
        >
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            {turn.status === "streaming" ? "Raw stream events" : "Details"}
          </summary>
          {rawDetailsOpen ? (
            <div className="mt-1.5 space-y-1">
              {turn.events.map((ev, i) => (
                <DevModeAgentEventRow
                  key={`${turn.id}-ev-${i}`}
                  ev={ev}
                />
              ))}
            </div>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}

function parseLatestRun(raw: unknown): LatestRunInfo | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const lr = raw as Record<string, unknown>;
  const runId = typeof lr.runId === "string" ? lr.runId : "";
  const status = typeof lr.status === "string" ? lr.status : "";
  const outputSummary =
    typeof lr.outputSummary === "string" ? lr.outputSummary : "";
  if (!runId || !status) {
    return undefined;
  }
  const eventPreview = Array.isArray(lr.eventPreview)
    ? lr.eventPreview.filter((x): x is string => typeof x === "string")
    : [];
  const createdAt =
    typeof lr.createdAt === "number" ? lr.createdAt : undefined;
  return {
    runId,
    status,
    createdAt,
    outputSummary,
    eventPreview,
  };
}

function DevModeAgentHistoryCard({ agent }: { agent: CloudAgentHistoryEntry }) {
  const repos =
    agent.runtime === "cloud" && agent.repos && agent.repos.length > 0
      ? agent.repos
      : [];

  return (
    <div
      data-testid="dev-mode-agent-history-card"
      className="border-border/60 bg-background/30 space-y-1.5 rounded-lg border p-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-1.5">
        <p className="text-foreground min-w-0 flex-1 text-xs font-medium break-words">
          {agent.name.trim().length > 0 ? agent.name : "Untitled agent"}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {agent.archived ? (
            <Badge variant="secondary" className="text-[0.65rem]">
              Archived
            </Badge>
          ) : null}
          {agent.status ? (
            <Badge variant="outline" className="text-[0.65rem] capitalize">
              {agent.status}
            </Badge>
          ) : null}
        </div>
      </div>
      {agent.summary.trim().length > 0 ? (
        <p className="text-muted-foreground line-clamp-3 text-[0.65rem] break-words">
          {agent.summary}
        </p>
      ) : null}
      <p className="text-muted-foreground font-mono text-[0.6rem] break-all">
        {agent.agentId}
      </p>
      <div className="text-muted-foreground flex flex-col gap-0.5 text-[0.6rem]">
        <p>
          <span className="font-medium text-foreground/80">Modified:</span>{" "}
          {formatAgentTimestamp(agent.lastModified)}
        </p>
        <p>
          <span className="font-medium text-foreground/80">Created:</span>{" "}
          {formatAgentTimestamp(agent.createdAt)}
        </p>
      </div>
      {repos.length > 0 ? (
        <p className="text-muted-foreground text-[0.6rem] break-all">
          <span className="font-medium text-foreground/80">Repos:</span>{" "}
          {repos.join(", ")}
        </p>
      ) : null}

      {agent.detailError ? (
        <div
          data-testid="dev-mode-agent-history-detail-error"
          className="border-border/50 rounded border bg-muted/35 px-2 py-1.5 text-[0.6rem]"
        >
          <span className="font-medium text-foreground">Latest run detail</span>
          <p className="text-muted-foreground mt-0.5 break-words">
            {agent.detailError}
          </p>
        </div>
      ) : null}

      {agent.latestRun ? (
        <div
          data-testid="dev-mode-agent-history-latest-run"
          className="border-border/50 space-y-1.5 rounded border bg-card-02/35 px-2 py-1.5 dark:bg-card-01/25"
        >
          <p className="text-muted-foreground text-[0.6rem] font-semibold uppercase tracking-wide">
            Latest run
          </p>
          <div className="text-muted-foreground flex flex-col gap-1 text-[0.6rem]">
            <p className="break-all font-mono">{agent.latestRun.runId}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-[0.65rem] capitalize">
                {agent.latestRun.status}
              </Badge>
              <span>
                <span className="font-medium text-foreground/80">Run time:</span>{" "}
                {formatAgentTimestamp(agent.latestRun.createdAt)}
              </span>
            </div>
          </div>
          {agent.latestRun.outputSummary.trim().length > 0 ? (
            <pre className="text-foreground max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.65rem] leading-snug">
              {agent.latestRun.outputSummary}
            </pre>
          ) : null}
          {agent.latestRun.eventPreview.length > 0 ? (
            <details className="group text-[0.6rem]">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                Event preview ({agent.latestRun.eventPreview.length})
              </summary>
              <ul className="border-border/40 mt-1 max-h-36 space-y-0.5 overflow-y-auto border-t pt-1 font-mono">
                {agent.latestRun.eventPreview.map((line, i) => (
                  <li
                    key={`${agent.latestRun!.runId}-preview-${i}`}
                    className="break-words"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {agent.latestRun.outputSummary.trim().length === 0 &&
          agent.latestRun.eventPreview.length === 0 ? (
            <p
              data-testid="dev-mode-agent-history-no-output"
              className="text-muted-foreground text-[0.6rem]"
            >
              No output lines captured for this run.
            </p>
          ) : null}
        </div>
      ) : !agent.detailError ? (
        <p
          data-testid="dev-mode-agent-history-no-run"
          className="text-muted-foreground text-[0.6rem]"
        >
          No runs returned for this agent yet.
        </p>
      ) : null}
    </div>
  );
}

function DevModeAgentHistoryPanel({
  preload,
  registerHistoryFetch,
  historyLoadedRef,
}: {
  preload: boolean;
  registerHistoryFetch?: (fn: (() => Promise<void>) | null) => void;
  historyLoadedRef: MutableRefObject<boolean>;
}) {
  const [agents, setAgents] = useState<CloudAgentHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoFetched, setHasAutoFetched] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev-mode/agent", { method: "GET" });
      const data = (await res.json().catch(() => ({}))) as {
        agents?: unknown;
        error?: unknown;
      };
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : `HTTP ${res.status}`;
        setError(msg);
        setAgents([]);
        return;
      }
      const raw = data.agents;
      if (!Array.isArray(raw)) {
        setError("Invalid response");
        setAgents([]);
        return;
      }
      const parsed: CloudAgentHistoryEntry[] = [];
      for (const item of raw) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        const agentId =
          typeof rec.agentId === "string" ? rec.agentId : null;
        const name = typeof rec.name === "string" ? rec.name : "";
        const summary = typeof rec.summary === "string" ? rec.summary : "";
        const lastModified =
          typeof rec.lastModified === "number" ? rec.lastModified : 0;
        if (!agentId) continue;
        const entry: CloudAgentHistoryEntry = {
          agentId,
          name,
          summary,
          lastModified,
        };
        if (typeof rec.createdAt === "number") {
          entry.createdAt = rec.createdAt;
        }
        if (
          rec.status === "running" ||
          rec.status === "finished" ||
          rec.status === "error"
        ) {
          entry.status = rec.status;
        }
        if (rec.archived === true) {
          entry.archived = true;
        }
        if (rec.runtime === "cloud") {
          entry.runtime = "cloud";
        }
        if (Array.isArray(rec.repos)) {
          entry.repos = rec.repos.filter(
            (u): u is string => typeof u === "string"
          );
        }
        const lr = parseLatestRun(rec.latestRun);
        if (lr) {
          entry.latestRun = lr;
        }
        if (typeof rec.detailError === "string" && rec.detailError.length > 0) {
          entry.detailError = rec.detailError;
        }
        parsed.push(entry);
      }
      setAgents(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    historyLoadedRef.current = hasAutoFetched;
  }, [hasAutoFetched, historyLoadedRef]);

  useEffect(() => {
    registerHistoryFetch?.(fetchHistory);
    return () => registerHistoryFetch?.(null);
  }, [fetchHistory, registerHistoryFetch]);

  useEffect(() => {
    if (!preload || hasAutoFetched) {
      return;
    }
    setHasAutoFetched(true);
    void fetchHistory();
  }, [fetchHistory, hasAutoFetched, preload]);

  return (
    <div
      data-testid="dev-mode-agent-history"
      className="flex min-h-0 flex-1 flex-col gap-2 p-2"
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-wide uppercase">
            History
          </p>
          <p className="text-muted-foreground text-[0.6rem] leading-snug">
            Cloud agents visible to your API key (SDK list).
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1"
          data-testid="dev-mode-agent-history-refresh"
          disabled={loading}
          onClick={() => void fetchHistory()}
        >
          {loading ? (
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw aria-hidden className="size-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {loading && agents.length === 0 ? (
        <div
          data-testid="dev-mode-agent-history-loading"
          className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-8 text-xs"
        >
          <Loader2 aria-hidden className="text-primary size-6 animate-spin" />
          <span>Loading agents and latest runs…</span>
        </div>
      ) : null}

      {error ? (
        <div
          data-testid="dev-mode-agent-history-error"
          className="border-destructive/40 rounded border bg-destructive/10 px-2 py-2 text-xs"
        >
          <span className="text-destructive font-medium">Could not load</span>
          <p className="text-foreground mt-1 break-words">{error}</p>
        </div>
      ) : null}

      {!loading && !error && agents.length === 0 ? (
        <p
          data-testid="dev-mode-agent-history-empty"
          className="text-muted-foreground py-6 text-center text-xs"
        >
          No cloud agents yet.
        </p>
      ) : null}

      {agents.length > 0 ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
          {agents.map((a) => (
            <DevModeAgentHistoryCard key={a.agentId} agent={a} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DevModeAgentPromptPanel({
  onPromptTerminal,
}: {
  onPromptTerminal?: () => void;
}) {
  const { agentId, agentStatus } = useDevMode();
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [prompt, setPrompt] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const streaming = useMemo(
    () => turns.some((t) => t.status === "streaming"),
    [turns]
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const applyEventToTurn = useCallback(
    (turnId: string, ev: AgentStreamEvent) => {
      setTurns((prev) =>
        prev.map((t) => {
          if (t.id !== turnId) {
            return t;
          }
          const nextEvents = [...t.events, ev];
          let nextStatus = t.status;
          if (ev.type === "done") {
            nextStatus = "done";
          }
          if (ev.type === "error") {
            nextStatus = "error";
          }
          return { ...t, events: nextEvents, status: nextStatus };
        })
      );
    },
    []
  );

  const onCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runSend = useCallback(
    async (turnId: string, text: string) => {
      if (!agentId) {
        return;
      }
      let terminalRefreshNotified = false;
      const notifyTerminalOnce = () => {
        if (terminalRefreshNotified) {
          return;
        }
        terminalRefreshNotified = true;
        onPromptTerminal?.();
      };

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch("/api/dev-mode/agent/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, prompt: text }),
          signal: ac.signal,
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: unknown;
          };
          const msg =
            typeof errBody.error === "string"
              ? errBody.error
              : `HTTP ${res.status}`;
          applyEventToTurn(turnId, { type: "error", message: msg });
          notifyTerminalOnce();
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          applyEventToTurn(turnId, {
            type: "error",
            message: "No response body",
          });
          notifyTerminalOnce();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.trim().length === 0) {
              continue;
            }
            const ev = parseAgentStreamLine(line);
            if (ev) {
              applyEventToTurn(turnId, ev);
              if (ev.type === "done" || ev.type === "error") {
                notifyTerminalOnce();
              }
            }
          }
        }

        if (buffer.trim().length > 0) {
          const ev = parseAgentStreamLine(buffer);
          if (ev) {
            applyEventToTurn(turnId, ev);
            if (ev.type === "done" || ev.type === "error") {
              notifyTerminalOnce();
            }
          }
        }

        if (!terminalRefreshNotified) {
          notifyTerminalOnce();
        }
      } catch (err) {
        const isAbort =
          err instanceof DOMException
            ? err.name === "AbortError"
            : err instanceof Error && err.name === "AbortError";
        if (isAbort) {
          applyEventToTurn(turnId, { type: "error", message: "Cancelled" });
          notifyTerminalOnce();
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        applyEventToTurn(turnId, { type: "error", message });
        notifyTerminalOnce();
      } finally {
        if (abortRef.current === ac) {
          abortRef.current = null;
        }
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId && t.status === "streaming"
              ? { ...t, status: "done" }
              : t
          )
        );
      }
    },
    [agentId, applyEventToTurn, onPromptTerminal]
  );

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const text = prompt.trim();
      if (
        !agentId ||
        text.length === 0 ||
        streaming ||
        agentStatus !== "connected"
      ) {
        return;
      }
      const turnId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `turn-${Date.now()}`;
      setTurns((prev) => [
        ...prev,
        { id: turnId, prompt: text, events: [], status: "streaming" },
      ]);
      setPrompt("");
      void runSend(turnId, text);
    },
    [agentId, agentStatus, prompt, runSend, streaming]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        (
          e.currentTarget.form as HTMLFormElement | null
        )?.requestSubmit();
      }
    },
    []
  );

  const submitDisabled =
    !agentId ||
    prompt.trim().length === 0 ||
    streaming ||
    agentStatus !== "connected";

  return (
    <div
      data-testid="dev-mode-agent-form"
      className="flex min-h-0 flex-1 flex-col gap-2 p-2"
    >
      <form onSubmit={onSubmit} className="flex shrink-0 flex-col gap-2">
        <textarea
          data-testid="dev-mode-agent-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          placeholder={
            agentStatus === "connected"
              ? "Prompt the agent…"
              : agentStatus === "connecting"
                ? "Connecting…"
                : "Agent unavailable"
          }
          disabled={agentStatus !== "connected"}
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[4.5rem] w-full resize-none rounded-md border px-2 py-1.5 text-xs shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={submitDisabled}
            data-testid="dev-mode-agent-submit"
          >
            Send
          </Button>
          {streaming ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="dev-mode-agent-cancel"
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        {[...turns].reverse().map((turn) => (
          <DevModeAgentTurnCard key={turn.id} turn={turn} />
        ))}
      </div>
    </div>
  );
}

function MetadataSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <div className="text-foreground text-sm break-words">{children}</div>
    </section>
  );
}

function DevModeElementDetailsBody({ snapshot }: { snapshot: DevModeElementSnapshot }) {
  return (
    <div className="flex flex-col gap-4">
      <MetadataSection title="Tag & identity">
        <p>
          <code className="text-primary">&lt;{snapshot.tagName}&gt;</code>
          {snapshot.id && (
            <>
              {" "}
              <code className="text-xs">id=&quot;{snapshot.id}&quot;</code>
            </>
          )}
        </p>
        {snapshot.className && (
          <p className="text-muted-foreground text-xs break-all">
            {snapshot.className}
          </p>
        )}
      </MetadataSection>

      <MetadataSection title="Layout (getBoundingClientRect)">
        <pre className="bg-card-02/80 dark:bg-card-01/50 overflow-x-auto rounded border p-2 text-xs">
          {JSON.stringify(snapshot.rect, null, 2)}
        </pre>
      </MetadataSection>

      <MetadataSection title="Attributes">
        {snapshot.attributes.length === 0 ? (
          <p className="text-muted-foreground">None</p>
        ) : (
          <ul className="text-muted-foreground list-none space-y-1.5 pl-0 text-xs">
            {snapshot.attributes.map((a) => (
              <li key={a.name}>
                <code className="text-foreground">{a.name}</code>={" "}
                <span className="break-all">&quot;{a.value}&quot;</span>
              </li>
            ))}
          </ul>
        )}
      </MetadataSection>

      <MetadataSection title="Computed styles (subset)">
        <pre className="bg-card-02/80 dark:bg-card-01/50 max-h-48 overflow-auto rounded border p-2 text-xs">
          {Object.entries(snapshot.computed)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")}
        </pre>
      </MetadataSection>

      {snapshot.text && (
        <MetadataSection title="Text (trimmed)">
          <p className="text-muted-foreground line-clamp-6 break-all text-xs">
            {snapshot.text}
          </p>
        </MetadataSection>
      )}

      <MetadataSection title="outerHTML (truncated)">
        <pre className="bg-card-02/80 dark:bg-card-01/50 max-h-40 overflow-x-auto overflow-y-auto rounded border p-2 text-xs break-all whitespace-pre-wrap">
          {snapshot.outerHTML}
        </pre>
      </MetadataSection>
    </div>
  );
}

function elementInspectorKey(snapshot: DevModeElementSnapshot): string {
  return `${snapshot.domPath.join("/")}-${snapshot.rect.width}x${snapshot.rect.height}-${snapshot.outerHTML.slice(0, 80)}`;
}

function DevModeSelectedElementCollapsible({
  snapshot,
  onClear,
}: {
  snapshot: DevModeElementSnapshot;
  onClear: () => void;
}) {
  const pathTail =
    snapshot.domPath.length > 0
      ? snapshot.domPath.slice(-2).join(" › ")
      : snapshot.tagName;

  return (
    <details
      data-testid="dev-mode-element-details"
      className="group overflow-hidden"
    >
      <summary
        data-testid="dev-mode-element-details-summary"
        className={cn(
          "border-border/60 flex cursor-pointer list-none items-center gap-2 border-b bg-card-01/40 px-3 py-2.5 text-left backdrop-blur-sm [&::-webkit-details-marker]:hidden"
        )}
      >
        <ChevronRight
          aria-hidden
          className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90"
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-foreground flex flex-wrap items-baseline gap-x-1.5 font-mono text-xs font-medium">
            <code className="text-primary">&lt;{snapshot.tagName}&gt;</code>
            {snapshot.id ? (
              <span className="text-muted-foreground font-normal">
                #{snapshot.id}
              </span>
            ) : null}
            <span className="text-muted-foreground font-normal">
              · {snapshot.rect.width}×{snapshot.rect.height}px
            </span>
          </div>
          <p className="text-muted-foreground truncate text-[0.65rem] leading-tight">
            {pathTail}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Clear selection"
          data-testid="dev-mode-clear-selection"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClear();
          }}
        >
          <XIcon className="size-4" />
        </Button>
      </summary>

      <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-3 py-4">
        <DevModeElementDetailsBody snapshot={snapshot} />
      </div>
    </details>
  );
}

function DevModeRightRail() {
  const { enabled, selected, setSelected } = useDevMode();
  const [railTab, setRailTab] = useState<DevModeRailTab>("agent");
  const historyFetchRef = useRef<(() => Promise<void>) | null>(null);
  const historyHasLoadedRef = useRef(false);

  const registerHistoryFetch = useCallback(
    (fn: (() => Promise<void>) | null) => {
      historyFetchRef.current = fn;
    },
    []
  );

  const onPromptTerminal = useCallback(() => {
    if (!historyHasLoadedRef.current) {
      return;
    }
    void historyFetchRef.current?.();
  }, []);

  useEffect(() => {
    if (!enabled) {
      document.body.style.paddingRight = "";
      return;
    }
    const railWidth = `${DEV_MODE_RAIL_WIDTH_REM}rem`;
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      document.body.style.paddingRight = mq.matches ? railWidth : "";
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      document.body.style.paddingRight = "";
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <aside
      data-dev-mode-ui=""
      data-testid="dev-mode-rail"
      aria-label="Dev mode panel"
      className="bg-card/95 supports-backdrop-filter:bg-card/80 fixed top-0 right-0 z-[35] flex h-dvh w-72 flex-col overflow-hidden border-l border-border shadow-sm backdrop-blur-md max-md:hidden"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className="border-border/60 flex min-h-0 flex-[1.2] flex-col overflow-hidden border-b"
          data-testid="dev-mode-rail-primary-slot"
          aria-label="Dev tools"
        >
          <div
            role="tablist"
            aria-label="Dev tools sections"
            data-testid="dev-mode-rail-tabs"
            className="border-border/60 flex shrink-0 border-b"
          >
            <button
              type="button"
              role="tab"
              id="dev-mode-tab-agent"
              aria-selected={railTab === "agent"}
              aria-controls="dev-mode-tabpanel-agent"
              data-testid="dev-mode-tab-agent"
              className={cn(
                "text-foreground/90 hover:bg-muted/40 flex min-h-10 flex-1 items-center justify-center px-2 text-xs font-medium transition-colors",
                railTab === "agent"
                  ? "border-primary text-primary border-b-2 pb-[calc(0.5rem-2px)]"
                  : "text-muted-foreground border-b-2 border-transparent pb-2"
              )}
              onClick={() => setRailTab("agent")}
            >
              Cloud agent
            </button>
            <button
              type="button"
              role="tab"
              id="dev-mode-tab-history"
              aria-selected={railTab === "history"}
              aria-controls="dev-mode-tabpanel-history"
              data-testid="dev-mode-tab-history"
              className={cn(
                "text-foreground/90 hover:bg-muted/40 flex min-h-10 flex-1 items-center justify-center px-2 text-xs font-medium transition-colors",
                railTab === "history"
                  ? "border-primary text-primary border-b-2 pb-[calc(0.5rem-2px)]"
                  : "text-muted-foreground border-b-2 border-transparent pb-2"
              )}
              onClick={() => setRailTab("history")}
            >
              History
            </button>
          </div>

          <div
            role="tabpanel"
            id="dev-mode-tabpanel-agent"
            aria-labelledby="dev-mode-tab-agent"
            hidden={railTab !== "agent"}
            className="min-h-0 flex-1 flex-col overflow-hidden"
          >
            <DevModeAgentPromptPanel onPromptTerminal={onPromptTerminal} />
          </div>
          <div
            role="tabpanel"
            id="dev-mode-tabpanel-history"
            aria-labelledby="dev-mode-tab-history"
            hidden={railTab !== "history"}
            className="min-h-0 flex-1 flex-col overflow-hidden"
          >
            <DevModeAgentHistoryPanel
              preload={railTab === "history"}
              registerHistoryFetch={registerHistoryFetch}
              historyLoadedRef={historyHasLoadedRef}
            />
          </div>
        </div>

        {selected != null ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div
              className="border-border bg-background/40 overflow-hidden rounded-lg border shadow-sm"
              data-testid="dev-mode-element-panel"
            >
              <DevModeSelectedElementCollapsible
                key={elementInspectorKey(selected)}
                snapshot={selected}
                onClear={() => setSelected(null)}
              />
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function DevModeToggle() {
  const { enabled, setEnabled, agentStatus } = useDevMode();

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col items-center gap-1.5 rounded-2xl border border-border/40 bg-card/40 px-4 py-3 shadow-lg backdrop-blur-md supports-backdrop-filter:bg-card/30 max-md:hidden"
      data-dev-mode-ui=""
    >
      <label
        htmlFor="dev-mode-switch"
        className="cursor-pointer select-none text-xs text-muted-foreground/70"
      >
        Dev mode {enabled ? "on" : "off"}
      </label>
      {enabled ? (
        <span
          className="text-[0.65rem] text-muted-foreground/80"
          data-testid="dev-mode-agent-status"
        >
          {(agentStatus === "connecting" || agentStatus === "idle") &&
            "Agent: connecting…"}
          {agentStatus === "connected" && "Agent: connected"}
          {agentStatus === "error" && "Agent: error"}
        </span>
      ) : null}
      <button
        id="dev-mode-switch"
        type="button"
        role="switch"
        aria-checked={enabled}
        data-testid="dev-mode-toggle"
        className={cn(
          "relative h-7 w-12 shrink-0 cursor-pointer rounded-full border border-transparent shadow-md transition-colors duration-200 outline-none select-none",
          "focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "active:scale-[0.98]",
          enabled
            ? "bg-primary shadow-primary/20"
            : "bg-muted text-muted-foreground shadow-inner"
        )}
        onClick={() => setEnabled(!enabled)}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0.5 left-0.5 size-6 rounded-full bg-card shadow-sm ring-1 ring-border/60 transition-transform duration-200 ease-out",
            enabled && "translate-x-5"
          )}
        />
      </button>
    </div>
  );
}

function DevModeInspector() {
  const { enabled, selected, setSelected } = useDevMode();
  const [hover, setHover] = useState<HoverHighlight | null>(null);
  const raf = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!enabledRef.current) return;
    if (isInsideDevModeUi(e.target)) {
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      setHover(null);
      return;
    }
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
    }
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const t = e.target;
      if (!(t instanceof Element)) {
        setHover(null);
        return;
      }
      const r = t.getBoundingClientRect();
      setHover({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        label: t.tagName.toLowerCase(),
      });
    });
  }, []);

  const onClick = useCallback(
    (e: MouseEvent) => {
      if (!enabledRef.current) {
        return;
      }
      if (isInsideDevModeUi(e.target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const source =
        e.target instanceof Element
          ? e.target
          : e.target instanceof Text && e.target.parentElement != null
            ? e.target.parentElement
            : null;
      const snap = buildElementSnapshot(e.target);
      if (snap) {
        setSelected(snap, source);
      } else {
        setSelected(null);
      }
    },
    [setSelected]
  );

  useEffect(() => {
    if (!enabled) {
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      setHover(null);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    document.addEventListener("mousemove", onMouseMove, { capture: true });
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("mousemove", onMouseMove, { capture: true });
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, [enabled, onClick, onMouseMove]);

  if (!enabled) {
    return null;
  }
  return (
    <>
      {selected != null ? (
        <DevModeSelectionOutline key={elementInspectorKey(selected)} />
      ) : null}
      <DevModeHoverOutline highlight={hover} />
    </>
  );
}

export function DevMode() {
  return (
    <>
      <DevModeRightRail />
      <DevModeToggle />
      <DevModeInspector />
    </>
  );
}
