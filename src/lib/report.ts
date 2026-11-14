import { alignmentLabel } from './scoring';
import type { MatchReport } from '../types';

export function reportToMarkdown(report: MatchReport): string {
  const lines: string[] = [];
  lines.push('# Resume match report');
  lines.push('');
  lines.push(`**Overall score:** ${report.overall} / 100 (${alignmentLabel(report.alignment)})`);
  lines.push('');
  lines.push(semanticNote(report));
  lines.push('');
  lines.push('## Score breakdown');
  lines.push('');
  lines.push('| Component | Score | Weight |');
  lines.push('| --- | ---: | ---: |');
  lines.push(componentRow('Semantic alignment', report.components.semantic, report.components.weightPercents.semantic));
  lines.push(
    componentRow(
      'Skill coverage',
      report.components.skills,
      report.components.weightPercents.skills,
    ),
  );
  lines.push(
    componentRow(
      'Requirement match',
      report.components.requirements,
      report.components.weightPercents.requirements,
    ),
  );
  if (report.components.redistributed) {
    lines.push('');
    lines.push('Weights were redistributed because one component had nothing to score.');
  }
  lines.push('');
  lines.push(`Job skills found on the resume: ${report.matchedSkills.length} of ${report.jdSkillCount}.`);
  lines.push('');
  lines.push('## Matched skills');
  lines.push('');
  lines.push(report.matchedSkills.length ? skillList(report.matchedSkills) : '_None of the tracked job skills appeared on the resume._');
  lines.push('');
  lines.push('## Missing skills');
  lines.push('');
  lines.push('Sorted by how often and how prominently they appear in the job description.');
  lines.push('');
  if (report.missingSkills.length === 0) {
    lines.push('_No tracked job skill is missing._');
  } else {
    report.missingSkills.forEach((skill, index) => {
      const times = skill.count === 1 ? 'mentioned once' : `mentioned ${skill.count} times`;
      lines.push(
        `${index + 1}. **${skill.name}** (${skill.categoryLabel}) — ${skill.tier} prominence, ${times}`,
      );
    });
  }
  lines.push('');
  lines.push('## Where the resume covers the job');
  lines.push('');
  if (report.sections.length === 0) {
    lines.push('_No resume sections to compare._');
  } else {
    for (const section of report.sections) {
      lines.push(`- **${section.label}** — ${section.matched} of ${section.total} job skills (${section.coverage}%)`);
    }
  }
  lines.push('');
  lines.push('## Requirement match');
  lines.push('');
  if (report.requirements.length === 0) {
    lines.push('_No distinct requirements were found in the job description._');
  } else {
    for (const item of report.requirements) {
      lines.push(`### ${item.index}. ${item.score} / 100 — ${alignmentLabel(item.alignment)}`);
      lines.push('');
      lines.push('Job requirement:');
      lines.push('');
      lines.push(`> ${item.requirement}`);
      lines.push('');
      lines.push('Closest resume line:');
      lines.push('');
      lines.push(item.resumeLine ? `> ${item.resumeLine}` : '_No resume line to compare._');
      lines.push('');
    }
  }
  lines.push('## Rewrite suggestions');
  lines.push('');
  lines.push('These are templates. Only describe work you did, and only add a tool when you used it.');
  lines.push('');
  if (report.suggestions.length === 0) {
    lines.push('_No weak bullets were flagged. Look for an action verb and a real number on each line._');
  } else {
    report.suggestions.forEach((suggestion, index) => {
      lines.push(`### ${index + 1}. ${suggestion.issueLabels.join('; ')}`);
      lines.push('');
      lines.push('Original:');
      lines.push('');
      lines.push(`> ${suggestion.original}`);
      lines.push('');
      lines.push('Suggested rewrite:');
      lines.push('');
      lines.push(`> ${suggestion.rewrite}`);
      if (suggestion.keywordNote) {
        lines.push('');
        lines.push(suggestion.keywordNote);
      }
      lines.push('');
    });
  }
  if (report.clipped) {
    lines.push('Scoring used the first 40,000 characters of an input.');
    lines.push('');
  }
  lines.push(`Resume words: ${report.stats.resumeWords}. Job description words: ${report.stats.jobWords}.`);
  lines.push('');
  lines.push('Scored entirely in the browser. Your resume never leaves your device.');
  lines.push('');
  return lines.join('\n');
}

function semanticNote(report: MatchReport): string {
  if (report.mode === 'embedding' && report.model) {
    return `Semantic alignment uses ${report.model} running in this browser.`;
  }
  return 'The embedding model did not load, so this score uses on-device keyword similarity.';
}

function componentRow(label: string, score: number | null, weight: number): string {
  return `| ${label} | ${score === null ? 'n/a' : score} | ${weight}% |`;
}

function skillList(skills: MatchReport['matchedSkills']): string {
  return skills.map((skill) => `- ${skill.name} (${skill.categoryLabel})`).join('\n');
}
