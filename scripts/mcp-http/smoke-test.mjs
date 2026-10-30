#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { chromium } from "playwright-core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const output = path.join(root, "verification");
await mkdir(output, { recursive: true });
const baseUrl = process.env.SCKETCH3DWEB_URL || "http://127.0.0.1:31880";
const endpoint = `http://127.0.0.1:${process.env.SCKETCH3DWEB_MCP_PORT || "31881"}/mcp`;
const token = process.env.SCKETCH3DWEB_MCP_TOKEN;
const browser = await chromium.connectOverCDP(process.env.SCKETCH3DWEB_BROWSER_CDP || "http://127.0.0.1:9238");
const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, acceptDownloads: true });
const page = await context.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message));
const client = new Client({ name: "scketch3dweb-browser-smoke", version: "1.0.0" });
const report = { checks: [], consoleErrors };
async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 });
  assert.ok(!result.isError, JSON.stringify(result));
  return result.content?.[0]?.type === "text" ? JSON.parse(result.content[0].text) : result;
}
try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("html[lang=ru]").waitFor();
  assert.ok(await page.getByText("Проекты", { exact: true }).count());
  await page.screenshot({ path: path.join(output, "dashboard-ru.png") });
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.locator("html[lang=en]").waitFor();
  assert.ok(await page.getByText("Projects", { exact: true }).count());
  await page.getByRole("button", { name: "RU", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("html[lang=ru]").waitFor();
  report.checks.push("Russian default; RU/EN switch; persisted after reload");
  await page.goto(`${baseUrl}/?editor=1`, { waitUntil: "domcontentloaded" });
  await page.locator("canvas").first().waitFor({ timeout: 120000 });
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const tools = await client.listTools();
  assert.ok(tools.tools.some((t) => t.name === "scketch3dweb_export_stl"));
  let editors;
  for (let attempt = 0; attempt < 30; attempt++) {
    editors = await call("scketch3dweb_list_editors");
    if (editors.editors.length) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(editors.editors.length, 1);
  const editorNumber = editors.editors[0].editorNumber;
  const scene = await call("scketch3dweb_read_scene", { editorNumber });
  assert.equal(scene.shapeCount, 0);
  const created = await call("scketch3dweb_create_shape", { editorNumber, kind: "box", name: "Пластина MCP", width: 30, depth: 20, height: 5, x: 0, z: 0, elevation: 0 });
  const id = created.object.id;
  const updated = await call("scketch3dweb_update_object", { editorNumber, id, width: 40 });
  assert.equal(updated.object.dimensions.width, 40);
  report.checks.push("Production editor discovered over authenticated MCP; create and resize");
  const cut = await call("scketch3dweb_create_shape", { editorNumber, kind: "cylinder", name: "Отверстие", width: 6, depth: 6, height: 9, x: 0, z: 0, elevation: -2, sides: 48 });
  const grouped = await call("scketch3dweb_boolean_cut", { editorNumber, solidIds: [id], holeIds: [cut.object.id], timeoutMs: 90000 });
  assert.ok(grouped.object.id);
  const meshReport = await call("scketch3dweb_analyze_printability", { editorNumber, ids: [grouped.object.id] });
  assert.ok(meshReport.basicChecksPass, JSON.stringify(meshReport));
  assert.deepEqual(meshReport.bounds.size.map((v) => Math.round(v*1000)/1000), [40,20,5]);
  // Upstream's mesh boolean expands cutters by CUTTER_PADDING=0.05 mm per side.
  // Validate the actual 48-sided padded cylinder, rather than hiding that size difference.
  const radius = 3 + 0.05;
  const expectedVolume = 40*20*5 - 48/2 * radius*radius * Math.sin(2*Math.PI/48) * 5;
  assert.ok(Math.abs(meshReport.signedVolumeMm3 - expectedVolume) < 0.01, JSON.stringify(meshReport));
  report.booleanCutterPaddingMm = 0.05;
  report.checks.push("Boolean hole; closed mesh; Z-up bounds and volume match the documented upstream 0.05 mm cutter padding");
  const exported = await call("scketch3dweb_export_stl", { editorNumber, ids: [grouped.object.id], filename: "smoke-plate.stl", overwrite: true });
  assert.equal(exported.filename, "smoke-plate.stl");
  const bytes = await readFile(path.join(root, "data/models/smoke-plate.stl"));
  assert.equal(bytes.length, 84 + bytes.readUInt32LE(80)*50);
  const reimported = await call("scketch3dweb_import_stl_file", { editorNumber, filename: "smoke-plate.stl", x: 60, z: 0 });
  assert.deepEqual([reimported.object.dimensions.width, reimported.object.dimensions.depth, reimported.object.dimensions.height].map((v)=>Math.round(v)), [40,20,5]);
  assert.ok(reimported.report.basicChecksPass);
  report.checks.push("Binary STL exported to persistent directory and re-imported with preserved dimensions");
  await call("scketch3dweb_update_object", { editorNumber, id: reimported.object.id, width: 45, height: 6 });
  const beforeSecondCut = await call("scketch3dweb_analyze_printability", { editorNumber, ids: [reimported.object.id] });
  const secondCutter = await call("scketch3dweb_create_shape", { editorNumber, kind: "cylinder", name: "Второе отверстие STL", width: 4, depth: 4, height: 10, x: 70, z: 0, elevation: -2, sides: 48 });
  const editedStl = await call("scketch3dweb_boolean_cut", { editorNumber, solidIds: [reimported.object.id], holeIds: [secondCutter.object.id], timeoutMs: 90000 });
  const secondExport = await call("scketch3dweb_export_stl", { editorNumber, ids: [editedStl.object.id], filename: "smoke-edited.stl", overwrite: true });
  assert.ok(secondExport.report.basicChecksPass, JSON.stringify(secondExport.report));
  assert.deepEqual(secondExport.report.bounds.size.map((v) => Math.round(v*1000)/1000), [45,20,6]);
  const removedVolume = beforeSecondCut.signedVolumeMm3 - secondExport.report.signedVolumeMm3;
  assert.ok(removedVolume > 70 && removedVolume < 90, `Removed volume ${removedVolume}`);
  report.editedImportedStl = secondExport;
  report.checks.push("Imported STL resized to 45x20x6 mm, cut again, and exported as a closed mesh");
  const denied = await client.callTool({ name: "scketch3dweb_import_stl_file", arguments: { filename: "../secret.stl" } });
  assert.ok(denied.isError);
  assert.equal((await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
  assert.equal((await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/scketch3dweb-mcp`)).status, 401);
  report.checks.push("Missing token, cross-origin requests and path traversal rejected");
  const imageResult = await client.callTool({ name: "scketch3dweb_capture_image", arguments: { editorNumber, face: "home" } }, undefined, { timeout: 60000 });
  assert.ok(!imageResult.isError, JSON.stringify(imageResult).slice(0,1000));
  const image = imageResult.content.find((c) => c.type === "image");
  assert.ok(image); await writeFile(path.join(output, "mcp-viewport.png"), Buffer.from(image.data, "base64"));
  await page.screenshot({ path: path.join(output, "editor-ru.png") });
  await writeFile(path.join(output, "visible-editor-text.txt"), await page.locator("body").innerText());
  assert.equal(consoleErrors.length, 0, consoleErrors.join("\n"));
  report.checks.push("Viewport captured through MCP; Russian editor screenshot; no browser page errors");
  report.status = "PASS";
  report.mesh = meshReport; report.stl = exported; report.toolCount = tools.tools.length;
} catch (error) { report.status = "FAIL"; report.error = error.stack; throw error; }
finally {
  await writeFile(path.join(output, "browser-mcp-report.json"), JSON.stringify(report, null, 2));
  await client.close(); await context.close(); await browser.close();
}
console.log(JSON.stringify(report, null, 2));
