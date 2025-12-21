import type { ServerWebSocket } from "bun";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { WSData } from "./http-server";
import type { AgentSession, ClientMessage } from "./session-types";
import { SESSION_TIMEOUT_MS } from "./session-types";
import { runAgent, sendToClient } from "./agent-runner";
import { calculateSessionUsage } from "./sdk-sessions";

export type WebSocketConfig = {
  sessions: Map<string, AgentSession>;
  beadsMcpPath: string | null;
};

function sendToWs(ws: ServerWebSocket<WSData>, msg: object) {
  ws.send(JSON.stringify(msg));
}

export function createWebSocketHandlers(config: WebSocketConfig) {
  const { sessions, beadsMcpPath } = config;

  return {
    open(ws: ServerWebSocket<WSData>) {
      console.log("Client connected");
    },

    close(ws: ServerWebSocket<WSData>) {
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
              console.log(`Session ${sessionId} cleaned up after timeout`);
            }
          }, SESSION_TIMEOUT_MS);
        }
      }
      console.log("Client disconnected");
    },

    async message(ws: ServerWebSocket<WSData>, raw: string | Buffer) {
      const msg = JSON.parse(raw.toString()) as ClientMessage;

      if (msg.type === "start") {
        const sessionId = crypto.randomUUID();
        ws.data.sessionId = sessionId;

        const initialUsage = msg.resumeSessionId
          ? calculateSessionUsage(msg.cwd, msg.resumeSessionId) || { inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheCreation: 0 }
          : { inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheCreation: 0 };

        const session: AgentSession = {
          id: sessionId,
          cwd: msg.cwd,
          agentName: msg.agentName,
          systemPromptAppend: msg.systemPromptAppend,
          sdkSessionId: msg.resumeSessionId,
          abortController: new AbortController(),
          inputQueue: [],
          fileSnapshots: new Map(),
          touchedFiles: new Set(),
          ws,
          isRunning: false,
          allowedTools: msg.allowedTools,
          disallowedTools: msg.disallowedTools,
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
        }).catch((err) => {
          sendToClient(session, { type: "error", error: String(err) });
        });

        return;
      }

      if (msg.type === "resume") {
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

      if (msg.type === "message") {
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

      if (msg.type === "inject_context") {
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

      if (msg.type === "interrupt") {
        session.abortController.abort();
        sendToClient(session, { type: "interrupted" });
        return;
      }

      if (msg.type === "end") {
        session.abortController.abort();
        if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
        sessions.delete(sessionId);
        ws.data.sessionId = undefined;
        sendToWs(ws, { type: "session_ended", sessionId });
        return;
      }

      if (msg.type === "clear") {
        session.abortController.abort();
        session.abortController = new AbortController();
        session.sdkSessionId = undefined;
        session.inputQueue = [];
        session.inputResolver = undefined;
        session.fileSnapshots.clear();
        session.touchedFiles.clear();
        sendToWs(ws, { type: "session_cleared", sessionId });
        return;
      }

      if (msg.type === "continue") {
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
        }).catch((err) => {
          sendToClient(session, { type: "error", error: String(err) });
        });
        return;
      }

      if (msg.type === "compact") {
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
    },
  };
}
