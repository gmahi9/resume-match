export type SkillCategory =
  | 'language'
  | 'framework'
  | 'cloud'
  | 'data'
  | 'tool'
  | 'soft'
  | 'certification';

export type Alignment = 'aligned' | 'partial' | 'weak';

export type ScoreMode = 'embedding' | 'lexical';

export type SuggestionIssue = 'weak-opener' | 'no-metric' | 'too-short' | 'vague';

export interface SkillHit {
  id: string;
  name: string;
  category: SkillCategory;
  categoryLabel: string;
  count: number;
  prominence: number;
  tier: 'high' | 'medium' | 'low';
}

export interface RequirementMatch {
  index: number;
  requirement: string;
  score: number;
  alignment: Alignment;
  resumeLine: string | null;
}

export interface Suggestion {
  original: string;
  issues: SuggestionIssue[];
  issueLabels: string[];
  rewrite: string;
  keywordNote: string | null;
}

export interface SectionCoverage {
  label: string;
  matched: number;
  total: number;
  coverage: number;
  skillNames: string[];
}

export interface ScoreWeights {
  semantic: number;
  skills: number;
  requirements: number;
}

export interface MatchReport {
  overall: number;
  alignment: Alignment;
  components: {
    semantic: number;
    skills: number | null;
    requirements: number | null;
    weights: ScoreWeights;
    weightPercents: ScoreWeights;
    redistributed: boolean;
  };
  mode: ScoreMode;
  model: string | null;
  matchedSkills: SkillHit[];
  missingSkills: SkillHit[];
  jdSkillCount: number;
  requirements: RequirementMatch[];
  suggestions: Suggestion[];
  sections: SectionCoverage[];
  clipped: boolean;
  stats: {
    resumeWords: number;
    jobWords: number;
  };
}
