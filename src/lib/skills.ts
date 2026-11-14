import { CATEGORY_LABELS, SKILLS, type SkillDef } from '../data/skills';
import type { SkillCategory, SkillHit } from '../types';
import type { DocSection } from './text';
import { splitJdSections } from './text';

export interface SkillSpan {
  skillId: string;
  start: number;
  end: number;
}

interface AliasPattern {
  skillId: string;
  regex: RegExp;
}

const SKILL_BY_ID = new Map<string, SkillDef>(SKILLS.map((skill) => [skill.id, skill]));

const PATTERNS: AliasPattern[] = SKILLS.flatMap((skill) => {
  const sources: Array<{ text: string; sensitive: boolean }> = [
    ...skill.aliases.map((text) => ({ text, sensitive: false })),
    ...(skill.caseAliases ?? []).map((text) => ({ text, sensitive: true })),
  ];
  return sources
    .filter((source) => source.text.trim().length > 0)
    .map((source) => ({
      skillId: skill.id,
      regex: aliasRegex(source.text, source.sensitive),
    }));
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function aliasRegex(alias: string, caseSensitive: boolean): RegExp {
  const tight = alias.toLowerCase() === 'c';
  const ahead = tight ? '[A-Za-z0-9+#]' : '[A-Za-z0-9]';
  const flags = caseSensitive ? 'g' : 'gi';
  return new RegExp(`(?<![A-Za-z0-9.])${escapeRegExp(alias)}(?!${ahead})`, flags);
}

export function skillById(id: string): SkillDef | undefined {
  return SKILL_BY_ID.get(id);
}

export function findSkillSpans(text: string): SkillSpan[] {
  const bySkill = new Map<string, Array<{ start: number; end: number }>>();
  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(pattern.regex)) {
      const start = match.index ?? 0;
      const spans = bySkill.get(pattern.skillId) ?? [];
      spans.push({ start, end: start + match[0].length });
      bySkill.set(pattern.skillId, spans);
    }
  }
  const mentions: SkillSpan[] = [];
  for (const [skillId, spans] of bySkill) {
    for (const span of mergeSpans(spans)) {
      mentions.push({ skillId, start: span.start, end: span.end });
    }
  }
  mentions.sort((a, b) => a.start - b.start || a.end - b.end);
  return mentions;
}

function mergeSpans(spans: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i += 1) {
    const last = merged[merged.length - 1];
    const span = sorted[i];
    if (span.start <= last.end) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}

interface SkillTally {
  id: string;
  count: number;
  prominence: number;
}

export function tallySkills(sections: DocSection[]): Map<string, SkillTally> {
  const tallies = new Map<string, SkillTally>();
  for (const section of sections) {
    for (const span of findSkillSpans(section.text)) {
      const position = section.start + span.start;
      const early = position < 500 ? 1.25 : 1;
      const current = tallies.get(span.skillId) ?? { id: span.skillId, count: 0, prominence: 0 };
      current.count += 1;
      current.prominence += section.weight * early;
      tallies.set(span.skillId, current);
    }
  }
  return tallies;
}

export function toSkillHits(tallies: Map<string, SkillTally>, ids?: Set<string>): SkillHit[] {
  const rows = [...tallies.values()].filter((row) => (ids ? ids.has(row.id) : true));
  const max = rows.reduce((best, row) => Math.max(best, row.prominence), 0);
  return rows
    .map((row) => {
      const skill = SKILL_BY_ID.get(row.id);
      if (!skill) return null;
      return {
        id: skill.id,
        name: skill.name,
        category: skill.category,
        categoryLabel: CATEGORY_LABELS[skill.category],
        count: row.count,
        prominence: Math.round(row.prominence * 10) / 10,
        tier: tierFor(row.prominence, max),
      } satisfies SkillHit;
    })
    .filter((hit): hit is SkillHit => hit !== null)
    .sort((a, b) => b.prominence - a.prominence || a.name.localeCompare(b.name));
}

function tierFor(prominence: number, max: number): SkillHit['tier'] {
  if (max <= 0) return 'low';
  const ratio = prominence / max;
  if (ratio >= 0.66) return 'high';
  if (ratio >= 0.33) return 'medium';
  return 'low';
}

export function jdSkillTallies(jobDescription: string): Map<string, SkillTally> {
  return tallySkills(splitJdSections(jobDescription));
}

export function resumeSkillIds(resume: string): Set<string> {
  return new Set(findSkillSpans(resume).map((span) => span.skillId));
}

export function skillsInText(text: string): SkillHit[] {
  const sections = [{ label: 'Text', kind: 'body', weight: 1, text, start: 0 }];
  return toSkillHits(tallySkills(sections));
}

export function categoryLabel(category: SkillCategory): string {
  return CATEGORY_LABELS[category];
}
