import { describe, expect, it } from 'vitest';
import { SKILLS } from '../data/skills';
import { findSkillSpans, skillById } from './skills';
import { scoreMatch } from './scoring';

describe('skill taxonomy', () => {
  it('uses unique ids and aliases', () => {
    const ids = new Set<string>();
    const aliases = new Set<string>();
    for (const skill of SKILLS) {
      expect(ids.has(skill.id), skill.id).toBe(false);
      ids.add(skill.id);
      const texts = [...skill.aliases, ...(skill.caseAliases ?? [])];
      expect(texts.length).toBeGreaterThan(0);
      for (const alias of texts) {
        const key = alias.toLowerCase();
        expect(aliases.has(key), alias).toBe(false);
        aliases.add(key);
      }
    }
  });

  it('matches each skill from one of its own aliases', () => {
    for (const skill of SKILLS) {
      const probe = skill.caseAliases?.[0] ?? [...skill.aliases].sort((a, b) => b.length - a.length)[0];
      const hits = findSkillSpans(probe).map((span) => span.skillId);
      expect(hits, skill.id).toContain(skill.id);
    }
  });

  it('treats synonyms as the same skill and keeps Java apart from JavaScript', () => {
    const report = scoreMatch({
      resume: 'Built interfaces with React and JS. Deployed services to k8s.',
      jobDescription: 'Requirements\n- JavaScript and React\n- Kubernetes\n- Java for backend services',
      semanticCosine: 0.6,
      mode: 'embedding',
    });
    const matched = report.matchedSkills.map((skill) => skill.name);
    const missing = report.missingSkills.map((skill) => skill.name);
    expect(matched).toEqual(expect.arrayContaining(['JavaScript', 'React', 'Kubernetes']));
    expect(matched).not.toContain('Java');
    expect(missing).toContain('Java');
  });

  it('does not treat Go as Google, or C as C++', () => {
    const go = scoreMatch({
      resume: 'Worked at Google on search.',
      jobDescription: 'Requirements\n- Go',
      mode: 'lexical',
    });
    expect(go.matchedSkills.map((skill) => skill.name)).not.toContain('Go');
    expect(go.missingSkills.map((skill) => skill.name)).toContain('Go');
    expect(go.matchedSkills.map((skill) => skill.name)).not.toContain('Google Cloud');

    const c = scoreMatch({
      resume: 'Systems code in C++.',
      jobDescription: 'Requirements\n- C\n- C++',
      mode: 'lexical',
    });
    expect(c.matchedSkills.map((skill) => skill.name)).toContain('C++');
    expect(c.matchedSkills.map((skill) => skill.name)).not.toContain('C');
    expect(c.missingSkills.map((skill) => skill.name)).toContain('C');
  });

  it('does not treat the verb express as Express', () => {
    const prose = findSkillSpans('Please express yourself clearly.').map((span) => span.skillId);
    expect(prose).not.toContain('express');
    const named = findSkillSpans('Built APIs with Express.js').map((span) => span.skillId);
    expect(named).toContain('express');
    expect(skillById('express')?.name).toBe('Express');
  });

  it('orders missing skills by prominence in the job description', () => {
    const report = scoreMatch({
      resume: 'Pastry chef.',
      jobDescription: ['About us', 'We use Excel sometimes.', '', 'Requirements', '- Python', '- Python', '- Python and SQL', '', 'Nice to have', '- Excel'].join('\n'),
      mode: 'lexical',
    });
    const names = report.missingSkills.map((skill) => skill.name);
    expect(names.indexOf('Python')).toBeLessThan(names.indexOf('SQL'));
    expect(names.indexOf('SQL')).toBeLessThan(names.indexOf('Excel'));
    expect(report.missingSkills[0]?.tier).toBe('high');
  });
});
