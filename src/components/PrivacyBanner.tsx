import { LockIcon } from './Icons';

export function PrivacyBanner() {
  return (
    <div className="privacy" role="note">
      <LockIcon />
      <p>Your resume never leaves your device.</p>
    </div>
  );
}
