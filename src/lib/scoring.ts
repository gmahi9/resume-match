import { EMBEDDING_MODEL } from './embeddings-model';
import { extractRequirements, extractResumeBullets, extractResumeLines } from './requirements';
import { jdSkillTallies, resumeSkillIds, toSkillHits, findSkillSpans, skillById } from './skills';
import { buildSuggestions } from './suggestions';
import { COSINE_RANGE, LEXICAL_RANGE, clamp, mapToScore, tokenCosine } from './similarity';
import { clipInput, splitResumeSections, wordCount } from './text';
import type { Alignment, MatchReport, ScoreMode, ScoreWeights, SectionCoverage } from '../types';

export const SCORE_WEIGHTS = { semantic: 0.45, skills: 0.35, requirements: 0.2 } as const;

export interface ScoreInput {
  resume: string;
  jobDescription: string;
  semanticCosine?: number;
  /** Cosine of each requirement against each resume line, in extract order. */
  lineCosines?: number[][];
  mode?: ScoreMode;
}

export function alignmentFor(score: number): Alignment {
  if (score >= 70) return 'aligned';
  if (score >= 45) return 'partial';
  return 'weak';
}

export function alignmentLabel(alignment: Alignment): string {
  if (alignment === 'aligned') return 'Strong alignment';
  if (alignment === 'partial') return 'Partial alignment';
  return 'Low alignment';
}

export function percentageShares(weights: ScoreWeights): ScoreWeights {
  const keys: Array<keyof ScoreWeights> = ['semantic', 'skills', 'requirements'];
  const rows = keys.map((key) => {
    const exact = weights[key] * 100;
    return { key, floor: Math.floor(exact + 1e-9), frac: exact - Math.floor(exact + 1e-9), exact };
  });
  let used = rows.reduce((sum, row) => sum + row.floor, 0);
  const ranked = [...rows].sort((a, b) => b.frac - a.frac || b.exact - a.exact);
  for (const row of ranked) {
    if (used >= 100) break;
    if (row.exact <= 0) continue;
    row.floor += 1;
    used += 1;
  }
  return {
    semantic: rows.find((row) => row.key === 'semantic')?.floor ?? 0,
    skills: rows.find((row) => row.key === 'skills')?.floor ?? 0,
    requirements: rows.find((row) => row.key === 'requirements')?.floor ?? 0,
  };
}

