import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeScketch3DwebMcpCommand,
  dispatchScketch3DwebMcpCommand,
  pollScketch3DwebMcpCommand,
  registerScketch3DwebMcpEditor,
  waitForScketch3DwebMcpCommand,
} from "@/lib/scketch3dwebMcpStore";

const editor = {
  editorId: "editor-test",
  editorNumber: 12345,
  projectId: "project-test",
  projectName: "MCP test",
  url: "http://localhost:3000/?editor=1",
  focused: true,
  shapeCount: 0,
  selectedCount: 0,
  notice: "",
  lastError: null,
};

beforeEach(() => {
  delete (globalThis as { __scketch3dwebMcpStore?: unknown }).__scketch3dwebMcpStore;
  registerScketch3DwebMcpEditor(editor);
});

describe("Scketch3Dweb MCP long polling", () => {
  it("delivers a command directly to a waiting editor", async () => {
    const poll = waitForScketch3DwebMcpCommand(editor.editorId, { timeoutMs: 5_000 });
    const result = dispatchScketch3DwebMcpCommand({ editorId: editor.editorId, action: "list_objects" });

    const command = await poll;
    expect(command).toMatchObject({ action: "list_objects", params: {} });
    expect(pollScketch3DwebMcpCommand(editor.editorId)).toBeNull();

    completeScketch3DwebMcpCommand(editor.editorId, { commandId: command!.id, ok: true, data: [] });
    await expect(result).resolves.toMatchObject({ commandId: command!.id, ok: true, data: [] });
  });

  it("allows only one pending poll per editor", async () => {
    const firstPoll = waitForScketch3DwebMcpCommand(editor.editorId, { timeoutMs: 5_000 });
    const secondPoll = waitForScketch3DwebMcpCommand(editor.editorId, { timeoutMs: 5_000 });

    await expect(firstPoll).resolves.toBeNull();
    const result = dispatchScketch3DwebMcpCommand({ editorId: editor.editorId, action: "inspect_errors" });
    const command = await secondPoll;
    expect(command?.action).toBe("inspect_errors");

    completeScketch3DwebMcpCommand(editor.editorId, { commandId: command!.id, ok: true });
    await expect(result).resolves.toMatchObject({ commandId: command!.id, ok: true });
  });

  it("removes an aborted poll before queueing the next command", async () => {
    const controller = new AbortController();
    const poll = waitForScketch3DwebMcpCommand(editor.editorId, { timeoutMs: 5_000, signal: controller.signal });
    controller.abort();
    await expect(poll).resolves.toBeNull();

    const result = dispatchScketch3DwebMcpCommand({ editorId: editor.editorId, action: "get_scene" });
    const command = pollScketch3DwebMcpCommand(editor.editorId);
    expect(command?.action).toBe("get_scene");

    completeScketch3DwebMcpCommand(editor.editorId, { commandId: command!.id, ok: true });
    await expect(result).resolves.toMatchObject({ commandId: command!.id, ok: true });
  });
});


afterEach(()=>{vi.useRealTimers();});
it("removes expired mutations from the queue without affecting the next command",async()=>{
 vi.useFakeTimers();
 const expired=dispatchScketch3DwebMcpCommand({editorId:editor.editorId,action:"update_object",timeoutMs:1000});
 await vi.advanceTimersByTimeAsync(1001);
 await expect(expired).resolves.toMatchObject({ok:false});
 expect(pollScketch3DwebMcpCommand(editor.editorId)).toBeNull();
 const fresh=dispatchScketch3DwebMcpCommand({editorId:editor.editorId,action:"get_scene"});
 const command=await waitForScketch3DwebMcpCommand(editor.editorId,{timeoutMs:1000});
 expect(command?.action).toBe("get_scene");
 completeScketch3DwebMcpCommand(editor.editorId,{commandId:command!.id,ok:true});
 await expect(fresh).resolves.toMatchObject({ok:true});
});
it("rejects expired delivery even before a delayed timeout callback executes",async()=>{
 vi.useFakeTimers();
 const result=dispatchScketch3DwebMcpCommand({editorId:editor.editorId,action:"update_object",timeoutMs:1000});
 vi.setSystemTime(Date.now()+1001);
 expect(pollScketch3DwebMcpCommand(editor.editorId)).toBeNull();
 await vi.advanceTimersByTimeAsync(1000);
 await expect(result).resolves.toMatchObject({ok:false});
});
it("honors the 120 second budget used by geometry tools",async()=>{
 vi.useFakeTimers();
 const result=dispatchScketch3DwebMcpCommand({editorId:editor.editorId,action:"modeling_command",timeoutMs:120000});
 const command=pollScketch3DwebMcpCommand(editor.editorId)!;
 await vi.advanceTimersByTimeAsync(61000);
 expect(command.expiresAt!-command.createdAt).toBe(120000);
 expect(completeScketch3DwebMcpCommand(editor.editorId,{commandId:command.id,ok:true})).toBe(true);
 await expect(result).resolves.toMatchObject({ok:true});
});
