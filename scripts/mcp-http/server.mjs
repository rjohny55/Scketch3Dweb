#!/usr/bin/env node
import http from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Ajv from "ajv";
import { tools, callTool, toolResult, authenticateMcpAccount, withMcpAccount } from "../scketch3dweb-mcp-server.mjs";

const token = process.env.SCKETCH3DWEB_MCP_TOKEN ?? "";
if (token.length < 32) throw new Error("Set SCKETCH3DWEB_MCP_TOKEN to at least 32 characters (run npm run setup:local)");
const ajv = new Ajv({ strict: false });
const validators = new Map(tools.map((t) => [t.name, ajv.compile(t.inputSchema)]));
const host = process.env.SCKETCH3DWEB_MCP_HOST || "127.0.0.1";
const port = Number(process.env.SCKETCH3DWEB_MCP_PORT || 3001);
const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function reply(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

const listener = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "invalid"}`);
    if (!allowedHosts.has(url.hostname) || req.headers.origin) return reply(res, 403, { error: "Use a localhost MCP client without a browser Origin header" });
    if (url.pathname === "/health" && req.method === "GET") return reply(res, 200, { ok: true, transport: "streamable-http" });
    if (url.pathname !== "/mcp") return reply(res, 404, { error: "Not found" });
    let account;
    try { account = await authenticateMcpAccount(req.headers.authorization); }
    catch { return reply(res, 401, { error: "A valid personal MCP key is required" }); }
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return reply(res, 405, { error: "Stateless MCP uses POST" }); }
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) return reply(res, 413, { error: "Request limit is 2 MiB; import STL by filename" });
      chunks.push(chunk);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return reply(res, 400, { error: "Invalid JSON" }); }
    const server = new Server({ name: "scketch3dweb-local", version: "1.0.0" }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
    server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
      try {
        const validate = validators.get(params.name);
        if (!validate) throw new Error(`Unknown tool: ${params.name}`);
        const args = params.arguments ?? {};
        if (!validate(args)) throw new Error(ajv.errorsText(validate.errors));
        return toolResult(await withMcpAccount(account, () => callTool(params.name, args)));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: error.message || String(error) }] };
      }
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    if (!res.headersSent) reply(res, 500, { error: error.message || "MCP request failed" });
  }
});
listener.requestTimeout = 120000;
listener.listen(port, host, () => console.error(`Scketch3Dweb MCP ready on port ${port}, path /mcp`));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => {
  listener.close(); listener.closeAllConnections();
  setTimeout(() => process.exit(0), 250).unref();
});
