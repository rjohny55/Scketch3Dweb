// Use the packaged Electron executable with ELECTRON_RUN_AS_NODE=1.
// Arguments: resource directory, report path. Does not print account credentials.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");

(async () => {
  const resources = process.argv[2] === "--resources-from-executable"
    ? path.join(path.dirname(process.execPath), "resources")
    : path.resolve(process.argv[2]);
  const report = path.resolve(process.argv[3]);
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "scketch-desktop-server-"));
  const log = fs.openSync(path.join(data, "server.log"), "a");
  const password = randomBytes(24).toString("hex");
  const port = process.platform === "win32" ? "62160" : "62159";
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(resources, "web", "apps", "web", "server.js")], {
    cwd: path.join(resources, "web", "apps", "web"),
    windowsHide: true,
    stdio: ["ignore", log, log],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_PATH: path.join(resources, "app.asar", "node_modules"),
      HOSTNAME: "127.0.0.1",
      PORT: port,
      SCKETCH3DWEB_SHARED_PROJECTS_DIR: path.join(data, "projects"),
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  let spawnError;
  child.on("error", error => { spawnError = error; });
  try {
    let ready = false;
    let lastConnectionError;
    for (let i = 0; i < 150; i++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw Error(`Packaged server exited: ${child.exitCode}`);
      try { ready = (await fetch(`${base}/api/health`)).ok; } catch (error) { lastConnectionError = error.cause?.message || error.message; }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!ready) throw Error(`Packaged server startup timed out: ${lastConnectionError || "health not ready"}`);
    const setup = await fetch(`${base}/api/auth`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setup", username: "smoke-user", displayName: "Smoke User", password }),
    });
    if (!setup.ok) throw Error(`Account setup: HTTP ${setup.status}`);
    const login = await fetch(`${base}/api/auth`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", username: "smoke-user", password }),
    });
    if (!login.ok) throw Error(`Account login: HTTP ${login.status}`);
    if (!fs.existsSync(path.join(data, "projects", ".accounts", "accounts.sqlite"))) throw Error("Database missing");
    const home = await fetch(base);
    if (!home.ok) throw Error(`Home page: HTTP ${home.status}`);
    fs.writeFileSync(report, JSON.stringify({ platform: process.platform, arch: process.arch, electron: process.versions.electron, health: "ok", accountSetup: "ok", accountLogin: "ok", database: "ok", home: "ok" }, null, 2));
  } catch (error) {
    fs.writeFileSync(report, JSON.stringify({ platform: process.platform, error: error.message, log: fs.readFileSync(path.join(data, "server.log"), "utf8").slice(-6000) }, null, 2));
    process.exitCode = 1;
  } finally {
    child.kill();
    fs.closeSync(log);
  }
})().catch(() => { process.exitCode = 1; });
