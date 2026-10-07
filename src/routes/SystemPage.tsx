import { useState } from 'react';
import { Badge, type BadgeVariant } from '../components/Badge';
import { Button } from '../components/Button';
import { FieldRow } from '../components/FieldRow';
import { FieldSkeleton } from '../components/FieldSkeleton';
import { SourceEvidence } from '../components/SourceEvidence';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { DocumentHeader } from '../components/DocumentHeader';
import { EditFieldDialog } from '../components/EditFieldDialog';
import { ScenarioControl } from '../components/ScenarioControl';
import { Flag } from '../components/Flag';
import { TickMark } from '../components/TickMark';
import { ReferenceButton } from '../components/ReferenceButton';
import { useExtractionStream } from '../lib/useExtractionStream';
import type { ExtractionField, FieldReviewState } from '../lib/types';
import type { StreamScenario } from '../lib/streamExtraction';
import { TOTAL_FIELD_COUNT } from '../lib/streamExtraction';
import './SystemPage.css';

const COLOR_PRIMITIVES = [
  'neutral-0', 'neutral-50', 'neutral-100', 'neutral-200', 'neutral-300',
  'neutral-400', 'neutral-500', 'neutral-600', 'neutral-700', 'neutral-800', 'neutral-900',
  'blue-100', 'blue-500', 'blue-600', 'blue-700',
  'green-100', 'green-500', 'green-700',
  'amber-100', 'amber-500', 'amber-700',
  'red-100', 'red-500', 'red-700',
];

const COLOR_SEMANTIC = [
  'bg', 'surface', 'surface-sunken', 'border', 'border-strong',
  'text-primary', 'text-secondary', 'text-muted',
  'interactive', 'interactive-hover', 'interactive-subtle', 'focus-ring',
  'status-success-bg', 'status-success-text', 'status-success-border',
  'status-caution-bg', 'status-caution-text', 'status-caution-border',
  'status-danger-bg', 'status-danger-text', 'status-danger-border',
  'status-info-bg', 'status-info-text', 'status-info-border',
  'status-neutral-bg', 'status-neutral-text', 'status-neutral-border',
];

const SPACING_TOKENS = ['space-1', 'space-2', 'space-3', 'space-4', 'space-5', 'space-6', 'space-8', 'space-10', 'space-12', 'space-16'];

const TYPE_TOKENS = ['font-size-xs', 'font-size-sm', 'font-size-base', 'font-size-md', 'font-size-lg', 'font-size-xl', 'font-size-2xl'];

const RADIUS_TOKENS = ['radius-sm', 'radius-md', 'radius-lg', 'radius-full'];

const SHADOW_TOKENS = ['shadow-sm', 'shadow-md', 'shadow-lg'];

const BADGE_VARIANTS: BadgeVariant[] = ['neutral', 'success', 'caution', 'danger', 'info'];

function sampleField(overrides: Partial<ExtractionField> = {}): ExtractionField {
  return {
    id: 'sample',
    label: 'Total revenue',
    value: '48,213',
    unit: 'USD',
    sourceQuote: 'Net sales 48,213',
    page: 3,
    confidence: 0.95,
    ...overrides,
  };
}

function FieldRowDemo({
  field,
  initialReview,
}: {
  field: ExtractionField;
  initialReview: FieldReviewState;
}) {
  const [review, setReview] = useState<FieldReviewState>(initialReview);
  return (
    <FieldRow
      field={field}
      review={review}
      onConfirm={() => setReview({ decision: 'confirmed', reviewedAt: new Date().toISOString() })}
      onReject={() => setReview({ decision: 'rejected', reviewedAt: new Date().toISOString() })}
      onEdit={(value) => setReview({ decision: 'edited', editedValue: value, reviewedAt: new Date().toISOString() })}
      onResolveCandidate={(value) =>
        setReview(
          value === field.value
            ? { decision: 'confirmed', reviewedAt: new Date().toISOString() }
            : { decision: 'edited', editedValue: value, resolvedCandidate: value, reviewedAt: new Date().toISOString() },
        )
      }
    />
  );
}

