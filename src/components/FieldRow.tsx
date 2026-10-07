import { useState } from 'react';
import type { ExtractionField, FieldReviewState } from '../lib/types';
import { Badge } from './Badge';
import { Button } from './Button';
import { SourceEvidence } from './SourceEvidence';
import { ConflictResolver } from './ConflictResolver';
import { EditFieldDialog } from './EditFieldDialog';
import './FieldRow.css';

const LOW_CONFIDENCE_THRESHOLD = 0.75;
const PROSE_LENGTH_THRESHOLD = 60;

interface FieldRowProps {
  field: ExtractionField;
  review: FieldReviewState;
  onConfirm: () => void;
  onReject: () => void;
  onEdit: (value: string) => void;
  onResolveCandidate: (value: string) => void;
}

function decisionBadge(review: FieldReviewState) {
  switch (review.decision) {
    case 'confirmed':
      return <Badge variant="success">Confirmed</Badge>;
    case 'edited':
      return <Badge variant="info">Edited</Badge>;
    case 'rejected':
      return <Badge variant="danger">Rejected</Badge>;
    default:
      return <Badge variant="neutral">Needs review</Badge>;
  }
}

export function FieldRow({ field, review, onConfirm, onReject, onEdit, onResolveCandidate }: FieldRowProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasCandidates = Boolean(field.candidates && field.candidates.length > 0);
  const isDerived = Boolean(field.derived);
  const isMissing = field.value === '';
  // A value with no citation at all — distinct from "nothing was found" (isMissing)
  // and from a derived field (where no citation is expected, since it's calculated).
  const isUngrounded = !isMissing && !isDerived && !hasCandidates && field.sourceQuote === null;
  const isLowConfidence =
    !hasCandidates && !isMissing && field.confidence !== null && field.confidence < LOW_CONFIDENCE_THRESHOLD;
  const isProse = !field.unit && !isMissing && field.value.length > PROSE_LENGTH_THRESHOLD;
  // Nothing to verify a value against means Confirm can't honestly mean "I checked this."
  const canConfirm = !hasCandidates && !isMissing && !isUngrounded;

  const displayValue = review.decision === 'edited' ? (review.editedValue ?? '') : field.value;

  return (
    <article className={`field-row field-row--${review.decision}`} aria-label={field.label}>
      <div className="field-row__top">
        <h3 className="field-row__label">{field.label}</h3>
        <div className="field-row__badges">
          {hasCandidates ? <Badge variant="caution">Conflicting values</Badge> : null}
          {isMissing ? <Badge variant="caution">Not found in document</Badge> : null}
          {isUngrounded ? <Badge variant="danger">No source cited</Badge> : null}
          {isDerived ? <Badge variant="info">Calculated</Badge> : null}
          {isLowConfidence ? <Badge variant="caution">Model was unsure</Badge> : null}
          {decisionBadge(review)}
        </div>
      </div>

      <div className={`field-row__value ${isProse ? 'field-row__value--prose' : ''}`}>
        {isMissing && review.decision !== 'edited' ? (
          <span className="field-row__empty">No value extracted</span>
        ) : (
          <span className={isProse ? 'field-row__value-prose' : 'field-row__value-text'}>
            {displayValue} {field.unit}
          </span>
        )}
        {review.decision === 'edited' ? (
          <span className="field-row__original">
            Model extracted: {field.value || '(empty)'} {field.unit}
          </span>
        ) : null}
      </div>

      {isDerived ? (
        <p className="field-row__derived">
          Calculated, not read from the document — <code>{field.derived!.formula}</code> using{' '}
          {field.derived!.inputLabels.join(' and ')}. Confirming this means confirming the
          arithmetic and its inputs, not matching it against source text.
        </p>
      ) : (
        <SourceEvidence
          quote={field.sourceQuote}
          page={field.page}
          missingMessage={isUngrounded ? 'The model did not cite any source for this value.' : undefined}
        />
      )}

      {hasCandidates ? (
        <ConflictResolver
          fieldId={field.id}
          originalValue={field.value}
          originalQuote={field.sourceQuote}
          originalPage={field.page}
          unit={field.unit}
          candidates={field.candidates ?? []}
          resolvedValue={review.decision === 'confirmed' ? field.value : review.editedValue}
          onResolve={onResolveCandidate}
        />
      ) : null}

      <div className="field-row__actions">
        {canConfirm ? (
          <Button variant="primary" onClick={onConfirm} disabled={review.decision === 'confirmed'}>
            Confirm
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => setDialogOpen(true)}>
          Edit
        </Button>
        <Button variant="danger" onClick={onReject} disabled={review.decision === 'rejected'}>
          Reject
        </Button>
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
