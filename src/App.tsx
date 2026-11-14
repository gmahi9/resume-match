import { useEffect, useId, useRef, useState } from 'react';
import { Header, type ThemeName } from './components/Header';
import { PrivacyBanner } from './components/PrivacyBanner';
import { Results } from './components/Results';
import { SAMPLE_JOB, SAMPLE_RESUME } from './data/sample';
import { analyze } from './lib/analyze';
import { extractResumeFile, fileKind } from './lib/extract';
import { MIN_SCORE_CHARS } from './lib/text';
import type { MatchReport } from './types';

const THEME_KEY = 'resume-match-theme';

function readTheme(): ThemeName {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
}

export function App() {
  const [theme, setTheme] = useState<ThemeName>(readTheme);
  const [resume, setResume] = useState('');
  const [job, setJob] = useState('');
  const [fileNote, setFileNote] = useState('');
  const [fileError, setFileError] = useState('');
  const [reading, setReading] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'scoring' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState('');
  const [report, setReport] = useState<MatchReport | null>(null);
  const [scoreError, setScoreError] = useState('');
  const fileInput = useRef<HTMLInputElement | null>(null);
  const resumeId = useId();
  const jobId = useId();
  const helpId = useId();
  const statusId = useId();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#121411' : '#f3efe6');
  }, [theme]);

  useEffect(() => {
    if (phase !== 'done') return;
    const heading = document.getElementById('report-title');
    heading?.focus();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    heading?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [phase, report]);

  function toggleTheme() {
    const next: ThemeName = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* Storage can be blocked. The choice still applies for this view. */
    }
  }

  async function onFile(file: File | null) {
    setFileError('');
    if (!file) return;
    const kind = fileKind(file);
    if (kind === 'unsupported') {
      setFileError('Use a PDF, DOCX, or plain text file.');
      return;
    }
    setReading(true);
    setFileNote(`Reading ${file.name}`);
    try {
      const text = await extractResumeFile(file);
      setResume(text);
      setFileNote(`${file.name} · edit the text below if the extraction needs a correction`);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'The file could not be read.');
      setFileNote('');
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function loadSample() {
    setResume(SAMPLE_RESUME);
    setJob(SAMPLE_JOB);
    setFileNote('Sample resume loaded. It stays in this page.');
    setFileError('');
    setScoreError('');
  }

  function clearAll() {
    setResume('');
    setJob('');
    setReport(null);
    setPhase('idle');
    setFileNote('');
    setFileError('');
    setScoreError('');
    setProgress(null);
    setProgressLabel('');
  }

  async function onScore() {
    if (resume.trim().length < MIN_SCORE_CHARS || job.trim().length < MIN_SCORE_CHARS) return;
    setScoreError('');
    setPhase('scoring');
    setProgress(0);
    setProgressLabel('Loading the embedding model');
    try {
      const next = await analyze({
        resume,
        jobDescription: job,
        onProgress: (ratio, label) => {
          setProgress(ratio);
          setProgressLabel(label);
        },
      });
      setReport(next);
      setPhase('done');
    } catch (error) {
      setPhase('error');
      setScoreError(error instanceof Error ? error.message : 'Scoring failed.');
    }
  }

  const ready = resume.trim().length >= MIN_SCORE_CHARS && job.trim().length >= MIN_SCORE_CHARS;
  const busy = phase === 'scoring' || reading;
  const status = statusMessage(phase, progressLabel, reading);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="app-shell">
        <div className="no-print">
          <Header theme={theme} onToggleTheme={toggleTheme} />
          <PrivacyBanner />
        </div>
        <main id="main" className="main-wrap">
          <section className="hero no-print">
            <h1>See how a resume lines up with a job</h1>
            <p>
              Paste both documents, or upload a resume as PDF, DOCX, or text. The score blends semantic similarity from a small embedding model with a transparent skill check.
              Nothing is uploaded.
            </p>
            <ol className="steps">
              <li>
                <span>01</span> Add the resume
              </li>
              <li>
                <span>02</span> Add the job description
              </li>
              <li>
                <span>03</span> Score it here
              </li>
            </ol>
          </section>

          <form
            className="no-print"
            aria-busy={busy}
            onSubmit={(event) => {
              event.preventDefault();
              void onScore();
            }}
          >
            <div className="input-grid">
              <section className="panel" aria-labelledby="resume-heading">
                <div className="panel-head">
                  <h2 id="resume-heading">Resume</h2>
                  <span>{resume.trim() ? `${resume.trim().split(/\s+/).length} words` : 'Empty'}</span>
                </div>
                <div
                  className="dropzone"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    void onFile(event.dataTransfer.files[0] ?? null);
                  }}
                >
                  <input
                    ref={fileInput}
                    id="resume-file"
                    className="file-input"
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.text,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    aria-describedby={fileError ? 'file-error' : undefined}
                    onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
                  />
                  <span>Drop a PDF, DOCX, or text file, or browse</span>
                </div>
                {fileNote ? <p className="fine-print">{fileNote}</p> : null}
                {fileError ? (
                  <p id="file-error" className="form-error" role="alert">
                    {fileError}
                  </p>
                ) : null}
                <div className="field">
                  <label htmlFor={resumeId}>Resume text</label>
                  <textarea
                    id={resumeId}
                    value={resume}
                    onChange={(event) => setResume(event.target.value)}
                    spellCheck
                    autoComplete="off"
                    placeholder="Paste a resume, or upload a file and correct the extracted text."
                  />
                </div>
              </section>

              <section className="panel" aria-labelledby="job-heading">
                <div className="panel-head">
                  <h2 id="job-heading">Job description</h2>
                  <span>{job.trim() ? `${job.trim().split(/\s+/).length} words` : 'Empty'}</span>
                </div>
                <div className="field">
                  <label htmlFor={jobId}>Job description text</label>
                  <textarea
                    id={jobId}
                    value={job}
                    onChange={(event) => setJob(event.target.value)}
                    spellCheck
                    autoComplete="off"
                    placeholder="Paste the posting, including requirements and responsibilities."
                  />
                </div>
              </section>
            </div>

            <div className="actions">
              <button type="submit" className="button button-primary" disabled={!ready || busy}>
                {phase === 'scoring' ? 'Scoring' : 'Score match'}
              </button>
              <button type="button" className="button button-secondary" onClick={loadSample} disabled={busy}>
                Load sample resume and job
              </button>
              <button type="button" className="button button-quiet" onClick={clearAll} disabled={busy}>
                Clear
              </button>
              <p id={helpId} className="fine-print">
                {ready ? 'Scoring runs in this browser. The embedding model downloads once, then stays in the browser cache.' : 'Add both a resume and a job description to score them.'}
              </p>
            </div>
            <div id={statusId} className="sr-only" role="status">
              {status}
            </div>
            {phase === 'scoring' ? (
              <div className="progress-block">
                <div className="meter-labels">
                  <span>{progressLabel || 'Working'}</span>
                  <span>{progress === null ? '' : `${Math.round(progress * 100)}%`}</span>
                </div>
                <progress max={100} value={Math.round((progress ?? 0) * 100)} aria-label="Scoring progress">
                  {progressLabel}
                </progress>
              </div>
            ) : null}
            {scoreError ? (
              <p className="form-error" role="alert">
                {scoreError}
              </p>
            ) : null}
          </form>

          {report && phase === 'done' ? <Results report={report} /> : null}
        </main>
        <footer className="site-foot no-print">
          <p>Your resume never leaves your device.</p>
          <p>MIT license · gmahi9</p>
        </footer>
      </div>
      </>
  );
}

function statusMessage(phase: 'idle' | 'scoring' | 'done' | 'error', label: string, reading: boolean): string {
  if (reading) return 'Reading the resume file.';
  if (phase === 'scoring') return label || 'Scoring the resume against the job description.';
  if (phase === 'done') return 'Match report ready.';
  if (phase === 'error') return 'Scoring failed.';
  return '';
}
