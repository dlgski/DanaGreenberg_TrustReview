export interface ExtractionCandidate {
  value: string;
  sourceQuote: string | null;
  page?: number;
}

export interface DerivedInfo {
  formula: string;
  /** Field ids the formula reads, in formula order. */
  inputIds: string[];
  inputLabels: string[];
}

export interface ExtractionField {
  id: string;
  label: string;
  /** '' means the model found no value at all. */
  value: string;
  unit?: string;
  /** null means the model cited no evidence for this field at all — either because
   * nothing was found, or (more dangerously) because it reported a value anyway. */
  sourceQuote: string | null;
  page?: number;
  /** Raw model-reported confidence for this single field, 0-1, or null when not
   * applicable (e.g. nothing was found). Shown as a plain-language flag (e.g. "model
   * was unsure"), never as a ranking score and never used to auto-approve. */
  confidence: number | null;
  status?: 'not_found';
  /** Present when the model found more than one candidate value for this field. */
  candidates?: ExtractionCandidate[];
  /** Present when this field is computed from other fields rather than read from the
   * document — a null sourceQuote on a derived field is expected, not a red flag. */
  derived?: DerivedInfo;
}

export interface SourcePage {
  page: number;
  text: string;
}

export interface ExtractionProvenance {
  filename: string;
  pageCount: number;
  model: string;
  completedAt: string;
}

export type FieldDecision = 'pending' | 'confirmed' | 'edited' | 'rejected';

export interface FieldReviewState {
  decision: FieldDecision;
  editedValue?: string;
  resolvedCandidate?: string;
  reviewedAt?: string;
}

// 'partial' is not its own status — it's the UI's description of a document
// where fields.length < expected total, which can be true while streaming
// (normal, still in progress) or while failed (stopped early, won't resume
// without a retry). Keeping it derived avoids two sources of truth.
export type JobStatus = 'idle' | 'streaming' | 'complete' | 'failed';

export interface StreamEvent {
  type: 'field' | 'done' | 'error';
  field?: ExtractionField;
  message?: string;
}
