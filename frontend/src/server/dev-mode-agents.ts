import type { SDKAgent } from "@cursor/sdk";

/** Shared agent instances created by POST /api/dev-mode/agent (same Node process). */
export const agents = new Map<string, SDKAgent>();
