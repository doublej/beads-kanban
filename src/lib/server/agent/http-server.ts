import type { Server, ServerWebSocket } from "bun";
import { createWorktree, listWorktrees, removeWorktree } from "./worktree";
import type { AgentQueue } from "./queue-manager";
import type { AgentSession } from "./session-types";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

export type WSData = { sessionId?: string };

export type HttpConfig = {
  port: number;
  beadsMcpEnabled: boolean;
  getSessionsCount: () => number;
  listSdkSessions: (cwd: string) => unknown[];
  getSessionHistory: (cwd: string, sessionId: string) => unknown[];
  handleUpgrade: (req: Request, server: Server) => boolean;
  queue: AgentQueue;
  sessions: Map<string, AgentSession>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

function requireCwd(url: URL): string | Response {
  const cwd = url.searchParams.get("cwd");
  if (!cwd) return errorResponse("cwd required", 400);
  return cwd;
}

export function createHttpHandler(config: HttpConfig) {
  return async function fetch(req: Request, server: Server): Promise<Response | undefined> {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return jsonResponse({
        status: "ok",
        activeSessions: config.getSessionsCount(),
        beadsMcpEnabled: config.beadsMcpEnabled,
      });
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/sessions") {
      const cwd = requireCwd(url);
      if (cwd instanceof Response) return cwd;
      try {
        return jsonResponse({ sessions: config.listSdkSessions(cwd) });
      } catch (err) {
        return errorResponse(String(err), 500);
      }
    }

    const historyMatch = url.pathname.match(/^\/sessions\/([^/]+)\/history$/);
    if (historyMatch) {
      const cwd = requireCwd(url);
      if (cwd instanceof Response) return cwd;
      try {
        return jsonResponse({ messages: config.getSessionHistory(cwd, historyMatch[1]) });
      } catch (err) {
        return errorResponse(String(err), 500);
      }
    }

    if (url.pathname === "/queue" && req.method === "GET") {
      const cwd = url.searchParams.get("cwd");
      const items = cwd ? config.queue.getItemsForCwd(cwd) : [];
      return jsonResponse({ items });
    }

    if (url.pathname === "/agents") {
      if (req.method === "POST") return handleAgentEnqueue(req, config);
      if (req.method === "GET") return handleAgentList(url, config);
    }
    const agentMatch = url.pathname.match(/^\/agents\/([^/]+)$/);
    if (agentMatch) {
      const sessionId = agentMatch[1];
      if (req.method === "GET") return handleAgentGet(sessionId, config);
      if (req.method === "DELETE") return handleAgentInterrupt(sessionId, config);
    }
    const messageMatch = url.pathname.match(/^\/agents\/([^/]+)\/message$/);
    if (messageMatch && req.method === "POST") {
      return handleAgentMessage(messageMatch[1], req, config);
    }

    if (url.pathname === "/worktrees") {
      if (req.method === "POST") return handleWorktreeCreate(req);
      if (req.method === "GET") return handleWorktreeList(url);
      if (req.method === "DELETE") return handleWorktreeRemove(req);
    }

    if (config.handleUpgrade(req, server)) return undefined;
    return new Response("WebSocket only", { status: 426 });
  };
}

async function handleWorktreeCreate(req: Request): Promise<Response> {
  const body = await req.json() as { repoPath?: string; ticketId?: string };
  if (!body.repoPath || !body.ticketId) return errorResponse("repoPath and ticketId required", 400);
  try {
    return jsonResponse({ path: await createWorktree(body.repoPath, body.ticketId) });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

async function handleWorktreeList(url: URL): Promise<Response> {
  const repoPath = url.searchParams.get("repoPath");
  if (!repoPath) return errorResponse("repoPath required", 400);
  try {
    return jsonResponse({ worktrees: await listWorktrees(repoPath) });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

async function handleWorktreeRemove(req: Request): Promise<Response> {
  const body = await req.json() as { repoPath?: string; ticketId?: string };
  if (!body.repoPath || !body.ticketId) return errorResponse("repoPath and ticketId required", 400);
  try {
    await removeWorktree(body.repoPath, body.ticketId);
    return jsonResponse({ ok: true });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
}

type EnqueueBody = {
  ticketId?: string;
  agentName?: string;
  cwd?: string;
  title?: string;
  description?: string;
  priority?: number;
  issueType?: string;
  model?: string;
  useWorktree?: boolean;
};

async function handleAgentEnqueue(req: Request, config: HttpConfig): Promise<Response> {
  const body = (await req.json()) as EnqueueBody;
  if (!body.ticketId || !body.cwd) return errorResponse("ticketId and cwd required", 400);

  const item = {
    ticketId: body.ticketId,
    agentName: body.agentName ?? `${body.ticketId}-agent`,
    cwd: body.cwd,
    title: body.title ?? body.ticketId,
    description: body.description ?? "",
    priority: body.priority ?? 2,
    issueType: body.issueType ?? "task",
    model: body.model,
    useWorktree: body.useWorktree ?? false,
    enqueuedAt: new Date().toISOString(),
  };
  config.queue.enqueue(item);
  return jsonResponse({ queued: true, ticketId: item.ticketId, enqueuedAt: item.enqueuedAt });
}

function handleAgentList(url: URL, config: HttpConfig): Response {
  const cwd = requireCwd(url);
  if (cwd instanceof Response) return cwd;
  return jsonResponse({
    active: config.queue.getActiveSessions().filter((s) => s.projectCwd === cwd),
    queued: config.queue.getItemsForCwd(cwd),
  });
}

function handleAgentGet(sessionId: string, config: HttpConfig): Response {
  const session = config.sessions.get(sessionId);
  if (!session) return errorResponse("session not found", 404);
  return jsonResponse({
    sessionId: session.id,
    agentName: session.agentName,
    cwd: session.cwd,
    projectCwd: session.projectCwd ?? session.cwd,
    ticketId: session.ticketId,
    worktreePath: session.worktreePath,
    isRunning: session.isRunning,
    isManager: !!session.isManager,
    model: session.model,
    sdkSessionId: session.sdkSessionId,
    usage: session.usage,
  });
}

function handleAgentInterrupt(sessionId: string, config: HttpConfig): Response {
  const session = config.sessions.get(sessionId);
  if (!session) return errorResponse("session not found", 404);
  session.abortController.abort();
  return jsonResponse({ interrupted: true, sessionId });
}

async function handleAgentMessage(sessionId: string, req: Request, config: HttpConfig): Promise<Response> {
  const session = config.sessions.get(sessionId);
  if (!session) return errorResponse("session not found", 404);

  const body = (await req.json()) as { text?: string };
  if (!body.text) return errorResponse("text required", 400);

  const userMsg: SDKUserMessage = {
    type: "user",
    session_id: session.id,
    parent_tool_use_id: null,
    message: { role: "user", content: body.text },
  };
  if (session.inputResolver) session.inputResolver(userMsg);
  else session.inputQueue.push(userMsg);
  return jsonResponse({ delivered: true });
}
