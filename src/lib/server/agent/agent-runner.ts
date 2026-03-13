import { query, type Options, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentSession } from "./session-types";
import { BLOCKED_BEADS_TOOLS, createBeadsToolsServer } from "./beads-tools";
import { createManagerToolsServer } from "./manager-tools";
import { buildManagerPrompt } from "./manager-prompt";
import { extractFilePath, snapshotFile, computeDiffs } from "./file-diff";
import { buildSystemPrompt } from "./system-prompt";
import type { AgentQueue } from "./queue-manager";
import { log } from "../logger";

// Intercept fetch to log auth headers
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
  const [url, init] = args;
  if (url.toString().includes('anthropic.com') || url.toString().includes('claude.ai')) {
    const headers = new Headers(init?.headers);
    log.info('[AUTH INTERCEPT]', JSON.stringify({
      url: url.toString().substring(0, 50) + '...',
      'x-api-key': headers.get('x-api-key')?.substring(0, 20) + '...' || '(not set)',
      'authorization': headers.get('authorization')?.substring(0, 30) + '...' || '(not set)',
      'cookie': headers.get('cookie') ? '(present)' : '(not set)',
    }));
  }
  return originalFetch(...args);
};

export function sendToClient(session: AgentSession, msg: object) {
  if (session.ws) {
    session.ws.send(JSON.stringify(msg));
  }
}

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

export type RunAgentOpts = {
  allowedTools?: string[];
  disallowedTools?: string[];
  resumeSdkSession?: string;
  beadsMcpPath?: string | null;
  queue?: AgentQueue;
  sessions?: Map<string, AgentSession>;
};

export async function runAgent(session: AgentSession, briefing: string, opts: RunAgentOpts) {
  session.isRunning = true;
  const inputIterator = createInputIterator(session);

  const initialMessage: SDKUserMessage = {
    type: "user",
    session_id: session.id,
    parent_tool_use_id: null,
    message: { role: "user", content: briefing },
  };
  session.inputQueue.push(initialMessage);

  const allowedTools = opts.allowedTools
    ? [...new Set([...opts.allowedTools, "Skill"])]
    : undefined;

  const disallowedTools = session.isManager
    ? opts.disallowedTools
    : session.agentName
      ? [...(opts.disallowedTools || []), ...BLOCKED_BEADS_TOOLS]
      : opts.disallowedTools;

  const options: Options = {
    cwd: session.cwd,
    abortController: session.abortController,
    ...(session.model && { model: session.model }),
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    includePartialMessages: true,
    settingSources: ["user", "project"],
    allowedTools,
    disallowedTools,
    ...(opts.resumeSdkSession && { resume: opts.resumeSdkSession }),
    mcpServers: {
      ...(opts.beadsMcpPath && {
        beads: {
          command: "uv",
          args: ["--directory", opts.beadsMcpPath, "run", "beads-mcp"],
          env: {
            PATH: process.env.PATH || "",
            HOME: process.env.HOME || "",
            BD_CWD: session.cwd,
            ...(session.agentName && { BD_AGENT_NAME: session.agentName }),
          },
        },
      }),
      ...(session.isManager && opts.queue && opts.sessions && {
        "beads-manager": createManagerToolsServer(session.cwd, opts.sessions, opts.queue),
      }),
      ...(!session.isManager && session.agentName && {
        "beads-agent": createBeadsToolsServer(session.agentName, session.cwd),
      }),
    },
    hooks: {
      PreToolUse: [{
        hooks: [async (input) => {
          const hook = input as any;
          const path = extractFilePath(hook.tool_name, hook.tool_input as Record<string, unknown>);
          if (path) {
            await snapshotFile(session.fileSnapshots, session.touchedFiles, path);
          }
          return { continue: true };
        }],
      }],
      SubagentStart: [{
        hooks: [async (input) => {
          const agentType = (input as any).agent_type || "subagent";
          sendToClient(session, {
            type: "system_message",
            subtype: "subagent_start",
            content: `Starting subagent: ${agentType}`,
            agentName: agentType
          });
          return { continue: true };
        }],
      }],
      SubagentStop: [{
        hooks: [async (input) => {
          const agentId = (input as any).agent_id || "subagent";
          sendToClient(session, {
            type: "system_message",
            subtype: "subagent_end",
            content: `Subagent completed: ${agentId}`,
            agentName: agentId
          });
          return { continue: true };
        }],
      }],
    },
  };

  const systemAppend = session.isManager
    ? buildManagerPrompt()
    : buildSystemPrompt(session);
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
      if (message.type === "system" && message.subtype === "init") {
        session.sdkSessionId = message.session_id;

        // Get rich slash command info from the SDK
        const slashCommands = await agentQuery.supportedCommands();
        log.info("[agent] supportedCommands:", slashCommands);

        sendToClient(session, {
          type: "sdk_session",
          sdkSessionId: message.session_id,
          source: opts.resumeSdkSession ? "resume" : "new",
          slashCommands: slashCommands.map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            argumentHint: cmd.argumentHint
          }))
        });

        if (session.usage.inputTokens > 0 || session.usage.outputTokens > 0) {
          sendToClient(session, {
            type: "usage",
            inputTokens: session.usage.inputTokens,
            outputTokens: session.usage.outputTokens,
            cacheRead: session.usage.cacheRead,
            cacheCreation: session.usage.cacheCreation,
          });
        }
      }

      if (message.type === "system") {
        const subtype = message.subtype;
        // Handle compact boundary - compaction complete
        if (subtype === "compact_boundary") {
          sendToClient(session, {
            type: "compacted",
            metadata: (message as any).compact_metadata
          });
          sendToClient(session, {
            type: "system_message",
            subtype: "compact_done",
            content: "Context compacted successfully"
          });
        }
        // Handle status messages (e.g., compacting status)
        else if (subtype === "status") {
          const status = (message as any).status;
          if (status === "compacting") {
            sendToClient(session, {
              type: "system_message",
              subtype: "compact_start",
              content: "Compacting context..."
            });
          }
        }
      }

      if (message.type === "assistant") {
        const usage = (message as any).message?.usage;
        if (usage) {
          session.usage.inputTokens += usage.input_tokens || 0;
          session.usage.outputTokens += usage.output_tokens || 0;
          session.usage.cacheRead += usage.cache_read_input_tokens || 0;
          session.usage.cacheCreation += usage.cache_creation_input_tokens || 0;

          sendToClient(session, {
            type: "usage",
            inputTokens: session.usage.inputTokens,
            outputTokens: session.usage.outputTokens,
            cacheRead: session.usage.cacheRead,
            cacheCreation: session.usage.cacheCreation,
          });
        }
      }

      sendToClient(session, { type: "stream", data: message });

      if (message.type === "result") {
        const diffs = await computeDiffs(session.fileSnapshots, session.touchedFiles);
        sendToClient(session, { type: "done", result: message, diffs });
      }
    }
  } finally {
    session.isRunning = false;
    // Notify manager when a worker completes
    if (!session.isManager && opts.sessions) {
      for (const s of opts.sessions.values()) {
        if (!s.isManager || !s.isRunning) continue;
        const notification: SDKUserMessage = {
          type: "user",
          session_id: s.id,
          parent_tool_use_id: null,
          message: {
            role: "user",
            content: `[System] Agent "${session.agentName}" has completed its task.`,
          },
        };
        if (s.inputResolver) {
          s.inputResolver(notification);
        } else {
          s.inputQueue.push(notification);
        }
        break;
      }
    }
    // Auto-start next queued item when a worker finishes
    if (!session.isManager && opts.queue) {
      opts.queue.maybeStartNext();
    }
  }
}
