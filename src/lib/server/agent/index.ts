import { query, type Options, type SDKMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ServerWebSocket } from "bun";
import { homedir } from "os";
import { join } from "path";
import { existsSync, readdirSync } from "fs";
import { BLOCKED_BEADS_TOOLS, createBeadsToolsServer } from "./beads-tools";

const PORT = parseInt(process.env.AGENT_PORT || "9347", 10);

// Find beads-mcp path dynamically (latest version)
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

// SDK session info from disk
interface SdkSessionInfo {
  sessionId: string;
  agentName?: string;
  timestamp: string;
  summary?: string;
  preview: string[];  // Multiple lines of conversation
}

// List SDK sessions from ~/.claude/projects/<project-path>/
function listSdkSessions(cwd: string): SdkSessionInfo[] {
  // Convert cwd to Claude project directory format
  // Claude converts both / and _ to -
  const projectPath = cwd.replace(/[/_]/g, "-");
  const sessionsDir = join(homedir(), ".claude/projects", projectPath);

  console.log(`[sessions] Searching: ${sessionsDir}`);

  if (!existsSync(sessionsDir)) {
    console.log(`[sessions] Directory not found`);
    return [];
  }

  const files = readdirSync(sessionsDir)
    .filter(f => f.endsWith(".jsonl"))
    .map(f => {
      const fullPath = join(sessionsDir, f);
      try {
        const content = require("fs").readFileSync(fullPath, "utf8");
        const lines = content.split("\n").filter((l: string) => l.trim());
        if (lines.length === 0) return null;

        let sessionId = f.replace(".jsonl", "");
        let timestamp = "";
        let agentName: string | undefined;
        let summary: string | undefined;
        const preview: string[] = [];

        // Parse lines to extract metadata and conversation
        for (const line of lines.slice(0, 50)) {
          try {
            const data = JSON.parse(line);

            // Get session ID and timestamp from first user message
            if (data.sessionId && !timestamp) {
              sessionId = data.sessionId;
              timestamp = data.timestamp || "";
            }

            // Extract summary if present
            if (data.type === "summary" && data.summary) {
              summary = data.summary;
            }

            // Extract agent name from "You are an agent named X" pattern
            if (data.type === "user" && typeof data.message?.content === "string") {
              const match = data.message.content.match(/You are an agent named "([^"]+)"/);
              if (match) agentName = match[1];
            }

            // Collect user messages for preview (skip meta/system)
            if (data.type === "user" && !data.isMeta && data.message?.content) {
              const text = typeof data.message.content === "string"
                ? data.message.content
                : Array.isArray(data.message.content)
                  ? data.message.content.find((c: any) => c.type === "text")?.text
                  : null;
              if (text && !text.startsWith("<") && text.length > 5 && preview.length < 10) {
                const clean = text.replace(/\s+/g, " ").trim().slice(0, 120);
                if (clean && !clean.startsWith("You are an agent")) {
                  preview.push(clean);
                }
              }
            }

            // Also collect assistant responses (first sentence)
            if (data.type === "assistant" && data.message?.content) {
              const content = data.message.content;
              const text = Array.isArray(content)
                ? content.find((c: any) => c.type === "text")?.text
                : typeof content === "string" ? content : null;
              if (text && preview.length < 10) {
                const firstSentence = text.split(/[.!?\n]/)[0]?.trim().slice(0, 80);
                if (firstSentence && firstSentence.length > 10) {
                  preview.push(`> ${firstSentence}`);
                }
              }
            }
          } catch { /* skip unparseable lines */ }
        }

        if (!timestamp) return null;

        return { sessionId, agentName, timestamp, summary, preview } as SdkSessionInfo;
      } catch {
        return null;
      }
    })
    .filter((s): s is SdkSessionInfo => s !== null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Return only recent sessions (last 30)
  return files.slice(0, 30);
}

type FileDiff = {
  path: string;
  operation: "created" | "modified" | "deleted";
  before: string | null;
  after: string | null;
};

