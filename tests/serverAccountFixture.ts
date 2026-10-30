import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { POST } from "@/app/api/auth/route";

const database = globalThis as typeof globalThis & { __scketchAccountsDb?: DatabaseSync };

export async function serverAccountFixture() {
  const previous = process.env.SCKETCH3DWEB_SHARED_PROJECTS_DIR;
  database.__scketchAccountsDb?.close();
  delete database.__scketchAccountsDb;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "scketch3dweb-api-test-"));
  process.env.SCKETCH3DWEB_SHARED_PROJECTS_DIR = root;
  const response = await POST(new Request("http://localhost/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify({ action: "setup", username: "test-admin", displayName: "Test Admin", password: "synthetic-test-password" }),
  }));
  if (response.status !== 200) throw new Error("Could not bootstrap isolated test account");
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Test account did not receive a session cookie");
  return {
    root,
    cookie,
    async cleanup() {
      database.__scketchAccountsDb?.close();
      delete database.__scketchAccountsDb;
      if (previous === undefined) delete process.env.SCKETCH3DWEB_SHARED_PROJECTS_DIR;
      else process.env.SCKETCH3DWEB_SHARED_PROJECTS_DIR = previous;
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}
