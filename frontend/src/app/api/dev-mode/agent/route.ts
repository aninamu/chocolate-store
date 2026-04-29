import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  Agent,
  type ConversationTurn,
  type Run,
  type SDKAgentInfo,
  type SDKMessage,
  type TextBlock,
} from "@cursor/sdk";

import { agents as devModeAgents } from "@/server/dev-mode-agents";

const HISTORY_LIST_LIMIT = 50;
/** Bound N+1 enrichment to the listed agents (same cap as list). */
const HISTORY_ENRICH_LIMIT = 50;
const MAX_STREAM_MESSAGES = 48;
const MAX_PREVIEW_LINES = 20;
const MAX_SUMMARY_CHARS = 2500;

type LatestRunPayload = {
  runId: string;
  status: string;
  createdAt?: number;
  outputSummary: string;
  eventPreview: string[];
};

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…`;
}

function summarizeConversationTurns(turns: ConversationTurn[]): {
  outputSummary: string;
  eventPreview: string[];
} {
  const preview: string[] = [];
  let assistantBuf = "";

  for (const turn of turns) {
    if (turn.type !== "agentConversationTurn") {
      continue;
    }
    const { userMessage, steps } = turn.turn;
    if (userMessage?.text) {
      preview.push(`User: ${truncate(userMessage.text, 280)}`);
    }
    for (const step of steps) {
      switch (step.type) {
        case "assistantMessage": {
          const text = step.message.text;
          assistantBuf += text;
          preview.push(`Assistant: ${truncate(text, 320)}`);
          break;
        }
        case "thinkingMessage": {
          preview.push(`Thinking: ${truncate(step.message.text, 220)}`);
          break;
        }
        case "toolCall": {
          preview.push(`Tool: ${step.message.type}`);
          break;
        }
        default: {
          break;
        }
      }
    }
  }

  return {
    outputSummary: assistantBuf.trim().slice(0, MAX_SUMMARY_CHARS),
    eventPreview: preview.slice(0, MAX_PREVIEW_LINES),
  };
}

function formatSdkMessageLine(msg: SDKMessage): string | null {
  switch (msg.type) {
    case "assistant": {
      const parts = msg.message.content
        .filter((c): c is TextBlock => c.type === "text")
        .map((c) => c.text);
      const joined = parts.join("");
      return joined.trim().length > 0
        ? `Assistant: ${truncate(joined, 400)}`
        : null;
    }
    case "user": {
      const text = msg.message.content.map((c) => c.text).join("");
      return text.trim().length > 0 ? `User: ${truncate(text, 320)}` : null;
    }
    case "tool_call":
      return `Tool ${msg.name} (${msg.status})`;
    case "thinking":
      return `Thinking: ${truncate(msg.text, 220)}`;
    case "status":
      return `Status: ${msg.status}${msg.message ? ` · ${msg.message}` : ""}`;
    case "task": {
      const line = msg.text?.trim() || msg.status?.trim();
      return line ? `Task: ${truncate(line, 240)}` : null;
    }
    case "system":
      return `System (${msg.subtype ?? "init"})`;
    case "request":
      return `Request: ${msg.request_id}`;
    default:
      return null;
  }
}

async function summarizeRun(run: Run): Promise<LatestRunPayload> {
  const runId = run.id;
  const status = run.status;
  const createdAt = run.createdAt;

  let outputSummary = "";
  const eventPreview: string[] = [];

  try {
    const turns = await run.conversation();
    const conv = summarizeConversationTurns(turns);
    outputSummary = conv.outputSummary;
    eventPreview.push(...conv.eventPreview);
  } catch {
    try {
      let n = 0;
      for await (const msg of run.stream()) {
        const line = formatSdkMessageLine(msg);
        if (line) {
          eventPreview.push(line);
        }
        n += 1;
        if (n >= MAX_STREAM_MESSAGES) {
          break;
        }
      }
      outputSummary = eventPreview.join("\n").slice(0, MAX_SUMMARY_CHARS);
    } catch {
      outputSummary =
        typeof run.result === "string" && run.result.trim().length > 0
          ? truncate(run.result, MAX_SUMMARY_CHARS)
          : "";
    }
  }

  if (!outputSummary && typeof run.result === "string" && run.result.trim().length > 0) {
    outputSummary = truncate(run.result, MAX_SUMMARY_CHARS);
  }

  return {
    runId,
    status,
    createdAt,
    outputSummary,
    eventPreview: eventPreview.slice(0, MAX_PREVIEW_LINES),
  };
}

async function enrichLatestRun(
  apiKey: string,
  agentId: string
): Promise<{ latestRun?: LatestRunPayload; detailError?: string }> {
  try {
    const listed = await Agent.listRuns(agentId, {
      runtime: "cloud",
      apiKey,
      limit: 1,
    });
    const run = listed.items[0];
    if (!run) {
      return {};
    }
    const latestRun = await summarizeRun(run);
    return { latestRun };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { detailError: message };
  }
}

function findGitRoot(start: string): string | null {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, ".git"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

function normalizeRepoUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("git@")) {
    const match = /^git@([^:]+):(.+)$/.exec(trimmed);
    if (match) {
      const host = match[1];
      const repoPath = match[2].replace(/\.git$/i, "");
      return `https://${host}/${repoPath}`;
    }
  }
  return trimmed.replace(/\.git$/i, "");
}

