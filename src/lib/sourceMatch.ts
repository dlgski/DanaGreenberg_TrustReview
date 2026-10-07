/**
 * Pure matching between extracted fields and the source document's page text.
 * Nothing here changes a value, sorts fields or approves anything. It only finds
 * where things are so the interface can show them.
 */

import type { ExtractionField, SourcePage } from './types';

export function pageLines(text: string): string[] {
  return text.split('\n');
}

export function lineKey(page: number, lineIndex: number): string {
  return `${page}:${lineIndex}`;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Finds a quote in a page, ignoring case and whitespace differences. Returns the
 * indexes of every line the match touches, or null when the quote isn't there.
 */
export function findQuoteLines(pageText: string, quote: string): number[] | null {
  const needle = normalize(quote);
  if (needle === '') return null;

  const spans: { index: number; start: number; end: number }[] = [];
  let joined = '';
  pageLines(pageText).forEach((raw, index) => {
    const line = normalize(raw);
    if (line === '') return;
    if (joined !== '') joined += ' ';
    spans.push({ index, start: joined.length, end: joined.length + line.length });
    joined += line;
  });

  const at = joined.indexOf(needle);
  if (at === -1) return null;
  const end = at + needle.length;
  return spans.filter((span) => span.start < end && span.end > at).map((span) => span.index);
}

export interface LabelMismatch {
  page: number;
  lineIndex: number;
  /** The number exactly as the document prints it, e.g. "1,904". */
  documentValue: string;
  /** Absolute difference between the extracted number and the document's. */
  difference: number;
  /** The page's own title in sentence case, e.g. "Consolidated statement of operations". */
  pageTitle: string;
}

/** Reads "1,904", "$6,120", "(1,250)" or "1.42" as a number. Anything else is null. */
export function parseAmount(raw: string): number | null {
  const compact = raw.trim().replace(/[$,\s]/g, '');
  const negative = compact.startsWith('(') && compact.endsWith(')');
  const body = negative ? compact.slice(1, -1) : compact;
  if (!/^-?\d+(\.\d+)?$/.test(body)) return null;
  const value = Number(body);
  return negative ? -value : value;
}

export function pageTitle(text: string): string {
  const first = pageLines(text)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '';
  const lower = first.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** A value the model reported without citing anything, that isn't calculated or conflicting. */
export function isUngrounded(field: ExtractionField): boolean {
  const hasCandidates = Boolean(field.candidates && field.candidates.length > 0);
  return field.value !== '' && field.sourceQuote === null && !field.derived && !hasCandidates;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The one cross-check this interface makes, kept deliberately narrow: for an uncited
 * value, look for exactly one line that is the field's label followed by a number. If
 * that number differs, report it. It never changes a value.
 */
export function findLabelMismatch(field: ExtractionField, pages: SourcePage[]): LabelMismatch | null {
  if (!isUngrounded(field)) return null;
  const extracted = parseAmount(field.value);
  if (extracted === null) return null;

  const pattern = new RegExp(`^${escapeRegExp(field.label)}\\s+(\\(?-?[\\d,]+(?:\\.\\d+)?\\)?)$`, 'i');
  const hits: { page: SourcePage; lineIndex: number; documentValue: string }[] = [];
  for (const page of pages) {
    pageLines(page.text).forEach((line, lineIndex) => {
      const match = pattern.exec(line.trim());
      if (match) hits.push({ page, lineIndex, documentValue: match[1] });
    });
  }
  if (hits.length !== 1) return null;

  const [hit] = hits;
  const documentNumber = parseAmount(hit.documentValue);
  if (documentNumber === null || documentNumber === extracted) return null;
  return {
    page: hit.page.page,
    lineIndex: hit.lineIndex,
    documentValue: hit.documentValue,
    difference: Math.abs(extracted - documentNumber),
    pageTitle: pageTitle(hit.page.text),
  };
}

export function findAllMismatches(fields: ExtractionField[], pages: SourcePage[]): Record<string, LabelMismatch> {
  const result: Record<string, LabelMismatch> = {};
  for (const field of fields) {
    const mismatch = findLabelMismatch(field, pages);
    if (mismatch) result[field.id] = mismatch;
  }
  return result;
}
