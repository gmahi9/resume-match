export const COSINE_RANGE = { min: 0.3, max: 0.8 } as const;
export const LEXICAL_RANGE = { min: 0.05, max: 0.5 } as const;

const STOP_WORDS = new Set(
  `a an the and or of to for in on with at by from as is are was were be been being this that those these it its your you we our their they them he she his her not no but if so than then into over under about per via using use used within without across during including include such other etc`.split(
    /\s+/,
  ),
);

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mapToScore(value: number, range: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return 0;
  const span = range.max - range.min;
  if (span <= 0) return 0;
  return clamp(Math.round(((value - range.min) / span) * 100), 0, 100);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let left = 0;
  let right = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    left += a[i] * a[i];
    right += b[i] * b[i];
  }
  if (left === 0 || right === 0) return 0;
  return dot / Math.sqrt(left * right);
}

export function meanNormalize(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const acc = new Array<number>(dim).fill(0);
  let used = 0;
  for (const vector of vectors) {
    if (vector.length !== dim) continue;
    used += 1;
    for (let i = 0; i < dim; i += 1) acc[i] += vector[i];
  }
  if (used === 0) return [];
  for (let i = 0; i < dim; i += 1) acc[i] /= used;
  const norm = Math.hypot(...acc) || 1;
  return acc.map((value) => value / norm);
}

export function contentTokens(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z0-9][a-z0-9+.#-]{1,}/g) ?? [];
  return tokens.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function tokenCosine(a: string, b: string): number {
  const left = termFrequency(contentTokens(a));
  const right = termFrequency(contentTokens(b));
  const keys = new Set([...left.keys(), ...right.keys()]);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const key of keys) {
    const x = left.get(key) ?? 0;
    const y = right.get(key) ?? 0;
    dot += x * y;
    leftNorm += x * x;
    rightNorm += y * y;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / Math.sqrt(leftNorm * rightNorm);
}

function termFrequency(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}
