// Run against an unpacked Linux build in an isolated test user/display.
// Example: xvfb-run -a node scripts/tests/desktop-packaged-smoke.mjs
import { _electron as electron } from "playwright-core";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const executablePath = path.resolve(process.argv[2] || "dist/desktop/linux-unpacked/scketch3dweb");
const base = "http://127.0.0.1:62158";
const password = randomBytes(24).toString("hex");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
// Root-only container test; distributed builds keep the Chromium sandbox enabled.
const args = process.getuid?.() === 0 ? ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [];

async function launch() {
  const app = await electron.launch({ executablePath, args, env, timeout: 60000 });
  const page = await app.firstWindow({ timeout: 60000 });
  await page.waitForLoadState("domcontentloaded");
  return { app, page };
}

let application;
try {
  let { app, page } = await launch();
  application = app;
  const version = await app.evaluate(({ app }) => app.getVersion());
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  if (version !== pkg.version) throw Error(`Version mismatch: ${version}`);
  const dataDirectory = await app.evaluate(({ app }) => app.getPath("userData"));
  const setup = await page.request.post(`${base}/api/auth`, {
    data: { action: "setup", username: "desktop-smoke", displayName: "Desktop Smoke", password },
  });
  if (!setup.ok()) throw Error(`Account setup failed: ${setup.status()}`);
  if (!fs.existsSync(path.join(dataDirectory, "projects", ".accounts", "accounts.sqlite"))) {
    throw Error("Account database was not stored in the user-data directory");
  }
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).first().click();
  await page.getByRole("button", { name: "Open settings", exact: true }).click();
  const versionRow = page.locator(".dashboard-version-row").filter({ hasText: "Scketch3Dweb version" });
  await versionRow.getByText(version, { exact: true }).waitFor();
  const link = versionRow.getByRole("link", { name: "GitHub" });
  if (await link.getAttribute("href") !== "https://github.com/rjohny55/Scketch3Dweb") throw Error("Wrong repository link");
  await page.goto(`${base}/?editor=1`);
  await page.locator("canvas").first().waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: "Face labels", exact: true }).waitFor();
  const contexts = await page.locator("canvas").first().evaluate(canvas => Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl")));
  if (!contexts) throw Error("No WebGL rendering context");
  await app.close();
  application = undefined;

  ({ app, page } = await launch());
  application = app;
  const login = await page.request.post(`${base}/api/auth`, { data: { action: "login", username: "desktop-smoke", password } });
  if (!login.ok()) throw Error(`Account did not survive restart: ${login.status()}`);
  console.log(JSON.stringify({ version, accountSetup: "ok", userDataStorage: "ok", githubLink: "ok", editor: "ok", webgl: "ok", restartAndLogin: "ok" }));
} finally {
  await application?.close();
}
