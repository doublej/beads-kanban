import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { log } from "../logger";
import { listWorktrees } from "./worktree";

export type WorktreeRecord = {
  ticketId: string;
  path: string;
  projectCwd: string;
  sessionId: string;
  createdAt: string;
  removedAt?: string;
  status: "active" | "completed" | "removed";
};

function registryPath(projectCwd: string): string {
  return join(projectCwd, ".beads", "worktrees.json");
}

function readAll(projectCwd: string): WorktreeRecord[] {
  const path = registryPath(projectCwd);
  if (!existsSync(path)) return [];
  try {
    const text = readFileSync(path, "utf8");
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    log.warn(`[worktree-registry] Failed to read ${path}:`, err);
    return [];
  }
}

function writeAll(projectCwd: string, records: WorktreeRecord[]): void {
  const path = registryPath(projectCwd);
  const dir = join(projectCwd, ".beads");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(path, JSON.stringify(records, null, 2));
  } catch (err) {
    log.error(`[worktree-registry] Failed to write ${path}:`, err);
  }
}

export function registerWorktree(projectCwd: string, ticketId: string, path: string, sessionId: string): void {
  const records = readAll(projectCwd);
  records.push({
    ticketId,
    path,
    projectCwd,
    sessionId,
    createdAt: new Date().toISOString(),
    status: "active",
  });
  writeAll(projectCwd, records);
}

export function markWorktreeCompleted(projectCwd: string, ticketId: string): void {
  const records = readAll(projectCwd);
  let changed = false;
  for (const r of records) {
    if (r.ticketId === ticketId && r.status === "active") {
      r.status = "completed";
      changed = true;
    }
  }
  if (changed) writeAll(projectCwd, records);
}

export function markWorktreeRemoved(projectCwd: string, ticketId: string): void {
  const records = readAll(projectCwd);
  let changed = false;
  for (const r of records) {
    if (r.ticketId === ticketId && r.status !== "removed") {
      r.status = "removed";
      r.removedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) writeAll(projectCwd, records);
}

export function listActiveWorktrees(projectCwd: string): WorktreeRecord[] {
  return readAll(projectCwd).filter(r => r.projectCwd === projectCwd && r.status === "active");
}

export async function pruneStale(projectCwd: string): Promise<void> {
  const records = readAll(projectCwd);
  if (records.length === 0) return;

  let actualPaths: Set<string>;
  try {
    const worktrees = await listWorktrees(projectCwd);
    actualPaths = new Set(worktrees.map(w => w.path));
  } catch (err) {
    log.warn(`[worktree-registry] Failed to list git worktrees for ${projectCwd}:`, err);
    return;
  }

  let changed = false;
  for (const r of records) {
    if (r.projectCwd !== projectCwd) continue;
    if (r.status === "removed") continue;
    if (!actualPaths.has(r.path)) {
      r.status = "removed";
      r.removedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) writeAll(projectCwd, records);
}
