import { spawn } from "node:child_process";

if ((process.env.SCKETCH3DWEB_MCP_TOKEN ?? "").length < 32) throw new Error("Missing MCP token: run npm run setup:local before Docker Compose");
const children = [
  spawn(process.execPath, ["apps/web/server.js"], { stdio: "inherit", env: process.env }),
  spawn(process.execPath, ["scripts/mcp-http/server.mjs"], { stdio: "inherit", env: process.env }),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  Promise.all(children.map((child) => child.exitCode !== null || child.signalCode !== null ? Promise.resolve() : new Promise((r) => child.once("exit", r)))).then(() => process.exit(code));
  setTimeout(() => { for (const child of children) child.kill("SIGKILL"); process.exit(code); }, 8000).unref();
}
for (const child of children) {
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => { if (!stopping) stop(code || 1); });
}
process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));
