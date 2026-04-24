import type { ServerWebSocket } from "bun";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { WSData } from "./http-server";
import type { AgentSession, ClientMessage } from "./session-types";
import { SESSION_TIMEOUT_MS } from "./session-types";
import { runAgent, sendToClient } from "./agent-runner";
import { calculateSessionUsage } from "./sdk-sessions";
import type { AgentQueue } from "./queue-manager";
import { pruneStale } from "./worktree-registry";
import { log } from "../logger";

const prunedCwds = new Set<string>();

export type WebSocketConfig = {
  sessions: Map<string, AgentSession>;
  beadsMcpPath: string | null;
  queue: AgentQueue;
};

const clientCwdByWs: WeakMap<ServerWebSocket<WSData>, string> = new WeakMap();

function sendToWs(ws: ServerWebSocket<WSData>, msg: object) {
  ws.send(JSON.stringify(msg));
}

export function createWebSocketHandlers(config: WebSocketConfig) {
  const { sessions, beadsMcpPath, queue } = config;

  return {
    open(ws: ServerWebSocket<WSData>) {
      log.info("Client connected");
      queue.addClient(ws);
    },

    close(ws: ServerWebSocket<WSData>) {
      queue.removeClient(ws);
      const sessionId = ws.data.sessionId;
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (session) {
          session.ws = null;
          session.cleanupTimer = setTimeout(() => {
            const s = sessions.get(sessionId);
            if (s && s.ws === null) {
              s.abortController.abort();
              sessions.delete(sessionId);
              log.info(`Session ${sessionId} cleaned up after timeout`);
            }
          }, SESSION_TIMEOUT_MS);
        }
      }
      log.info("Client disconnected");
    },

    async message(ws: ServerWebSocket<WSData>, raw: string | Buffer) {
      const msg = JSON.parse(raw.toString()) as ClientMessage;

      if (msg.type === "set_project") {
        clientCwdByWs.set(ws, msg.cwd);
        queue.setClientCwd(ws, msg.cwd);
        if (!prunedCwds.has(msg.cwd)) {
          prunedCwds.add(msg.cwd);
          pruneStale(msg.cwd).catch(err => log.warn(`[worktree-registry] pruneStale failed:`, err));
        }
        return;
      }

      switch (msg.type) {
        case "start": {
          const sessionId = crypto.randomUUID();
          ws.data.sessionId = sessionId;

          const initialUsage = msg.resumeSessionId
            ? calculateSessionUsage(msg.cwd, msg.resumeSessionId) || { inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheCreation: 0 }
            : { inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheCreation: 0 };

          const session: AgentSession = {
            id: sessionId,
            cwd: msg.cwd,
            projectCwd: msg.cwd,
            agentName: msg.agentName,
            systemPromptAppend: msg.systemPromptAppend,
            sdkSessionId: msg.resumeSessionId,
            model: msg.model,
            abortController: new AbortController(),
            inputQueue: [],
            fileSnapshots: new Map(),
            touchedFiles: new Set(),
            ws,
            isRunning: false,
            allowedTools: msg.allowedTools,
            disallowedTools: msg.disallowedTools,
            isManager: msg.isManager,
            usage: initialUsage,
          };
          sessions.set(sessionId, session);

          sendToWs(ws, {
            type: "session_started",
            sessionId,
            resuming: !!msg.resumeSessionId
          });

          runAgent(session, msg.briefing, {
            allowedTools: msg.allowedTools,
            disallowedTools: msg.disallowedTools,
            resumeSdkSession: msg.resumeSessionId,
            beadsMcpPath,
            queue,
            sessions,
          }).catch((err) => {
            sendToClient(session, { type: "error", error: String(err) });
          });
          queue.broadcastActiveSessions();
          return;
        }

        case "resume": {
          const session = sessions.get(msg.sessionId);
          if (!session) {
            sendToWs(ws, { type: "error", error: "Session not found or expired" });
            return;
          }

          if (session.cleanupTimer) {
            clearTimeout(session.cleanupTimer);
            session.cleanupTimer = undefined;
          }

          session.ws = ws;
          ws.data.sessionId = msg.sessionId;

          sendToWs(ws, {
            type: "session_resumed",
            sessionId: msg.sessionId,
            sdkSessionId: session.sdkSessionId,
            isRunning: session.isRunning
          });
          return;
        }
      }

      const sessionId = ws.data.sessionId;
      if (!sessionId) {
        sendToWs(ws, { type: "error", error: "No active session" });
        return;
      }

      const session = sessions.get(sessionId);
      if (!session) {
        sendToWs(ws, { type: "error", error: "Session not found" });
        return;
      }

      switch (msg.type) {
        case "message": {
          const userMsg: SDKUserMessage = {
            type: "user",
            session_id: session.id,
            parent_tool_use_id: null,
            message: { role: "user", content: msg.text },
          };

          sendToClient(session, { type: "stream", data: userMsg });

          if (session.inputResolver) {
            session.inputResolver(userMsg);
          } else {
            session.inputQueue.push(userMsg);
          }
          return;
        }

        case "inject_context": {
          const contextMsg: SDKUserMessage = {
            type: "user",
            session_id: session.id,
            parent_tool_use_id: null,
            message: { role: "user", content: `<system-reminder>${msg.context}</system-reminder>` },
          };

          if (session.inputResolver) {
            session.inputResolver(contextMsg);
          } else {
            session.inputQueue.push(contextMsg);
          }
          return;
        }

        case "interrupt":
          session.abortController.abort();
          sendToClient(session, { type: "interrupted" });
          return;

        case "end":
          session.abortController.abort();
          if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
          sessions.delete(sessionId);
          ws.data.sessionId = undefined;
          sendToWs(ws, { type: "session_ended", sessionId });
          queue.maybeStartNext();
          return;

        case "clear":
          session.abortController.abort();
          session.abortController = new AbortController();
          session.sdkSessionId = undefined;
          session.inputQueue = [];
          session.inputResolver = undefined;
          session.fileSnapshots.clear();
          session.touchedFiles.clear();
          sendToWs(ws, { type: "session_cleared", sessionId });
          return;

        case "continue": {
          if (session.isRunning) {
            sendToWs(ws, { type: "error", error: "Agent is still running. Use 'message' for follow-up or 'interrupt' first." });
            return;
          }

          session.abortController = new AbortController();

          runAgent(session, msg.text, {
            allowedTools: session.allowedTools,
            disallowedTools: session.disallowedTools,
            resumeSdkSession: session.sdkSessionId,
            beadsMcpPath,
            queue,
            sessions,
          }).catch((err) => {
            sendToClient(session, { type: "error", error: String(err) });
          });
          return;
        }

        case "compact": {
          const compactMsg: SDKUserMessage = {
            type: "user",
            session_id: session.id,
            parent_tool_use_id: null,
            message: { role: "user", content: "/compact" },
          };

          if (session.inputResolver) {
            session.inputResolver(compactMsg);
          } else {
            session.inputQueue.push(compactMsg);
          }
          return;
        }

        case "queue_enqueue":
          queue.enqueue(msg.item);
          return;

        case "queue_cancel":
          queue.cancel(msg.ticketId);
          return;

        case "queue_reorder":
          queue.reorder(msg.fromIndex, msg.toIndex);
          return;

        case "queue_list": {
          const clientCwd = clientCwdByWs.get(ws);
          const items = clientCwd ? queue.getItemsForCwd(clientCwd) : [];
          sendToWs(ws, { type: "queue_state", items });
          return;
        }
      }
    },
  };
}