type AgentSession = {
  id: string;
  cwd: string;
  agentName?: string;
  systemPromptAppend?: string;
  sdkSessionId?: string; // Claude SDK session ID for resume
  abortController: AbortController;
  inputQueue: SDKUserMessage[];
  inputResolver?: (msg: SDKUserMessage) => void;
  fileSnapshots: Map<string, string | null>;
  touchedFiles: Set<string>;
  ws: ServerWebSocket<WSData> | null;
  cleanupTimer?: Timer;
  isRunning: boolean;
  allowedTools?: string[];
  disallowedTools?: string[];
};

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const sessions = new Map<string, AgentSession>();

type WSData = { sessionId?: string };

type ClientMessage =
  | { type: "start"; cwd: string; agentName?: string; systemPromptAppend?: string; briefing: string; allowedTools?: string[]; disallowedTools?: string[]; resumeSessionId?: string }
  | { type: "resume"; sessionId: string }
  | { type: "continue"; text: string }
  | { type: "message"; text: string }
  | { type: "interrupt" }
  | { type: "end" }
  | { type: "clear" }
  | { type: "compact" }
  | { type: "permission"; allow: boolean; message?: string };

async function* createInputIterator(session: AgentSession): AsyncIterable<SDKUserMessage> {
  while (true) {
    if (session.inputQueue.length > 0) {
      yield session.inputQueue.shift()!;
    } else {
      const msg = await new Promise<SDKUserMessage>((resolve) => {
        session.inputResolver = resolve;
      });
      session.inputResolver = undefined;
      yield msg;
    }
  }
}

function sendToClient(session: AgentSession, msg: object) {
  if (session.ws) {
    session.ws.send(JSON.stringify(msg));
  }
}

function sendToWs(ws: ServerWebSocket<WSData>, msg: object) {
  ws.send(JSON.stringify(msg));
}

async function readFileContent(path: string): Promise<string | null> {
  const file = Bun.file(path);
  if (await file.exists()) {
    return await file.text();
  }
  return null;
}

async function snapshotFile(session: AgentSession, path: string) {
  if (!session.fileSnapshots.has(path)) {
    session.fileSnapshots.set(path, await readFileContent(path));
  }
  session.touchedFiles.add(path);
}

function extractFilePath(toolName: string, input: Record<string, unknown>): string | null {
  if (toolName === "Edit" || toolName === "Write" || toolName === "Read") {
    return (input.file_path as string) || null;
  }
  if (toolName === "NotebookEdit") {
    return (input.notebook_path as string) || null;
  }
  return null;
}

async function computeDiffs(session: AgentSession): Promise<FileDiff[]> {
  const diffs: FileDiff[] = [];

  for (const path of session.touchedFiles) {
    const before = session.fileSnapshots.get(path) ?? null;
    const after = await readFileContent(path);

    if (before === null && after !== null) {
      diffs.push({ path, operation: "created", before: null, after });
    } else if (before !== null && after === null) {
      diffs.push({ path, operation: "deleted", before, after: null });
    } else if (before !== after) {
      diffs.push({ path, operation: "modified", before, after });
    }
  }

  return diffs;
}

