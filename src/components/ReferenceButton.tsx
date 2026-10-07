import type { MouseEvent } from 'react';
import './ReferenceButton.css';

interface ReferenceButtonProps {
  codes: string[];
  label: string;
  pressed: boolean;
  tone?: 'blue' | 'red';
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

/** A field's workpaper reference. Its accessible name includes the code, e.g. "3a Show in source". */
export function ReferenceButton({ codes, label, pressed, tone = 'blue', onClick }: ReferenceButtonProps) {
  return (
    <button
      type="button"
      className={`reference-button reference-button--${tone}`}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {codes.map((code) => (
        <code key={code} className="reference-button__code">
          {code}
        </code>
      ))}
      <span className="reference-button__label">{label}</span>
    </button>
  );
}
