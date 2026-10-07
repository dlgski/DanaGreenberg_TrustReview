import raw from '../data/Halvorsen extraction.json';
import type { DerivedInfo, ExtractionField, ExtractionProvenance, SourcePage } from './types';

/**
 * Raw shape of Halvorsen extraction.json, as produced by the extraction model.
 * This is the only file that needs to change if a future extraction.json has a
 * different shape — everything downstream consumes the normalized ExtractionField[].
 */
interface RawSource {
  page: number;
  quote: string;
}

interface RawAlternate {
  value: string | number;
  source: RawSource | null;
}

interface RawDerived {
  formula: string;
  inputs: string[];
}

interface RawField {
  key: string;
  label: string;
  value: string | number | null;
  unit?: string;
  confidence: number | null;
  source: RawSource | null;
  status?: 'not_found';
  alternates?: RawAlternate[];
  derived?: RawDerived;
}

interface RawExtraction {
  job_id: string;
  document: { filename: string; page_count: number };
  model: string;
  completed_at: string;
  fields: RawField[];
  source_pages: { page: number; text: string }[];
}

const data = raw as RawExtraction;

function formatValue(value: string | number | null): string {
  if (value === null) return '';
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);
  }
  return value;
}

function normalizeDerived(d: RawDerived | undefined, labelByKey: Map<string, string>): DerivedInfo | undefined {
  if (!d) return undefined;
  return {
    formula: d.formula,
    inputLabels: d.inputs.map((key) => labelByKey.get(key) ?? key),
  };
}

function normalizeField(f: RawField, labelByKey: Map<string, string>): ExtractionField {
  return {
    id: f.key,
    label: f.label,
    value: formatValue(f.value),
    unit: f.unit,
    sourceQuote: f.source?.quote ?? null,
    page: f.source?.page,
    confidence: f.confidence,
    status: f.status,
    candidates: f.alternates?.map((alt) => ({
      value: formatValue(alt.value),
      sourceQuote: alt.source?.quote ?? null,
      page: alt.source?.page,
    })),
    derived: normalizeDerived(f.derived, labelByKey),
  };
}

export function normalizeExtraction(): {
  fields: ExtractionField[];
  sourcePages: SourcePage[];
  provenance: ExtractionProvenance;
  figuresInThousands: boolean;
} {
  const labelByKey = new Map(data.fields.map((f) => [f.key, f.label]));

  return {
    fields: data.fields.map((f) => normalizeField(f, labelByKey)),
    sourcePages: data.source_pages,
    provenance: {
      filename: data.document.filename,
      pageCount: data.document.page_count,
      model: data.model,
      completedAt: data.completed_at,
    },
    figuresInThousands: data.source_pages.some((p) => /in thousands/i.test(p.text)),
  };
}
