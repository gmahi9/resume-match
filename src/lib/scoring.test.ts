import { describe, expect, it } from 'vitest';
import { SAMPLE_JOB, SAMPLE_RESUME } from '../data/sample';
import { reportToMarkdown } from './report';
import { alignmentFor, percentageShares, scoreMatch } from './scoring';
import { mapToScore, COSINE_RANGE } from './similarity';

describe('score combination', () => {
  it('redistributes weight when a job has no recognizable skills or requirements', () => {
    const report = scoreMatch({
      resume: 'Pastry chef baking bread daily.',
      jobDescription: 'Python',
      semanticCosine: 0.55,
      mode: 'embedding',
    });
    expect(report.components.skills).toBe(0);
    expect(report.components.requirements).toBeNull();
    expect(report.components.semantic).toBe(50);
    expect(report.components.weightPercents.semantic + report.components.weightPercents.skills).toBe(100);
    expect(report.components.weightPercents.requirements).toBe(0);
    expect(report.overall).toBe(28);
    expect(report.components.redistributed).toBe(true);
  });

  it('uses lexical similarity when no embedding cosine is provided', () => {
    const report = scoreMatch({
      resume: 'React TypeScript engineer building design systems and mentoring teams.',
      jobDescription: 'React TypeScript engineer building design systems and mentoring teams.',
      mode: 'lexical',
    });
    expect(report.mode).toBe('lexical');
    expect(report.model).toBeNull();
    expect(report.components.semantic).toBeGreaterThan(70);
  });

  it('scores the sample as a partial match with both matched and missing skills', () => {
    const report = scoreMatch({
      resume: SAMPLE_RESUME,
      jobDescription: SAMPLE_JOB,
      semanticCosine: 0.62,
      mode: 'embedding',
    });
    expect(report.mode).toBe('embedding');
    expect(report.model).toBe('Xenova/all-MiniLM-L6-v2');
    expect(report.matchedSkills.map((skill) => skill.name)).toEqual(
      expect.arrayContaining(['React', 'TypeScript', 'Node.js', 'Docker', 'AWS', 'CI/CD', 'Communication', 'Mentoring']),
    );
    expect(report.missingSkills.map((skill) => skill.name)).toEqual(
      expect.arrayContaining(['GraphQL', 'PostgreSQL', 'Kubernetes', 'Python', 'Terraform', 'AWS Certified Developer']),
    );
    expect(report.overall).toBeGreaterThan(40);
    expect(report.overall).toBeLessThan(90);
    expect(report.requirements.length).toBeGreaterThan(3);
    expect(report.sections.some((section) => section.label === 'Experience')).toBe(true);
    expect(report.clipped).toBe(false);
  });

  it('prefers a specific bullet over a skill list when the scores are close', () => {
    const report = scoreMatch({
      resume: [
        'Skills',
        'JavaScript, TypeScript, React, HTML, CSS, Node.js, Docker, AWS, CI/CD, Communication',
        'Experience',
        '- Built a React and TypeScript design system adopted by 4 product teams.',
      ].join('\n'),
      jobDescription: 'Requirements\n- Design and ship customer-facing features in React and TypeScript.',
      semanticCosine: 0.7,
      mode: 'embedding',
      lineCosines: [[0.7, 0.66]],
    });
    expect(report.requirements[0]?.resumeLine).toMatch(/design system/);
  });

  it('picks the resume line with the highest supplied similarity', () => {
    const report = scoreMatch({
      resume: '- Built a React design system used by 4 teams.\n- Wrote internal notes about office snacks.',
      jobDescription: 'Requirements\n- Build customer-facing React applications for the design system.',
      semanticCosine: 0.7,
      mode: 'embedding',
      lineCosines: [[0.82, 0.31]],
    });
    expect(report.requirements).toHaveLength(1);
    expect(report.requirements[0]?.resumeLine).toMatch(/React design system/);
    expect(report.requirements[0]?.score).toBe(mapToScore(0.82, COSINE_RANGE));
  });

  it('labels alignment bands and percentage shares', () => {
    expect(alignmentFor(70)).toBe('aligned');
    expect(alignmentFor(45)).toBe('partial');
    expect(alignmentFor(44)).toBe('weak');
    expect(percentageShares({ semantic: 0.45, skills: 0.35, requirements: 0.2 })).toEqual({
      semantic: 45,
      skills: 35,
      requirements: 20,
    });
  });

  it('copies a markdown report that keeps the privacy line', () => {
    const report = scoreMatch({
      resume: SAMPLE_RESUME,
      jobDescription: SAMPLE_JOB,
      semanticCosine: 0.62,
      mode: 'embedding',
    });
    const markdown = reportToMarkdown(report);
    expect(markdown).toContain(`**Overall score:** ${report.overall} / 100`);
    expect(markdown).toContain('GraphQL');
    expect(markdown).toContain('Your resume never leaves your device.');
    expect(markdown).toContain('Xenova/all-MiniLM-L6-v2');
  });
});
