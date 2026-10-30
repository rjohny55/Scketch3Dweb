import type manifoldModule from "manifold-3d";
import type {ManifoldToplevel} from "manifold-3d";
import {manifoldModuleSource} from "@/generated/manifoldModuleSource";
import {manifoldWasmBase64} from "@/generated/manifoldWasmBase64";
let manifoldRuntimePromise:Promise<ManifoldToplevel>|null=null;
export function resetManifoldRuntime(){manifoldRuntimePromise=null;}
function base64ToUint8Array(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importBundledManifoldModule() {
  const blobUrl = URL.createObjectURL(new Blob([manifoldModuleSource], { type: "text/javascript" }));
  try {
    return (await import(/* webpackIgnore: true */ blobUrl)) as { default: typeof manifoldModule };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export function getManifoldRuntime() {
  const assetBase = typeof window === "undefined" ? "/" : new URL(".", window.location.href).href;
  const isFileBuild = typeof window !== "undefined" && window.location.protocol === "file:";
  const manifoldScriptUrl = new URL("manifold.js", assetBase).href;
  const runtimeModule = isFileBuild
    ? importBundledManifoldModule().then((module) => module.default)
    : import(/* webpackIgnore: true */ manifoldScriptUrl).then((module) => (module as { default: typeof manifoldModule }).default);
  manifoldRuntimePromise ??= runtimeModule
    .then((module) => {
      if (isFileBuild) {
        return (module as unknown as (config: { wasmBinary: Uint8Array }) => Promise<ManifoldToplevel>)({
          wasmBinary: base64ToUint8Array(manifoldWasmBase64),
        });
      }
      return module({
        locateFile: ((file: string) => (file.endsWith(".wasm") ? new URL("manifold.wasm", assetBase).href : new URL(file, assetBase).href)) as () => string,
      });
    })
    .then((runtime) => {
      runtime.setup();
      return runtime;
    });
  return manifoldRuntimePromise;
}
