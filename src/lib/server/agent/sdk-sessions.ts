import { existsSync, readdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { SdkSessionInfo } from "./session-types";

export function calculateSessionUsage(cwd: string, sessionId: string): { inputTokens: number; outputTokens: number; cacheRead: number; cacheCreation: number } | null {
  const projectPath = cwd.replace(/[/_]/g, "-");
  const sessionFile = join(homedir(), ".claude/projects", projectPath, `${sessionId}.jsonl`);

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

export function listSdkSessions(cwd: string): SdkSessionInfo[] {
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
        const content = readFileSync(fullPath, "utf8");
        const lines = content.split("\n").filter((l: string) => l.trim());
        if (lines.length === 0) return null;

        let sessionId = f.replace(".jsonl", "");
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
    })
    .filter((s): s is SdkSessionInfo => s !== null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return files.slice(0, 30);
}
