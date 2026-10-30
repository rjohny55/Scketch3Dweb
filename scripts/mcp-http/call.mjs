#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { writeFile } from "node:fs/promises";

const [name = "tools/list", input = "{}", imageFile] = process.argv.slice(2);
const endpoint = process.env.SCKETCH3DWEB_MCP_ENDPOINT || `http://127.0.0.1:${process.env.SCKETCH3DWEB_MCP_PORT || "31881"}/mcp`;
const token = process.env.SCKETCH3DWEB_MCP_TOKEN;
if (!token) throw new Error("Use node --env-file=.env scripts/mcp-http/call.mjs ...");
const client = new Client({ name: "scketch3dweb-local-cli", version: "1.0.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const result = name === "tools/list" ? await client.listTools() : await client.callTool({ name, arguments: JSON.parse(input) }, undefined, { timeout: 120000 });
  for (const content of result.content ?? []) {
    if (content.type === "image") {
      if (imageFile) await writeFile(imageFile, Buffer.from(content.data, "base64"));
      content.data = imageFile ? `[saved to ${imageFile}]` : "[image omitted; pass output PNG filename as third argument]";
    }
  }
  console.log(JSON.stringify(result, null, 2));
  if (result.isError) process.exitCode = 1;
} finally { await client.close(); }
