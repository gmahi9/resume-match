import { bulletBodies, sentences, splitJdSections, splitResumeSections, wordCount } from './text';

export const MAX_REQUIREMENTS = 10;
export const MAX_RESUME_LINES = 20;

const BOILERPLATE = [
  /equal opportunity/i,
  /without regard/i,
  /we are an equal/i,
  /benefits include/i,
  /medical,\s*dental/i,
  /401\(k\)/i,
  /parental leave/i,
  /apply today/i,
  /salary range/i,
  /competitive (salary|compensation|pay)/i,
];

function acceptRequirement(text: string): boolean {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length < 25 || clean.length > 320) return false;
  if (wordCount(clean) < 4) return false;
  return !BOILERPLATE.some((pattern) => pattern.test(clean));
}

function priorityFor(kind: string): number {
  if (kind === 'requirements') return 3;
  if (kind === 'responsibilities') return 2;
  if (kind === 'preferred' || kind === 'intro' || kind === 'body') return 1;
  return 0;
}

export function extractRequirements(jobDescription: string): string[] {
  const sections = splitJdSections(jobDescription);
  const candidates: Array<{ text: string; priority: number; order: number }> = [];
  let order = 0;

  for (const section of sections) {
    const priority = priorityFor(section.kind);
    if (priority === 0) continue;
    for (const bullet of bulletBodies(section.text)) {
      const text = bullet.replace(/\s+/g, ' ').trim();
      if (acceptRequirement(text)) candidates.push({ text, priority, order: order++ });
    }
  }

  if (candidates.length < 3) {
    for (const section of sections) {
      if (priorityFor(section.kind) === 0) continue;
      const prose = section.text
        .split('\n')
        .filter((line) => !/^\s*(?:[-*•▪◦●]|\d{1,2}[.)])\s+/.test(line))
        .join(' ');
      for (const sentence of sentences(prose)) {
        const text = sentence.replace(/\s+/g, ' ').trim();
        if (!acceptRequirement(text)) continue;
        if (candidates.some((candidate) => candidate.text === text)) continue;
        candidates.push({ text, priority: 1, order: order++ });
      }
    }
  }

  const chosen = [...candidates]
    .sort((a, b) => b.priority - a.priority || a.order - b.order)
    .slice(0, MAX_REQUIREMENTS)
    .sort((a, b) => a.order - b.order);
  return chosen.map((candidate) => candidate.text);
}

const CONTACT = /@[a-z0-9.-]+\.[a-z]{2,}|\b\d{3}[-.)\s]\d{3}[-.\s]\d{4}\b|linkedin\.com|github\.com/i;

export function extractResumeLines(resume: string): string[] {
  const sections = splitResumeSections(resume);
  const preferred = new Set(['Experience', 'Projects', 'Summary', 'Skills', 'Resume']);
  const lines: string[] = [];

  const push = (text: string) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length < 30 || clean.length > 320) return;
    if (CONTACT.test(clean) && wordCount(clean) < 12) return;
    if (lines.includes(clean)) return;
    lines.push(clean);
  };

  for (const section of sections) {
    if (!preferred.has(section.label)) continue;
    for (const bullet of bulletBodies(section.text)) push(bullet);
    if (section.label === 'Skills' || section.label === 'Summary' || section.label === 'Resume') {
      for (const line of section.text.split('\n')) push(line);
    }
  }

  if (lines.length < 3) {
    for (const section of sections) {
      for (const sentence of sentences(section.text)) push(sentence);
    }
  }

  return lines.slice(0, MAX_RESUME_LINES);
}

export function extractResumeBullets(resume: string): string[] {
  const seen = new Set<string>();
  const bullets: string[] = [];
  for (const bullet of bulletBodies(resume)) {
    const clean = bullet.replace(/\s+/g, ' ').trim();
    if (clean.length < 8 || seen.has(clean)) continue;
    seen.add(clean);
    bullets.push(clean);
  }
  return bullets;
}
