import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { AgentSession } from "./session-types";
import { createHttpHandler, type WSData } from "./http-server";
import { createWebSocketHandlers } from "./websocket-handler";
import { listSdkSessions } from "./sdk-sessions";

const PORT = parseInt(process.env.AGENT_PORT || "9347", 10);

function findBeadsMcpPath(): string | null {
  const beadsBaseDir = join(homedir(), ".claude/plugins/cache/beads-marketplace/beads");
  if (!existsSync(beadsBaseDir)) return null;

  const versions = readdirSync(beadsBaseDir)
    .filter(v => /^\d+\.\d+\.\d+$/.test(v))
    .sort((a, b) => {
      const [aMajor, aMinor, aPatch] = a.split(".").map(Number);
      const [bMajor, bMinor, bPatch] = b.split(".").map(Number);
      return bMajor - aMajor || bMinor - aMinor || bPatch - aPatch;
    });

  if (versions.length === 0) return null;

  const mcpPath = join(beadsBaseDir, versions[0], "integrations/beads-mcp");
  return existsSync(mcpPath) ? mcpPath : null;
}

const BEADS_MCP_PATH = process.env.BEADS_MCP_PATH || findBeadsMcpPath();

const sessions = new Map<string, AgentSession>();

const wsHandlers = createWebSocketHandlers({
  sessions,
  beadsMcpPath: BEADS_MCP_PATH,
});

const server = Bun.serve<WSData>({
  port: PORT,
  hostname: "0.0.0.0",
  fetch: createHttpHandler({
    port: PORT,
    beadsMcpEnabled: !!BEADS_MCP_PATH,
    getSessionsCount: () => sessions.size,
    listSdkSessions,
    handleUpgrade: (req, server) => server.upgrade(req, { data: {} }),
  }),
  websocket: wsHandlers,
});

console.log(`Agent WebSocket server running on ws://localhost:${PORT}`);
if (BEADS_MCP_PATH) {
  console.log(`Beads MCP enabled: ${BEADS_MCP_PATH}`);
} else {
  console.log("Beads MCP not found (optional)");
}

function shutdown() {
  console.log("\nShutting down...");
  for (const [id, session] of sessions) {
    session.abortController.abort();
    if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
  }
  sessions.clear();
  server.stop();
  console.log("Server stopped");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
