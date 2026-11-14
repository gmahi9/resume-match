import { findSkillSpans, skillById } from './skills';
import { hasQuantification, wordCount } from './text';
import type { SkillHit, Suggestion, SuggestionIssue } from '../types';

export const ISSUE_LABELS: Record<SuggestionIssue, string> = {
  'weak-opener': 'Weak opener',
  'no-metric': 'No measurable result',
  'too-short': 'Too brief',
  vague: 'Vague wording',
};

const ACTION_VERBS = new Set(
  `led built designed developed implemented shipped launched owned mentored automated migrated optimized improved reduced increased delivered architected created established integrated deployed analyzed analysed refactored scaled introduced coordinated negotiated presented documented tested debugged resolved streamlined modernized containerized wrote produced generated configured maintained operated collaborated partnered drove spearheaded cut grew saved accelerated simplified standardized hardened secured monitored triaged prototyped replaced consolidated enabled authored coached hired trained published decreased lowered raised boosted expanded used`.split(
    /\s+/,
  ),
);

const WEAK_OPENERS: RegExp[] = [
  /^i\s+(?:was|am)\s+responsible\s+for\s+/i,
  /^was\s+responsible\s+for\s+/i,
  /^responsible\s+for\s+/i,
  /^worked\s+on\s+/i,
  /^helped\s+(?:with|to)\s+/i,
  /^duties\s+included\s+/i,
  /^tasked\s+with\s+/i,
  /^involved\s+in\s+/i,
  /^participated\s+in\s+/i,
  /^assisted\s+(?:with|in)\s+/i,
  /^my\s+duties\s+included\s+/i,
  /^in\s+charge\s+of\s+/i,
];

const GERUNDS: Record<string, string> = {
  updating: 'Updated',
  building: 'Built',
  developing: 'Developed',
  helping: 'Supported',
  working: 'Delivered',
  creating: 'Created',
  managing: 'Managed',
  leading: 'Led',
  writing: 'Wrote',
  maintaining: 'Maintained',
  testing: 'Tested',
  designing: 'Designed',
  implementing: 'Implemented',
  optimizing: 'Optimized',
  deploying: 'Deployed',
  migrating: 'Migrated',
  improving: 'Improved',
  collaborating: 'Collaborated',
  assisting: 'Supported',
  running: 'Operated',
  supporting: 'Supported',
  handling: 'Managed',
  using: 'Used',
};

const VAGUE = /\b(stuff|things|various|etc\.?|and more)\b/i;
const METRIC_PLACEHOLDER = '[add a real result: percent, time, cost, or scale]';

export function startsWithActionVerb(text: string): boolean {
  const first = text
    .trim()
    .replace(/^[^A-Za-z]+/, '')
    .split(/[\s/]+/)[0]
    ?.replace(/[^A-Za-z-]/g, '')
    .toLowerCase();
  if (!first) return false;
  if (ACTION_VERBS.has(first)) return true;
  if (first.startsWith('co-') && ACTION_VERBS.has(first.slice(3))) return true;
  return false;
}

export function suggestionIssues(bullet: string): SuggestionIssue[] {
  const issues: SuggestionIssue[] = [];
  if (WEAK_OPENERS.some((pattern) => pattern.test(bullet)) || !startsWithActionVerb(bullet)) {
    issues.push('weak-opener');
  }
  if (!hasQuantification(bullet)) issues.push('no-metric');
  if (wordCount(bullet) < 8) issues.push('too-short');
  if (VAGUE.test(bullet)) issues.push('vague');
  return issues;
}

export function suggestRewrite(bullet: string): string {
  let core = bullet.replace(/\s+/g, ' ').trim();
  for (const pattern of WEAK_OPENERS) {
    if (pattern.test(core)) {
      core = core.replace(pattern, '');
      break;
    }
  }
  core = core.trim();
  const first = core.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z-]/g, '') ?? '';
  if (GERUNDS[first]) {
    const rest = core.slice(core.split(/\s+/)[0]?.length ?? 0).trim();
    core = `${GERUNDS[first]}${rest ? ` ${rest}` : ''}`;
  } else if (!startsWithActionVerb(core)) {
    const verb = inferVerb(core);
    const rest = core ? core.charAt(0).toLowerCase() + core.slice(1) : 'the work';
    core = `${verb} ${rest}`;
  }
  core = core.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  if (core.length > 0) core = core.charAt(0).toUpperCase() + core.slice(1);
  if (!hasQuantification(bullet)) core = `${core} — ${METRIC_PLACEHOLDER}`;
  else if (!/[.!?]$/.test(core)) core = `${core}.`;
  return core;
}

function inferVerb(text: string): string {
  const rules: Array<[RegExp, string]> = [
    [/\b(test|qa|quality)\b/i, 'Tested'],
    [/\b(mentor|coach|manag)/i, 'Led'],
    [/\bdesign/i, 'Designed'],
    [/\bmigrat/i, 'Migrated'],
    [/\bautomat/i, 'Automated'],
    [/\b(optimi|performance|latency|speed)/i, 'Optimized'],
    [/\bdeploy/i, 'Deployed'],
    [/\banalys/i, 'Analyzed'],
    [/\b(writ|author)/i, 'Wrote'],
    [/\bintegrat/i, 'Integrated'],
    [/\b(build|develop|implement|creat)/i, 'Built'],
  ];
  for (const [pattern, verb] of rules) {
    if (pattern.test(text)) return verb;
  }
  return 'Delivered';
}

export function honestKeywordNote(bullet: string, missing: SkillHit[]): string | null {
  const present = findSkillSpans(bullet)
    .map((span) => skillById(span.skillId))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));
  const presentCategories = new Set(present.map((skill) => skill.category));
  const candidate = missing.find(
    (skill) =>
      skill.category !== 'soft' &&
      skill.category !== 'certification' &&
      presentCategories.has(skill.category),
  );
  if (!candidate) return null;
  const named = present.find((skill) => skill.category === candidate.category);
  if (!named) return null;
  return `The job description emphasizes ${candidate.name}. This line already names ${named.name}. Add ${candidate.name} only if you used it here.`;
}

export function suggestForBullet(bullet: string, missing: SkillHit[]): Suggestion | null {
  const issues = suggestionIssues(bullet);
  if (issues.length === 0) return null;
  return {
    original: bullet,
    issues,
    issueLabels: issues.map((issue) => ISSUE_LABELS[issue]),
    rewrite: suggestRewrite(bullet),
    keywordNote: honestKeywordNote(bullet, missing),
  };
}

export function buildSuggestions(bullets: string[], missing: SkillHit[], limit = 5): Suggestion[] {
  return bullets
    .map((bullet, index) => ({ suggestion: suggestForBullet(bullet, missing), index }))
    .filter((row): row is { suggestion: Suggestion; index: number } => row.suggestion !== null)
    .sort((a, b) => b.suggestion.issues.length - a.suggestion.issues.length || a.index - b.index)
    .slice(0, limit)
    .map((row) => row.suggestion);
}
