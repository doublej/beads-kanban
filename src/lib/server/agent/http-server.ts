import type { Server, ServerWebSocket } from "bun";

export type WSData = { sessionId?: string };

export type HttpConfig = {
  port: number;
  beadsMcpEnabled: boolean;
  getSessionsCount: () => number;
  listSdkSessions: (cwd: string) => unknown[];
  handleUpgrade: (req: Request, server: Server) => boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

export function createHttpHandler(config: HttpConfig) {
  return function fetch(req: Request, server: Server): Response | undefined {
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

    if (config.handleUpgrade(req, server)) {
      return undefined;
    }
    return new Response("WebSocket only", { status: 426 });
  };
}
