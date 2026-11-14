import { describe, expect, it } from 'vitest';
import { SAMPLE_JOB, SAMPLE_RESUME } from '../data/sample';
import { scoreMatch } from './scoring';
import { suggestRewrite, suggestionIssues } from './suggestions';

describe('rewrite suggestions', () => {
  it('rewrites a weak, unmeasured bullet without inventing a number', () => {
    expect(suggestionIssues('Helped with stuff')).toEqual(
      expect.arrayContaining(['weak-opener', 'no-metric', 'too-short', 'vague']),
    );
    expect(suggestRewrite('Helped with stuff')).toBe(
      'Delivered stuff — [add a real result: percent, time, cost, or scale]',
    );
    expect(suggestRewrite('Responsible for updating the website')).toBe(
      'Updated the website — [add a real result: percent, time, cost, or scale]',
    );
  });

  it('leaves a specific measured bullet alone', () => {
    const strong = 'Reduced checkout latency by 35% by introducing a Redis cache.';
    expect(suggestionIssues(strong)).toEqual([]);
  });

  it('flags weak sample bullets and keeps honest keyword notes', () => {
    const report = scoreMatch({ resume: SAMPLE_RESUME, jobDescription: SAMPLE_JOB, semanticCosine: 0.62, mode: 'embedding' });
    expect(report.suggestions[0]?.original).toMatch(/Helped with stuff/);
    const originals = report.suggestions.map((suggestion) => suggestion.original).join('\n');
    expect(originals).not.toMatch(/cutting new-screen/);
    expect(originals).not.toMatch(/Lighthouse/);
    expect(originals).not.toMatch(/Mentored 3/);
    const nodeLine = report.suggestions.find((suggestion) => suggestion.original.includes('Node.js'));
    expect(nodeLine?.keywordNote).toMatch(/GraphQL/);
    expect(nodeLine?.keywordNote).toMatch(/Node\.js/);
    expect(nodeLine?.keywordNote).toMatch(/only if you used it/i);
  });
});
