import { existsSync, readdirSync, readFileSync, openSync, readSync, closeSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { SdkSessionInfo } from "./session-types";

// Only the first HEAD_LINES of each session file are inspected below, so read
// just enough bytes to cover them instead of loading multi-MB files whole.
const HEAD_LINES = 50;
const HEAD_CHUNK = 64 * 1024;
const HEAD_MAX_BYTES = 1024 * 1024;

function readHead(fullPath: string, maxLines: number): string {
  const fd = openSync(fullPath, "r");
  try {
    const buf = Buffer.allocUnsafe(HEAD_CHUNK);
    let acc = "";
    let pos = 0;
    while (pos < HEAD_MAX_BYTES) {
      const bytes = readSync(fd, buf, 0, HEAD_CHUNK, pos);
      if (bytes === 0) break;
      acc += buf.toString("utf8", 0, bytes);
      pos += bytes;
      let newlines = 0;
      for (let i = 0; i < acc.length; i++) if (acc.charCodeAt(i) === 10) newlines++;
      if (newlines >= maxLines) break;
    }
    return acc;
  } finally {
    closeSync(fd);
  }
}

// Cache parsed session metadata keyed by path; invalidated when mtime changes,
// so repeated /sessions polls only re-read files that actually changed.
const sessionCache = new Map<string, { mtimeMs: number; info: SdkSessionInfo }>();

type ChatMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  timestamp?: string;
};

function getProjectDir(cwd: string): string {
  const projectPath = cwd.replace(/[/_]/g, "-");
  return join(homedir(), ".claude/projects", projectPath);
}

export function calculateSessionUsage(cwd: string, sessionId: string): { inputTokens: number; outputTokens: number; cacheRead: number; cacheCreation: number } | null {
  const sessionFile = join(getProjectDir(cwd), `${sessionId}.jsonl`);

  if (!existsSync(sessionFile)) return null;

  try {
    const content = readFileSync(sessionFile, "utf8");
    const lines = content.split("\n").filter((l: string) => l.trim());

    let inputTokens = 0, outputTokens = 0, cacheRead = 0, cacheCreation = 0;

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.type === "assistant" && data.message?.usage) {
          const u = data.message.usage;
          inputTokens += u.input_tokens || 0;
          outputTokens += u.output_tokens || 0;
          cacheRead += u.cache_read_input_tokens || 0;
          cacheCreation += u.cache_creation_input_tokens || 0;
        }
      } catch { /* skip */ }
    }

    return { inputTokens, outputTokens, cacheRead, cacheCreation };
  } catch {
    return null;
  }
}

function parseSessionFile(fullPath: string, filename: string): SdkSessionInfo | null {
  try {
    const content = readHead(fullPath, HEAD_LINES);
    const lines = content.split("\n").filter((l: string) => l.trim());
    if (lines.length === 0) return null;

    let sessionId = filename.replace(".jsonl", "");
    let timestamp = "";
    let agentName: string | undefined;
    let summary: string | undefined;
    const preview: string[] = [];

    for (const line of lines.slice(0, 50)) {
      try {
        const data = JSON.parse(line);

        if (data.sessionId && !timestamp) {
          sessionId = data.sessionId;
          timestamp = data.timestamp || "";
        }

        if (data.type === "summary" && data.summary) {
          summary = data.summary;
        }

        if (data.type === "user" && typeof data.message?.content === "string") {
          const match = data.message.content.match(/You are an agent named "([^"]+)"/);
          if (match) agentName = match[1];
        }

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
      } catch { /* skip */ }
    }

    if (!timestamp) return null;

    return { sessionId, agentName, timestamp, summary, preview } as SdkSessionInfo;
  } catch {
    return null;
  }
}

export function listSdkSessions(cwd: string): SdkSessionInfo[] {
  const sessionsDir = getProjectDir(cwd);

  if (!existsSync(sessionsDir)) return [];

  const files = readdirSync(sessionsDir)
    .filter(f => f.endsWith(".jsonl"))
    .map(f => {
      const fullPath = join(sessionsDir, f);
      let mtimeMs: number;
      try {
        mtimeMs = statSync(fullPath).mtimeMs;
      } catch {
        return null;
      }
      const cached = sessionCache.get(fullPath);
      if (cached && cached.mtimeMs === mtimeMs) return cached.info;
      const info = parseSessionFile(fullPath, f);
      if (info) sessionCache.set(fullPath, { mtimeMs, info });
      return info;
    })
    .filter((s): s is SdkSessionInfo => s !== null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return files.slice(0, 30);
}

export function getSessionHistory(cwd: string, sessionId: string): ChatMessage[] {
  const sessionFile = join(getProjectDir(cwd), `${sessionId}.jsonl`);
  if (!existsSync(sessionFile)) return [];

  try {
    const content = readFileSync(sessionFile, "utf8");
    const lines = content.split("\n").filter((l: string) => l.trim());
    const messages: ChatMessage[] = [];

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.type === "user" && data.message?.content) {
          const raw = data.message.content;
          const text = typeof raw === "string"
            ? raw
            : Array.isArray(raw)
              ? raw.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n")
              : null;
          if (!text || text.startsWith("<system-reminder>")) continue;
          messages.push({ role: "user", content: text, timestamp: data.timestamp });
        } else if (data.type === "assistant" && data.message?.content) {
          const blocks = Array.isArray(data.message.content) ? data.message.content : [];
          for (const block of blocks) {
            if (block.type === "text" && block.text) {
              messages.push({ role: "assistant", content: block.text, timestamp: data.timestamp });
            } else if (block.type === "tool_use" && block.name) {
              messages.push({
                role: "tool",
                content: `Using ${block.name}`,
                toolName: block.name,
                toolInput: block.input,
                timestamp: data.timestamp,
              });
            }
          }
        } else if (data.type === "result" && data.subtype === "tool_result") {
          // Attach tool result to the last pending tool message
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "tool" && !messages[i].toolResult) {
              const resultText = typeof data.result === "string" ? data.result : JSON.stringify(data.result);
              messages[i] = { ...messages[i], toolResult: resultText };
              break;
            }
          }
        }
      } catch { /* skip malformed line */ }
    }

    return messages;
  } catch {
    return [];
  }
}
