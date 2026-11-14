import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * SIMD WASM files for the embedding runtime. The app loads them with one
 * thread so the page does not need cross-origin isolation when it is proxied.
 */
const ORT_FILES = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'];

function copyIfNewer(from: string, to: string): void {
  if (!existsSync(from)) return;
  mkdirSync(path.dirname(to), { recursive: true });
  if (existsSync(to) && statSync(to).mtimeMs >= statSync(from).mtimeMs) return;
  copyFileSync(from, to);
}

export function copyLocalRuntimeFiles(): { ort: number; worker: boolean } {
  const publicDir = path.join(root, 'public');
  const ortOut = path.join(publicDir, 'ort');
  mkdirSync(ortOut, { recursive: true });

  const ortDist = path.dirname(require.resolve('onnxruntime-web'));
  const present = new Set(readdirSync(ortDist));
  let ort = 0;
  for (const name of ORT_FILES) {
    if (!present.has(name)) continue;
    copyIfNewer(path.join(ortDist, name), path.join(ortOut, name));
    ort += 1;
  }
  const wasmFile = path.join(ortOut, 'ort-wasm-simd-threaded.wasm');
  const glueFile = path.join(ortOut, 'ort-wasm-simd-threaded.mjs');
  if (!existsSync(wasmFile) || !existsSync(glueFile)) {
    const available = [...present].filter((name) => name.includes('wasm')).slice(0, 40);
    throw new Error(
      `onnxruntime-web single-thread wasm files were not found in ${ortDist}. Saw: ${available.join(', ')}`,
    );
  }

  const worker = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
  copyIfNewer(worker, path.join(publicDir, 'pdf.worker.min.mjs'));
  return { ort, worker: true };
}

function localRuntimePlugin(): Plugin {
  return {
    name: 'local-runtime-files',
    buildStart() {
      copyLocalRuntimeFiles();
    },
    configureServer() {
      copyLocalRuntimeFiles();
    },
  };
}

copyLocalRuntimeFiles();

const ortWasmEntry = path.join(path.dirname(require.resolve('onnxruntime-web')), 'ort.wasm.min.mjs');

export default defineConfig({
  base: './',
  plugins: [react(), localRuntimePlugin()],
  resolve: {
    alias: [
      {
        find: 'onnxruntime-web/webgpu',
        replacement: ortWasmEntry,
      },
      {
        find: /^onnxruntime-web$/,
        replacement: ortWasmEntry,
      },
    ]
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers', 'onnxruntime-web'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
  },
});