function LiveStreamDemo() {
  const [scenario, setScenario] = useState<StreamScenario>('success');
  const { status, fields, errorMessage, begin, retry } = useExtractionStream(scenario);

  return (
    <div className="component-grid">
      <ScenarioControl value={scenario} onChange={setScenario} />
      {status === 'idle' ? (
        <EmptyState
          title="No extraction in progress"
          description="This demo drives the same hook and simulator the Review page uses."
          actionLabel="Run extraction"
          onAction={begin}
        />
      ) : (
        <>
          <ProgressIndicator label="Fields received" value={fields.length} max={TOTAL_FIELD_COUNT} />
          {status === 'failed' && errorMessage ? (
            <ErrorBanner
              message={errorMessage}
              receivedCount={fields.length}
              totalCount={TOTAL_FIELD_COUNT}
              onRetry={retry}
            />
          ) : null}
          <div className="component-row">
            {fields.slice(-3).map((f) => (
              <Badge key={f.id} variant="neutral">
                {f.label}
              </Badge>
            ))}
            {status === 'streaming' ? <Badge variant="info">receiving…</Badge> : null}
            {status === 'complete' ? <Badge variant="success">done</Badge> : null}
          </div>
        </>
      )}
    </div>
  );
}

export function SystemPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const conflictField = sampleField({
    id: 'total_debt',
    label: 'Total debt',
    value: '21,500',
    unit: 'USD',
    sourceQuote: 'Total long-term debt 21,500',
    page: 4,
    confidence: 0.62,
    candidates: [
      {
        value: '24,750',
        sourceQuote: 'Total debt, including current portion 24,750',
        page: 6,
      },
    ],
  });

  const demoProvenance = {
    filename: 'Halvorsen_FY2025_Financials.pdf',
    pageCount: 6,
    model: 'extractor-v4',
    completedAt: '2026-09-14T15:42:08Z',
  };

  return (
    <div className="system-page">
      <div>
        <h1>Design system</h1>
        <p className="system-page__intro">
          Every token and every component this interface is built from, shown in each state it can
          appear in. Components consume these tokens through <code>var(--token-name)</code> only —
          no raw hex or pixel values live outside this token layer.
        </p>
      </div>

      <section className="system-section">
        <h2 className="system-section__title">Workpaper primitives</h2>
        <div className="component-row">
          <TickMark decision="pending" />
          <TickMark decision="confirmed" />
          <TickMark decision="edited" />
          <TickMark decision="rejected" />
        </div>
        <div className="component-row">
          <Flag tone="caution" icon="warning">Model was unsure</Flag>
          <Flag tone="caution" icon="split">Two possible values</Flag>
          <Flag tone="danger" icon="warning">Doesn't match the document</Flag>
          <Flag tone="info" icon="calculator">Calculated, not read from the document</Flag>
        </div>
        <div className="component-row">
          <ReferenceButton codes={['3a']} label="Show in source" pressed={false} onClick={() => {}} />
          <ReferenceButton codes={['3a']} label="Show in source" pressed onClick={() => {}} />
          <ReferenceButton codes={['4a', '6b']} label="Show both in source" pressed={false} onClick={() => {}} />
          <ReferenceButton codes={['3b']} label="Show the line on page 3" pressed tone="red" onClick={() => {}} />
        </div>
        <div className="component-row">
          <Button variant="text">Reject</Button>
          <Button variant="quiet">Edit</Button>
          <Button variant="primary">Confirm</Button>
          <Button variant="primary" size="large" disabled>Approve extraction</Button>
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Color</h2>
        <h3 className="system-section__group-title">Primitives</h3>
        <div className="swatch-grid">
          {COLOR_PRIMITIVES.map((token) => (
            <div className="swatch" key={token}>
              <div className="swatch__fill" style={{ background: `var(--color-${token})` }} />
              <div className="swatch__label">{token}</div>
            </div>
          ))}
        </div>
        <h3 className="system-section__group-title">Semantic</h3>
        <div className="swatch-grid">
          {COLOR_SEMANTIC.map((token) => (
            <div className="swatch" key={token}>
              <div className="swatch__fill" style={{ background: `var(--color-${token})` }} />
              <div className="swatch__label">{token}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Spacing</h2>
        {SPACING_TOKENS.map((token) => (
          <div className="scale-row" key={token}>
            <span className="scale-row__name">{token}</span>
            <div className="scale-row__box" style={{ width: `var(--${token})`, height: 'var(--space-5)' }} />
          </div>
        ))}
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Type</h2>
        {TYPE_TOKENS.map((token) => (
          <div className="type-row" key={token}>
            <span className="type-row__name">{token}</span>
            <span style={{ fontSize: `var(--${token})` }}>Aa — The quick brown fox</span>
          </div>
        ))}
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Radius</h2>
        <div className="radius-row">
          {RADIUS_TOKENS.map((token) => (
            <div className="radius-sample" key={token} style={{ borderRadius: `var(--${token})` }}>
              {token}
            </div>
          ))}
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Elevation</h2>
        <div className="shadow-row">
          {SHADOW_TOKENS.map((token) => (
            <div className="shadow-sample" key={token} style={{ boxShadow: `var(--${token})` }}>
              {token}
            </div>
          ))}
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Button</h2>
        <div className="component-row">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" disabled>
            Primary disabled
          </Button>
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Badge</h2>
        <div className="component-row">
          {BADGE_VARIANTS.map((v) => (
            <Badge key={v} variant={v}>
              {v}
            </Badge>
          ))}
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Progress indicator</h2>
        <div className="component-grid">
          <ProgressIndicator label="Fields received" value={6} max={9} />
          <ProgressIndicator label="Fields reviewed" value={9} max={9} />
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Source evidence</h2>
        <div className="component-grid">
          <div>
            <p className="state-label">With a matching quote and page citation</p>
            <SourceEvidence quote="Net sales 48,213" page={3} />
          </div>
          <div>
            <p className="state-label">No value was found in the document</p>
            <SourceEvidence quote={null} />
          </div>
          <div>
            <p className="state-label">A value exists but the model cited no source for it</p>
            <SourceEvidence quote={null} missingMessage="The model did not cite any source for this value." />
          </div>
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Field row — every state</h2>
        <div className="component-grid">
          <div>
            <p className="state-label">Loading (skeleton)</p>
            <FieldSkeleton />
          </div>
          <div>
            <p className="state-label">Needs review (pending, default)</p>
            <FieldRowDemo field={sampleField()} initialReview={{ decision: 'pending' }} />
          </div>
          <div>
            <p className="state-label">Confirmed</p>
            <FieldRowDemo field={sampleField({ id: 'confirmed' })} initialReview={{ decision: 'confirmed' }} />
          </div>
          <div>
            <p className="state-label">Edited</p>
            <FieldRowDemo
              field={sampleField({ id: 'edited' })}
              initialReview={{ decision: 'edited', editedValue: '49,800' }}
            />
          </div>
          <div>
            <p className="state-label">Rejected</p>
            <FieldRowDemo field={sampleField({ id: 'rejected' })} initialReview={{ decision: 'rejected' }} />
          </div>
          <div>
            <p className="state-label">Low confidence flagged</p>
            <FieldRowDemo
              field={sampleField({ id: 'low-confidence', label: 'Fiscal year end', value: '2025-06-30', unit: undefined, sourceQuote: 'for the fiscal year ended June 30, 2025', confidence: 0.41 })}
              initialReview={{ decision: 'pending' }}
            />
          </div>
          <div>
            <p className="state-label">Not found in document</p>
            <FieldRowDemo
              field={sampleField({ id: 'missing', label: 'Guarantor', value: '', unit: undefined, sourceQuote: null, confidence: null, status: 'not_found' })}
              initialReview={{ decision: 'pending' }}
            />
          </div>
          <div>
            <p className="state-label">No source cited (value present, nothing to verify it against)</p>
            <FieldRowDemo
              field={sampleField({ id: 'ungrounded', label: 'Net income', value: '2,310', sourceQuote: null, confidence: 0.88 })}
              initialReview={{ decision: 'pending' }}
            />
          </div>
          <div>
            <p className="state-label">Calculated, not extracted</p>
            <FieldRowDemo
              field={sampleField({
                id: 'derived',
                label: 'Debt service coverage ratio',
                value: '1.42',
                unit: undefined,
                sourceQuote: null,
                confidence: 0.9,
                derived: { formula: 'ebitda / annual_debt_service', inputLabels: ['EBITDA', 'Annual debt service'] },
              })}
              initialReview={{ decision: 'pending' }}
            />
          </div>
          <div>
            <p className="state-label">Long narrative value (rendered as prose, not a mono figure)</p>
            <FieldRowDemo
              field={sampleField({
                id: 'prose',
                label: 'Financial covenants',
                value: 'The Company is required to maintain a minimum fixed charge coverage ratio of 1.25 to 1.00... As of June 30, 2025, the Company was in compliance with all covenants, except as described in Note 9, for which the lender granted a waiver dated August 4, 2025.',
                unit: undefined,
                sourceQuote: 'Note 8 — Debt and Covenants',
                page: 6,
                confidence: 0.74,
              })}
              initialReview={{ decision: 'pending' }}
            />
          </div>
          <div>
            <p className="state-label">Conflicting values — unresolved (two legitimate definitions)</p>
            <FieldRowDemo field={conflictField} initialReview={{ decision: 'pending' }} />
          </div>
          <div>
            <p className="state-label">Conflicting values — resolved by analyst</p>
            <FieldRowDemo
              field={{ ...conflictField, id: 'total-debt-resolved' }}
              initialReview={{ decision: 'edited', editedValue: '24,750', resolvedCandidate: '24,750' }}
            />
          </div>
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Edit field dialog</h2>
        <Button variant="secondary" onClick={() => setDialogOpen(true)}>
          Open edit dialog
        </Button>
        <EditFieldDialog
          open={dialogOpen}
          fieldId="demo-net-sales"
          fieldLabel="Net sales"
          currentValue="6210800"
          unit="USD"
          sourceQuote="Net sales ........................................... $ 6,210,800"
          onSave={() => setDialogOpen(false)}
          onClose={() => setDialogOpen(false)}
        />
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Error banner</h2>
        <ErrorBanner
          message="Extraction job lost connection to the document service before finishing."
          receivedCount={5}
          totalCount={9}
          onRetry={() => {}}
        />
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Empty state</h2>
        <EmptyState
          title="No extraction in progress"
          description="Run the extraction model against this borrower's financial statements to begin review."
          actionLabel="Run extraction"
          onAction={() => {}}
        />
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Document header</h2>
        <div className="component-grid">
          <div>
            <p className="state-label">Streaming, nothing decided yet</p>
            <DocumentHeader
              borrowerName="Halvorsen Marine Supply, LLC"
              periodEnd="2025-06-30"
              provenance={demoProvenance}
              figuresInThousands={true}
              status="streaming"
              receivedCount={4}
              totalCount={9}
              decidedCount={0}
              canApprove={false}
              approved={false}
              onApprove={() => {}}
            />
          </div>
          <div>
            <p className="state-label">Complete, fully reviewed, ready to approve</p>
            <DocumentHeader
              borrowerName="Halvorsen Marine Supply, LLC"
              periodEnd="2025-06-30"
              provenance={demoProvenance}
              figuresInThousands={true}
              status="complete"
              receivedCount={9}
              totalCount={9}
              decidedCount={9}
              canApprove={true}
              approved={false}
              onApprove={() => {}}
            />
          </div>
          <div>
            <p className="state-label">Approved</p>
            <DocumentHeader
              borrowerName="Halvorsen Marine Supply, LLC"
              periodEnd="2025-06-30"
              provenance={demoProvenance}
              figuresInThousands={true}
              status="complete"
              receivedCount={9}
              totalCount={9}
              decidedCount={9}
              canApprove={true}
              approved={true}
              onApprove={() => {}}
            />
          </div>
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Live streaming demo</h2>
        <p className="system-page__intro">
          Drives the same simulator used on the Review page. Use the control below to try the
          success, slow, and failure paths.
        </p>
        <LiveStreamDemo />
      </section>
    </div>
  );
}