export function scoreMatch(input: ScoreInput): MatchReport {
  const resumeClip = clipInput(input.resume);
  const jobClip = clipInput(input.jobDescription);
  const resume = resumeClip.text;
  const jobDescription = jobClip.text;
  const useEmbedding = input.mode !== 'lexical' && typeof input.semanticCosine === 'number';
  const mode: ScoreMode = useEmbedding ? 'embedding' : 'lexical';

  const semantic = useEmbedding
    ? mapToScore(input.semanticCosine ?? 0, COSINE_RANGE)
    : mapToScore(tokenCosine(resume, jobDescription), LEXICAL_RANGE);

  const jdTallies = jdSkillTallies(jobDescription);
  const resumeIds = resumeSkillIds(resume);
  const jdHits = toSkillHits(jdTallies);
  const matchedSkills = jdHits.filter((hit) => resumeIds.has(hit.id));
  const missingSkills = jdHits.filter((hit) => !resumeIds.has(hit.id));

  let skills: number | null = null;
  if (jdHits.length > 0) {
    const total = jdHits.reduce((sum, hit) => sum + hit.prominence, 0);
    const hitWeight = matchedSkills.reduce((sum, hit) => sum + hit.prominence, 0);
    skills = total > 0 ? clamp(Math.round((hitWeight / total) * 100), 0, 100) : 0;
  }

  const requirementTexts = extractRequirements(jobDescription);
  const lines = extractResumeLines(resume);
  const requirements = requirementTexts.map((requirement, index) => {
    let bestScore = 0;
    let bestRank = Number.NEGATIVE_INFINITY;
    let bestLine: string | null = null;
    const consider = (line: string, score: number) => {
      const rank = score - skillListPenalty(line);
      if (rank > bestRank) {
        bestRank = rank;
        bestScore = score;
        bestLine = line;
      }
    };
    if (useEmbedding && input.lineCosines && input.lineCosines.length === requirementTexts.length) {
      const row = input.lineCosines[index] ?? [];
      lines.forEach((line, lineIndex) => consider(line, mapToScore(row[lineIndex] ?? 0, COSINE_RANGE)));
    } else {
      lines.forEach((line) => consider(line, mapToScore(tokenCosine(requirement, line), LEXICAL_RANGE)));
    }
    return {
      index: index + 1,
      requirement,
      score: bestScore,
      alignment: alignmentFor(bestScore),
      resumeLine: bestLine,
    };
  });

  const requirementsScore =
    requirements.length > 0
      ? clamp(Math.round(requirements.reduce((sum, item) => sum + item.score, 0) / requirements.length), 0, 100)
      : null;

  const combined = combineScores({ semantic, skills, requirements: requirementsScore });
  const sections = coverSections(resume, new Set(jdHits.map((hit) => hit.id)));

  return {
    overall: combined.overall,
    alignment: alignmentFor(combined.overall),
    components: {
      semantic,
      skills,
      requirements: requirementsScore,
      weights: combined.weights,
      weightPercents: percentageShares(combined.weights),
      redistributed: skills === null || requirementsScore === null,
    },
    mode,
    model: mode === 'embedding' ? EMBEDDING_MODEL : null,
    matchedSkills,
    missingSkills,
    jdSkillCount: jdHits.length,
    requirements,
    suggestions: buildSuggestions(extractResumeBullets(resume), missingSkills),
    sections,
    clipped: resumeClip.clipped || jobClip.clipped,
    stats: {
      resumeWords: wordCount(resume),
      jobWords: wordCount(jobDescription),
    },
  };
}

function skillListPenalty(line: string): number {
  const commas = line.split(',').length - 1;
  return commas >= 5 ? 12 : 0;
}

function combineScores(parts: {
  semantic: number;
  skills: number | null;
  requirements: number | null;
}): { overall: number; weights: ScoreWeights } {
  const active: Array<[keyof ScoreWeights, number, number]> = [['semantic', SCORE_WEIGHTS.semantic, parts.semantic]];
  if (parts.skills !== null) active.push(['skills', SCORE_WEIGHTS.skills, parts.skills]);
  if (parts.requirements !== null) active.push(['requirements', SCORE_WEIGHTS.requirements, parts.requirements]);
  const sum = active.reduce((total, [, weight]) => total + weight, 0) || 1;
  const weights: ScoreWeights = { semantic: 0, skills: 0, requirements: 0 };
  let overall = 0;
  for (const [key, weight, value] of active) {
    const share = weight / sum;
    weights[key] = share;
    overall += share * value;
  }
  return { overall: clamp(Math.round(overall), 0, 100), weights };
}

function coverSections(resume: string, jdSkillIds: Set<string>): SectionCoverage[] {
  if (jdSkillIds.size === 0) return [];
  const sections = splitResumeSections(resume);
  const rows = sections.map((section) => {
    const names = [
      ...new Set(
        findSkillSpans(section.text)
          .map((span) => skillById(span.skillId))
          .filter((skill) => skill && jdSkillIds.has(skill.id))
          .map((skill) => skill!.name),
      ),
    ].sort((a, b) => a.localeCompare(b));
    return {
      label: section.label,
      matched: names.length,
      total: jdSkillIds.size,
      coverage: Math.round((names.length / jdSkillIds.size) * 100),
      skillNames: names,
    };
  });
  const meaningful = rows.filter((row) => row.label !== 'Header' || row.matched > 0);
  return meaningful.length > 0 ? meaningful : rows;
}
