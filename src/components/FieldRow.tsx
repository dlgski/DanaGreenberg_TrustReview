import { useState } from 'react';
import type { ExtractionField, FieldReviewState } from '../lib/types';
import { isUngrounded, type LabelMismatch, type SourceCitation } from '../lib/sourceMatch';
import { Button } from './Button';
import { ConflictResolver } from './ConflictResolver';
import { EditFieldDialog } from './EditFieldDialog';
import { Flag } from './Flag';
import { ReferenceButton } from './ReferenceButton';
import { TickMark } from './TickMark';
import { VarianceSchedule } from './VarianceSchedule';
import './FieldRow.css';

const LOW_CONFIDENCE_THRESHOLD = 0.75;
const PROSE_LENGTH_THRESHOLD = 60;
/** Values up to this long sit right-aligned on the label's line, like a statement figure. */
const FIGURE_LENGTH_THRESHOLD = 16;

export interface DerivedInput {
  label: string;
  value: string | null;
}

interface FieldRowProps {
  field: ExtractionField;
  review: FieldReviewState;
  citations: SourceCitation[];
  mismatch: LabelMismatch | null;
  /** Current values of a calculated field's inputs, in formula order. */
  derivedInputs?: DerivedInput[];
  figuresInThousands: boolean;
  isShowingSource: boolean;
  /** Receives the clicked button so the page can return focus to it. */
  onShowSource: (opener: HTMLElement) => void;
  onConfirm: () => void;
  onReject: () => void;
  onEdit: (value: string) => void;
  onResolveCandidate: (value: string) => void;
}

interface RiskFlagProps {
  mismatch: boolean;
  ungrounded: boolean;
  hasCandidates: boolean;
  isMissing: boolean;
  isDerived: boolean;
  isLowConfidence: boolean;
}

/** At most one flag per field, most serious first. */
function RiskFlag({ mismatch, ungrounded, hasCandidates, isMissing, isDerived, isLowConfidence }: RiskFlagProps) {
  if (mismatch) return <Flag tone="danger" icon="warning">Doesn't match the document</Flag>;
  if (ungrounded) return <Flag tone="danger" icon="warning">No source cited</Flag>;
  if (hasCandidates) return <Flag tone="caution" icon="split">Two possible values</Flag>;
  if (isMissing) return <Flag tone="caution" icon="warning">Not found</Flag>;
  if (isDerived) return <Flag tone="info" icon="calculator">Calculated, not read from the document</Flag>;
  if (isLowConfidence) return <Flag tone="caution" icon="warning">Model was unsure</Flag>;
  return null;
}

