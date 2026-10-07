import { useState } from 'react';
import { Button } from '../components/Button';
import { ConflictResolver } from '../components/ConflictResolver';
import { DocumentHeader } from '../components/DocumentHeader';
import { EditFieldDialog } from '../components/EditFieldDialog';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { FieldRow } from '../components/FieldRow';
import { FieldSkeleton } from '../components/FieldSkeleton';
import { Flag } from '../components/Flag';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { ReferenceButton } from '../components/ReferenceButton';
import { ScenarioControl } from '../components/ScenarioControl';
import { SourcePanel } from '../components/SourcePanel';
import { TickMark } from '../components/TickMark';
import { VarianceSchedule } from '../components/VarianceSchedule';
import { assignReferenceCodes, findAllMismatches, type LabelMismatch, type SourceCitation } from '../lib/sourceMatch';
import { allFields, provenance, sourcePages, TOTAL_FIELD_COUNT, type StreamScenario } from '../lib/streamExtraction';
import type { ExtractionField, FieldDecision, FieldReviewState } from '../lib/types';
import { useExtractionStream } from '../lib/useExtractionStream';
import './SystemPage.css';

const COLOR_TOKENS = [
  'graphite', 'graphite-2', 'graphite-3', 'region', 'card', 'option', 'line', 'input-border',
  'ledger', 'ledger-line', 'ledger-text', 'ledger-code',
  'pencil-blue', 'blue-wash', 'pencil-red', 'red-wash', 'red-ink', 'ochre', 'tick-pending',
];

const TYPE_TOKENS = ['text-2xs', 'text-xs', 'text-sm', 'text-base', 'text-md', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'];

const RADIUS_TOKENS = ['radius-region', 'radius-panel', 'radius-card', 'radius-option', 'radius-control', 'radius-code'];

const DECISIONS: FieldDecision[] = ['pending', 'confirmed', 'edited', 'rejected'];

const MISMATCHES = findAllMismatches(allFields, sourcePages);
const REFERENCES = assignReferenceCodes(allFields, sourcePages, MISMATCHES);
const FIELD_LABELS = Object.fromEntries(allFields.map((f) => [f.id, f.label]));
const FIELD_VALUES = Object.fromEntries(allFields.map((f) => [f.id, f.value]));
const ALL_FIELD_IDS = new Set(allFields.map((f) => f.id));
const PANEL_DEMO_FIELDS = ['total_revenue', 'total_debt', 'net_income', 'covenant_summary'];

const CITE_3A: SourceCitation[] = [{ page: 3, lineIndexes: [2], code: '3a', kind: 'cite', option: null }];
const DEBT_OPTIONS: SourceCitation[] = [
  { page: 4, lineIndexes: [8], code: '4a', kind: 'option', option: 1 },
  { page: 6, lineIndexes: [4], code: '6b', kind: 'option', option: 2 },
];
const NET_INCOME_CITATION: SourceCitation[] = [{ page: 3, lineIndexes: [10], code: '3b', kind: 'mismatch', option: null }];
const NET_INCOME_MISMATCH: LabelMismatch = {
  page: 3,
  lineIndex: 10,
  documentValue: '1,904',
  difference: 406,
  pageTitle: 'Consolidated statement of operations',
};

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

const CONFLICT_FIELD = sampleField({
  id: 'total_debt',
  label: 'Total debt',
  value: '21,500',
  sourceQuote: 'Total long-term debt 21,500',
  page: 4,
  confidence: 0.62,
  candidates: [{ value: '24,750', sourceQuote: 'Total debt, including current portion 24,750', page: 6 }],
});

function FieldRowDemo({
  field,
  initialReview,
  citations = [],
  mismatch = null,
}: {
  field: ExtractionField;
  initialReview: FieldReviewState;
  citations?: SourceCitation[];
  mismatch?: LabelMismatch | null;
}) {
  const [review, setReview] = useState<FieldReviewState>(initialReview);
  const [showing, setShowing] = useState(false);
  return (
    <FieldRow
      field={field}
      review={review}
      citations={citations}
      mismatch={mismatch}
      figuresInThousands
      isShowingSource={showing}
      onShowSource={() => setShowing((s) => !s)}
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

function SourcePanelDemo() {
  const [active, setActive] = useState<string | null>('net_income');
  return (
    <div className="component-grid">
      <div className="component-row">
        {PANEL_DEMO_FIELDS.map((id) => (
          <ReferenceButton
            key={id}
            codes={(REFERENCES.byField[id] ?? []).flatMap((c) => (c.code ? [c.code] : []))}
            label={FIELD_LABELS[id]}
            pressed={active === id}
            tone={MISMATCHES[id] ? 'red' : 'blue'}
            onClick={() => setActive((current) => (current === id ? null : id))}
          />
        ))}
      </div>
      <p className="state-label">On screens 1000px wide and under this panel becomes the drawer, so it is hidden here.</p>
      <div className="system-page__panel-demo">
        <SourcePanel
          pages={sourcePages}
          provenance={provenance}
          references={REFERENCES}
          fieldLabels={FIELD_LABELS}
          fieldValues={FIELD_VALUES}
          receivedFieldIds={ALL_FIELD_IDS}
          activeFieldId={active}
          drawerOpen={false}
          onCloseDrawer={() => {}}
        />
      </div>
    </div>
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
            <ErrorBanner message={errorMessage} receivedCount={fields.length} totalCount={TOTAL_FIELD_COUNT} onRetry={retry} />
          ) : null}
          <p className="state-label">
            Last received: {fields.slice(-3).map((f) => f.label).join(', ') || 'nothing yet'}
            {status === 'complete' ? '. Done.' : ''}
          </p>
        </>
      )}
    </div>
  );
}

