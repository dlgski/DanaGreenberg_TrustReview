import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  allFields,
  figuresInThousands,
  isStreamScenario,
  provenance,
  sourcePages,
  TOTAL_FIELD_COUNT,
  type StreamScenario,
} from '../lib/streamExtraction';
import { assignReferenceCodes, findAllMismatches } from '../lib/sourceMatch';
import { useExtractionStream } from '../lib/useExtractionStream';
import { useFieldReviews } from '../lib/useFieldReviews';
import { NARROW_LAYOUT_QUERY, useMediaQuery } from '../lib/useMediaQuery';
import type { ExtractionField, FieldReviewState } from '../lib/types';
import { DocumentHeader } from '../components/DocumentHeader';
import { FieldRow, type DerivedInput } from '../components/FieldRow';
import { FieldSkeleton } from '../components/FieldSkeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import { ScenarioControl } from '../components/ScenarioControl';
import { SourcePanel } from '../components/SourcePanel';
import './ReviewPage.css';

// Codes come from the full extraction, not the fields received so far, so a field's
// code never changes while the job is still streaming.
const MISMATCHES = findAllMismatches(allFields, sourcePages);
const REFERENCES = assignReferenceCodes(allFields, sourcePages, MISMATCHES);
const FIELD_LABELS = Object.fromEntries(allFields.map((f) => [f.id, f.label]));
const FIELD_VALUES = Object.fromEntries(allFields.map((f) => [f.id, f.value]));

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

export function ReviewPage() {
  const [scenario, setScenario] = useState<StreamScenario>(readScenarioFromUrl);
  const { status, fields, errorMessage, begin, retry, attempt } = useExtractionStream(scenario);
  const { confirm, reject, edit, resolveCandidate, getDecision } = useFieldReviews(attempt);
  const [approved, setApproved] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [activeSourceFieldId, setActiveSourceFieldId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerOpenerRef = useRef<HTMLElement | null>(null);
  const isNarrow = useMediaQuery(NARROW_LAYOUT_QUERY);

  // A new attempt starts a fresh review: nothing approved, nothing shown in the source.
  useEffect(() => {
    setApproved(false);
    setActiveSourceFieldId(null);
    setDrawerOpen(false);
  }, [attempt]);

  useEffect(() => {
    if (!isNarrow) setDrawerOpen(false);
  }, [isNarrow]);

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
  const receivedFieldIds = useMemo(() => new Set(fields.map((f) => f.id)), [fields]);

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

  function handleShowSource(fieldId: string) {
    if (isNarrow) {
      // In drawer mode the reference always opens the drawer; Close returns focus here.
      drawerOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setActiveSourceFieldId(fieldId);
      setDrawerOpen(true);
      return;
    }
    setActiveSourceFieldId((current) => (current === fieldId ? null : fieldId));
  }

  function closeDrawer() {
    // Commit first: the fields are inert while the drawer is open and can't take focus until then.
    flushSync(() => setDrawerOpen(false));
    drawerOpenerRef.current?.focus();
  }

  return (
    <div className="review-page">
      <div className="review-page__dev-control" inert={drawerOpen}>
        <ScenarioControl value={scenario} onChange={handleScenarioChange} />
      </div>

      <div className="visually-hidden" aria-live="polite">
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
        <div className="review-page__region">
          <div inert={drawerOpen}>
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
          </div>

          <div className="review-page__split">
            <section className="review-page__fields" aria-label="Extracted fields" inert={drawerOpen}>
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
                  onShowSource={() => handleShowSource(field.id)}
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
            </section>

            <SourcePanel
              pages={sourcePages}
              provenance={provenance}
              references={REFERENCES}
              fieldLabels={FIELD_LABELS}
              fieldValues={FIELD_VALUES}
              receivedFieldIds={receivedFieldIds}
              activeFieldId={activeSourceFieldId}
              drawerOpen={drawerOpen}
              onCloseDrawer={closeDrawer}
            />
          </div>
        </div>
      )}
    </div>
  );
}
