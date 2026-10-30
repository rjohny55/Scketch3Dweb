import { robotCatalogModel } from './robotCatalog';
import type { WorkplaneShape } from '@/types/scketch3dweb';

type LoadedPart = { shape: WorkplaneShape; bytes: Uint8Array };
type WorkerResult = { shape: WorkplaneShape; positions: Float32Array; normals: Float32Array; bytes: ArrayBuffer; error?: string };

export function loadRobotCatalogShape(id: string, signal?: AbortSignal, expiresAt = Date.now() + 120_000): Promise<LoadedPart> {
  const model = robotCatalogModel(id);
  if (!model) return Promise.reject(new Error('Unknown robot part'));
  if (signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
  if (expiresAt <= Date.now()) return Promise.reject(new Error('Model loading timed out'));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL('../workers/robotCatalog.worker.ts', import.meta.url)); }
    catch (error) { reject(error); return; }
    let settled = false;
    const finish = (error?: unknown, result?: LoadedPart) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error); else resolve(result!);
    };
    const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Model loading timed out')), expiresAt - Date.now());
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = worker.onmessageerror = () => finish(new Error('Robot model worker failed'));
    worker.onmessage = event => {
      if (settled) return;
      try {
        const { shape, positions, normals, bytes, error } = event.data as WorkerResult;
        if (error) throw new Error(error);
        if (!shape?.importedMesh || !(positions instanceof Float32Array) || !(normals instanceof Float32Array) || !(bytes instanceof ArrayBuffer)) throw new Error('Invalid robot model response');
        shape.importedMesh.positions = Array.from(positions);
        shape.importedMesh.normals = Array.from(normals);
        finish(undefined, { shape, bytes: new Uint8Array(bytes) });
      } catch (error) { finish(error); }
    };
    try { worker.postMessage({ url: new URL(model.meshUrl, window.location.origin).href, name: model.code + '.stl' }); }
    catch (error) { finish(error); }
  });
}
