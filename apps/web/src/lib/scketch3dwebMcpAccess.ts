import { timingSafeEqual } from "node:crypto";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

// Production automation is explicit, loopback-only, and controller-authenticated.
// Browser heartbeat/poll/result calls still require the same local origin.
export function mcpAccessError(request: Request, controller = false): { status: number; error: string } | null {
  const production = process.env.NODE_ENV === "production";
  const token = process.env.SCKETCH3DWEB_MCP_TOKEN ?? "";
  if (production && (process.env.SCKETCH3DWEB_MCP_ENABLED !== "true" || token.length < 32)) {
    return { status: 404, error: "Scketch3Dweb MCP is disabled." };
  }
  const internalUrl = new URL(request.url);
  // Next's standalone server can expose its internal hostname/port in request.url.
  // The browser's origin must match the validated external Host, including Docker's mapped port.
  let url: URL;
  try { url = new URL(`${internalUrl.protocol}//${request.headers.get("host") ?? internalUrl.host}`); }
  catch { return { status: 403, error: "Invalid MCP host." }; }
  if (!LOCAL_HOSTS.has(url.hostname)) return { status: 403, error: "Scketch3Dweb MCP requires localhost." };
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return { status: 403, error: "Cross-origin MCP requests are forbidden." };
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) {
    return { status: 403, error: "Cross-site MCP requests are forbidden." };
  }
  if (controller && (production || token)) {
    const actual = Buffer.from(request.headers.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${token}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return { status: 401, error: "A valid MCP bearer token is required." };
    }
  }
  return null;
}
