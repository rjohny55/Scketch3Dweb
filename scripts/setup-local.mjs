import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "data/models"), { recursive: true });
await mkdir(path.join(root, "data/projects"), { recursive: true });
try {
  await writeFile(path.join(root, ".env"), `SCKETCH3DWEB_MCP_TOKEN=${randomBytes(32).toString("hex")}\nSCKETCH3DWEB_WEB_PORT=31880\nSCKETCH3DWEB_MCP_PORT=31881\n`, { flag: "wx", mode: 0o600 });
  console.log("Created .env with a private MCP token. Token was not printed.");
} catch (error) { if (error.code !== "EEXIST") throw error; console.log("Existing .env preserved."); }
console.log("Start: docker compose up --build -d\nEditor: http://127.0.0.1:31880/?editor=1\nMCP: http://127.0.0.1:31881/mcp");
