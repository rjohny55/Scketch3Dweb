import { readFile } from "node:fs/promises";

export const dynamic = "force-dynamic";
export async function GET() {
  const archive = process.env.SCKETCH3DWEB_SOURCE_ARCHIVE;
  if (!archive) return new Response("Source archive is available in the Docker MCP build.", { status: 404 });
  try {
    const bytes = await readFile(archive);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": 'attachment; filename="scketch3dweb-mcp-source.tar.gz"',
      "Cache-Control": "no-cache",
    } });
  } catch { return new Response("Source archive unavailable.", { status: 503 }); }
}