function resolveRepoUrl(): string | null {
  const fromEnv = process.env.CURSOR_DEV_MODE_REPO_URL?.trim();
  if (fromEnv) {
    return normalizeRepoUrl(fromEnv);
  }
  const root = findGitRoot(process.cwd());
  if (!root) {
    return null;
  }
  try {
    const raw = execSync("git remote get-url origin", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return normalizeRepoUrl(raw);
  } catch {
    return null;
  }
}

export async function GET() {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { error: "CURSOR_API_KEY is not set. Add it to your environment." },
      { status: 503 }
    );
  }

  try {
    const result = await Agent.list({
      runtime: "cloud",
      apiKey,
      includeArchived: true,
      limit: HISTORY_LIST_LIMIT,
    });

    const slice = result.items.slice(0, HISTORY_ENRICH_LIMIT);
    const extras = await Promise.all(
      slice.map((info) => enrichLatestRun(apiKey, info.agentId))
    );
    const listedAgents: Array<
      SDKAgentInfo & {
        latestRun?: LatestRunPayload;
        detailError?: string;
      }
    > = slice.map((info, i) => {
      const extra = extras[i]!;
      return {
        ...info,
        ...(extra.latestRun != null ? { latestRun: extra.latestRun } : {}),
        ...(extra.detailError != null ? { detailError: extra.detailError } : {}),
      };
    });

    return Response.json({
      agents: listedAgents,
      nextCursor: result.nextCursor,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { error: "CURSOR_API_KEY is not set. Add it to your environment." },
      { status: 503 }
    );
  }

  const repoUrl = resolveRepoUrl();
  if (!repoUrl) {
    return Response.json(
      {
        error:
          "Could not resolve a GitHub repository URL. Set CURSOR_DEV_MODE_REPO_URL or run from a git clone with origin.",
      },
      { status: 400 }
    );
  }

  const startingRef =
    process.env.CURSOR_DEV_MODE_STARTING_REF?.trim() || "main";

  try {
    const agent = await Agent.create({
      apiKey,
      model: { id: "composer-2" },
      cloud: {
        repos: [{ url: repoUrl, startingRef }],
      },
    });

    devModeAgents.set(agent.agentId, agent);
    return Response.json({ agentId: agent.agentId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}

type DeleteBody = {
  agentId?: unknown;
};

export async function DELETE(request: Request) {
  let body: DeleteBody;
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const agentId =
    typeof body.agentId === "string" && body.agentId.length > 0
      ? body.agentId
      : null;

  if (!agentId) {
    return Response.json({ error: "agentId is required" }, { status: 400 });
  }

  const agent = devModeAgents.get(agentId);
  if (agent) {
    agent.close();
    devModeAgents.delete(agentId);
  }

  return new Response(null, { status: 204 });
}