export function FieldRow({
  field,
  review,
  citations,
  mismatch,
  derivedInputs,
  figuresInThousands,
  isShowingSource,
  onShowSource,
  onConfirm,
  onReject,
  onEdit,
  onResolveCandidate,
}: FieldRowProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasCandidates = Boolean(field.candidates && field.candidates.length > 0);
  const isDerived = Boolean(field.derived);
  const isMissing = field.value === '';
  const ungrounded = isUngrounded(field);
  const isLowConfidence =
    !hasCandidates && !isMissing && field.confidence !== null && field.confidence < LOW_CONFIDENCE_THRESHOLD;
  const isProse = !field.unit && !isMissing && field.value.length > PROSE_LENGTH_THRESHOLD;
  // Nothing to verify a value against means Confirm can't honestly mean "I checked this."
  const canConfirm = !hasCandidates && !isMissing && !ungrounded;

  const displayValue = review.decision === 'edited' ? (review.editedValue ?? '') : field.value;
  const showsEmpty = isMissing && review.decision !== 'edited';
  const isFigure = !showsEmpty && !isProse && displayValue.length <= FIGURE_LENGTH_THRESHOLD;
  const unitLabel = field.unit === 'USD' && figuresInThousands ? 'USD thousands' : field.unit;

  const codes = citations.map((c) => c.code).filter((c): c is string => c !== null);
  const optionCodes = [field.value, ...(field.candidates ?? [])].map(
    (_, i) => citations.find((c) => c.option === i + 1)?.code ?? null,
  );
  const referenceLabel = mismatch
    ? `Show the line on page ${mismatch.page}`
    : citations.length === 2
      ? 'Show both in source'
      : citations.length > 2
        ? 'Show all in source'
        : 'Show in source';
  const editLabel = isMissing ? 'Add value' : mismatch ? 'Edit value' : 'Edit';

  const inputs = isDerived
    ? (derivedInputs ?? field.derived!.inputLabels.map((label) => ({ label, value: null })))
    : [];

  const classes = ['field-row', `field-row--${review.decision}`, isShowingSource ? 'field-row--active' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={classes} aria-label={field.label}>
      <div className="field-row__tick">
        <TickMark decision={review.decision} />
      </div>

      <div className="field-row__body">
        <div className="field-row__line">
          <h3 className="field-row__label">{field.label}</h3>
          {isFigure ? (
            <p className="field-row__figure">
              {displayValue}
              {unitLabel ? <span className="field-row__unit">{unitLabel}</span> : null}
            </p>
          ) : null}
        </div>

        {showsEmpty ? <p className="field-row__empty">The model found no value for this field.</p> : null}
        {!showsEmpty && !isFigure ? (
          <p className={isProse ? 'field-row__prose' : 'field-row__text'}>{displayValue}</p>
        ) : null}
        {review.decision === 'edited' ? (
          <p className="field-row__original">
            Model extracted: {field.value || '(empty)'}
            {unitLabel ? ` ${unitLabel}` : ''}
          </p>
        ) : null}

        <RiskFlag
          mismatch={mismatch !== null}
          ungrounded={ungrounded}
          hasCandidates={hasCandidates}
          isMissing={isMissing}
          isDerived={isDerived}
          isLowConfidence={isLowConfidence}
        />

        {isDerived ? (
          <p className="field-row__derived">
            Calculated as <code>{field.derived!.formula}</code> from{' '}
            {inputs.map((input, i) => (
              <span key={input.label}>
                <strong>{input.label}</strong>
                {input.value ? ` ${input.value}` : ''}
                {i < inputs.length - 1 ? ' and ' : ''}
              </span>
            ))}
            . Confirm the math and {inputs.length === 2 ? 'both inputs' : 'its inputs'}.
          </p>
        ) : null}

        {mismatch ? (
          <VarianceSchedule
            fieldLabel={field.label}
            extractedValue={field.value}
            documentValue={mismatch.documentValue}
            documentSource={`${mismatch.pageTitle}, page ${mismatch.page}`}
            difference={mismatch.difference}
            code={codes[0] ?? `on page ${mismatch.page}`}
          />
        ) : null}

        {hasCandidates ? (
          <ConflictResolver
            fieldId={field.id}
            fieldLabel={field.label}
            originalValue={field.value}
            originalQuote={field.sourceQuote}
            originalPage={field.page}
            candidates={field.candidates ?? []}
            codes={optionCodes}
            resolvedValue={review.decision === 'confirmed' ? field.value : review.editedValue}
            onResolve={onResolveCandidate}
          />
        ) : null}

        <div className="field-row__foot">
          {citations.length > 0 ? (
            <ReferenceButton
              codes={codes}
              label={referenceLabel}
              tone={mismatch ? 'red' : 'blue'}
              pressed={isShowingSource}
              onClick={(event) => onShowSource(event.currentTarget)}
            />
          ) : (
            <span className="field-row__no-source">No source line</span>
          )}
          <div className="field-row__actions">
            <Button variant="text" onClick={onReject} disabled={review.decision === 'rejected'}>
              Reject
            </Button>
            <Button variant="quiet" onClick={() => setDialogOpen(true)}>
              {editLabel}
            </Button>
            {canConfirm ? (
              <Button variant="primary" onClick={onConfirm} disabled={review.decision === 'confirmed'}>
                Confirm
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <EditFieldDialog
        open={dialogOpen}
        fieldId={field.id}
        fieldLabel={field.label}
        currentValue={displayValue}
        unit={field.unit}
        sourceQuote={field.sourceQuote}
        onSave={(value) => {
          onEdit(value);
          setDialogOpen(false);
        }}
        onClose={() => setDialogOpen(false)}
      />
    </article>
  );
}
