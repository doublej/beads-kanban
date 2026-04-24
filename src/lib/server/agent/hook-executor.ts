import { join } from "path";
import { existsSync, watch, readFileSync, type FSWatcher } from "fs";
import yaml from "js-yaml";
import type { HookConfig, HookContext, HookEntry, HookEventName } from "./hook-config";
import { log } from "../logger";

const DEFAULT_TIMEOUT_SEC = 10;

type ConfigShape = {
  hooks?: HookConfig;
};

class HookExecutor {
  private configByCwd = new Map<string, HookConfig>();
  private watchers = new Map<string, FSWatcher>();

  private configPath(cwd: string): string {
    return join(cwd, ".beads", "config.yaml");
  }

  private load(cwd: string): HookConfig {
    const path = this.configPath(cwd);
    if (!existsSync(path)) return {};
    try {
      const text = readFileSync(path, "utf8");
      const parsed = yaml.load(text) as ConfigShape | null;
      return parsed?.hooks ?? {};
    } catch (err) {
      log.error(`[hooks] Failed to parse ${path}:`, err);
      return {};
    }
  }

  private ensureWatcher(cwd: string) {
    if (this.watchers.has(cwd)) return;
    const path = this.configPath(cwd);
    if (!existsSync(path)) return;
    try {
      const w = watch(path, () => {
        this.configByCwd.set(cwd, this.load(cwd));
        log.info(`[hooks] Reloaded hooks for ${cwd}`);
      });
      this.watchers.set(cwd, w);
    } catch (err) {
      log.warn(`[hooks] Failed to watch ${path}:`, err);
    }
  }

  getLoadedHooks(cwd: string): HookConfig {
    let cfg = this.configByCwd.get(cwd);
    if (!cfg) {
      cfg = this.load(cwd);
      this.configByCwd.set(cwd, cfg);
      this.ensureWatcher(cwd);
    }
    return cfg;
  }

  private matches(entry: HookEntry, id: string | undefined): boolean {
    if (!entry.matcher) return true;
    if (!id) return false;
    try {
      const glob = new Bun.Glob(entry.matcher);
      return glob.match(id);
    } catch {
      return false;
    }
  }

  private interpolate(cmd: string, ctx: HookContext): string {
    return cmd.replace(/\{(\w+)\}/g, (_, key) => {
      const v = (ctx as Record<string, unknown>)[key];
      return v === undefined || v === null ? "" : String(v);
    });
  }

  private buildEnv(ctx: HookContext): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [key, val] of Object.entries(process.env)) {
      if (typeof val === "string") env[key] = val;
    }
    const map: Record<string, keyof HookContext> = {
      BEADS_ID: "id",
      BEADS_TITLE: "title",
      BEADS_STATUS: "status",
      BEADS_PRIORITY: "priority",
      BEADS_ASSIGNEE: "assignee",
      BEADS_CWD: "cwd",
      BEADS_OLD_STATUS: "oldStatus",
      BEADS_NEW_STATUS: "newStatus",
      BEADS_CONTENT: "content",
      BEADS_SENDER: "sender",
      BEADS_AGENT_NAME: "agentName",
      BEADS_TICKET_ID: "ticketId",
      BEADS_WORKTREE_PATH: "worktreePath",
      BEADS_ERROR: "error",
    };
    for (const [envKey, ctxKey] of Object.entries(map)) {
      const v = ctx[ctxKey];
      if (v !== undefined && v !== null) env[envKey] = String(v);
    }
    return env;
  }

  async executeHooks(event: HookEventName, ctx: HookContext): Promise<void> {
    const cwd = ctx.cwd;
    if (!cwd) return;
    const cfg = this.getLoadedHooks(cwd);
    const entries = cfg[event];
    if (!entries || entries.length === 0) return;

    const ticketId = ctx.id ?? ctx.ticketId;
    const matching = entries.filter(e => this.matches(e, ticketId));
    if (matching.length === 0) return;

    const env = this.buildEnv(ctx);

    await Promise.all(matching.map(entry => this.runOne(event, entry, ctx, env)));
  }

  private async runOne(event: HookEventName, entry: HookEntry, ctx: HookContext, env: Record<string, string>): Promise<void> {
    const command = this.interpolate(entry.command, ctx);
    const timeoutMs = (entry.timeout ?? DEFAULT_TIMEOUT_SEC) * 1000;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const proc = Bun.spawn(["bash", "-c", command], {
        cwd: ctx.cwd,
        env,
        stdout: "pipe",
        stderr: "pipe",
        signal: controller.signal,
      });

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      clearTimeout(timer);

      if (stdout.trim()) log.info(`[hook:${event}] stdout:`, stdout.trim());
      if (stderr.trim()) log.warn(`[hook:${event}] stderr:`, stderr.trim());
      if (exitCode !== 0) log.warn(`[hook:${event}] exit ${exitCode}: ${command}`);
    } catch (err) {
      log.error(`[hook:${event}] failed:`, err);
    }
  }
}

export const hookExecutor = new HookExecutor();
