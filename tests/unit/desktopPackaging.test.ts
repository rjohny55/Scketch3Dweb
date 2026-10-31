import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("desktop release configuration", () => {
  it("keeps package and lockfile versions in sync", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages[""].version).toBe(pkg.version);
    const format = readFileSync("apps/web/src/lib/skfProject.ts", "utf8");
    expect(format).toContain(`SKF_CREATED_WITH_VERSION = "${pkg.version}"`);
  });

  it("stores writable data in the user profile, not installed resources", () => {
    const main = readFileSync("apps/desktop/main.cjs", "utf8");
    expect(main).toContain('SCKETCH3DWEB_SHARED_PROJECTS_DIR: path.join(app.getPath("userData"), "projects")');
    expect(main).toContain('SCKETCH3DWEB_MODELS_DIR: path.join(app.getPath("userData"), "models")');
    expect(main).toContain('HOSTNAME: "127.0.0.1"');
    expect(main).toContain('contextIsolation: true');
    expect(main).toContain('nodeIntegration: false');
  });

  it("uses the configured webpack build and the project's release channel", () => {
    const build = readFileSync("apps/desktop/build-web.mjs", "utf8");
    expect(build).toContain('"apps/web", "--webpack"');
    const config = readFileSync("apps/desktop/electron-builder.yml", "utf8");
    expect(config).toContain('repo: Scketch3Dweb');
    expect(config).toContain('owner: rjohny55');
    expect(config).toContain('provider: github');
  });

  it("links the version section to the project's public repository", () => {
    const page = readFileSync("apps/web/src/app/page.tsx", "utf8");
    expect(page).toContain('href="https://github.com/rjohny55/Scketch3Dweb" target="_blank" rel="noopener noreferrer"');
  });
});