async function runAgent(session: AgentSession, briefing: string, opts: { allowedTools?: string[]; disallowedTools?: string[]; resumeSdkSession?: string }) {
  session.isRunning = true;
  const inputIterator = createInputIterator(session);

  const initialMessage: SDKUserMessage = {
    type: "user",
    session_id: session.id,
    parent_tool_use_id: null,
    message: { role: "user", content: briefing },
  };
  session.inputQueue.push(initialMessage);

  // Ensure Skill tool is always available for invoking user/project skills
  const allowedTools = opts.allowedTools
    ? [...new Set([...opts.allowedTools, "Skill"])]
    : undefined;

  // Block raw beads MCP tools when agentName is set (we use wrappers that auto-inject assignee)
  const disallowedTools = session.agentName
    ? [...(opts.disallowedTools || []), ...BLOCKED_BEADS_TOOLS]
    : opts.disallowedTools;

  const options: Options = {
    cwd: session.cwd,
    abortController: session.abortController,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    includePartialMessages: true,
    settingSources: ["user", "project"],
    allowedTools,
    disallowedTools,
    ...(opts.resumeSdkSession && { resume: opts.resumeSdkSession }),
    mcpServers: {
      // Standard beads MCP (some tools blocked when agentName is set)
      ...(BEADS_MCP_PATH && {
        beads: {
          command: "uv",
          args: ["--directory", BEADS_MCP_PATH, "run", "beads-mcp"],
          env: {
            PATH: process.env.PATH || "",
            HOME: process.env.HOME || "",
            BD_CWD: session.cwd,
            BD_DB: join(session.cwd, ".beads", "beads.db"),
            ...(session.agentName && { BD_AGENT_NAME: session.agentName }),
          },
        },
      }),
      // Agent-aware beads tools that auto-inject assignee
      ...(session.agentName && {
        "beads-agent": createBeadsToolsServer(session.agentName, session.cwd),
      }),
    },
    hooks: {
      PreToolUse: [{
        hooks: [async (input) => {
          if (input.hook_event_name === "PreToolUse") {
            const path = extractFilePath(input.tool_name, input.tool_input as Record<string, unknown>);
            if (path) {
              await snapshotFile(session, path);
            }
          }
          return { continue: true };
        }],
      }],
    },
  };

  // Build system prompt with agent identity and tool routing
  let systemAppend = session.systemPromptAppend || "";
  if (session.agentName) {
    systemAppend += `

## Agent Identity & Beads Tools
You are agent "${session.agentName}".

**IMPORTANT**: For beads issue tracking, use these tools (they auto-inject your assignee):
- \`mcp__beads-agent__create_issue\` - Create issues (replaces mcp__beads__create)
- \`mcp__beads-agent__update_issue\` - Update issues (replaces mcp__beads__update)

The raw \`mcp__beads__create\` and \`mcp__beads__update\` tools are blocked. All other beads tools (\`mcp__beads__list\`, \`mcp__beads__show\`, \`mcp__beads__ready\`, etc.) work normally.

## MANDATORY Ticket Workflow

**FOR EACH TICKET**, follow this EXACT sequence:

1. **CLAIM** - Update ticket to \`in_progress\` BEFORE starting work:
   \`mcp__beads-agent__update_issue({ id: "<ticket-id>", status: "in_progress" })\`

2. **WORK** - Implement the changes

3. **COMMIT** - Create atomic commit with ticket reference:
   \`git add <files> && git commit -m "<type>(<ticket-id>): <description>"\`

4. **CLOSE** - Update ticket with summary, commit ID, and hash:
   \`\`\`
   git log -1 --format="%H %s"  # Get commit hash and message
   mcp__beads-agent__update_issue({
     id: "<ticket-id>",
     status: "closed",
     notes: "Summary: <what was done>\\nCommit: <hash> <message>"
   })
   \`\`\`

**NEVER**:
- Start work without claiming (updating to in_progress)
- Move to next ticket before committing current work
- Close ticket without recording commit info`;
  }

  if (systemAppend) {
    options.systemPrompt = {
      type: "preset",
      preset: "claude_code",
      append: systemAppend,
    };
  }

  const agentQuery = query({ prompt: inputIterator, options });

  try {
    for await (const message of agentQuery) {
      // Capture SDK session ID from init message
      if (message.type === "system" && message.subtype === "init") {
        session.sdkSessionId = message.session_id;
        sendToClient(session, {
          type: "sdk_session",
          sdkSessionId: message.session_id,
          source: opts.resumeSdkSession ? "resume" : "new"
        });
      }

      // Detect compact boundary (context was compacted)
      if (message.type === "system" && message.subtype === "compact_boundary") {
        sendToClient(session, {
          type: "compacted",
          metadata: (message as any).compact_metadata
        });
      }

      sendToClient(session, { type: "stream", data: message });

      if (message.type === "result") {
        const diffs = await computeDiffs(session);
        sendToClient(session, { type: "done", result: message, diffs });
        // Don't break - allow the agent to continue processing follow-up messages
      }
    }
  } finally {
    session.isRunning = false;
  }
}

