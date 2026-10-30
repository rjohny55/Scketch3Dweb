import { afterEach, describe, expect, it, vi } from "vitest";
import { mcpAccessError } from "@/lib/scketch3dwebMcpAccess";

afterEach(() => vi.unstubAllEnvs());
const token = "test-token-".repeat(5);
function req(headers = {}, host = "127.0.0.1:31880") { return new Request(`http://${host}/api/scketch3dweb-mcp`, { headers }); }
describe("production MCP access", () => {
  it("stays disabled by default", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("SCKETCH3DWEB_MCP_ENABLED", "");
    expect(mcpAccessError(req(), true)?.status).toBe(404);
  });
  it("requires both opt-in and a long token", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("SCKETCH3DWEB_MCP_ENABLED", "true"); vi.stubEnv("SCKETCH3DWEB_MCP_TOKEN", "short");
    expect(mcpAccessError(req(), true)?.status).toBe(404);
  });
  it("accepts authenticated controllers and local browser polling, rejects cross-origin and remote host", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("SCKETCH3DWEB_MCP_ENABLED", "true"); vi.stubEnv("SCKETCH3DWEB_MCP_TOKEN", token);
    expect(mcpAccessError(req(), true)?.status).toBe(401);
    expect(mcpAccessError(req({ authorization: `Bearer ${token}` }), true)).toBeNull();
    expect(mcpAccessError(req({ origin: "http://127.0.0.1:31880", "sec-fetch-site": "same-origin" }))).toBeNull();
    expect(mcpAccessError(new Request("http://0.0.0.0:3000/api/scketch3dweb-mcp", { headers: { host: "127.0.0.1:31880", origin: "http://127.0.0.1:31880", "sec-fetch-site": "same-origin" } }))).toBeNull();
    expect(mcpAccessError(req({ origin: "https://evil.example" }))?.status).toBe(403);
    expect(mcpAccessError(req({ "sec-fetch-site": "cross-site" }))?.status).toBe(403);
    expect(mcpAccessError(req({}, "evil.example"))?.status).toBe(403);
  });
});
