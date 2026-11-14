export const MAX_INPUT_CHARS = 40_000;
export const MIN_SCORE_CHARS = 40;

export function normalizeText(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim();
}

export function clipInput(input: string): { text: string; clipped: boolean } {
  const text = normalizeText(input);
  if (text.length <= MAX_INPUT_CHARS) return { text, clipped: false };
  return { text: text.slice(0, MAX_INPUT_CHARS), clipped: true };
}

export function wordCount(text: string): number {
  const words = text.match(/[A-Za-z0-9][A-Za-z0-9+.#-]*/g);
  return words?.length ?? 0;
}

export function hasQuantification(text: string): boolean {
  return /\d/.test(text);
}

export interface DocSection {
  label: string;
  kind: string;
  weight: number;
  text: string;
  start: number;
}

interface HeadingDef {
  label: string;
  kind: string;
  weight: number;
  labels: string[];
}

const JD_HEADINGS: HeadingDef[] = [
  {
    label: 'Requirements',
    kind: 'requirements',
    weight: 1.65,
    labels: [
      'requirements',
      'required',
      'required qualifications',
      'minimum qualifications',
      'qualifications',
      'basic qualifications',
      'what you bring',
      'what we are looking for',
      'must have',
      'must-haves',
      'must haves',
      'required skills',
    ],
  },
  {
    label: 'Responsibilities',
    kind: 'responsibilities',
    weight: 1.3,
    labels: [
      'responsibilities',
      'what you will do',
      "what you'll do",
      'what youll do',
      'the role',
      'duties',
      'in this role',
      'your responsibilities',
    ],
  },
  {
    label: 'Preferred',
    kind: 'preferred',
    weight: 0.55,
    labels: [
      'nice to have',
      'nice-to-have',
      'preferred',
      'preferred qualifications',
      'bonus',
      'bonus points',
      'pluses',
      'optional',
      'preferred skills',
    ],
  },
  {
    label: 'About',
    kind: 'about',
    weight: 0.3,
    labels: [
      'about us',
      'about the company',
      'who we are',
      'about',
      'benefits',
      'perks',
      'what we offer',
      'compensation',
      'equal opportunity',
      'our mission',
      'the company',
    ],
  },
];

const RESUME_HEADINGS: HeadingDef[] = [
  { label: 'Summary', kind: 'summary', weight: 1, labels: ['summary', 'professional summary', 'profile', 'objective', 'about me'] },
  {
    label: 'Experience',
    kind: 'experience',
    weight: 1,
    labels: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history'],
  },
  { label: 'Skills', kind: 'skills', weight: 1, labels: ['skills', 'technical skills', 'core skills', 'technologies', 'tech stack'] },
  { label: 'Projects', kind: 'projects', weight: 1, labels: ['projects', 'selected projects', 'personal projects'] },
  { label: 'Education', kind: 'education', weight: 1, labels: ['education', 'academics'] },
  { label: 'Certifications', kind: 'certifications', weight: 1, labels: ['certifications', 'certificates', 'licenses', 'certification'] },
];

function cleanHeading(line: string): string {
  return line
    .trim()
    .replace(/^[#*\s]+/, '')
    .replace(/[:\-–—\s]+$/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function lookupHeading(line: string, dictionary: HeadingDef[]): HeadingDef | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 70 || /^[-*•▪◦●]/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) return null;
  const cleaned = cleanHeading(trimmed);
  return dictionary.find((heading) => heading.labels.includes(cleaned)) ?? null;
}

function splitByHeadings(text: string, dictionary: HeadingDef[], intro: HeadingDef, emptyLabel: HeadingDef): DocSection[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const lines = normalized.split('\n');
  const sections: DocSection[] = [];
  let offset = 0;
  let current = { ...intro, start: 0, lines: [] as string[] };

  const flush = () => {
    const body = current.lines.join('\n').trim();
    if (body) {
      sections.push({
        label: current.label,
        kind: current.kind,
        weight: current.weight,
        text: body,
        start: current.start,
      });
    }
  };

  for (const line of lines) {
    const heading = lookupHeading(line, dictionary);
    if (heading) {
      flush();
      current = { ...heading, start: offset + line.length + 1, lines: [] };
    } else {
      current.lines.push(line);
    }
    offset += line.length + 1;
  }
  flush();

  if (sections.length === 0) {
    return [{ label: emptyLabel.label, kind: emptyLabel.kind, weight: emptyLabel.weight, text: normalized, start: 0 }];
  }
  return sections;
}

export function splitJdSections(text: string): DocSection[] {
  return splitByHeadings(
    text,
    JD_HEADINGS,
    { label: 'Opening', kind: 'intro', weight: 1.15, labels: [] },
    { label: 'Job description', kind: 'body', weight: 1, labels: [] },
  );
}

export function splitResumeSections(text: string): DocSection[] {
  return splitByHeadings(
    text,
    RESUME_HEADINGS,
    { label: 'Header', kind: 'header', weight: 1, labels: [] },
    { label: 'Resume', kind: 'resume', weight: 1, labels: [] },
  );
}

const BULLET_RE = /^\s*(?:[-*•▪◦●]|\d{1,2}[.)])\s+(.+)$/;

export function bulletBodies(text: string): string[] {
  const bodies: string[] = [];
  for (const line of normalizeText(text).split('\n')) {
    const match = line.match(BULLET_RE);
    if (match?.[1]) bodies.push(match[1].trim());
  }
  return bodies;
}

export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function chunkForEmbedding(text: string, maxChars = 700, maxChunks = 6): string[] {
  const parts = normalizeText(text)
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const part of parts) {
    const piece = part.length > maxChars ? part.slice(0, maxChars) : part;
    if (current && current.length + piece.length + 1 > maxChars) {
      chunks.push(current);
      if (chunks.length >= maxChunks) return chunks;
      current = piece;
    } else {
      current = current ? `${current}\n${piece}` : piece;
    }
  }
  if (current && chunks.length < maxChunks) chunks.push(current);
  if (chunks.length === 0 && normalizeText(text)) chunks.push(normalizeText(text).slice(0, maxChars));
  return chunks;
}
