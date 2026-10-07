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

export type CitationKind = 'cite' | 'option' | 'mismatch';

export interface SourceCitation {
  page: number;
  /** Lines the quote covers. Empty when the quote couldn't be found on its page. */
  lineIndexes: number[];
  /** Page number plus a letter, e.g. "3a". null when the quote couldn't be found. */
  code: string | null;
  kind: CitationKind;
  /** 1-based option number for a conflicting field, otherwise null. */
  option: number | null;
}

export interface LineReference {
  code: string;
  kind: CitationKind;
  fieldIds: string[];
}

export interface ReferenceIndex {
  /** Citations per field id, in option order for conflicting fields. */
  byField: Record<string, SourceCitation[]>;
  /** Keyed by lineKey(page, lineIndex), for the first line of each citation only. */
  byLine: Record<string, LineReference>;
}

type UncodedCitation = Omit<SourceCitation, 'code'>;

/**
 * Gives every cited line a workpaper-style code: the page number plus a letter in
 * line order within that page (3a, 3b, 3c). Codes depend only on line positions,
 * never on field order, so they stay the same while fields stream in.
 */
export function assignReferenceCodes(
  fields: ExtractionField[],
  pages: SourcePage[],
  mismatches: Record<string, LabelMismatch>,
): ReferenceIndex {
  const textByPage = new Map(pages.map((p) => [p.page, p.text]));
  const locate = (page: number | undefined, quote: string | null) => {
    if (page === undefined || quote === null) return null;
    const text = textByPage.get(page);
    return { page, lineIndexes: text === undefined ? [] : (findQuoteLines(text, quote) ?? []) };
  };

  const pending: { fieldId: string; citation: UncodedCitation }[] = [];
  for (const field of fields) {
    const mismatch = mismatches[field.id];
    if (mismatch) {
      pending.push({
        fieldId: field.id,
        citation: { page: mismatch.page, lineIndexes: [mismatch.lineIndex], kind: 'mismatch', option: null },
      });
      continue;
    }
    if (field.candidates && field.candidates.length > 0) {
      const options = [
        { page: field.page, quote: field.sourceQuote },
        ...field.candidates.map((c) => ({ page: c.page, quote: c.sourceQuote })),
      ];
      options.forEach((option, i) => {
        const located = locate(option.page, option.quote);
        if (located) pending.push({ fieldId: field.id, citation: { ...located, kind: 'option', option: i + 1 } });
      });
      continue;
    }
    const located = locate(field.page, field.sourceQuote);
    if (located) pending.push({ fieldId: field.id, citation: { ...located, kind: 'cite', option: null } });
  }

  const firstLinesByPage = new Map<number, number[]>();
  for (const { citation } of pending) {
    if (citation.lineIndexes.length === 0) continue;
    const list = firstLinesByPage.get(citation.page) ?? [];
    if (!list.includes(citation.lineIndexes[0])) list.push(citation.lineIndexes[0]);
    firstLinesByPage.set(citation.page, list);
  }
  const codeFor = (page: number, firstLine: number) => {
    const sorted = [...(firstLinesByPage.get(page) ?? [])].sort((a, b) => a - b);
    return `${page}${String.fromCharCode(97 + sorted.indexOf(firstLine))}`;
  };

  const index: ReferenceIndex = { byField: {}, byLine: {} };
  for (const { fieldId, citation } of pending) {
    const hasLines = citation.lineIndexes.length > 0;
    const code = hasLines ? codeFor(citation.page, citation.lineIndexes[0]) : null;
    (index.byField[fieldId] ??= []).push({ ...citation, code });
    if (code === null) continue;
    const key = lineKey(citation.page, citation.lineIndexes[0]);
    const existing = index.byLine[key];
    if (!existing) {
      index.byLine[key] = { code, kind: citation.kind, fieldIds: [fieldId] };
    } else if (!existing.fieldIds.includes(fieldId)) {
      existing.fieldIds.push(fieldId);
    }
  }
  return index;
}

export const IDLE_SOURCE_STATUS = "Choose a field's code to find its line here.";

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** The source panel's live status line for the field being shown. */
export function describeSelection(fieldLabel: string, citations: SourceCitation[]): string {
  if (citations.length === 0) return `Nothing to show in the source for ${fieldLabel}.`;
  const missing = citations.find((c) => c.code === null);
  if (missing) return `Couldn't find the quoted text on page ${missing.page}. Showing the whole page.`;
  const codes = citations.map((c) => c.code ?? '');
  if (codes.length === 1) return `Showing line ${codes[0]}, cited for ${fieldLabel}.`;
  return `Showing lines ${joinWithAnd(codes)} for ${fieldLabel}.`;
}
