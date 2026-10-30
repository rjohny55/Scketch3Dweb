import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { modelFile } from "../scketch3dweb-mcp-server.mjs";

test("STL paths stay inside the configured models directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "scketch3dweb-model-test-"));
  const previous = process.env.SCKETCH3DWEB_MODELS_DIR;
  process.env.SCKETCH3DWEB_MODELS_DIR = path.join(root, "models");
  try {
    const valid = await modelFile("Тест детали.stl");
    await writeFile(valid, "sample");
    assert.equal(await modelFile("Тест детали.stl", true), valid);
    for (const name of ["../secret.stl", "/tmp/secret.stl", "x/y.stl", "x\\y.stl", "part.obj", "x..stl"]) {
      await assert.rejects(() => modelFile(name));
    }
    const outside = path.join(root, "outside.stl"); await writeFile(outside, "secret");
    await symlink(outside, path.join(root, "models", "link.stl"));
    await assert.rejects(() => modelFile("link.stl", true), /outside/);
    await assert.rejects(() => modelFile("missing.stl", true));
  } finally {
    if (previous === undefined) delete process.env.SCKETCH3DWEB_MODELS_DIR;
    else process.env.SCKETCH3DWEB_MODELS_DIR = previous;
    await rm(root, { recursive: true, force: true });
  }
});
