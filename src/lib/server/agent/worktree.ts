/**
 * Git worktree management for agent concurrency isolation.
 * Creates detached worktrees at .git/beads-worktrees/{ticketId}/
 * and symlinks .beads/ into each worktree.
 */
import { join, resolve } from "path";
import { existsSync, symlinkSync } from "fs";

const WORKTREE_DIR = "beads-worktrees";

function worktreeBase(repoPath: string): string {
  return join(repoPath, ".git", WORKTREE_DIR);
}

function worktreePath(repoPath: string, ticketId: string): string {
  return join(worktreeBase(repoPath), ticketId);
}

async function run(cmd: string[], cwd: string): Promise<string> {
  const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0) throw new Error(err.trim() || `Command failed: ${cmd.join(" ")}`);
  return out.trim();
}

export async function createWorktree(repoPath: string, ticketId: string): Promise<string> {
  const wt = worktreePath(repoPath, ticketId);

  if (existsSync(wt)) return resolve(wt);

  await run(["git", "worktree", "add", "--detach", wt], repoPath);

  const beadsSrc = join(repoPath, ".beads");
  const beadsDst = join(wt, ".beads");
  if (existsSync(beadsSrc) && !existsSync(beadsDst)) {
    symlinkSync(beadsSrc, beadsDst);
  }

  return resolve(wt);
}

export interface WorktreeInfo {
  ticketId: string;
  path: string;
}

export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  const raw = await run(["git", "worktree", "list", "--porcelain"], repoPath);
  const base = worktreeBase(repoPath);
  const results: WorktreeInfo[] = [];

  for (const block of raw.split("\n\n")) {
    const match = block.match(/^worktree (.+)$/m);
    if (!match) continue;
    const wtPath = match[1];
    if (!wtPath.startsWith(base)) continue;
    const ticketId = wtPath.slice(base.length + 1);
    if (ticketId) results.push({ ticketId, path: wtPath });
  }

  return results;
}

export async function removeWorktree(repoPath: string, ticketId: string): Promise<void> {
  const wt = worktreePath(repoPath, ticketId);
  if (!existsSync(wt)) {
    const { markWorktreeRemoved } = await import("./worktree-registry");
    markWorktreeRemoved(repoPath, ticketId);
    return;
  }
  await run(["git", "worktree", "remove", "--force", wt], repoPath);
  const { markWorktreeRemoved } = await import("./worktree-registry");
  markWorktreeRemoved(repoPath, ticketId);
}
