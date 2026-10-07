import { useEffect, useMemo, useState } from 'react';
import { allFields, sourcePages, provenance, figuresInThousands, TOTAL_FIELD_COUNT } from '../lib/streamExtraction';
import { isStreamScenario, type StreamScenario } from '../lib/streamExtraction';
import { useExtractionStream } from '../lib/useExtractionStream';
import { useFieldReviews } from '../lib/useFieldReviews';
import type { ExtractionField, FieldReviewState } from '../lib/types';
import { DocumentHeader } from '../components/DocumentHeader';
import { assignReferenceCodes, findAllMismatches } from '../lib/sourceMatch';
import { FieldRow } from '../components/FieldRow';
import type { DerivedInput } from '../components/FieldRow';
import { FieldSkeleton } from '../components/FieldSkeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { ScenarioControl } from '../components/ScenarioControl';
import './ReviewPage.css';

// Codes come from the full extraction, not the fields received so far, so a field's
// code never changes while the job is still streaming.
const MISMATCHES = findAllMismatches(allFields, sourcePages);
const REFERENCES = assignReferenceCodes(allFields, sourcePages, MISMATCHES);

function derivedInputsFor(
  field: ExtractionField,
  fields: ExtractionField[],
  getDecision: (id: string) => FieldReviewState,
): DerivedInput[] | undefined {
  if (!field.derived) return undefined;
  return field.derived.inputLabels.map((label) => {
    const input = fields.find((f) => f.label === label);
    return { label, value: input ? effectiveValue(fields, getDecision, input.id) || null : null };
  });
}

function readScenarioFromUrl(): StreamScenario {
  const param = new URLSearchParams(window.location.search).get('scenario');
  return isStreamScenario(param) ? param : 'success';
}

function effectiveValue(fields: ExtractionField[], getDecision: (id: string) => FieldReviewState, key: string) {
  const field = fields.find((f) => f.id === key);
  if (!field) return '';
  const review = getDecision(key);
  return review.decision === 'edited' ? (review.editedValue ?? '') : field.value;
}

export function ReviewPage() {
  const [scenario, setScenario] = useState<StreamScenario>(readScenarioFromUrl);
  const { status, fields, errorMessage, begin, retry, attempt } = useExtractionStream(scenario);
  const { confirm, reject, edit, resolveCandidate, getDecision } = useFieldReviews(attempt);
  const [approved, setApproved] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [activeSourceFieldId, setActiveSourceFieldId] = useState<string | null>(null);

  useEffect(() => {
    setApproved(false);
    setActiveSourceFieldId(null);
  }, [attempt]);

  useEffect(() => {
    if (status === 'streaming') {
      setAnnouncement(`${fields.length} of ${TOTAL_FIELD_COUNT} fields received.`);
    } else if (status === 'complete') {
      setAnnouncement('Extraction finished. All fields received.');
    } else if (status === 'failed') {
      setAnnouncement('Extraction job failed before finishing.');
    }
  }, [status, fields.length]);

  const decidedCount = useMemo(
    () => fields.filter((f) => getDecision(f.id).decision !== 'pending').length,
    [fields, getDecision],
  );

  const canApprove =
    status === 'complete' && fields.length === TOTAL_FIELD_COUNT && decidedCount === fields.length;

  const borrowerName = effectiveValue(fields, getDecision, 'borrower_legal_name');
  const periodEnd = effectiveValue(fields, getDecision, 'fiscal_year_end');

  function handleScenarioChange(next: StreamScenario) {
    setScenario(next);
    const url = new URL(window.location.href);
    url.searchParams.set('scenario', next);
    window.history.replaceState(null, '', url);
  }

  return (
    <div className="review-page">
      <div className="review-page__dev-control">
        <ScenarioControl value={scenario} onChange={handleScenarioChange} />
      </div>

      <div className="review-page__live-region" aria-live="polite">
        {announcement}
      </div>

      {status === 'idle' ? (
        <EmptyState
          title="No extraction in progress"
          description="Run the extraction model against this borrower's financial statements to begin review."
          actionLabel="Run extraction"
          onAction={begin}
        />
      ) : (
        <>
          <DocumentHeader
            borrowerName={borrowerName}
            periodEnd={periodEnd}
            provenance={provenance}
            figuresInThousands={figuresInThousands}
            status={status}
            receivedCount={fields.length}
            totalCount={TOTAL_FIELD_COUNT}
            decidedCount={decidedCount}
            canApprove={canApprove}
            approved={approved}
            onApprove={() => setApproved(true)}
          />

          {status === 'failed' && errorMessage ? (
            <ErrorBanner
              message={errorMessage}
              receivedCount={fields.length}
              totalCount={TOTAL_FIELD_COUNT}
              onRetry={retry}
            />
          ) : null}

          <div className="review-page__fields">
            {fields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                review={getDecision(field.id)}
                citations={REFERENCES.byField[field.id] ?? []}
                mismatch={MISMATCHES[field.id] ?? null}
                derivedInputs={derivedInputsFor(field, fields, getDecision)}
                figuresInThousands={figuresInThousands}
                isShowingSource={activeSourceFieldId === field.id}
                onShowSource={() => setActiveSourceFieldId((current) => (current === field.id ? null : field.id))}
                onConfirm={() => confirm(field.id)}
                onReject={() => reject(field.id)}
                onEdit={(value) => edit(field.id, value)}
                onResolveCandidate={(value) => resolveCandidate(field.id, value, field.value)}
              />
            ))}
            {status === 'streaming'
              ? Array.from({ length: TOTAL_FIELD_COUNT - fields.length }).map((_, i) => (
                  <FieldSkeleton key={`skeleton-${i}`} />
                ))
              : null}
          </div>

          <details className="review-page__full-source" id="full-source-viewer">
            <summary>
              View full source document ({provenance.pageCount} pages)
            </summary>
            {sourcePages.map((p) => (
              <section
                key={p.page}
                id={`source-page-${p.page}`}
                className="review-page__full-source-page"
              >
                <h3 className="review-page__full-source-heading">Page {p.page}</h3>
                <pre className="review-page__full-source-text">{p.text}</pre>
              </section>
            ))}
          </details>
        </>
      )}
    </div>
  );
}
