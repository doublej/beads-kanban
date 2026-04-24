import type { Server, ServerWebSocket } from "bun";
import { createWorktree, listWorktrees, removeWorktree } from "./worktree";
import type { AgentQueue } from "./queue-manager";

export type WSData = { sessionId?: string };

export type HttpConfig = {
  port: number;
  beadsMcpEnabled: boolean;
  getSessionsCount: () => number;
  listSdkSessions: (cwd: string) => unknown[];
  getSessionHistory: (cwd: string, sessionId: string) => unknown[];
  handleUpgrade: (req: Request, server: Server) => boolean;
  queue: AgentQueue;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

export function createHttpHandler(config: HttpConfig) {
  return async function fetch(req: Request, server: Server): Promise<Response | undefined> {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        activeSessions: config.getSessionsCount(),
        beadsMcpEnabled: config.beadsMcpEnabled,
      }), { headers: { "Content-Type": "application/json" } });
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/sessions") {
      const cwd = url.searchParams.get("cwd");
      if (!cwd) {
        return new Response(JSON.stringify({ error: "cwd required" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      try {
        const sessions = config.listSdkSessions(cwd);
        return new Response(JSON.stringify({ sessions }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // Session history endpoint: /sessions/:id/history?cwd=...
    const historyMatch = url.pathname.match(/^\/sessions\/([^/]+)\/history$/);
    if (historyMatch) {
      const sessionId = historyMatch[1];
      const cwd = url.searchParams.get("cwd");
      if (!cwd) {
        return new Response(JSON.stringify({ error: "cwd required" }), {
          status: 400, headers: corsHeaders,
        });
      }
      try {
        const messages = config.getSessionHistory(cwd, sessionId);
        return new Response(JSON.stringify({ messages }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500, headers: corsHeaders,
        });
      }
    }

    if (url.pathname === "/queue" && req.method === "GET") {
      const cwd = url.searchParams.get("cwd");
      const items = cwd ? config.queue.getItemsForCwd(cwd) : [];
      return new Response(JSON.stringify({ items }), {
        headers: corsHeaders,
      });
    }

    // --- Worktree endpoints ---
    if (url.pathname === "/worktrees") {
      if (req.method === "POST") {
        return await handleWorktreeCreate(req);
      }
      if (req.method === "GET") {
        return await handleWorktreeList(url);
      }
      if (req.method === "DELETE") {
        return await handleWorktreeRemove(req);
      }
    }

    if (config.handleUpgrade(req, server)) {
      return undefined;
    }
    return new Response("WebSocket only", { status: 426 });
  };
}

async function handleWorktreeCreate(req: Request): Promise<Response> {
  const body = await req.json() as { repoPath?: string; ticketId?: string };
  if (!body.repoPath || !body.ticketId) {
    return new Response(JSON.stringify({ error: "repoPath and ticketId required" }), {
      status: 400, headers: corsHeaders,
    });
  }
  try {
    const path = await createWorktree(body.repoPath, body.ticketId);
    return new Response(JSON.stringify({ path }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: corsHeaders,
    });
  }
}

async function handleWorktreeList(url: URL): Promise<Response> {
  const repoPath = url.searchParams.get("repoPath");
  if (!repoPath) {
    return new Response(JSON.stringify({ error: "repoPath required" }), {
      status: 400, headers: corsHeaders,
    });
  }
  try {
    const worktrees = await listWorktrees(repoPath);
    return new Response(JSON.stringify({ worktrees }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: corsHeaders,
    });
  }
}

async function handleWorktreeRemove(req: Request): Promise<Response> {
  const body = await req.json() as { repoPath?: string; ticketId?: string };
  if (!body.repoPath || !body.ticketId) {
    return new Response(JSON.stringify({ error: "repoPath and ticketId required" }), {
      status: 400, headers: corsHeaders,
    });
  }
  try {
    await removeWorktree(body.repoPath, body.ticketId);
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: corsHeaders,
    });
  }
}
