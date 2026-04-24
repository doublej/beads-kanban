import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { AgentSession } from "./session-types";
import { createHttpHandler, type WSData } from "./http-server";
import { createWebSocketHandlers } from "./websocket-handler";
import { listSdkSessions, getSessionHistory } from "./sdk-sessions";
import { AgentQueue } from "./queue-manager";
import { runAgent, sendToClient } from "./agent-runner";
import { createWorktree } from "./worktree";
import { registerWorktree } from "./worktree-registry";
import { log } from "../logger";

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
const queue = new AgentQueue(sessions);

// Wire up queue dispatch: when queue dequeues an item, start an agent session
queue.setDispatchFn(async (item, briefing) => {
  const sessionCwd = item.useWorktree
    ? await createWorktree(item.cwd, item.ticketId)
    : item.cwd;

  const sessionId = crypto.randomUUID();
  const session: AgentSession = {
    id: sessionId,
    cwd: sessionCwd,
    projectCwd: item.cwd,
    ticketId: item.ticketId,
    worktreePath: item.useWorktree ? sessionCwd : undefined,
    agentName: item.agentName,
    model: item.model,
    abortController: new AbortController(),
    inputQueue: [],
    fileSnapshots: new Map(),
    touchedFiles: new Set(),
    ws: null,
    isRunning: false,
    usage: { inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheCreation: 0 },
  };
  sessions.set(sessionId, session);

  if (item.useWorktree) {
    log.info(`[queue] Started ${item.agentName} in worktree ${sessionCwd}`);
    registerWorktree(item.cwd, item.ticketId, sessionCwd, sessionId);
  }

  runAgent(session, briefing, {
    beadsMcpPath: BEADS_MCP_PATH,
    queue,
    sessions,
  }).then(() => {
    queue.broadcastActiveSessions();
    queue.maybeStartNext();
  }).catch((err) => {
    log.error(`[queue] Agent ${item.agentName} failed:`, err);
    sessions.delete(sessionId);
    queue.broadcastActiveSessions();
    queue.maybeStartNext();
  });

  queue.broadcastActiveSessions();
});

const wsHandlers = createWebSocketHandlers({
  sessions,
  beadsMcpPath: BEADS_MCP_PATH,
  queue,
});

const server = Bun.serve<WSData>({
  port: PORT,
  hostname: "0.0.0.0",
  fetch: createHttpHandler({
    port: PORT,
    beadsMcpEnabled: !!BEADS_MCP_PATH,
    getSessionsCount: () => sessions.size,
    listSdkSessions,
    getSessionHistory,
    handleUpgrade: (req, server) => server.upgrade(req, { data: {} }),
    queue,
  }),
  websocket: wsHandlers,
});

log.info(`Agent WebSocket server running on ws://localhost:${PORT}`);
if (BEADS_MCP_PATH) {
  log.info(`Beads MCP enabled: ${BEADS_MCP_PATH}`);
} else {
  log.info("Beads MCP not found (optional)");
}

function shutdown() {
  log.info("Shutting down...");
  for (const [id, session] of sessions) {
    session.abortController.abort();
    if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
  }
  sessions.clear();
  server.stop();
  log.info("Server stopped");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