const server = Bun.serve<WSData>({
  port: PORT,
  hostname: "0.0.0.0",
  fetch(req, server) {
    const url = new URL(req.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        activeSessions: sessions.size,
        beadsMcpEnabled: !!BEADS_MCP_PATH,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // CORS headers for HTTP endpoints
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json",
    };

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // List available SDK sessions from disk
    if (url.pathname === "/sessions") {
      const cwd = url.searchParams.get("cwd");
      if (!cwd) {
        return new Response(JSON.stringify({ error: "cwd required" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      try {
        const sdkSessions = listSdkSessions(cwd);
        return new Response(JSON.stringify({ sessions: sdkSessions }), {
          headers: corsHeaders,
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    if (server.upgrade(req, { data: {} })) {
      return;
    }
    return new Response("WebSocket only", { status: 426 });
  },
  websocket: {
    open(ws) {
      console.log("Client connected");
    },
    close(ws) {
      const sessionId = ws.data.sessionId;
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (session) {
          session.ws = null;
          // Start cleanup timer instead of immediate deletion
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
    async message(ws, raw) {
      const msg = JSON.parse(raw.toString()) as ClientMessage;

      if (msg.type === "start") {
        const sessionId = crypto.randomUUID();
        ws.data.sessionId = sessionId;

        const session: AgentSession = {
          id: sessionId,
          cwd: msg.cwd,
          agentName: msg.agentName,
          systemPromptAppend: msg.systemPromptAppend,
          sdkSessionId: msg.resumeSessionId, // Pre-set if resuming SDK session
          abortController: new AbortController(),
          inputQueue: [],
          fileSnapshots: new Map(),
          touchedFiles: new Set(),
          ws,
          isRunning: false,
          allowedTools: msg.allowedTools,
          disallowedTools: msg.disallowedTools,
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

        // Cancel cleanup timer if pending
        if (session.cleanupTimer) {
          clearTimeout(session.cleanupTimer);
          session.cleanupTimer = undefined;
        }

        // Re-attach websocket
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

      if (msg.type === "interrupt") {
        session.abortController.abort();
        sendToClient(session, { type: "interrupted" });
        return;
      }

      if (msg.type === "end") {
        // End session completely - abort and cleanup
        session.abortController.abort();
        if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
        sessions.delete(sessionId);
        ws.data.sessionId = undefined;
        sendToWs(ws, { type: "session_ended", sessionId });
        return;
      }

      if (msg.type === "clear") {
        // Clear session - restart with fresh context (no SDK resume)
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
        // Continue session with new prompt (agent must not be running)
        if (session.isRunning) {
          sendToWs(ws, { type: "error", error: "Agent is still running. Use 'message' for follow-up or 'interrupt' first." });
          return;
        }

        // Reset abort controller and restart agent with SDK resume
        session.abortController = new AbortController();

        runAgent(session, msg.text, {
          allowedTools: session.allowedTools,
          disallowedTools: session.disallowedTools,
          resumeSdkSession: session.sdkSessionId,
        }).catch((err) => {
          sendToClient(session, { type: "error", error: String(err) });
        });
        return;
      }

      if (msg.type === "compact") {
        // Trigger manual context compaction via /compact slash command
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
  },
});

console.log(`Agent WebSocket server running on ws://localhost:${PORT}`);
if (BEADS_MCP_PATH) {
  console.log(`Beads MCP enabled: ${BEADS_MCP_PATH}`);
} else {
  console.log("Beads MCP not found (optional)");
}

// Graceful shutdown
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