export function SystemPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="system-page">
      <div>
        <h1 className="system-page__title">Design system</h1>
        <p className="system-page__intro">
          The interface borrows from audit workpapers: a pencil tick for every decision, a page-and-letter
          code tying each figure to its source line, and a variance when the two disagree. Components use
          these tokens through <code>var(--token-name)</code> only.
        </p>
      </div>

      <section className="system-section">
        <h2 className="system-section__title">Color</h2>
        <div className="swatch-grid">
          {COLOR_TOKENS.map((token) => (
            <div className="swatch" key={token}>
              <div className="swatch__fill" style={{ background: `var(--color-${token})` }} />
              <div className="swatch__label">{token}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Type</h2>
        <p className="system-page__intro">
          Libre Franklin for the interface and figures. Courier Prime for the source document and reference codes.
        </p>
        {TYPE_TOKENS.map((token) => (
          <div className="type-row" key={token}>
            <span className="type-row__name">{token}</span>
            <span style={{ fontSize: `var(--${token})` }}>Net sales 48,213</span>
          </div>
        ))}
        <p className="type-row__doc">Adjusted EBITDA (see Note 7) 6,120</p>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Radius by level</h2>
        <div className="radius-row">
          {RADIUS_TOKENS.map((token) => (
            <div className="radius-sample" key={token} style={{ borderRadius: `var(--${token})` }}>
              {token}
            </div>
          ))}
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Tick marks</h2>
        <div className="component-row">
          {DECISIONS.map((d) => (
            <div className="tick-sample" key={d}>
              <TickMark decision={d} />
              <span className="state-label">{d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Flags</h2>
        <div className="component-row">
          <Flag tone="danger" icon="warning">Doesn't match the document</Flag>
          <Flag tone="danger" icon="warning">No source cited</Flag>
          <Flag tone="caution" icon="split">Two possible values</Flag>
          <Flag tone="caution" icon="warning">Not found</Flag>
          <Flag tone="info" icon="calculator">Calculated, not read from the document</Flag>
          <Flag tone="caution" icon="warning">Model was unsure</Flag>
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Buttons and references</h2>
        <div className="component-row">
          <Button variant="text">Reject</Button>
          <Button variant="quiet">Edit</Button>
          <Button variant="primary">Confirm</Button>
          <Button variant="primary" disabled>Confirmed</Button>
          <Button variant="primary" size="large">Approve extraction</Button>
        </div>
        <div className="component-row">
          <ReferenceButton codes={['3a']} label="Show in source" pressed={false} onClick={() => {}} />
          <ReferenceButton codes={['3a']} label="Show in source" pressed onClick={() => {}} />
          <ReferenceButton codes={['4a', '6b']} label="Show both in source" pressed={false} onClick={() => {}} />
          <ReferenceButton codes={['3b']} label="Show the line on page 3" pressed tone="red" onClick={() => {}} />
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Variance and conflict options</h2>
        <VarianceSchedule
          fieldLabel="Net income"
          extractedValue="2,310"
          documentValue="1,904"
          documentSource="Consolidated statement of operations, page 3"
          difference={406}
          code="3b"
        />
        <ConflictResolver
          fieldId="demo-debt"
          fieldLabel="Total debt"
          originalValue="21,500"
          originalQuote="Total long-term debt 21,500"
          originalPage={4}
          candidates={[{ value: '24,750', sourceQuote: 'Total debt, including current portion 24,750', page: 6 }]}
          codes={['4a', '6b']}
          onResolve={() => {}}
        />
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Field card, every state</h2>
        <div className="component-grid component-grid--cards">
          <div>
            <p className="state-label">Loading</p>
            <FieldSkeleton />
          </div>
          <div>
            <p className="state-label">Not reviewed</p>
            <FieldRowDemo field={sampleField()} initialReview={{ decision: 'pending' }} citations={CITE_3A} />
          </div>
          <div>
            <p className="state-label">Confirmed</p>
            <FieldRowDemo field={sampleField({ id: 'confirmed' })} initialReview={{ decision: 'confirmed' }} citations={CITE_3A} />
          </div>
          <div>
            <p className="state-label">Edited</p>
            <FieldRowDemo
              field={sampleField({ id: 'edited' })}
              initialReview={{ decision: 'edited', editedValue: '49,800' }}
              citations={CITE_3A}
            />
          </div>
          <div>
            <p className="state-label">Rejected</p>
            <FieldRowDemo field={sampleField({ id: 'rejected' })} initialReview={{ decision: 'rejected' }} citations={CITE_3A} />
          </div>
          <div>
            <p className="state-label">Short text value</p>
            <FieldRowDemo
              field={sampleField({ id: 'name', label: 'Borrower legal name', value: 'Halvorsen Marine Supply, LLC', unit: undefined, sourceQuote: 'Halvorsen Marine Supply, LLC and Subsidiary', page: 1 })}
              initialReview={{ decision: 'pending' }}
              citations={[{ page: 1, lineIndexes: [0], code: '1a', kind: 'cite', option: null }]}
            />
          </div>
          <div>
            <p className="state-label">Model was unsure</p>
            <FieldRowDemo
              field={sampleField({ id: 'low-confidence', label: 'Fiscal year end', value: '2025-06-30', unit: undefined, sourceQuote: 'for the fiscal year ended June 30, 2025', page: 1, confidence: 0.41 })}
              initialReview={{ decision: 'pending' }}
              citations={[{ page: 1, lineIndexes: [2], code: '1b', kind: 'cite', option: null }]}
            />
          </div>
          <div>
            <p className="state-label">Not found</p>
            <FieldRowDemo
              field={sampleField({ id: 'missing', label: 'Guarantor', value: '', unit: undefined, sourceQuote: null, page: undefined, confidence: null, status: 'not_found' })}
              initialReview={{ decision: 'pending' }}
            />
          </div>
          <div>
            <p className="state-label">Doesn't match the document</p>
            <FieldRowDemo
              field={sampleField({ id: 'net-income', label: 'Net income', value: '2,310', sourceQuote: null, page: undefined, confidence: 0.88 })}
              initialReview={{ decision: 'pending' }}
              citations={NET_INCOME_CITATION}
              mismatch={NET_INCOME_MISMATCH}
            />
          </div>
          <div>
            <p className="state-label">No source cited, nothing to compare with</p>
            <FieldRowDemo
              field={sampleField({ id: 'ungrounded', label: 'Interest coverage', value: '3.2', unit: undefined, sourceQuote: null, page: undefined, confidence: 0.8 })}
              initialReview={{ decision: 'pending' }}
            />
          </div>
          <div>
            <p className="state-label">Calculated</p>
            <FieldRowDemo
              field={sampleField({
                id: 'derived',
                label: 'Debt service coverage ratio',
                value: '1.42',
                unit: undefined,
                sourceQuote: null,
                page: undefined,
                confidence: 0.9,
                derived: { formula: 'ebitda / annual_debt_service', inputLabels: ['EBITDA', 'Annual debt service'] },
              })}
              initialReview={{ decision: 'pending' }}
            />
          </div>
          <div>
            <p className="state-label">Narrative value</p>
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
              citations={[{ page: 6, lineIndexes: [0], code: '6a', kind: 'cite', option: null }]}
            />
          </div>
          <div>
            <p className="state-label">Two possible values, unresolved</p>
            <FieldRowDemo field={CONFLICT_FIELD} initialReview={{ decision: 'pending' }} citations={DEBT_OPTIONS} />
          </div>
          <div>
            <p className="state-label">Two possible values, resolved</p>
            <FieldRowDemo
              field={{ ...CONFLICT_FIELD, id: 'total-debt-resolved' }}
              initialReview={{ decision: 'edited', editedValue: '24,750', resolvedCandidate: '24,750' }}
              citations={DEBT_OPTIONS}
            />
          </div>
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Source panel</h2>
        <SourcePanelDemo />
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Document header</h2>
        <div className="component-grid">
          <div className="system-page__region">
            <p className="state-label">Streaming, nothing decided yet</p>
            <DocumentHeader
              borrowerName="Halvorsen Marine Supply, LLC"
              periodEnd="2025-06-30"
              figuresInThousands
              status="streaming"
              totalCount={10}
              decisions={['pending', 'pending', 'pending', 'pending']}
              canApprove={false}
              approved={false}
              onApprove={() => {}}
            />
          </div>
          <div className="system-page__region">
            <p className="state-label">Complete, partly reviewed</p>
            <DocumentHeader
              borrowerName="Halvorsen Marine Supply, LLC"
              periodEnd="2025-06-30"
              figuresInThousands
              status="complete"
              totalCount={10}
              decisions={['rejected', 'confirmed', 'confirmed', 'edited', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending']}
              canApprove={false}
              approved={false}
              onApprove={() => {}}
            />
          </div>
          <div className="system-page__region">
            <p className="state-label">Complete, every field ticked, ready to approve</p>
            <DocumentHeader
              borrowerName="Halvorsen Marine Supply, LLC"
              periodEnd="2025-06-30"
              figuresInThousands
              status="complete"
              totalCount={10}
              decisions={['confirmed', 'confirmed', 'edited', 'confirmed', 'rejected', 'confirmed', 'edited', 'confirmed', 'confirmed', 'confirmed']}
              canApprove
              approved={false}
              onApprove={() => {}}
            />
          </div>
          <div className="system-page__region">
            <p className="state-label">Approved</p>
            <DocumentHeader
              borrowerName="Halvorsen Marine Supply, LLC"
              periodEnd="2025-06-30"
              figuresInThousands
              status="complete"
              totalCount={10}
              decisions={['confirmed', 'confirmed', 'confirmed', 'confirmed', 'edited', 'edited', 'confirmed', 'confirmed', 'rejected', 'confirmed']}
              canApprove
              approved
              onApprove={() => {}}
            />
          </div>
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Edit field dialog</h2>
        <div className="component-row">
          <Button variant="quiet" onClick={() => setDialogOpen(true)}>
            Open edit dialog
          </Button>
        </div>
        <EditFieldDialog
          open={dialogOpen}
          fieldId="demo-net-sales"
          fieldLabel="Total revenue"
          currentValue="48,213"
          unit="USD"
          sourceQuote="Net sales 48,213"
          onSave={() => setDialogOpen(false)}
          onClose={() => setDialogOpen(false)}
        />
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Error banner</h2>
        <ErrorBanner
          message="Extraction job lost connection to the document service before finishing."
          receivedCount={6}
          totalCount={10}
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
        <h2 className="system-section__title">Live streaming demo</h2>
        <p className="system-page__intro">
          Drives the same simulator as the Review page. Use the control to try the success, slow and failure paths.
        </p>
        <LiveStreamDemo />
      </section>
    </div>
  );
}
