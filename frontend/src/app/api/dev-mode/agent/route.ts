import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { Agent, type SDKAgent } from "@cursor/sdk";

const agents = new Map<string, SDKAgent>();

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

    agents.set(agent.agentId, agent);
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

  const agent = agents.get(agentId);
  if (agent) {
    agent.close();
    agents.delete(agentId);
  }

  return new Response(null, { status: 204 });
}
