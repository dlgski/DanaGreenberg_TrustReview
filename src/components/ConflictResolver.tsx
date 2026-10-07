import type { ExtractionCandidate } from '../lib/types';
import './ConflictResolver.css';

interface ConflictResolverProps {
  fieldId: string;
  fieldLabel: string;
  originalValue: string;
  originalQuote: string | null;
  originalPage?: number;
  candidates: ExtractionCandidate[];
  /** Reference code for each option, original first. null when its quote wasn't found. */
  codes: (string | null)[];
  resolvedValue?: string;
  onResolve: (value: string) => void;
}

export function ConflictResolver({
  fieldId,
  fieldLabel,
  originalValue,
  originalQuote,
  originalPage,
  candidates,
  codes,
  resolvedValue,
  onResolve,
}: ConflictResolverProps) {
  const options = [
    { value: originalValue, quote: originalQuote, page: originalPage },
    ...candidates.map((c) => ({ value: c.value, quote: c.sourceQuote, page: c.page })),
  ];

  return (
    <fieldset className="conflict-resolver">
      <legend className="visually-hidden">Choose the value for {fieldLabel}</legend>
      {options.map((option, index) => (
        <label className="conflict-resolver__option" key={index}>
          <input
            type="radio"
            name={`conflict-${fieldId}`}
            value={option.value}
            checked={resolvedValue === option.value}
            onChange={() => onResolve(option.value)}
          />
          <span className="conflict-resolver__source">
            {codes[index] ? <code className="conflict-resolver__code">{codes[index]}</code> : null}
            {option.quote ?? 'No source cited'}
            {option.page ? `, page ${option.page}` : ''}
          </span>
          <span className="conflict-resolver__value">{option.value || '(empty)'}</span>
        </label>
      ))}
    </fieldset>
  );
}
