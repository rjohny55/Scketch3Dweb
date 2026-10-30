import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/project-thumbnail/route";
import { serverAccountFixture } from "../serverAccountFixture";

let fixture: Awaited<ReturnType<typeof serverAccountFixture>>;

function missingThumbnailRequest(url: string, headers?: HeadersInit) {
  return new Request(`${url}/api/project-thumbnail?projectId=missing-thumbnail`, { headers: { Cookie: fixture.cookie, ...headers } });
}

describe("project thumbnail request origins", () => {
  beforeEach(async () => { fixture = await serverAccountFixture(); });
  afterEach(async () => { await fixture.cleanup(); });
  it("allows same-origin requests on a public HTTPS host", async () => {
    const response = await GET(missingThumbnailRequest("https://projects.example.test", {
      Origin: "https://projects.example.test",
      "Sec-Fetch-Site": "same-origin",
    }));

    expect(response.status).toBe(404);
  });

  it("accepts a preserved public Host and forwarded HTTPS protocol", async () => {
    const response = await GET(missingThumbnailRequest("http://localhost:3000", {
      Origin: "https://projects.example.test",
      "Sec-Fetch-Site": "same-origin",
      "X-Forwarded-Host": "projects.example.test",
      "X-Forwarded-Proto": "https",
      Host: "projects.example.test",
    }));

    expect(response.status).toBe(404);
  });

  it("rejects a different origin", async () => {
    const response = await GET(missingThumbnailRequest("https://projects.example.test", {
      Origin: "https://other.example.test",
      "Sec-Fetch-Site": "cross-site",
    }));

    expect(response.status).toBe(403);
  });

  it("allows same-origin uploads to proceed to request validation", async () => {
    const response = await POST(new Request("https://projects.example.test/api/project-thumbnail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: fixture.cookie,
        Origin: "https://projects.example.test",
        "Sec-Fetch-Site": "same-origin",
      },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid thumbnail request" });
  });

  it("requires authentication to read a thumbnail", async () => {
    expect((await GET(new Request("http://localhost/api/project-thumbnail?projectId=example"))).status).toBe(401);
  });

  it("does not trust a forwarded host alone to override the actual Host", async () => {
    const response = await GET(missingThumbnailRequest("http://localhost:3000", {
      Origin: "https://projects.example.test", "X-Forwarded-Host": "projects.example.test", "X-Forwarded-Proto": "https",
    }));
    expect(response.status).toBe(403);
  });
});
