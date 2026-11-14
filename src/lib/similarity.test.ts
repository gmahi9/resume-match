import { describe, expect, it } from 'vitest';
import { COSINE_RANGE, cosineSimilarity, mapToScore, meanNormalize, tokenCosine } from './similarity';

describe('similarity', () => {
  it('measures cosine similarity', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
    expect(cosineSimilarity([], [1])).toBe(0);
    expect(cosineSimilarity([1, 0], [1])).toBe(0);
  });

  it('maps embedding cosine onto 0–100', () => {
    expect(mapToScore(0.3, COSINE_RANGE)).toBe(0);
    expect(mapToScore(0.55, COSINE_RANGE)).toBe(50);
    expect(mapToScore(0.8, COSINE_RANGE)).toBe(100);
    expect(mapToScore(1, COSINE_RANGE)).toBe(100);
    expect(mapToScore(-0.2, COSINE_RANGE)).toBe(0);
  });

  it('normalizes the mean of vectors', () => {
    const mean = meanNormalize([
      [1, 0],
      [0, 1],
    ]);
    expect(mean[0]).toBeCloseTo(Math.SQRT1_2);
    expect(mean[1]).toBeCloseTo(Math.SQRT1_2);
    expect(Math.hypot(...mean)).toBeCloseTo(1);
  });

  it('scores identical wording higher than unrelated wording', () => {
    const same = tokenCosine('React TypeScript design systems', 'React TypeScript design systems');
    const different = tokenCosine('sourdough lamination pastry', 'Kubernetes GraphQL PostgreSQL');
    expect(same).toBeGreaterThan(0.9);
    expect(different).toBe(0);
  });
});
