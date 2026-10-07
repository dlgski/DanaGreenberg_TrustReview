import type { ExtractionProvenance, JobStatus } from '../lib/types';
import { Button } from './Button';
import { ProgressIndicator } from './ProgressIndicator';
import './DocumentHeader.css';

interface DocumentHeaderProps {
  borrowerName: string;
  periodEnd: string;
  provenance: ExtractionProvenance;
  figuresInThousands: boolean;
  status: JobStatus;
  receivedCount: number;
  totalCount: number;
  decidedCount: number;
  canApprove: boolean;
  approved: boolean;
  onApprove: () => void;
}

export function DocumentHeader({
  borrowerName,
  periodEnd,
  provenance,
  figuresInThousands,
  status,
  receivedCount,
  totalCount,
  decidedCount,
  canApprove,
  approved,
  onApprove,
}: DocumentHeaderProps) {
  return (
    <header className="document-header">
      <div className="document-header__meta">
        <h1 className="document-header__name">{borrowerName || 'Borrower name pending'}</h1>
        {periodEnd ? (
          <span className="document-header__period">Fiscal year end: {periodEnd}</span>
        ) : null}
        <p className="document-header__provenance">
          {provenance.filename} · {provenance.pageCount} pages · extracted{' '}
          {new Date(provenance.completedAt).toLocaleString()} by {provenance.model}
        </p>
        {figuresInThousands ? (
          <p className="document-header__note">
            Dollar figures in this statement are reported in thousands of U.S. dollars, per the
            source document's own headers — not adjusted here.
          </p>
        ) : null}
      </div>

      <div className="document-header__status">
        {status === 'streaming' ? (
          <ProgressIndicator label="Fields received" value={receivedCount} max={totalCount} />
        ) : null}
        {receivedCount > 0 ? (
          <div id="reviewed-progress">
            <ProgressIndicator label="Fields reviewed" value={decidedCount} max={receivedCount} />
          </div>
        ) : null}
        <Button
          variant="primary"
          onClick={onApprove}
          disabled={!canApprove || approved}
          aria-describedby={!canApprove && !approved && receivedCount > 0 ? 'reviewed-progress' : undefined}
        >
          {approved ? 'Approved' : 'Approve extraction'}
        </Button>
      </div>
    </header>
  );
}
