import type {
  Scketch3DwebMcpCommand,
  Scketch3DwebMcpCommandName,
  Scketch3DwebMcpCommandResult,
  Scketch3DwebMcpEditorSummary,
} from "@/lib/scketch3dwebMcpProtocol";
import { SCKETCH3DWEB_MCP_STALE_MS } from "@/lib/scketch3dwebMcpProtocol";

type PendingCommand = {
  expiresAt: number;
  editorId: string;
  resolve: (value: Scketch3DwebMcpCommandResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

type PollWaiter = {
  resolve: (command: Scketch3DwebMcpCommand | null) => void;
  timer: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  onAbort?: () => void;
};

type Scketch3DwebMcpStore = {
  editors: Map<string, Scketch3DwebMcpEditorSummary>;
  queues: Map<string, Scketch3DwebMcpCommand[]>;
  pending: Map<string, PendingCommand>;
  pollWaiters: Map<string, PollWaiter>;
};

declare global {
  // eslint-disable-next-line no-var
  var __scketch3dwebMcpStore: Scketch3DwebMcpStore | undefined;
}

function store() {
  const state = globalThis.__scketch3dwebMcpStore ??= {
    editors: new Map<string, Scketch3DwebMcpEditorSummary>(),
    queues: new Map<string, Scketch3DwebMcpCommand[]>(),
    pending: new Map<string, PendingCommand>(),
    pollWaiters: new Map<string, PollWaiter>(),
  };
  // Development hot reload can preserve a store created before pollWaiters
  // existed. Initialize it lazily so an already-open editor keeps working.
  state.pollWaiters ??= new Map<string, PollWaiter>();
  return state;
}

function createCommandId() {
  return globalThis.crypto?.randomUUID?.() ?? `scketch3dweb-mcp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function settlePollWaiter(
  state: Scketch3DwebMcpStore,
  editorId: string,
  waiter: PollWaiter,
  command: Scketch3DwebMcpCommand | null,
) {
  if (state.pollWaiters.get(editorId) !== waiter) return false;
  state.pollWaiters.delete(editorId);
  clearTimeout(waiter.timer);
  if (waiter.signal && waiter.onAbort) {
    waiter.signal.removeEventListener("abort", waiter.onAbort);
  }
  waiter.resolve(command);
  return true;
}

function prune(current = Date.now()) {
  const state = store();
  for (const [editorId, editor] of state.editors) {
    if (state.pollWaiters.has(editorId) || current - editor.lastSeen <= SCKETCH3DWEB_MCP_STALE_MS) {
      continue;
    }
    state.editors.delete(editorId);
    state.queues.delete(editorId);
    for (const [commandId, pending] of state.pending) {
      if (pending.editorId !== editorId) {
        continue;
      }
      clearTimeout(pending.timer);
      state.pending.delete(commandId);
      pending.resolve({
        commandId,
        ok: false,
        error: `Scketch3Dweb editor ${editor.editorNumber} is no longer open`,
        completedAt: current,
      });
    }
  }
}

export function registerScketch3DwebMcpEditor(editor: Omit<Scketch3DwebMcpEditorSummary, "lastSeen">) {
  const current = Date.now();
  prune(current);
  const state = store();
  state.editors.set(editor.editorId, { ...editor, lastSeen: current });
  state.queues.set(editor.editorId, state.queues.get(editor.editorId) ?? []);
}

export function listScketch3DwebMcpEditors() {
  prune();
  return [...store().editors.values()].sort((a, b) => a.editorNumber - b.editorNumber);
}

export function pollScketch3DwebMcpCommand(editorId: string) {
  prune();
  const queue = store().queues.get(editorId);
  while (queue?.length) {
    const command = queue.shift()!;
    if ((command.expiresAt ?? command.createdAt + 60_000) > Date.now() && store().pending.has(command.id)) return command;
  }
  return null;
}

export function waitForScketch3DwebMcpCommand(
  editorId: string,
  { timeoutMs, signal }: { timeoutMs: number; signal?: AbortSignal },
) {
  const state = store();
  const current = Date.now();
  const editor = state.editors.get(editorId);
  if (editor) state.editors.set(editorId, { ...editor, lastSeen: current });
  prune(current);
  const queued = pollScketch3DwebMcpCommand(editorId);
  if (queued) return Promise.resolve(queued);
  if (signal?.aborted) return Promise.resolve(null);

  const existing = state.pollWaiters.get(editorId);
  if (existing) settlePollWaiter(state, editorId, existing, null);

  return new Promise<Scketch3DwebMcpCommand | null>((resolve) => {
    let waiter: PollWaiter;
    const timer = setTimeout(() => settlePollWaiter(state, editorId, waiter, null), Math.max(1_000, Math.min(timeoutMs, 30_000)));
    const onAbort = () => settlePollWaiter(state, editorId, waiter, null);
    waiter = { resolve, timer, signal, onAbort };
    state.pollWaiters.set(editorId, waiter);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function completeScketch3DwebMcpCommand(editorId: string, result: Scketch3DwebMcpCommandResult) {
  const state = store();
  const pending = state.pending.get(result.commandId);
  if (!pending || pending.editorId !== editorId || Date.now() >= pending.expiresAt) {
    return false;
  }
  clearTimeout(pending.timer);
  state.pending.delete(result.commandId);
  pending.resolve({ ...result, completedAt: result.completedAt ?? Date.now() });
  return true;
}

export function dispatchScketch3DwebMcpCommand({
  editorId,
  editorNumber,
  action,
  params = {},
  timeoutMs = 15000,
}: {
  editorId?: string;
  editorNumber?: number;
  action: Scketch3DwebMcpCommandName;
  params?: Record<string, unknown>;
  timeoutMs?: number;
}) {
  prune();
  const state = store();
  const editor =
    (editorId ? state.editors.get(editorId) : null) ??
    (typeof editorNumber === "number" ? [...state.editors.values()].find((candidate) => candidate.editorNumber === editorNumber) : null);
  if (!editor) {
    return Promise.resolve({
      commandId: "",
      ok: false,
      error: typeof editorNumber === "number" ? `No open Scketch3Dweb editor ${editorNumber}` : "No matching open Scketch3Dweb editor",
      completedAt: Date.now(),
    } satisfies Scketch3DwebMcpCommandResult);
  }

  const duration = Number.isFinite(timeoutMs) ? Math.max(1000, Math.min(timeoutMs, 120000)) : 15000;
  const command: Scketch3DwebMcpCommand = {
    id: createCommandId(),
    action,
    params,
    createdAt: Date.now(),
    expiresAt: Date.now() + duration,
  };
  const waiter = state.pollWaiters.get(editor.editorId);
  if (!waiter || !settlePollWaiter(state, editor.editorId, waiter, command)) {
    const queue = state.queues.get(editor.editorId) ?? [];
    queue.push(command);
    state.queues.set(editor.editorId, queue);
  }

  return new Promise<Scketch3DwebMcpCommandResult>((resolve) => {
    const timer = setTimeout(() => {
      state.pending.delete(command.id);
      state.queues.set(editor.editorId, (state.queues.get(editor.editorId) ?? []).filter(queued => queued.id !== command.id));
      resolve({
        commandId: command.id,
        ok: false,
        error: `Timed out waiting for Scketch3Dweb editor ${editor.editorNumber}`,
        completedAt: Date.now(),
      });
    }, duration);
    state.pending.set(command.id, { editorId: editor.editorId, resolve, timer, expiresAt: command.expiresAt! });
  });
}
