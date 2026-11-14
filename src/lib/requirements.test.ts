import { describe, expect, it } from 'vitest';
import { SAMPLE_JOB } from '../data/sample';
import { extractRequirements, extractResumeLines } from './requirements';

describe('requirements', () => {
  it('keeps job requirements and drops benefits boilerplate', () => {
    const requirements = extractRequirements(SAMPLE_JOB);
    expect(requirements.some((line) => /GraphQL/.test(line))).toBe(true);
    expect(requirements.some((line) => /Kubernetes/.test(line))).toBe(true);
    expect(requirements.some((line) => /equal opportunity/i.test(line))).toBe(false);
    expect(requirements.some((line) => /401/.test(line))).toBe(false);
    expect(requirements.length).toBeLessThanOrEqual(10);
  });

  it('splits a prose-only description into sentences', () => {
    const requirements = extractRequirements(
      'The team needs an engineer who has shipped production React applications for several years. The role also includes mentoring newer engineers every week.',
    );
    expect(requirements.length).toBeGreaterThan(0);
    expect(requirements.join(' ')).toMatch(/React/);
  });

  it('collects resume lines that can be compared', () => {
    const lines = extractResumeLines('- Built a design system in React used by four teams.\n- Fixed bugs.');
    expect(lines.some((line) => line.includes('design system'))).toBe(true);
    expect(lines.some((line) => line === 'Fixed bugs.')).toBe(false);
  });
});
