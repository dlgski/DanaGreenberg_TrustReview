import { useId } from 'react';
import type { FieldDecision, JobStatus } from '../lib/types';
import { Button } from './Button';
import { TickMark } from './TickMark';
import './DocumentHeader.css';

interface DocumentHeaderProps {
  borrowerName: string;
  /** As extracted, e.g. "2025-06-30". */
  periodEnd: string;
  figuresInThousands: boolean;
  status: JobStatus;
  totalCount: number;
  /** The decision for each received field, in field order. */
  decisions: FieldDecision[];
  canApprove: boolean;
  approved: boolean;
  onApprove: () => void;
}

function formatPeriodEnd(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

export function DocumentHeader({
  borrowerName,
  periodEnd,
  figuresInThousands,
  status,
  totalCount,
  decisions,
  canApprove,
  approved,
  onApprove,
}: DocumentHeaderProps) {
  const id = useId();
  const received = decisions.length;
  const decided = decisions.filter((d) => d !== 'pending').length;
  const count =
    status === 'streaming' ? `${received} of ${totalCount} fields received` : `${decided} of ${totalCount} fields ticked`;
  const reason =
    status === 'failed'
      ? 'The extraction has to finish before you can approve.'
      : canApprove
        ? 'Every field has a decision.'
        : 'Every field needs a decision before you can approve.';

  return (
    <header className="document-header">
      <div>
        <h1 className="document-header__name">{borrowerName || 'Borrower name pending'}</h1>
        <p className="document-header__meta">
          {periodEnd ? `Fiscal year ended ${formatPeriodEnd(periodEnd)}. ` : null}
          {figuresInThousands ? (
            <>
              All figures in <strong>thousands of U.S. dollars</strong>.
            </>
          ) : null}
        </p>
      </div>

      <div className="document-header__signoff">
        <div className="document-header__status">
          <b id={`${id}-count`} className="document-header__count">
            {count}
          </b>
          <div className="document-header__ticks" aria-hidden="true">
            {Array.from({ length: totalCount }, (_, i) => {
              const decision = i < received ? decisions[i] : null;
              return (
                <span key={i} className={`document-header__tick${decision === null ? ' document-header__tick--waiting' : ''}`}>
                  {decision && decision !== 'pending' ? <TickMark decision={decision} size="small" decorative /> : null}
                </span>
              );
            })}
          </div>
          <span id={`${id}-reason`} className="document-header__reason">
            {reason}
          </span>
        </div>
        <Button
          variant="primary"
          size="large"
          onClick={onApprove}
          disabled={!canApprove || approved}
          aria-describedby={`${id}-count ${id}-reason`}
        >
          {approved ? 'Approved' : 'Approve extraction'}
        </Button>
      </div>
    </header>
  );
}
