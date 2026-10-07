import type { FieldDecision } from '../lib/types';
import './TickMark.css';

const LABELS: Record<FieldDecision, string> = {
  pending: 'Not reviewed',
  confirmed: 'Confirmed',
  edited: 'Edited',
  rejected: 'Rejected',
};

interface TickMarkProps {
  decision: FieldDecision;
  size?: 'large' | 'small';
  /** Hide from assistive tech when nearby text already states the decision. */
  decorative?: boolean;
}

/**
 * An auditor's pencil tick for a field decision. Each decision renders a different
 * <path>, so React mounts a fresh element when the decision changes and the draw
 * animation plays once, as a response to the analyst's action.
 */
export function TickMark({ decision, size = 'large', decorative = false }: TickMarkProps) {
  return (
    <svg
      className={`tick-mark tick-mark--${size} tick-mark--${decision}`}
      viewBox="0 0 24 24"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : LABELS[decision]}
      aria-hidden={decorative ? true : undefined}
    >
      {decision === 'pending' ? <circle className="tick-mark__pending" cx="12" cy="12" r="9" /> : null}
      {decision === 'confirmed' ? <path className="tick-mark__stroke" d="M5 12.5l4.2 4.5L19 6.5" /> : null}
      {decision === 'edited' ? (
        <path className="tick-mark__stroke" d="M4 19l3.5-1 10-10-2.5-2.5-10 10L4 19z M13.5 7.5l2.5 2.5" />
      ) : null}
      {decision === 'rejected' ? <path className="tick-mark__stroke" d="M6 6l12 12 M18 6L6 18" /> : null}
    </svg>
  );
}
