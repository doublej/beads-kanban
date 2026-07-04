import { query, type Options, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentSession } from "./session-types";
import { BLOCKED_BEADS_TOOLS, createBeadsToolsServer } from "./beads-tools";
import { createManagerToolsServer } from "./manager-tools";
import { buildManagerPrompt } from "./manager-prompt";
import { extractFilePath, snapshotFile, computeDiffs } from "./file-diff";
import { buildSystemPrompt } from "./system-prompt";
import type { AgentQueue } from "./queue-manager";
import { hookExecutor } from "./hook-executor";
import { markWorktreeCompleted } from "./worktree-registry";
import { log } from "../logger";

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

  const projectCwd = session.projectCwd ?? session.cwd;
  const ticketId = session.ticketId ?? (session.agentName?.endsWith("-agent") ? session.agentName.slice(0, -6) : undefined);

  if (!session.isManager && session.agentName) {
    hookExecutor.executeHooks("AgentStarted", {
      cwd: projectCwd,
      agentName: session.agentName,
      ticketId,
      id: ticketId,
      worktreePath: session.worktreePath ?? "",
    }).catch(err => log.error("[hooks] AgentStarted failed:", err));
  }

  const inputIterator = createInputIterator(session);
  let runError: unknown = null;

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
    permissionMode: session.permissionMode ?? "bypassPermissions",
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
      PostToolUseFailure: [{
        hooks: [async (input) => {
          const hook = input as any;
          // Interrupts aren't real failures — the user stopped the tool.
          if (!hook.is_interrupt) {
            sendToClient(session, {
              type: "system_message",
              subtype: "tool_failure",
              content: `${hook.tool_name} failed: ${String(hook.error ?? "").slice(0, 300)}`,
            });
          }
          return { continue: true };
        }],
      }],
      Notification: [{
        hooks: [async (input) => {
          const hook = input as any;
          const text = hook.title ? `${hook.title}: ${hook.message}` : hook.message;
          if (text) {
            sendToClient(session, {
              type: "system_message",
              subtype: "notification",
              content: String(text).slice(0, 300),
            });
          }
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
  session.agentQuery = agentQuery;

  try {
    for await (const message of agentQuery) {
      if (message.type === "system" && message.subtype === "init") {
        session.sdkSessionId = message.session_id;

        const initMsg = message as any;
        // Adopt the SDK's effective permission mode so the client reflects reality.
        session.permissionMode = session.permissionMode ?? initMsg.permissionMode;

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

        // Surface SDK-reported capabilities: available models, MCP server health,
        // current model/permission mode. The init message already carries most of
        // this; supportedModels() fills the model picker.
        let models: { value: string; displayName: string; description: string }[] = [];
        try {
          models = await agentQuery.supportedModels();
        } catch (err) {
          log.warn("[agent] supportedModels failed:", err);
        }
        sendToClient(session, {
          type: "agent_capabilities",
          models,
          mcpServers: initMsg.mcp_servers ?? [],
          currentModel: initMsg.model,
          permissionMode: initMsg.permissionMode,
          tools: initMsg.tools ?? [],
          plugins: initMsg.plugins ?? [],
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
        const r = message as any;
        sendToClient(session, {
          type: "done",
          result: {
            subtype: r.subtype,
            total_cost_usd: r.total_cost_usd,
            modelUsage: r.modelUsage,
            num_turns: r.num_turns,
            permission_denials: r.permission_denials,
            errors: r.errors,
          },
          diffs,
        });
        if (!session.isManager) break;
      }
    }
  } catch (err) {
    runError = err;
    throw err;
  } finally {
    session.isRunning = false;
    session.agentQuery = undefined;
    const threwError = runError !== null;
    const errorMessage = threwError
      ? (runError instanceof Error ? runError.message : String(runError))
      : undefined;

    // Notify manager when a worker completes
    if (!session.isManager && opts.sessions) {
      const outcome = threwError
        ? `encountered an error: ${errorMessage}`
        : `completed ticket ${ticketId ?? "(unknown)"}`;
      const cwdLine = session.cwd ? ` CWD: ${session.cwd}.` : "";
      const content = `[System] Agent "${session.agentName}" ${outcome}.${cwdLine} Review the ticket and dispatch follow-up work if needed.`;
      let delivered = false;
      for (const s of opts.sessions.values()) {
        if (!s.isManager) continue;
        const managerProjectCwd = s.projectCwd ?? s.cwd;
        if (managerProjectCwd !== projectCwd) continue;
        const notification: SDKUserMessage = {
          type: "user",
          session_id: s.id,
          parent_tool_use_id: null,
          message: { role: "user", content },
        };
        sendToClient(s, { type: "stream", data: notification });
        if (s.inputResolver) {
          s.inputResolver(notification);
        } else {
          s.inputQueue.push(notification);
        }
        delivered = true;
        log.info(`[agent-runner] Notified manager ${s.agentName} of ${session.agentName} ${threwError ? "error" : "completion"} (ticket ${ticketId ?? "?"})`);
        break;
      }
      if (!delivered) {
        log.warn(`[agent-runner] No manager session found for project ${projectCwd} — ${session.agentName} completion not delivered`);
      }
    }

    if (!session.isManager && session.agentName) {
      const baseCtx = {
        cwd: projectCwd,
        agentName: session.agentName,
        ticketId,
        id: ticketId,
        worktreePath: session.worktreePath ?? "",
      };
      if (threwError) {
        hookExecutor.executeHooks("AgentError", { ...baseCtx, error: errorMessage ?? "" })
          .catch(e => log.error("[hooks] AgentError failed:", e));
      } else {
        hookExecutor.executeHooks("AgentCompleted", baseCtx)
          .catch(e => log.error("[hooks] AgentCompleted failed:", e));
      }
      if (session.worktreePath && ticketId) {
        try {
          markWorktreeCompleted(projectCwd, ticketId);
        } catch (e) {
          log.warn("[worktree-registry] markWorktreeCompleted failed:", e);
        }
      }
    }

    // Auto-start next queued item when a worker finishes
    if (!session.isManager && opts.queue) {
      opts.queue.maybeStartNext();
    }
  }
}
