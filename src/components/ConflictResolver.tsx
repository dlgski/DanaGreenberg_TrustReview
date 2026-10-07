import type { ExtractionCandidate } from '../lib/types';
import './ConflictResolver.css';

interface ConflictResolverProps {
  fieldId: string;
  originalValue: string;
  originalQuote: string | null;
  originalPage?: number;
  unit?: string;
  candidates: ExtractionCandidate[];
  resolvedValue?: string;
  onResolve: (value: string) => void;
}

export function ConflictResolver({
  fieldId,
  originalValue,
  originalQuote,
  originalPage,
  unit,
  candidates,
  resolvedValue,
  onResolve,
}: ConflictResolverProps) {
  const options = [
    { value: originalValue, quote: originalQuote, page: originalPage },
    ...candidates.map((c) => ({ value: c.value, quote: c.sourceQuote, page: c.page })),
  ];

  return (
    <fieldset className="conflict-resolver">
      <legend className="conflict-resolver__legend">
        The model found more than one value for this field in the document. Choose the one that
        applies.
      </legend>
      {options.map((option, index) => (
        <label className="conflict-resolver__option" key={index}>
          <input
            type="radio"
            name={`conflict-${fieldId}`}
            value={option.value}
            checked={resolvedValue === option.value}
            onChange={() => onResolve(option.value)}
          />
          <span className="conflict-resolver__option-body">
            <span className="conflict-resolver__value">
              {option.value || '(empty)'} {unit}
            </span>
            <span className="conflict-resolver__source">
              {option.page ? `Page ${option.page}: ` : ''}
              {option.quote ?? '(no source cited)'}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
