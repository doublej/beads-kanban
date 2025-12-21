import { query, type Options, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { join } from "path";
import type { AgentSession } from "./session-types";
import { BLOCKED_BEADS_TOOLS, createBeadsToolsServer } from "./beads-tools";
import { extractFilePath, snapshotFile, computeDiffs } from "./file-diff";

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

function buildSystemPrompt(session: AgentSession): string {
  let systemAppend = session.systemPromptAppend || "";
  if (session.agentName) {
    systemAppend += `

## Agent Identity & Beads Tools
You are agent "${session.agentName}".

**IMPORTANT**: For beads issue tracking, use these tools (they auto-inject your assignee):
- \`mcp__beads-agent__create_issue\` - Create issues (replaces mcp__beads__create)
- \`mcp__beads-agent__update_issue\` - Update issues (replaces mcp__beads__update)

The raw \`mcp__beads__create\` and \`mcp__beads__update\` tools are blocked. All other beads tools (\`mcp__beads__list\`, \`mcp__beads__show\`, \`mcp__beads__ready\`, etc.) work normally.

## Code Organization
Always optimize folder and component structure. Keep each concern separate: split large files into focused modules, extract reusable components, organize by feature/domain. Prefer smaller, single-purpose files over monolithic ones.

## MANDATORY Ticket Workflow

**FOR EACH TICKET**, follow this EXACT sequence:

1. **CLAIM** - Update ticket to \`in_progress\` BEFORE starting work:
   \`mcp__beads-agent__update_issue({ id: "<ticket-id>", status: "in_progress" })\`

2. **WORK** - Implement the changes

3. **COMMIT** - Create atomic commit with ticket reference:
   \`git add <files> && git commit -m "<type>(<ticket-id>): <description>"\`

4. **LINT** - Run linting and fix any issues BEFORE closing:
   \`bun run check\`
   - If errors: fix them, commit fixes, re-run lint
   - Only proceed to CLOSE when lint passes

5. **CLOSE** - Update ticket with summary, commit ID, and hash:
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
- Close ticket without running lint and ensuring it passes
- Close ticket without recording commit info`;
  }
  return systemAppend;
}

export type RunAgentOpts = {
  allowedTools?: string[];
  disallowedTools?: string[];
  resumeSdkSession?: string;
  beadsMcpPath?: string | null;
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
      ...(opts.beadsMcpPath && {
        beads: {
          command: "uv",
          args: ["--directory", opts.beadsMcpPath, "run", "beads-mcp"],
          env: {
            PATH: process.env.PATH || "",
            HOME: process.env.HOME || "",
            BD_CWD: session.cwd,
            BD_DB: join(session.cwd, ".beads", "beads.db"),
            ...(session.agentName && { BD_AGENT_NAME: session.agentName }),
          },
        },
      }),
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
              await snapshotFile(session.fileSnapshots, session.touchedFiles, path);
            }
          }
          return { continue: true };
        }],
      }],
      SubagentStart: [{
        hooks: [async (input) => {
          if (input.hook_event_name === "SubagentStart") {
            const agentType = (input as any).agent_type || "subagent";
            sendToClient(session, {
              type: "system_message",
              subtype: "subagent_start",
              content: `Starting subagent: ${agentType}`,
              agentName: agentType
            });
          }
          return { continue: true };
        }],
      }],
      SubagentStop: [{
        hooks: [async (input) => {
          if (input.hook_event_name === "SubagentStop") {
            const agentId = (input as any).agent_id || "subagent";
            sendToClient(session, {
              type: "system_message",
              subtype: "subagent_end",
              content: `Subagent completed: ${agentId}`,
              agentName: agentId
            });
          }
          return { continue: true };
        }],
      }],
    },
  };

  const systemAppend = buildSystemPrompt(session);
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
        console.log("[agent] supportedCommands:", slashCommands);

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
  }
}
