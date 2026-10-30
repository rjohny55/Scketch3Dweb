import { promises as fs } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DELETE, GET } from "@/app/api/shared-projects/route";
import { serverAccountFixture } from "../serverAccountFixture";

let sharedProjectsRoot = "";
let fixture: Awaited<ReturnType<typeof serverAccountFixture>>;

async function createSharedProject(fileName: string, content = "shared project") {
  await fs.writeFile(path.join(sharedProjectsRoot, fileName), content);
  const response = await GET(new Request("http://localhost/api/shared-projects?scope=mine", { headers: { Cookie: fixture.cookie } }));
  expect(response.status).toBe(200);
  const payload = await response.json() as { projects: Array<{ fileName: string; name: string; revision: string }> };
  const project = payload.projects.find((candidate) => candidate.name === fileName.replace(/\.skf$/, ""));
  if (!project) throw new Error(`Could not find ${fileName} in shared project listing`);
  return project;
}

function deleteRequest(fileName: string, revision?: string, origin = "http://localhost") {
  const headers = new Headers({ Origin: origin, Cookie: fixture.cookie });
  if (revision) headers.set("If-Match", `"${revision}"`);
  return new Request(`http://localhost/api/shared-projects?fileName=${encodeURIComponent(fileName)}`, {
    method: "DELETE",
    headers,
  });
}

describe("shared project deletion", () => {
  beforeEach(async () => {
    fixture = await serverAccountFixture();
    sharedProjectsRoot = fixture.root;
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  it("deletes a shared project when the listed revision still matches", async () => {
    const project = await createSharedProject("Delete me.skf");

    const response = await DELETE(deleteRequest(project.fileName, project.revision));

    expect(response.status).toBe(200);
    const files = await fs.readdir(path.join(sharedProjectsRoot, ".accounts", "files"));
    expect(files.some((name) => name.startsWith(project.fileName.replace(/\.skf$/, "") + "."))).toBe(false);
    await expect(fs.access(path.join(sharedProjectsRoot, "Delete me.skf"))).resolves.toBeUndefined();
    expect(await response.json()).toEqual({ deleted: true, fileName: project.fileName });
  });

  it("refuses to delete from a stale dashboard revision", async () => {
    const project = await createSharedProject("Changed model.skf");

    const response = await DELETE(deleteRequest(project.fileName, "stale-revision"));

    expect(response.status).toBe(409);
    await expect(fs.access(path.join(sharedProjectsRoot, "Changed model.skf"))).resolves.toBeUndefined();
  });

  it("requires a revision precondition before deleting", async () => {
    const project = await createSharedProject("Needs revision.skf");

    const response = await DELETE(deleteRequest(project.fileName));

    expect(response.status).toBe(409);
    await expect(fs.access(path.join(sharedProjectsRoot, "Needs revision.skf"))).resolves.toBeUndefined();
  });

  it("rejects cross-origin delete requests", async () => {
    const project = await createSharedProject("Protected model.skf");

    const response = await DELETE(deleteRequest(project.fileName, project.revision, "https://example.invalid"));

    expect(response.status).toBe(403);
    await expect(fs.access(path.join(sharedProjectsRoot, "Protected model.skf"))).resolves.toBeUndefined();
  });

  it("requires authentication before deleting projects", async () => {
    const response = await DELETE(new Request("http://localhost/api/shared-projects?fileName=example.skf", { method: "DELETE" }));
    expect(response.status).toBe(401);
  });
});
