import { MarkIcon } from './Icons';

export type ThemeName = 'light' | 'dark';

export function Header({ theme, onToggleTheme }: { theme: ThemeName; onToggleTheme: () => void }) {
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <header className="topbar">
      <a className="brand" href="#main">
        <MarkIcon />
        <span className="brand-text">
          <span className="brand-name">Resume Match</span>
          <span className="brand-tag">On this device</span>
        </span>
      </a>
      <button type="button" className="button button-secondary theme-toggle" onClick={onToggleTheme} aria-pressed={theme === 'dark'}>
        Use {next} theme
      </button>
    </header>
  );
}
