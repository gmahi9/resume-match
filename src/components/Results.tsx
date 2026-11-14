import { useState } from 'react';
import { alignmentLabel } from '../lib/scoring';
import { reportToMarkdown } from '../lib/report';
import type { MatchReport, SkillHit } from '../types';

const GAUGE_RADIUS = 68;
const GAUGE_CIRC = 2 * Math.PI * GAUGE_RADIUS;

export function Results({ report }: { report: MatchReport }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const label = alignmentLabel(report.alignment);
  const offset = GAUGE_CIRC * (1 - report.overall / 100);

  async function copyReport() {
    const markdown = reportToMarkdown(report);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(markdown);
      else copyWithSelection(markdown);
      setCopyState('copied');
    } catch {
      try {
        copyWithSelection(markdown);
        setCopyState('copied');
      } catch {
        setCopyState('failed');
      }
    }
  }

  function printReport() {
    const previous = document.title;
    document.title = `Resume match ${report.overall} of 100`;
    const restore = () => {
      document.title = previous;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  }

  return (
    <section className="report" id="report" aria-labelledby="report-title">
      <div className="report-head">
        <h2 id="report-title" tabIndex={-1}>
          Match report
        </h2>
        <div className="export-row no-print">
          <button type="button" className="button button-secondary" onClick={printReport}>
            Print / save as PDF
          </button>
          <button type="button" className="button button-secondary" onClick={() => void copyReport()}>
            Copy as Markdown
          </button>
          <span className="copy-state" role="status">
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : ''}
          </span>
        </div>
      </div>

      <div className="score-layout">
        <div className="gauge-card">
          <p className="eyebrow">Overall</p>
          <svg className="gauge" viewBox="0 0 180 180" role="img" aria-label={`Overall match score ${report.overall} out of 100, ${label}`}>
            <circle className="gauge-track" cx="90" cy="90" r={GAUGE_RADIUS} />
            <circle
              className={`gauge-value gauge-${report.alignment}`}
              cx="90"
              cy="90"
              r={GAUGE_RADIUS}
              strokeDasharray={GAUGE_CIRC}
              strokeDashoffset={offset}
              transform="rotate(-90 90 90)"
            />
            <text className="gauge-number" x="90" y="86" textAnchor="middle">
              {report.overall}
            </text>
            <text className="gauge-unit" x="90" y="110" textAnchor="middle">
              out of 100
            </text>
          </svg>
          <p className={`alignment alignment-${report.alignment}`}>{label}</p>
          <p className="fine-print">
            {report.matchedSkills.length} of {report.jdSkillCount} tracked job skills appear on the resume.
          </p>
        </div>

        <div className="breakdown">
          <h3>Score breakdown</h3>
          <ComponentBar
            label="Semantic alignment"
            score={report.components.semantic}
            weight={report.components.weightPercents.semantic}
          />
          <ComponentBar
            label="Skill coverage"
            score={report.components.skills}
            weight={report.components.weightPercents.skills}
          />
          <ComponentBar
            label="Requirement match"
            score={report.components.requirements}
            weight={report.components.weightPercents.requirements}
          />
          <p className="fine-print">{modeNote(report)}</p>
          {report.components.redistributed ? (
            <p className="fine-print">Weights were redistributed because one component had nothing to score.</p>
          ) : null}
          <details>
            <summary>How the score is built</summary>
            <p>
              Semantic alignment is {report.mode === 'embedding' ? 'a cosine similarity from the on-device embedding model' : 'keyword overlap'}, mapped onto 0–100. Skill coverage
              weights each job skill by how often it appears and whether it sits in requirements, responsibilities, or a nice-to-have list. Requirement match averages the closest
              resume line for each job bullet. Strong alignment starts at 70. Partial alignment starts at 45.
            </p>
          </details>
        </div>
      </div>

      <div className="skill-grid">
        <SkillColumn title="Matched skills" empty="None of the tracked job skills appeared on the resume." skills={report.matchedSkills} tone="matched" />
        <SkillColumn
          title="Missing skills"
          empty="No tracked job skill is missing."
          skills={report.missingSkills}
          tone="missing"
          intro="Ordered by how often and how prominently they appear in the job description."
        />
      </div>

      <section className="block" aria-labelledby="sections-title">
        <h3 id="sections-title">Where the resume covers the job</h3>
        {report.sections.length === 0 ? (
          <p>No resume sections to compare.</p>
        ) : (
          <ul className="section-list">
            {report.sections.map((section) => (
              <li key={section.label}>
                <div className="section-row">
                  <span>{section.label}</span>
                  <span>
                    {section.matched} of {section.total} · {section.coverage}%
                  </span>
                </div>
                <Bar value={section.coverage} label={`${section.label} covers ${section.coverage} percent of job skills`} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block" aria-labelledby="requirements-title">
        <h3 id="requirements-title">Requirement match</h3>
        {report.requirements.length === 0 ? (
          <p>No distinct requirements were found. Add bullets or full sentences to the job description.</p>
        ) : (
          <ol className="requirement-list">
            {report.requirements.map((item) => (
              <li key={item.index} className="requirement">
                <div className="req-top">
                  <span className={`pill pill-${item.alignment}`}>
                    {item.score} · {alignmentLabel(item.alignment)}
                  </span>
                </div>
                <p className="req-label">Job requirement</p>
                <blockquote>{item.requirement}</blockquote>
                <p className="req-label">Closest resume line</p>
                <blockquote>{item.resumeLine ?? 'No resume line to compare.'}</blockquote>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="block" aria-labelledby="suggestions-title">
        <h3 id="suggestions-title">Rewrite suggestions</h3>
        <p>These are templates. Only describe work you did, and only name a tool when you used it.</p>
        {report.suggestions.length === 0 ? (
          <p>No weak bullets were flagged. Strong lines start with an action verb and include a real number.</p>
        ) : (
          <ol className="suggestion-list">
            {report.suggestions.map((suggestion) => (
              <li key={suggestion.original} className="suggestion">
                <ul className="issue-list">
                  {suggestion.issueLabels.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
                <p className="req-label">Original</p>
                <blockquote>{suggestion.original}</blockquote>
                <p className="req-label">Suggested rewrite</p>
                <blockquote className="rewrite">{suggestion.rewrite}</blockquote>
                {suggestion.keywordNote ? <p className="keyword-note">{suggestion.keywordNote}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="report-foot">
        {report.clipped ? <p>Scoring used the first 40,000 characters of an input.</p> : null}
        <p>
          {report.stats.resumeWords} resume words · {report.stats.jobWords} job description words
        </p>
        <p>Your resume never leaves your device.</p>
      </footer>
    </section>
  );
}

function ComponentBar({ label, score, weight }: { label: string; score: number | null; weight: number }) {
  return (
    <div className="meter-row">
      <div className="meter-labels">
        <span>{label}</span>
        <span>{score === null ? 'Not scored' : score} · {weight}% of score</span>
      </div>
      <Bar value={score ?? 0} label={`${label}: ${score === null ? 'not scored' : `${score} out of 100`}`} />
    </div>
  );
}

function Bar({ value, label }: { value: number; label: string }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <svg className="bar" viewBox="0 0 100 8" role="img" aria-label={label} preserveAspectRatio="none">
      <rect className="bar-track" x="0" y="0" width="100" height="8" rx="4" />
      <rect className="bar-fill" x="0" y="0" width={width} height="8" rx="4" />
    </svg>
  );
}

function SkillColumn({
  title,
  skills,
  empty,
  tone,
  intro,
}: {
  title: string;
  skills: SkillHit[];
  empty: string;
  tone: 'matched' | 'missing';
  intro?: string;
}) {
  const headingId = `${tone}-skills-title`;
  return (
    <section className="block" aria-labelledby={headingId}>
      <h3 id={headingId}>{title}</h3>
      {intro ? <p className="fine-print">{intro}</p> : null}
      {skills.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul className="chip-list">
          {skills.map((skill) => (
            <li key={skill.id} className={`chip chip-${tone}`}>
              <span className="chip-name">{skill.name}</span>
              <span className="chip-meta">
                {skill.categoryLabel} · {skill.tier} · {skill.count === 1 ? 'once' : `${skill.count} times`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function modeNote(report: MatchReport): string {
  if (report.mode === 'embedding' && report.model) {
    return `Semantic score uses ${report.model} running in this browser. The model is downloaded once and then read from the browser cache.`;
  }
  return 'The embedding model did not load, so this score uses on-device keyword similarity.';
}

function copyWithSelection(text: string): void {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.className = 'sr-only';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('Copy failed');
}
