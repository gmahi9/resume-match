import { EMBEDDING_MODEL } from './embeddings-model';
import { onnxWasmDirectory } from './paths';

export interface ModelProgress {
  status?: string;
  file?: string;
  name?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

interface EmbeddingOutput {
  data: ArrayLike<number>;
  dims: number[];
}

type Extractor = (
  texts: string | string[],
  options: { pooling: 'mean'; normalize: true },
) => Promise<EmbeddingOutput>;

let loader: Promise<Extractor> | null = null;

export function describeProgress(event: ModelProgress, tracker: Map<string, number>): { ratio: number; label: string } {
  const file = event.file || event.name || 'model';
  if (event.status === 'progress' && typeof event.progress === 'number') tracker.set(file, event.progress);
  else if (event.status === 'done') tracker.set(file, 100);
  else if (event.status === 'initiate' || event.status === 'download') tracker.set(file, tracker.get(file) ?? 0);

  const values = [...tracker.values()];
  const ratio = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length / 100 : 0;
  let label = 'Loading the embedding model';
  if (event.status === 'download' || event.status === 'progress') label = `Downloading ${shortFile(file)}`;
  if (event.status === 'done') label = `Cached ${shortFile(file)}`;
  if (event.status === 'ready') label = 'Scoring on this device';
  return { ratio: Math.max(0, Math.min(1, ratio)), label };
}

function shortFile(file: string): string {
  const parts = file.split('/');
  return parts[parts.length - 1] || file;
}

export async function embedTexts(
  texts: string[],
  onProgress?: (event: ModelProgress) => void,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await loadExtractor(onProgress);
  const prepared = texts.map((text) => text.slice(0, 1200));
  const output = await extractor(prepared, { pooling: 'mean', normalize: true });
  return vectorsFromOutput(output, prepared.length);
}

function loadExtractor(onProgress?: (event: ModelProgress) => void): Promise<Extractor> {
  if (!loader) {
    loader = createExtractor(onProgress).catch((error: unknown) => {
      loader = null;
      throw error;
    });
  }
  return loader;
}

async function createExtractor(onProgress?: (event: ModelProgress) => void): Promise<Extractor> {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  const wasm = env.backends?.onnx?.wasm;
  if (wasm) {
    wasm.numThreads = 1;
    wasm.proxy = false;
    wasm.wasmPaths = onnxWasmDirectory();
  }
  const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (event: ModelProgress) => onProgress?.(event),
  });
  return extractor as unknown as Extractor;
}

function vectorsFromOutput(output: EmbeddingOutput, count: number): number[][] {
  const dim = output.dims[output.dims.length - 1] ?? 0;
  if (dim <= 0 || output.data.length !== count * dim) {
    throw new Error('Unexpected embedding shape.');
  }
  const vectors: number[][] = [];
  for (let index = 0; index < count; index += 1) {
    const start = index * dim;
    const vector: number[] = [];
    for (let offset = 0; offset < dim; offset += 1) vector.push(Number(output.data[start + offset]));
    vectors.push(vector);
  }
  return vectors;
}
