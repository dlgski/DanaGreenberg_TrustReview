# Split-view Review and Workpaper Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the source document in a side panel (a drawer on narrow screens) that highlights the exact lines each field came from, flag the net income discrepancy, and restyle the whole app in the approved audit-workpaper visual language.

**Architecture:** Pure matching logic (finding quotes, assigning reference codes, detecting label mismatches) lives in one tested module, `src/lib/sourceMatch.ts`. `ReviewPage` computes codes and mismatches once from the full extraction and owns which field is shown in the source. Presentational components (`FieldRow`, `SourcePanel`, `DocumentHeader` and small primitives) render from that. All visual values come from `src/styles/tokens.css`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, plain CSS with custom properties, Vitest 5 (new, logic tests only), `@fontsource` for self-hosted fonts.

**Spec:** `docs/superpowers/specs/2026-10-07-split-view-redesign-design.md`. The approved mockup is `.superpowers/brainstorm/72387-1791380452/content/visual-v7.html`. It's kept locally and not committed, so open it in a browser to compare.

## Global Constraints

- `src/styles/tokens.css` is the only file allowed to contain raw hex colors or pixel values. Exceptions: the `1000px` literal in `@media` queries (media queries can't read custom properties), and SVG `viewBox`, path coordinates and stroke widths.
- Breakpoint: 1000px and under is the narrow (drawer) layout. JS uses `NARROW_LAYOUT_QUERY = '(max-width: 1000px)'`.
- New runtime dependencies allowed: `@fontsource/libre-franklin` and `@fontsource/courier-prime` only. New dev dependency: `vitest` only. No runtime network requests.
- Review rules are unchanged: no auto-approve, no confidence sort, no "approve all." Confirm stays removed for conflicting, not-found and ungrounded fields. Approve needs a decision on every field and a completed job.
- Copy: sentence case. No all-caps labels, no dot-separated metadata strings, no arrows on links or buttons. Field names keep their casing in every generated string.
- Every text color meets WCAG AA (4.5:1) on the surface it sits on. Information is never carried by color alone. `--color-graphite-3` is for text on white only: it measures 4.44:1 on `--color-region`, so use `--color-graphite-2` for text on the slate region.
- `prefers-reduced-motion: reduce` turns off the drawer slide, smooth scrolling and the tick draw animation.
- Scrolling to a highlight scrolls only the source panel body, never the page.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Codes changing mid-stream.** Fields arrive one at a time. A field's code (for example "3c") must not change as other fields arrive. Pinned by the "letters don't depend on field order" test in Task 3. Codes are computed once from the full extraction in Task 8, and Task 13 checks this during a live stream.
2. **A cited quote that isn't on its page.** The panel should say so and show the whole page, not crash or highlight nothing silently. Pinned by the not-found tests in Task 3 (`assignReferenceCodes` and `describeSelection`).
3. **Labels with regex characters or shared prefixes**, for example "Net income (loss)" or a line "Net income attributable to members 1,904". The mismatch check must not throw or match the wrong line. Pinned by the regex-character and prefix tests in Task 2.
4. **Retrying while a field is shown in the source or the drawer is open.** The highlight, active field and drawer must reset with the new attempt. Pinned by the reset effect in Task 8 and the manual check in Task 13.
5. **Values that aren't numbers** (dates, names) must never produce a mismatch. Pinned by the non-numeric test in Task 2.

---

### Task 1: Vitest and quote finding

**Files:**
- Modify: `package.json`
- Create: `src/lib/sourceMatch.ts`
- Test: `src/lib/sourceMatch.test.ts`

**Interfaces:**
- Produces: `pageLines(text: string): string[]`, `lineKey(page: number, lineIndex: number): string`, `findQuoteLines(pageText: string, quote: string): number[] | null`

- [ ] **Step 1: Install Vitest and add the test script**

Run: `npm install -D vitest@^5`

Then in `package.json`, add a `test` script so the `scripts` block reads:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/sourceMatch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findQuoteLines, lineKey, pageLines } from './sourceMatch';

const PAGE = [
  'CONSOLIDATED STATEMENT OF OPERATIONS',
  '(in thousands of U.S. dollars)',
  'Net sales 48,213',
  'Cost of goods sold 36,904',
  '',
  'Supplemental (non-GAAP):',
  'Adjusted EBITDA (see Note 7) 6,120',
].join('\n');

describe('pageLines', () => {
  it('splits page text on newlines, keeping empty lines', () => {
    expect(pageLines('a\n\nb')).toEqual(['a', '', 'b']);
  });
});

describe('lineKey', () => {
  it('joins page and line index', () => {
    expect(lineKey(3, 10)).toBe('3:10');
  });
});

describe('findQuoteLines', () => {
  it('finds an exact single-line quote', () => {
    expect(findQuoteLines(PAGE, 'Net sales 48,213')).toEqual([2]);
  });

  it('ignores case differences', () => {
    expect(findQuoteLines(PAGE, 'consolidated statement of operations')).toEqual([0]);
  });

  it('collapses whitespace in the quote', () => {
    expect(findQuoteLines(PAGE, '  Net   sales\t48,213 ')).toEqual([2]);
  });

  it('returns every line a quote spans, skipping blank lines between them', () => {
    expect(findQuoteLines(PAGE, '36,904 Supplemental')).toEqual([3, 5]);
  });

  it('returns null when the quote is not on the page', () => {
    expect(findQuoteLines(PAGE, 'Net income 2,310')).toBeNull();
  });

  it('returns null for an empty quote', () => {
    expect(findQuoteLines(PAGE, '   ')).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, "Failed to resolve import "./sourceMatch""

- [ ] **Step 4: Write the implementation**

Create `src/lib/sourceMatch.ts`:

```ts
/**
 * Pure matching between extracted fields and the source document's page text.
 * Nothing here changes a value, sorts fields or approves anything. It only finds
 * where things are so the interface can show them.
 */

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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 8 tests

- [ ] **Step 6: Check build and lint**

Run: `npm run build && npm run lint`
Expected: build succeeds and lint reports no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/sourceMatch.ts src/lib/sourceMatch.test.ts
git commit -m "Add Vitest and quote line matching

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Label mismatch detection

**Files:**
- Modify: `src/lib/sourceMatch.ts`
- Test: `src/lib/sourceMatch.test.ts`

**Interfaces:**
- Consumes: `pageLines` from Task 1; `ExtractionField`, `SourcePage` from `src/lib/types.ts`
- Produces:
  - `interface LabelMismatch { page: number; lineIndex: number; documentValue: string; difference: number; pageTitle: string }`
  - `parseAmount(raw: string): number | null`
  - `pageTitle(text: string): string`
  - `isUngrounded(field: ExtractionField): boolean`
  - `findLabelMismatch(field: ExtractionField, pages: SourcePage[]): LabelMismatch | null`
  - `findAllMismatches(fields: ExtractionField[], pages: SourcePage[]): Record<string, LabelMismatch>`

- [ ] **Step 1: Write the failing tests**

Add this import at the top of `src/lib/sourceMatch.test.ts`, below the vitest import, and replace the existing `./sourceMatch` import:

```ts
import type { ExtractionField, SourcePage } from './types';
import { normalizeExtraction } from './normalizeExtraction';
import {
  findAllMismatches,
  findLabelMismatch,
  findQuoteLines,
  isUngrounded,
  lineKey,
  pageLines,
  pageTitle,
  parseAmount,
} from './sourceMatch';
```

Append to the end of the file:

```ts
function field(overrides: Partial<ExtractionField> = {}): ExtractionField {
  return {
    id: 'net_income',
    label: 'Net income',
    value: '2,310',
    unit: 'USD',
    sourceQuote: null,
    confidence: 0.88,
    ...overrides,
  };
}

const INCOME_PAGES: SourcePage[] = [
  {
    page: 3,
    text: ['CONSOLIDATED STATEMENT OF OPERATIONS', 'Income tax expense 1,464', 'Net income 1,904'].join('\n'),
  },
];

describe('parseAmount', () => {
  it.each([
    ['1,904', 1904],
    [' 2,310 ', 2310],
    ['(1,250)', -1250],
    ['-75', -75],
    ['1.42', 1.42],
    ['$6,120', 6120],
  ])('parses %s', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it.each(['2025-06-30', 'Halvorsen Marine Supply, LLC', '', '()'])('rejects %s', (raw) => {
    expect(parseAmount(raw)).toBeNull();
  });
});

describe('pageTitle', () => {
  it('uses the first non-empty line in sentence case', () => {
    expect(pageTitle('\n  CONSOLIDATED STATEMENT OF OPERATIONS\n(in thousands)')).toBe(
      'Consolidated statement of operations',
    );
  });
});

describe('isUngrounded', () => {
  it('is true for a value with no source that is not calculated or conflicting', () => {
    expect(isUngrounded(field())).toBe(true);
  });

  it('is false when nothing was found', () => {
    expect(isUngrounded(field({ value: '' }))).toBe(false);
  });
});

describe('findLabelMismatch', () => {
  it('finds the document line that disagrees with an uncited value', () => {
    expect(findLabelMismatch(field(), INCOME_PAGES)).toEqual({
      page: 3,
      lineIndex: 2,
      documentValue: '1,904',
      difference: 406,
      pageTitle: 'Consolidated statement of operations',
    });
  });

  it('returns null when the document agrees', () => {
    expect(findLabelMismatch(field({ value: '1,904' }), INCOME_PAGES)).toBeNull();
  });

  it('returns null when no line has the label', () => {
    expect(findLabelMismatch(field({ label: 'Guarantor fee' }), INCOME_PAGES)).toBeNull();
  });

  it('returns null when more than one line has the label', () => {
    const pages = [...INCOME_PAGES, { page: 5, text: 'Net income 1,950' }];
    expect(findLabelMismatch(field(), pages)).toBeNull();
  });

  it('reads a negative in parentheses', () => {
    const pages = [{ page: 3, text: 'Net income (120)' }];
    expect(findLabelMismatch(field(), pages)).toMatchObject({ documentValue: '(120)', difference: 2430 });
  });

  it('treats regex characters in the label literally', () => {
    const pages = [{ page: 3, text: 'Net income (loss) 1,904' }];
    expect(findLabelMismatch(field({ label: 'Net income (loss)' }), pages)).toMatchObject({ lineIndex: 0 });
  });

  it('does not match a longer line that only starts with the label', () => {
    const pages = [{ page: 3, text: 'Net income attributable to members 1,904' }];
    expect(findLabelMismatch(field(), pages)).toBeNull();
  });

  it('skips a field that cites a source', () => {
    expect(findLabelMismatch(field({ sourceQuote: 'Net income 2,310', page: 3 }), INCOME_PAGES)).toBeNull();
  });

  it('skips a calculated field', () => {
    const derived = { formula: 'a / b', inputLabels: ['A', 'B'] };
    expect(findLabelMismatch(field({ derived }), INCOME_PAGES)).toBeNull();
  });

  it('skips a field with conflicting values', () => {
    const candidates = [{ value: '1,904', sourceQuote: 'Net income 1,904', page: 3 }];
    expect(findLabelMismatch(field({ candidates }), INCOME_PAGES)).toBeNull();
  });

  it('skips a value that is not a number', () => {
    expect(findLabelMismatch(field({ value: 'about two million' }), INCOME_PAGES)).toBeNull();
  });
});

describe('findAllMismatches on the Halvorsen extraction', () => {
  it('finds only net income, on page 3', () => {
    const { fields, sourcePages } = normalizeExtraction();
    const mismatches = findAllMismatches(fields, sourcePages);
    expect(Object.keys(mismatches)).toEqual(['net_income']);
    expect(mismatches.net_income).toMatchObject({ page: 3, lineIndex: 10, documentValue: '1,904', difference: 406 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, "findAllMismatches is not a function" (or a similar missing-export error)

- [ ] **Step 3: Write the implementation**

Add the type import at the top of `src/lib/sourceMatch.ts`, below the file comment:

```ts
import type { ExtractionField, SourcePage } from './types';
```

Append to `src/lib/sourceMatch.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests

- [ ] **Step 5: Check build and lint**

Run: `npm run build && npm run lint`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sourceMatch.ts src/lib/sourceMatch.test.ts
git commit -m "Detect label mismatches for uncited values

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Reference codes and the panel status message

**Files:**
- Modify: `src/lib/sourceMatch.ts`
- Test: `src/lib/sourceMatch.test.ts`

**Interfaces:**
- Consumes: `findQuoteLines`, `lineKey`, `LabelMismatch` from Tasks 1 and 2
- Produces:
  - `type CitationKind = 'cite' | 'option' | 'mismatch'`
  - `interface SourceCitation { page: number; lineIndexes: number[]; code: string | null; kind: CitationKind; option: number | null }`
  - `interface LineReference { code: string; kind: CitationKind; fieldIds: string[] }`
  - `interface ReferenceIndex { byField: Record<string, SourceCitation[]>; byLine: Record<string, LineReference> }`
  - `assignReferenceCodes(fields: ExtractionField[], pages: SourcePage[], mismatches: Record<string, LabelMismatch>): ReferenceIndex`
  - `describeSelection(fieldLabel: string, citations: SourceCitation[]): string`
  - `IDLE_SOURCE_STATUS: string`

- [ ] **Step 1: Write the failing tests**

Add `assignReferenceCodes`, `describeSelection` and `type SourceCitation` to the `./sourceMatch` import in `src/lib/sourceMatch.test.ts`. Then append:

```ts
describe('assignReferenceCodes on the Halvorsen extraction', () => {
  const { fields, sourcePages } = normalizeExtraction();
  const mismatches = findAllMismatches(fields, sourcePages);
  const index = assignReferenceCodes(fields, sourcePages, mismatches);
  const codesFor = (id: string) => (index.byField[id] ?? []).map((c) => c.code);

  it('gives each cited line a page-and-letter code in line order', () => {
    expect(codesFor('borrower_legal_name')).toEqual(['1a']);
    expect(codesFor('fiscal_year_end')).toEqual(['1b']);
    expect(codesFor('total_revenue')).toEqual(['3a']);
    expect(codesFor('net_income')).toEqual(['3b']);
    expect(codesFor('ebitda')).toEqual(['3c']);
    expect(codesFor('total_debt')).toEqual(['4a', '6b']);
    expect(codesFor('covenant_summary')).toEqual(['6a']);
    expect(codesFor('annual_debt_service')).toEqual(['6c']);
  });

  it('gives no citations to calculated and not-found fields', () => {
    expect(index.byField.dscr).toBeUndefined();
    expect(index.byField.guarantor).toBeUndefined();
  });

  it('numbers the options of a conflicting field', () => {
    expect(index.byField.total_debt.map((c) => [c.kind, c.option])).toEqual([
      ['option', 1],
      ['option', 2],
    ]);
  });

  it('cites the mismatch line for net income', () => {
    expect(index.byField.net_income).toEqual([
      { page: 3, lineIndexes: [10], code: '3b', kind: 'mismatch', option: null },
    ]);
    expect(index.byLine[lineKey(3, 10)]).toEqual({ code: '3b', kind: 'mismatch', fieldIds: ['net_income'] });
  });

  it('finds every quote in the extraction', () => {
    const all = Object.values(index.byField).flat();
    expect(all.every((c) => c.code !== null && c.lineIndexes.length > 0)).toBe(true);
  });

  it("doesn't depend on field order, so codes don't change while fields stream in", () => {
    const reversed = assignReferenceCodes([...fields].reverse(), sourcePages, mismatches);
    for (const id of Object.keys(index.byField)) {
      expect(reversed.byField[id].map((c) => c.code)).toEqual(codesFor(id));
    }
  });
});

describe('assignReferenceCodes edge cases', () => {
  const pages: SourcePage[] = [{ page: 3, text: 'Net sales 48,213\nGross profit 11,309' }];

  it('gives a quote that is not on its page no code and no lines', () => {
    const missing = field({ id: 'revenue', label: 'Total revenue', value: '48,213', sourceQuote: 'Revenue 48,213', page: 3 });
    const index = assignReferenceCodes([missing], pages, {});
    expect(index.byField.revenue).toEqual([{ page: 3, lineIndexes: [], code: null, kind: 'cite', option: null }]);
    expect(index.byLine).toEqual({});
  });

  it('lets two fields that cite the same line share its code', () => {
    const a = field({ id: 'a', label: 'A', value: '48,213', sourceQuote: 'Net sales 48,213', page: 3 });
    const b = field({ id: 'b', label: 'B', value: '48,213', sourceQuote: 'net sales', page: 3 });
    const index = assignReferenceCodes([a, b], pages, {});
    expect(index.byField.a[0].code).toBe('3a');
    expect(index.byField.b[0].code).toBe('3a');
    expect(index.byLine[lineKey(3, 0)].fieldIds).toEqual(['a', 'b']);
  });
});

describe('describeSelection', () => {
  const cite = (code: string | null, page = 3): SourceCitation => ({
    page,
    lineIndexes: code ? [0] : [],
    code,
    kind: 'cite',
    option: null,
  });

  it('describes one line', () => {
    expect(describeSelection('Total revenue', [cite('3a')])).toBe('Showing line 3a, cited for Total revenue.');
  });

  it('describes two lines', () => {
    expect(describeSelection('Total debt', [cite('4a', 4), cite('6b', 6)])).toBe('Showing lines 4a and 6b for Total debt.');
  });

  it('describes three lines', () => {
    expect(describeSelection('X', [cite('1a', 1), cite('2a', 2), cite('3a')])).toBe('Showing lines 1a, 2a and 3a for X.');
  });

  it('says when a quote could not be found', () => {
    expect(describeSelection('Total revenue', [cite(null, 3)])).toBe(
      "Couldn't find the quoted text on page 3. Showing the whole page.",
    );
  });

  it('handles a field with nothing to show', () => {
    expect(describeSelection('Guarantor', [])).toBe('Nothing to show in the source for Guarantor.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, "assignReferenceCodes is not a function"

- [ ] **Step 3: Write the implementation**

Append to `src/lib/sourceMatch.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests

- [ ] **Step 5: Check build and lint**

Run: `npm run build && npm run lint`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sourceMatch.ts src/lib/sourceMatch.test.ts
git commit -m "Assign workpaper reference codes to cited source lines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Tokens, fonts and app shell

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/main.tsx`
- Replace: `src/styles/tokens.css`
- Replace: `src/styles/global.css`
- Modify: `src/App.tsx`
- Replace: `src/App.css`

**Interfaces:**
- Produces: every CSS custom property in the new `tokens.css` below. Later tasks use only these names. The "Legacy aliases" block keeps old names working until Task 11 deletes it.
- Produces: global utility class `.visually-hidden`.

- [ ] **Step 1: Install the fonts**

Run: `npm install @fontsource/libre-franklin@^5 @fontsource/courier-prime@^5`

- [ ] **Step 2: Import the fonts**

In `src/main.tsx`, add these imports above `import './styles/tokens.css'`:

```ts
import '@fontsource/libre-franklin/400.css'
import '@fontsource/libre-franklin/500.css'
import '@fontsource/libre-franklin/600.css'
import '@fontsource/libre-franklin/700.css'
import '@fontsource/libre-franklin/800.css'
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/700.css'
```

- [ ] **Step 3: Replace the tokens**

Replace the whole of `src/styles/tokens.css` with:

```css
/*
  Design tokens. This is the only file in the project allowed to contain
  raw hex colors or pixel values. Every component consumes these through
  var(--token-name), never a literal. The visual language is the audit
  workpaper: graphite text, blue pencil for verified marks and references,
  red pencil for exceptions, and ledger-pad green for the source document.
*/

:root {
  /* ---- Color ---- */
  --color-graphite: #23262b;
  --color-graphite-hover: #000000;
  --color-graphite-2: #4d535c;
  --color-graphite-3: #5f6670;
  --color-on-dark: #ffffff;

  --color-region: #dde2e5;
  --color-region-hover: #cfd5da;
  --color-card: #ffffff;
  --color-card-divider: #edf0f2;
  --color-option: #f1f3f5;
  --color-line: #d3d8dd;
  --color-input-border: #757d87;

  --color-ledger: #eaf0e6;
  --color-ledger-line: #cdd8c6;
  --color-ledger-text: #3f4a3c;
  --color-ledger-code: #56634f;

  --color-pencil-blue: #2547b8;
  --color-blue-wash: #e2e8fa;
  --color-pencil-red: #b3261e;
  --color-red-wash: #fbe7e4;
  --color-red-ink: #6e1a14;
  --color-ochre: #865400;

  --color-tick-pending: #b8bfc6;
  --color-disabled-bg: #b9c0c7;
  --color-disabled-text: #f3f5f6;
  --color-scrim: rgba(35, 38, 43, 0.3);
  --color-backdrop: rgba(35, 38, 43, 0.45);

  /* ---- Type ---- */
  --font-ui: "Libre Franklin", system-ui, sans-serif;
  --font-doc: "Courier Prime", ui-monospace, monospace;

  --text-2xs: 11.5px;
  --text-xs: 12.5px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-md: 15px;
  --text-lg: 17px;
  --text-xl: 18px;
  --text-2xl: 24px;
  --text-3xl: 26px;

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-heavy: 800;

  --leading-tight: 1.1;
  --leading-snug: 1.2;
  --leading-code: 1.4;
  --leading-base: 1.5;
  --leading-relaxed: 1.6;
  --leading-doc: 1.75;

  --tracking-tight: -0.02em;
  --tracking-snug: -0.01em;
  --underline-offset: 3px;

  /* ---- Spacing ---- */
  --space-0: 0px;
  --space-1: 4px;
  --space-1-5: 6px;
  --space-2: 8px;
  --space-2-5: 10px;
  --space-3: 12px;
  --space-3-5: 14px;
  --space-4: 16px;
  --space-4-5: 18px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* ---- Sizes ---- */
  --size-icon: 13px;
  --size-radio: 16px;
  --size-tick: 24px;
  --size-tick-box: 18px;
  --size-tick-box-mark: 14px;
  --tick-column: 46px;
  --code-column: 40px;
  --drawer-width: min(500px, 92vw);
  --dialog-width: min(480px, 90vw);
  --prose-measure: 62ch;
  --demo-panel-height: 480px;
  --system-page-width: 1040px;
  --swatch-min: 140px;
  --type-label-width: 120px;
  --radius-sample-width: 120px;
  --radius-sample-height: 96px;

  /* ---- Radius (by level: region > panel > card > option > control > code) ---- */
  --radius-region: 20px;
  --radius-panel: 14px;
  --radius-card: 10px;
  --radius-option: 8px;
  --radius-control: 7px;
  --radius-code: 4px;

  /* ---- Borders ---- */
  --border-thin: 1px;
  --border-mid: 1.5px;
  --border-thick: 2px;
  --bar-width: 3px;

  /* ---- Shadow (drawer and dialog only) ---- */
  --shadow-drawer: -16px 0 40px rgba(35, 38, 43, 0.2);
  --shadow-dialog: 0 12px 32px rgba(35, 38, 43, 0.16);

  /* ---- Motion ---- */
  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-drawer: 260ms;
  --duration-tick: 380ms;
  --easing-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --easing-drawer: cubic-bezier(0.2, 0.8, 0.2, 1);

  /* ---- Z-index ---- */
  --z-scrim: 10;
  --z-drawer: 20;
  --z-dialog: 100;

  /* ---- Legacy aliases ----
     Old token names pointed at the new palette, so components that haven't been
     migrated yet still render. Task 11 deletes this whole block. */
  --color-neutral-100: var(--color-option);
  --color-neutral-200: var(--color-region);
  --color-bg: var(--color-card);
  --color-surface: var(--color-card);
  --color-surface-sunken: var(--color-option);
  --color-border: var(--color-line);
  --color-border-strong: var(--color-input-border);
  --color-text-primary: var(--color-graphite);
  --color-text-secondary: var(--color-graphite-2);
  --color-text-muted: var(--color-graphite-3);
  --color-text-on-accent: var(--color-on-dark);
  --color-interactive: var(--color-pencil-blue);
  --color-interactive-hover: var(--color-graphite);
  --color-interactive-subtle: var(--color-blue-wash);
  --color-focus-ring: var(--color-pencil-blue);
  --color-status-success-bg: var(--color-blue-wash);
  --color-status-success-text: var(--color-pencil-blue);
  --color-status-success-border: var(--color-pencil-blue);
  --color-status-caution-bg: var(--color-option);
  --color-status-caution-text: var(--color-ochre);
  --color-status-caution-border: var(--color-ochre);
  --color-status-danger-bg: var(--color-red-wash);
  --color-status-danger-text: var(--color-pencil-red);
  --color-status-danger-border: var(--color-pencil-red);
  --color-status-info-bg: var(--color-blue-wash);
  --color-status-info-text: var(--color-pencil-blue);
  --color-status-info-border: var(--color-pencil-blue);
  --color-status-neutral-bg: var(--color-option);
  --color-status-neutral-text: var(--color-graphite-2);
  --color-status-neutral-border: var(--color-line);
  --font-family-base: var(--font-ui);
  --font-family-mono: var(--font-doc);
  --font-size-xs: var(--text-xs);
  --font-size-sm: var(--text-sm);
  --font-size-base: var(--text-base);
  --font-size-md: var(--text-md);
  --font-size-lg: var(--text-xl);
  --font-size-xl: var(--text-2xl);
  --font-size-2xl: var(--text-3xl);
  --font-weight-regular: var(--weight-regular);
  --font-weight-medium: var(--weight-medium);
  --font-weight-semibold: var(--weight-semibold);
  --font-weight-bold: var(--weight-bold);
  --line-height-tight: var(--leading-snug);
  --line-height-base: var(--leading-base);
  --line-height-relaxed: var(--leading-relaxed);
  --radius-sm: var(--radius-code);
  --radius-md: var(--radius-option);
  --radius-lg: var(--radius-panel);
  --radius-full: 999px;
  --border-width-thin: var(--border-thin);
  --border-width-thick: var(--border-thick);
  --shadow-sm: none;
  --shadow-md: none;
  --shadow-lg: var(--shadow-dialog);
  --duration-slow: var(--duration-drawer);
  --z-toast: 200;
}
```

- [ ] **Step 4: Replace the global styles**

Replace the whole of `src/styles/global.css` with:

```css
body {
  font-family: var(--font-ui);
  font-size: var(--text-base);
  line-height: var(--leading-base);
  color: var(--color-graphite);
  background: var(--color-card);
}

h1, h2, h3, h4 {
  line-height: var(--leading-snug);
  font-weight: var(--weight-semibold);
}

a {
  color: var(--color-pencil-blue);
}

:focus-visible {
  outline: var(--border-thick) solid var(--color-pencil-blue);
  outline-offset: var(--border-thick);
  border-radius: var(--radius-code);
}

dialog {
  border: none;
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-dialog);
  padding: 0;
  color: var(--color-graphite);
}

dialog::backdrop {
  background: var(--color-backdrop);
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
}

.visually-hidden {
  position: absolute;
  width: var(--border-thin);
  height: var(--border-thin);
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

- [ ] **Step 5: Make the app fill the viewport**

In `src/App.tsx`, change `<main>` to `<main className="app__main">`.

Replace the whole of `src/App.css` with:

```css
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-6);
}

.app__brand {
  font-weight: var(--weight-heavy);
  letter-spacing: var(--tracking-snug);
  color: var(--color-graphite);
  text-decoration: none;
}

.app__nav-links {
  display: flex;
  gap: var(--space-5);
}

.app__nav-links a {
  text-decoration: none;
  color: var(--color-graphite-2);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  padding-bottom: var(--space-1);
}

.app__nav-links a[aria-current='page'] {
  color: var(--color-graphite);
  box-shadow: inset 0 calc(-1 * var(--border-thick)) 0 var(--color-graphite);
}

/* The review page manages its own scrolling; other pages scroll here. */
.app__main {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
```

- [ ] **Step 6: Verify**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

Run `npm run dev` and open `http://localhost:5173/system`. The text should now be in Libre Franklin, figures in Courier Prime where monospace was used, and colors on the new graphite and pencil palette. Nothing should be broken or unstyled.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/main.tsx src/styles src/App.tsx src/App.css
git commit -m "Introduce workpaper design tokens and self-hosted fonts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Visual primitives (Icon, Flag, TickMark, ReferenceButton, Button)

**Files:**
- Create: `src/components/Icon.tsx`, `src/components/Icon.css`
- Create: `src/components/Flag.tsx`, `src/components/Flag.css`
- Create: `src/components/TickMark.tsx`, `src/components/TickMark.css`
- Create: `src/components/ReferenceButton.tsx`, `src/components/ReferenceButton.css`
- Replace: `src/components/Button.tsx`, `src/components/Button.css`
- Modify: `src/routes/SystemPage.tsx` (add one temporary section; Task 11 rewrites the page)

**Interfaces:**
- Consumes: `FieldDecision` from `src/lib/types.ts`
- Produces:
  - `Icon({ name }: { name: IconName })` with `type IconName = 'warning' | 'split' | 'calculator'`
  - `Flag({ tone, icon, children }: { tone: 'caution' | 'danger' | 'info'; icon: IconName; children: ReactNode })`
  - `TickMark({ decision, size = 'large', decorative = false }: { decision: FieldDecision; size?: 'large' | 'small'; decorative?: boolean })`
  - `ReferenceButton({ codes, label, pressed, tone = 'blue', onClick }: { codes: string[]; label: string; pressed: boolean; tone?: 'blue' | 'red'; onClick: () => void })`
  - `Button` props: `variant?: 'primary' | 'quiet' | 'text'` (legacy `'secondary' | 'danger' | 'ghost'` still accepted until Task 11), `size?: 'regular' | 'large'`

- [ ] **Step 1: Create Icon**

`src/components/Icon.tsx`:

```tsx
import './Icon.css';

export type IconName = 'warning' | 'split' | 'calculator';

const PATHS: Record<IconName, string> = {
  warning: 'M8 1.5 15 14H1L8 1.5Zm-.75 4.5v4h1.5V6h-1.5Zm0 5.25v1.5h1.5v-1.5h-1.5Z',
  split: 'M2 3h5v10H2V3Zm1.5 1.5v7h2v-7h-2ZM9 3h5v10H9V3Z',
  calculator:
    'M3 2h10v12H3V2Zm1.5 1.5v2.5h7V3.5h-7Zm0 4v1.5H6V7.5H4.5Zm2.75 0v1.5h1.5V7.5h-1.5Zm2.75 0v1.5h1.5V7.5H10Zm-5.5 3V12H6v-1.5H4.5Zm2.75 0V12h1.5v-1.5h-1.5Zm2.75 0V12h1.5v-1.5H10Z',
};

/** Decorative only: every icon sits next to text that says the same thing. */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={PATHS[name]} />
    </svg>
  );
}
```

`src/components/Icon.css`:

```css
.icon {
  width: var(--size-icon);
  height: var(--size-icon);
  flex: none;
}
```

- [ ] **Step 2: Create Flag**

`src/components/Flag.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import './Flag.css';

export type FlagTone = 'caution' | 'danger' | 'info';

interface FlagProps {
  tone: FlagTone;
  icon: IconName;
  children: ReactNode;
}

export function Flag({ tone, icon, children }: FlagProps) {
  return (
    <span className={`flag flag--${tone}`}>
      <Icon name={icon} />
      {children}
    </span>
  );
}
```

`src/components/Flag.css`:

```css
.flag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.flag--caution {
  color: var(--color-ochre);
}

.flag--danger {
  color: var(--color-pencil-red);
}

.flag--info {
  color: var(--color-pencil-blue);
}
```

- [ ] **Step 3: Create TickMark**

`src/components/TickMark.tsx`:

```tsx
import type { FieldDecision } from '../lib/types';
import './TickMark.css';

const LABELS: Record<FieldDecision, string> = {
  pending: 'Not reviewed',
  confirmed: 'Confirmed',
  edited: 'Edited',
  rejected: 'Rejected',
};

interface TickMarkProps {
  decision: FieldDecision;
  size?: 'large' | 'small';
  /** Hide from assistive tech when nearby text already states the decision. */
  decorative?: boolean;
}

/**
 * An auditor's pencil tick for a field decision. Each decision renders a different
 * <path>, so React mounts a fresh element when the decision changes and the draw
 * animation plays once, as a response to the analyst's action.
 */
export function TickMark({ decision, size = 'large', decorative = false }: TickMarkProps) {
  return (
    <svg
      className={`tick-mark tick-mark--${size} tick-mark--${decision}`}
      viewBox="0 0 24 24"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : LABELS[decision]}
      aria-hidden={decorative ? true : undefined}
    >
      {decision === 'pending' ? <circle className="tick-mark__pending" cx="12" cy="12" r="9" /> : null}
      {decision === 'confirmed' ? <path className="tick-mark__stroke" d="M5 12.5l4.2 4.5L19 6.5" /> : null}
      {decision === 'edited' ? (
        <path className="tick-mark__stroke" d="M4 19l3.5-1 10-10-2.5-2.5-10 10L4 19z M13.5 7.5l2.5 2.5" />
      ) : null}
      {decision === 'rejected' ? <path className="tick-mark__stroke" d="M6 6l12 12 M18 6L6 18" /> : null}
    </svg>
  );
}
```

`src/components/TickMark.css`:

```css
.tick-mark {
  display: block;
  overflow: visible;
}

.tick-mark--large {
  width: var(--size-tick);
  height: var(--size-tick);
}

.tick-mark--small {
  width: var(--size-tick-box-mark);
  height: var(--size-tick-box-mark);
}

.tick-mark__pending {
  fill: none;
  stroke: var(--color-tick-pending);
  stroke-width: 1.6;
  stroke-dasharray: 3 3;
}

.tick-mark__stroke {
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 60;
  stroke-dashoffset: 60;
  animation: tick-mark-draw var(--duration-tick) ease-out forwards;
}

.tick-mark--confirmed .tick-mark__stroke,
.tick-mark--edited .tick-mark__stroke {
  stroke: var(--color-pencil-blue);
}

.tick-mark--rejected .tick-mark__stroke {
  stroke: var(--color-pencil-red);
}

@keyframes tick-mark-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tick-mark__stroke {
    animation: none;
    stroke-dashoffset: 0;
  }
}
```

- [ ] **Step 4: Create ReferenceButton**

`src/components/ReferenceButton.tsx`:

```tsx
import './ReferenceButton.css';

interface ReferenceButtonProps {
  codes: string[];
  label: string;
  pressed: boolean;
  tone?: 'blue' | 'red';
  onClick: () => void;
}

/** A field's workpaper reference. Its accessible name includes the code, e.g. "3a Show in source". */
export function ReferenceButton({ codes, label, pressed, tone = 'blue', onClick }: ReferenceButtonProps) {
  return (
    <button
      type="button"
      className={`reference-button reference-button--${tone}`}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {codes.map((code) => (
        <code key={code} className="reference-button__code">
          {code}
        </code>
      ))}
      <span className="reference-button__label">{label}</span>
    </button>
  );
}
```

`src/components/ReferenceButton.css`:

```css
.reference-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-pencil-blue);
}

.reference-button--red {
  color: var(--color-pencil-red);
}

.reference-button__code {
  padding: 0 var(--space-1);
  border: var(--border-mid) solid currentColor;
  border-radius: var(--radius-code);
  font-family: var(--font-doc);
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
  line-height: var(--leading-code);
}

.reference-button:hover .reference-button__label {
  text-decoration: underline;
  text-underline-offset: var(--underline-offset);
}

.reference-button[aria-pressed='true'] .reference-button__code {
  background: var(--color-pencil-blue);
  border-color: var(--color-pencil-blue);
  color: var(--color-on-dark);
}

.reference-button--red[aria-pressed='true'] .reference-button__code {
  background: var(--color-pencil-red);
  border-color: var(--color-pencil-red);
}
```

- [ ] **Step 5: Replace Button**

`src/components/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

type ButtonVariant = 'primary' | 'quiet' | 'text';
/** Old variant names, mapped onto the new set until Task 11 migrates every caller. */
type LegacyVariant = 'secondary' | 'danger' | 'ghost';

const LEGACY: Record<LegacyVariant, ButtonVariant> = { secondary: 'quiet', danger: 'text', ghost: 'text' };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | LegacyVariant;
  size?: 'regular' | 'large';
}

export function Button({ variant = 'quiet', size = 'regular', className, ...rest }: ButtonProps) {
  const resolved = variant in LEGACY ? LEGACY[variant as LegacyVariant] : (variant as ButtonVariant);
  const classes = ['button', `button--${resolved}`, size === 'large' ? 'button--large' : null, className]
    .filter(Boolean)
    .join(' ');
  return <button className={classes} {...rest} />;
}
```

`src/components/Button.css`:

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3-5);
  border: 0;
  border-radius: var(--radius-control);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  transition:
    background var(--duration-fast) var(--easing-standard),
    color var(--duration-fast) var(--easing-standard);
}

.button--primary {
  background: var(--color-graphite);
  color: var(--color-on-dark);
}

.button--primary:hover:not(:disabled) {
  background: var(--color-graphite-hover);
}

.button--quiet {
  background: var(--color-region);
  color: var(--color-graphite);
}

.button--quiet:hover:not(:disabled) {
  background: var(--color-region-hover);
}

.button--text {
  background: transparent;
  color: var(--color-graphite-2);
  padding-inline: var(--space-2);
}

.button--text:hover:not(:disabled) {
  color: var(--color-pencil-red);
}

.button--large {
  padding: var(--space-3) var(--space-4-5);
  font-size: var(--text-base);
}

.button:disabled {
  background: var(--color-disabled-bg);
  color: var(--color-disabled-text);
}

.button--text:disabled {
  background: transparent;
  color: var(--color-graphite-3);
}
```

- [ ] **Step 6: Show the primitives on /system**

In `src/routes/SystemPage.tsx`, add imports:

```tsx
import { Flag } from '../components/Flag';
import { TickMark } from '../components/TickMark';
import { ReferenceButton } from '../components/ReferenceButton';
```

Then insert this section directly after the intro `<div>` (before the Color section):

```tsx
      <section className="system-section">
        <h2 className="system-section__title">Workpaper primitives</h2>
        <div className="component-row">
          <TickMark decision="pending" />
          <TickMark decision="confirmed" />
          <TickMark decision="edited" />
          <TickMark decision="rejected" />
        </div>
        <div className="component-row">
          <Flag tone="caution" icon="warning">Model was unsure</Flag>
          <Flag tone="caution" icon="split">Two possible values</Flag>
          <Flag tone="danger" icon="warning">Doesn't match the document</Flag>
          <Flag tone="info" icon="calculator">Calculated, not read from the document</Flag>
        </div>
        <div className="component-row">
          <ReferenceButton codes={['3a']} label="Show in source" pressed={false} onClick={() => {}} />
          <ReferenceButton codes={['3a']} label="Show in source" pressed onClick={() => {}} />
          <ReferenceButton codes={['4a', '6b']} label="Show both in source" pressed={false} onClick={() => {}} />
          <ReferenceButton codes={['3b']} label="Show the line on page 3" pressed tone="red" onClick={() => {}} />
        </div>
        <div className="component-row">
          <Button variant="text">Reject</Button>
          <Button variant="quiet">Edit</Button>
          <Button variant="primary">Confirm</Button>
          <Button variant="primary" size="large" disabled>Approve extraction</Button>
        </div>
      </section>
```

- [ ] **Step 7: Verify**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

With `npm run dev`, open `/system`. Check against `visual-v7.html`: the four tick marks draw in (dashed gray circle, blue ✓, blue pencil, red ✗), the flags have icons, the pressed reference codes fill solid, and the buttons are text, gray and graphite. With macOS "Reduce motion" on, the ticks appear without animating.

- [ ] **Step 8: Commit**

```bash
git add src/components/Icon.* src/components/Flag.* src/components/TickMark.* src/components/ReferenceButton.* src/components/Button.* src/routes/SystemPage.tsx
git commit -m "Add workpaper primitives: tick marks, flags, reference codes, buttons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Variance schedule and conflict options

**Files:**
- Create: `src/components/VarianceSchedule.tsx`, `src/components/VarianceSchedule.css`
- Replace: `src/components/ConflictResolver.tsx`, `src/components/ConflictResolver.css`
- Modify: `src/components/FieldRow.tsx` (ConflictResolver call site only)
- Modify: `src/routes/SystemPage.tsx` (add one demo to the temporary section)

**Interfaces:**
- Produces:
  - `VarianceSchedule({ fieldLabel, extractedValue, documentValue, documentSource, difference, code }: { fieldLabel: string; extractedValue: string; documentValue: string; documentSource: string; difference: number; code: string })`
  - `ConflictResolver` props: `{ fieldId: string; fieldLabel: string; originalValue: string; originalQuote: string | null; originalPage?: number; candidates: ExtractionCandidate[]; codes: (string | null)[]; resolvedValue?: string; onResolve: (value: string) => void }`. The `unit` prop is removed and `fieldLabel` and `codes` are added.

- [ ] **Step 1: Create VarianceSchedule**

`src/components/VarianceSchedule.tsx`:

```tsx
import './VarianceSchedule.css';

interface VarianceScheduleProps {
  fieldLabel: string;
  extractedValue: string;
  documentValue: string;
  /** Where the document's number is, e.g. "Consolidated statement of operations, page 3". */
  documentSource: string;
  difference: number;
  code: string;
}

const formatNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

/** An auditor-style variance: what the model said, what the document says, and the gap. */
export function VarianceSchedule({
  fieldLabel,
  extractedValue,
  documentValue,
  documentSource,
  difference,
  code,
}: VarianceScheduleProps) {
  return (
    <div className="variance-schedule">
      <table className="variance-schedule__table">
        <caption className="visually-hidden">{fieldLabel} variance</caption>
        <tbody>
          <tr>
            <th scope="row">Model extracted, no source cited</th>
            <td>{extractedValue}</td>
          </tr>
          <tr>
            <th scope="row">{documentSource}</th>
            <td>{documentValue}</td>
          </tr>
          <tr className="variance-schedule__difference">
            <th scope="row">Difference</th>
            <td>{formatNumber.format(difference)}</td>
          </tr>
        </tbody>
      </table>
      <p className="variance-schedule__note">
        Check line {code} before deciding. Edit the value if the statement is right.
      </p>
    </div>
  );
}
```

`src/components/VarianceSchedule.css`:

```css
.variance-schedule {
  margin-top: var(--space-2-5);
  padding: var(--space-2-5) var(--space-3-5) var(--space-3);
  border-radius: var(--radius-option);
  background: var(--color-red-wash);
}

.variance-schedule__table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums lining-nums;
}

.variance-schedule__table th {
  padding: var(--space-1) 0;
  text-align: left;
  font-size: var(--text-base);
  font-weight: var(--weight-regular);
}

.variance-schedule__table td {
  padding: var(--space-1) 0;
  text-align: right;
  font-size: var(--text-md);
  font-weight: var(--weight-bold);
}

.variance-schedule__difference th,
.variance-schedule__difference td {
  padding-top: var(--space-1-5);
  border-top: var(--border-mid) solid var(--color-pencil-red);
  color: var(--color-pencil-red);
}

.variance-schedule__note {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-red-ink);
}
```

- [ ] **Step 2: Replace ConflictResolver**

`src/components/ConflictResolver.tsx`:

```tsx
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
```

`src/components/ConflictResolver.css`:

```css
.conflict-resolver {
  display: grid;
  gap: var(--space-1-5);
  min-width: 0;
  margin: var(--space-2-5) 0 0;
  padding: 0;
  border: 0;
}

.conflict-resolver__option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-option);
  background: var(--color-option);
  cursor: pointer;
}

.conflict-resolver__option:has(input:checked) {
  background: var(--color-blue-wash);
  box-shadow: inset 0 0 0 var(--border-mid) var(--color-pencil-blue);
}

.conflict-resolver__option input {
  width: var(--size-radio);
  height: var(--size-radio);
  margin: 0;
  accent-color: var(--color-pencil-blue);
}

.conflict-resolver__source {
  font-size: var(--text-sm);
  color: var(--color-graphite-2);
}

.conflict-resolver__code {
  margin-right: var(--space-1-5);
  font-family: var(--font-doc);
  font-weight: var(--weight-bold);
  color: var(--color-pencil-blue);
}

.conflict-resolver__value {
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  font-variant-numeric: tabular-nums lining-nums;
}
```

- [ ] **Step 3: Update the call site in FieldRow**

In `src/components/FieldRow.tsx`, replace the `<ConflictResolver ... />` element with this. Task 7 rewrites this file and wires in real codes, so the empty codes array is temporary:

```tsx
        <ConflictResolver
          fieldId={field.id}
          fieldLabel={field.label}
          originalValue={field.value}
          originalQuote={field.sourceQuote}
          originalPage={field.page}
          candidates={field.candidates ?? []}
          codes={[]}
          resolvedValue={review.decision === 'confirmed' ? field.value : review.editedValue}
          onResolve={onResolveCandidate}
        />
```

- [ ] **Step 4: Add a variance demo to /system**

In `src/routes/SystemPage.tsx`, add `import { VarianceSchedule } from '../components/VarianceSchedule';` and append inside the "Workpaper primitives" section, after the last `component-row`:

```tsx
        <VarianceSchedule
          fieldLabel="Net income"
          extractedValue="2,310"
          documentValue="1,904"
          documentSource="Consolidated statement of operations, page 3"
          difference={406}
          code="3b"
        />
```

- [ ] **Step 5: Verify**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

On `/system`, check against `visual-v7.html`: the variance table has the red rule above "Difference 406". The conflicting-field demo shows full-width option rows with the figure on the right, and picking one gives it a blue wash and outline.

- [ ] **Step 6: Commit**

```bash
git add src/components/VarianceSchedule.* src/components/ConflictResolver.* src/components/FieldRow.tsx src/routes/SystemPage.tsx
git commit -m "Add variance schedule and restyle conflict options

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Field cards

**Files:**
- Replace: `src/components/FieldRow.tsx`, `src/components/FieldRow.css`
- Modify: `src/lib/streamExtraction.ts` (export the full field list)
- Modify: `src/routes/ReviewPage.tsx` (pass the new props)
- Modify: `src/routes/SystemPage.tsx` (`FieldRowDemo` passes the new props)

**Interfaces:**
- Consumes: `isUngrounded`, `assignReferenceCodes`, `findAllMismatches`, `LabelMismatch`, `SourceCitation` (Tasks 2 and 3); `Flag`, `TickMark`, `ReferenceButton`, `Button` (Task 5); `VarianceSchedule`, `ConflictResolver` (Task 6)
- Produces:
  - `export const allFields: ExtractionField[]` from `src/lib/streamExtraction.ts`
  - `export interface DerivedInput { label: string; value: string | null }` from `FieldRow.tsx`
  - `FieldRow` props: `{ field; review; citations: SourceCitation[]; mismatch: LabelMismatch | null; derivedInputs?: DerivedInput[]; figuresInThousands: boolean; isShowingSource: boolean; onShowSource: () => void; onConfirm; onReject; onEdit; onResolveCandidate }`

- [ ] **Step 1: Export the full field list**

In `src/lib/streamExtraction.ts`, change:

```ts
export { sourcePages, provenance, figuresInThousands };
```

to:

```ts
/** Every field in the extraction, whether or not it has streamed in yet. */
export const allFields = fields;

export { sourcePages, provenance, figuresInThousands };
```

- [ ] **Step 2: Replace FieldRow**

`src/components/FieldRow.tsx`:

```tsx
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
  onShowSource: () => void;
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
              onClick={onShowSource}
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
```

- [ ] **Step 3: Replace the FieldRow styles**

`src/components/FieldRow.css`:

```css
.field-row {
  display: grid;
  grid-template-columns: var(--tick-column) minmax(0, 1fr);
  background: var(--color-card);
  border: var(--border-mid) solid transparent;
  border-radius: var(--radius-card);
}

.field-row--active {
  border-color: var(--color-pencil-blue);
}

.field-row__tick {
  display: grid;
  justify-items: center;
  align-content: start;
  padding-top: var(--space-4);
  border-right: var(--border-thin) solid var(--color-card-divider);
}

.field-row__body {
  min-width: 0;
  padding: var(--space-3-5) var(--space-4-5) var(--space-3) var(--space-4);
}

.field-row__line {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
}

.field-row__label {
  flex: 1;
  min-width: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.field-row__figure {
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  font-variant-numeric: tabular-nums lining-nums;
  letter-spacing: var(--tracking-snug);
  line-height: var(--leading-snug);
  text-align: right;
  white-space: nowrap;
}

.field-row__unit {
  display: block;
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: 0;
  color: var(--color-graphite-3);
}

.field-row__text {
  margin-top: var(--space-1);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.field-row__prose {
  max-width: var(--prose-measure);
  margin-top: var(--space-1-5);
  line-height: var(--leading-relaxed);
}

.field-row__empty {
  margin-top: var(--space-1);
  font-style: italic;
  color: var(--color-graphite-3);
}

.field-row__original {
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-graphite-3);
  text-decoration: line-through;
}

.field-row__derived {
  margin-top: var(--space-1-5);
  font-size: var(--text-sm);
  color: var(--color-graphite-2);
}

.field-row__derived code {
  font-family: var(--font-doc);
  color: var(--color-graphite);
}

.field-row__derived strong {
  font-weight: var(--weight-semibold);
  color: var(--color-graphite);
}

.field-row__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2-5);
}

.field-row__no-source {
  font-size: var(--text-xs);
  color: var(--color-graphite-3);
}

.field-row__actions {
  display: flex;
  gap: var(--space-1-5);
}

.field-row--rejected .field-row__figure,
.field-row--rejected .field-row__text,
.field-row--rejected .field-row__prose {
  color: var(--color-graphite-3);
}
```

- [ ] **Step 4: Pass the new props from ReviewPage**

In `src/routes/ReviewPage.tsx`:

1. Change the first streamExtraction import to:

```ts
import { allFields, sourcePages, provenance, figuresInThousands, TOTAL_FIELD_COUNT } from '../lib/streamExtraction';
```

2. Add these imports:

```ts
import { assignReferenceCodes, findAllMismatches } from '../lib/sourceMatch';
import type { DerivedInput } from '../components/FieldRow';
```

3. Below the imports, add:

```ts
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
```

4. In `ReviewPage()`, below `const [announcement, setAnnouncement] = useState('');`, add:

```ts
  const [activeSourceFieldId, setActiveSourceFieldId] = useState<string | null>(null);
```

and change the existing `useEffect(() => { setApproved(false); }, [attempt]);` to:

```ts
  useEffect(() => {
    setApproved(false);
    setActiveSourceFieldId(null);
  }, [attempt]);
```

5. Replace the `<FieldRow ... />` element inside `fields.map` with:

```tsx
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
```

- [ ] **Step 5: Pass the new props from the /system demo**

In `src/routes/SystemPage.tsx`, replace `FieldRowDemo` with this. It accepts optional citations and a mismatch, and manages its own "showing source" toggle:

```tsx
function FieldRowDemo({
  field,
  initialReview,
  citations = [],
  mismatch = null,
}: {
  field: ExtractionField;
  initialReview: FieldReviewState;
  citations?: SourceCitation[];
  mismatch?: LabelMismatch | null;
}) {
  const [review, setReview] = useState<FieldReviewState>(initialReview);
  const [showing, setShowing] = useState(false);
  return (
    <FieldRow
      field={field}
      review={review}
      citations={citations}
      mismatch={mismatch}
      figuresInThousands
      isShowingSource={showing}
      onShowSource={() => setShowing((s) => !s)}
      onConfirm={() => setReview({ decision: 'confirmed', reviewedAt: new Date().toISOString() })}
      onReject={() => setReview({ decision: 'rejected', reviewedAt: new Date().toISOString() })}
      onEdit={(value) => setReview({ decision: 'edited', editedValue: value, reviewedAt: new Date().toISOString() })}
      onResolveCandidate={(value) =>
        setReview(
          value === field.value
            ? { decision: 'confirmed', reviewedAt: new Date().toISOString() }
            : { decision: 'edited', editedValue: value, resolvedCandidate: value, reviewedAt: new Date().toISOString() },
        )
      }
    />
  );
}
```

Add the import:

```ts
import type { LabelMismatch, SourceCitation } from '../lib/sourceMatch';
```

Then give the existing demos citations. On the demos for "Needs review", "Confirmed", "Edited" and "Rejected", add:

```tsx
citations={[{ page: 3, lineIndexes: [2], code: '3a', kind: 'cite', option: null }]}
```

On the "Conflicting values" demos (both), add:

```tsx
citations={[
  { page: 4, lineIndexes: [8], code: '4a', kind: 'option', option: 1 },
  { page: 6, lineIndexes: [4], code: '6b', kind: 'option', option: 2 },
]}
```

On the "No source cited" demo, rename its state label to "Doesn't match the document (uncited value, label found with a different number)" and add:

```tsx
citations={[{ page: 3, lineIndexes: [10], code: '3b', kind: 'mismatch', option: null }]}
mismatch={{ page: 3, lineIndex: 10, documentValue: '1,904', difference: 406, pageTitle: 'Consolidated statement of operations' }}
```

Then add a new demo directly after it, for an uncited value with no matching line:

```tsx
          <div>
            <p className="state-label">No source cited (no line in the document to compare with)</p>
            <FieldRowDemo
              field={sampleField({ id: 'ungrounded-plain', label: 'Interest coverage', value: '3.2', unit: undefined, sourceQuote: null, confidence: 0.8 })}
              initialReview={{ decision: 'pending' }}
            />
          </div>
```

- [ ] **Step 6: Verify**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

With `npm run dev`, open `/`, run the extraction, and compare each card to `visual-v7.html`:
- the tick column is on the left and figures are right-aligned with "USD thousands" under them
- the borrower name sits on its own line
- net income shows the variance table (2,310, 1,904, difference 406) and a red **3b** "Show the line on page 3"
- total debt shows option rows coded **4a** and **6b**
- DSCR reads "Calculated as `ebitda / annual_debt_service` from **EBITDA** 6,120 and **Annual debt service** 4,310. Confirm the math and both inputs."
- guarantor shows "No source line" and "Add value"
- Confirm, Edit and Reject draw the matching tick
- clicking a reference code fills it in and outlines the card in blue, and clicking it again clears it

The bottom-of-page full source viewer is still there until Task 8.

- [ ] **Step 7: Commit**

```bash
git add src/components/FieldRow.* src/lib/streamExtraction.ts src/routes/ReviewPage.tsx src/routes/SystemPage.tsx
git commit -m "Rebuild field cards with tick marks, reference codes and variance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Source panel, drawer and split layout

**Files:**
- Create: `src/lib/useMediaQuery.ts`
- Create: `src/components/SourcePanel.tsx`, `src/components/SourcePanel.css`
- Replace: `src/routes/ReviewPage.tsx`, `src/routes/ReviewPage.css`

**Interfaces:**
- Consumes: `pageLines`, `lineKey`, `describeSelection`, `IDLE_SOURCE_STATUS`, `ReferenceIndex`, `LabelMismatch` (Tasks 1 to 3); everything from Task 7
- Produces:
  - `NARROW_LAYOUT_QUERY = '(max-width: 1000px)'`, `useMediaQuery(query: string): boolean`
  - `SourcePanel` props: `{ pages: SourcePage[]; provenance: ExtractionProvenance; references: ReferenceIndex; fieldLabels: Record<string, string>; fieldValues: Record<string, string>; receivedFieldIds: ReadonlySet<string>; activeFieldId: string | null; drawerOpen: boolean; onCloseDrawer: () => void }`

- [ ] **Step 1: Create the media query hook**

`src/lib/useMediaQuery.ts`:

```ts
import { useEffect, useState } from 'react';

/** Matches the CSS breakpoint where the source panel becomes a drawer. Keep in sync with the 1000px media queries. */
export const NARROW_LAYOUT_QUERY = '(max-width: 1000px)';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}
```

- [ ] **Step 2: Create SourcePanel**

`src/components/SourcePanel.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import type { ExtractionProvenance, SourcePage } from '../lib/types';
import { describeSelection, IDLE_SOURCE_STATUS, lineKey, pageLines, type ReferenceIndex } from '../lib/sourceMatch';
import './SourcePanel.css';

interface SourcePanelProps {
  pages: SourcePage[];
  provenance: ExtractionProvenance;
  references: ReferenceIndex;
  fieldLabels: Record<string, string>;
  /** Values as extracted, by field id, for the mismatch note. */
  fieldValues: Record<string, string>;
  /** Codes for fields that haven't streamed in yet stay hidden. */
  receivedFieldIds: ReadonlySet<string>;
  activeFieldId: string | null;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

interface Highlight {
  label: string | null;
  tone: 'blue' | 'red';
}

export function SourcePanel({
  pages,
  provenance,
  references,
  fieldLabels,
  fieldValues,
  receivedFieldIds,
  activeFieldId,
  drawerOpen,
  onCloseDrawer,
}: SourcePanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const activeCitations = activeFieldId ? (references.byField[activeFieldId] ?? []) : [];
  const activeLabel = activeFieldId ? (fieldLabels[activeFieldId] ?? '') : '';

  const highlights = new Map<string, Highlight>();
  for (const citation of activeCitations) {
    citation.lineIndexes.forEach((lineIndex, i) => {
      let label: string | null = null;
      if (i === 0 && citation.kind === 'cite') label = `Cited for ${activeLabel}`;
      if (i === 0 && citation.kind === 'option') label = `Option ${citation.option} for ${activeLabel}`;
      highlights.set(lineKey(citation.page, lineIndex), { label, tone: citation.kind === 'mismatch' ? 'red' : 'blue' });
    });
  }

  const first = activeCitations[0];
  const scrollLineKey = first && first.code !== null ? lineKey(first.page, first.lineIndexes[0]) : null;
  const scrollPage = first && first.code === null ? first.page : null;

  // Scroll only the panel body: the page itself must never move.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !activeFieldId) return;
    const target = body.querySelector<HTMLElement>('[data-scroll-target]');
    if (!target) return;
    const offset = target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
    const top = target.dataset.scrollTarget === 'page' ? offset : offset - body.clientHeight / 2 + target.offsetHeight / 2;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    body.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [activeFieldId, drawerOpen]);

  useEffect(() => {
    if (drawerOpen) closeRef.current?.focus({ preventScroll: true });
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseDrawer();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, onCloseDrawer]);

  return (
    <>
      <div
        className={`source-panel__scrim${drawerOpen ? ' source-panel__scrim--open' : ''}`}
        onClick={onCloseDrawer}
        aria-hidden="true"
      />
      <aside
        className={`source-panel${drawerOpen ? ' source-panel--open' : ''}`}
        aria-labelledby="source-panel-title"
        role={drawerOpen ? 'dialog' : undefined}
        aria-modal={drawerOpen ? true : undefined}
      >
        <div className="source-panel__head">
          <div>
            <h2 id="source-panel-title" className="source-panel__title">
              Source document
            </h2>
            <p className="source-panel__meta">
              {provenance.filename}, {provenance.pageCount} pages. Codes in the margin match the fields.
            </p>
            <p className="source-panel__meta">
              Extracted by {provenance.model}, {new Date(provenance.completedAt).toLocaleString()}
            </p>
          </div>
          <button ref={closeRef} type="button" className="button button--quiet source-panel__close" onClick={onCloseDrawer}>
            Close
          </button>
        </div>

        <p className="source-panel__status" aria-live="polite">
          {activeFieldId ? describeSelection(activeLabel, activeCitations) : IDLE_SOURCE_STATUS}
        </p>

        <div className="source-panel__body" ref={bodyRef}>
          {pages.map((page) => (
            <section
              key={page.page}
              className="source-panel__page"
              aria-label={`Page ${page.page}`}
              data-scroll-target={scrollPage === page.page ? 'page' : undefined}
            >
              <h3 className="source-panel__page-title">Page {page.page}</h3>
              {pageLines(page.text).map((text, lineIndex) => {
                const key = lineKey(page.page, lineIndex);
                const reference = references.byLine[key];
                const visible = reference && reference.fieldIds.some((id) => receivedFieldIds.has(id)) ? reference : null;
                const mismatchFieldId = visible && visible.kind === 'mismatch' ? visible.fieldIds[0] : null;
                const highlight = highlights.get(key);
                const classes = [
                  'source-line',
                  mismatchFieldId ? 'source-line--mismatch' : null,
                  highlight ? `source-line--highlight source-line--${highlight.tone}` : null,
                ]
                  .filter(Boolean)
                  .join(' ');
                const Text = highlight ? 'mark' : 'span';
                return (
                  <div key={key} className={classes} data-scroll-target={scrollLineKey === key ? 'line' : undefined}>
                    <span className="source-line__code">{visible?.code ?? ''}</span>
                    <Text className="source-line__text">
                      {highlight?.label ? <span className="source-line__label">{highlight.label}</span> : null}
                      {text || ' '}
                      {mismatchFieldId ? (
                        <span className="source-line__note">
                          Differs from extracted {fieldLabels[mismatchFieldId]}, {fieldValues[mismatchFieldId]}
                        </span>
                      ) : null}
                    </Text>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}
```

`src/components/SourcePanel.css`:

```css
.source-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-ledger);
  border-radius: var(--radius-panel);
}

.source-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2-5);
  padding: var(--space-4) var(--space-5) var(--space-1-5);
}

.source-panel__title {
  font-size: var(--text-md);
  font-weight: var(--weight-bold);
}

.source-panel__meta {
  font-size: var(--text-xs);
  color: var(--color-ledger-text);
}

.source-panel__close {
  display: none;
  background: var(--color-card);
}

.source-panel__status {
  margin: 0 var(--space-5);
  padding: var(--space-1) 0 var(--space-2-5);
  border-bottom: var(--border-thin) solid var(--color-ledger-line);
  font-size: var(--text-xs);
  color: var(--color-ledger-text);
}

.source-panel__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 var(--space-5) var(--space-6) var(--space-2);
}

.source-panel__page {
  padding-top: var(--space-3-5);
}

.source-panel__page-title {
  margin: 0 0 var(--space-1-5) calc(var(--code-column) + var(--space-1));
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--color-ledger-text);
}

.source-line {
  display: grid;
  grid-template-columns: var(--code-column) minmax(0, 1fr);
  gap: var(--space-1);
  font-family: var(--font-doc);
  font-size: var(--text-sm);
  line-height: var(--leading-doc);
  color: var(--color-ledger-text);
}

.source-line__code {
  padding-right: var(--space-1-5);
  text-align: right;
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  color: var(--color-ledger-code);
}

.source-line__text {
  padding: 0 var(--space-2);
  border-radius: var(--radius-code);
  background: none;
  color: inherit;
  white-space: pre-wrap;
}

.source-line__label,
.source-line__note {
  display: block;
  font-family: var(--font-ui);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  white-space: normal;
}

.source-line__label {
  color: var(--color-pencil-blue);
}

.source-line__note {
  color: var(--color-pencil-red);
}

.source-line--mismatch .source-line__code {
  color: var(--color-pencil-red);
}

.source-line--mismatch .source-line__text {
  font-weight: var(--weight-bold);
  color: var(--color-graphite);
}

.source-line--highlight .source-line__text {
  padding: var(--space-1) var(--space-2-5);
  background: var(--color-card);
  font-weight: var(--weight-bold);
  color: var(--color-graphite);
}

.source-line--blue .source-line__code {
  color: var(--color-pencil-blue);
}

.source-line--blue .source-line__text {
  box-shadow: inset var(--bar-width) 0 0 var(--color-pencil-blue);
}

.source-line--red .source-line__text {
  box-shadow: inset var(--bar-width) 0 0 var(--color-pencil-red);
}

.source-panel__scrim {
  display: none;
}

/* Media queries can't read custom properties. 1000px matches NARROW_LAYOUT_QUERY. */
@media (max-width: 1000px) {
  .source-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-drawer);
    width: var(--drawer-width);
    border-radius: var(--radius-panel) 0 0 var(--radius-panel);
    box-shadow: var(--shadow-drawer);
    transform: translateX(105%);
    visibility: hidden;
    transition:
      transform var(--duration-drawer) var(--easing-drawer),
      visibility 0s var(--duration-drawer);
  }

  .source-panel--open {
    transform: none;
    visibility: visible;
    transition: transform var(--duration-drawer) var(--easing-drawer);
  }

  .source-panel__close {
    display: inline-flex;
  }

  .source-panel__scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: var(--z-scrim);
    background: var(--color-scrim);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-base) var(--easing-standard);
  }

  .source-panel__scrim--open {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .source-panel,
  .source-panel--open,
  .source-panel__scrim {
    transition: none;
  }
}
```

- [ ] **Step 3: Replace ReviewPage**

`src/routes/ReviewPage.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
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
    setDrawerOpen(false);
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
```

`src/routes/ReviewPage.css`:

```css
.review-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  height: 100%;
  padding: 0 var(--space-3-5) var(--space-3-5);
}

.review-page__dev-control {
  display: flex;
  justify-content: flex-end;
}

.review-page__region {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: var(--space-1) var(--space-4-5) var(--space-4-5);
  border-radius: var(--radius-region);
  background: var(--color-region);
}

.review-page__split {
  display: grid;
  flex: 1;
  min-height: 0;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: var(--space-4);
}

.review-page__fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  overflow: auto;
  padding: var(--border-thick) var(--space-1-5) var(--space-2) var(--border-thick);
}

/* Media queries can't read custom properties. 1000px matches NARROW_LAYOUT_QUERY. */
@media (max-width: 1000px) {
  .review-page__split {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

- [ ] **Step 4: Verify**

Run: `npm run build && npm run lint && npm test`
Expected: all pass. (If TypeScript rejects `inert={drawerOpen}`, the installed `@types/react` is older than 19. Check `npm ls @types/react` reports 19.x.)

With `npm run dev`, at a window wider than 1000px:
- the source panel sits beside the fields in ledger green
- clicking **3a** on Total revenue highlights "Net sales 48,213" with "Cited for Total revenue" above it, the status reads "Showing line 3a, cited for Total revenue.", and the page itself doesn't scroll
- Total debt highlights both lines with "Option 1 for Total debt" and "Option 2 for Total debt"
- line 3b always shows "Differs from extracted Net income, 2,310"
- the old bottom-of-page source viewer is gone

Narrow the window below 1000px. The panel disappears. Clicking a reference opens the drawer with focus on Close, and Escape, Close and a scrim click each close it and return focus to the reference. Opening the drawer and then widening the window closes it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/useMediaQuery.ts src/components/SourcePanel.* src/routes/ReviewPage.tsx src/routes/ReviewPage.css
git commit -m "Show the source beside the fields with coded line highlights

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Document header sign-off block

**Files:**
- Replace: `src/components/DocumentHeader.tsx`, `src/components/DocumentHeader.css`
- Modify: `src/routes/ReviewPage.tsx` (DocumentHeader call site)
- Modify: `src/routes/SystemPage.tsx` (DocumentHeader demos)

**Interfaces:**
- Consumes: `TickMark` (Task 5), `Button` size `large` (Task 5)
- Produces: `DocumentHeader` props `{ borrowerName: string; periodEnd: string; figuresInThousands: boolean; status: JobStatus; totalCount: number; decisions: FieldDecision[]; canApprove: boolean; approved: boolean; onApprove: () => void }`. The `provenance`, `receivedCount` and `decidedCount` props are removed.

- [ ] **Step 1: Replace DocumentHeader**

`src/components/DocumentHeader.tsx`:

```tsx
import { useId } from 'react';
import type { FieldDecision, JobStatus } from '../lib/types';
import { Button } from './Button';
import { TickMark } from './TickMark';
import './DocumentHeader.css';

interface DocumentHeaderProps {
  borrowerName: string;
  /** As extracted, e.g. "2025-06-30". */
  periodEnd: string;
  figuresInThousands: boolean;
  status: JobStatus;
  totalCount: number;
  /** The decision for each received field, in field order. */
  decisions: FieldDecision[];
  canApprove: boolean;
  approved: boolean;
  onApprove: () => void;
}

function formatPeriodEnd(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

export function DocumentHeader({
  borrowerName,
  periodEnd,
  figuresInThousands,
  status,
  totalCount,
  decisions,
  canApprove,
  approved,
  onApprove,
}: DocumentHeaderProps) {
  const id = useId();
  const received = decisions.length;
  const decided = decisions.filter((d) => d !== 'pending').length;
  const count =
    status === 'streaming' ? `${received} of ${totalCount} fields received` : `${decided} of ${totalCount} fields ticked`;
  const reason =
    status === 'failed'
      ? 'The extraction has to finish before you can approve.'
      : canApprove
        ? 'Every field has a decision.'
        : 'Every field needs a decision before you can approve.';

  return (
    <header className="document-header">
      <div>
        <h1 className="document-header__name">{borrowerName || 'Borrower name pending'}</h1>
        <p className="document-header__meta">
          {periodEnd ? `Fiscal year ended ${formatPeriodEnd(periodEnd)}. ` : null}
          {figuresInThousands ? (
            <>
              All figures in <strong>thousands of U.S. dollars</strong>.
            </>
          ) : null}
        </p>
      </div>

      <div className="document-header__signoff">
        <div className="document-header__status">
          <b id={`${id}-count`} className="document-header__count">
            {count}
          </b>
          <div className="document-header__ticks" aria-hidden="true">
            {Array.from({ length: totalCount }, (_, i) => {
              const decision = i < received ? decisions[i] : null;
              return (
                <span key={i} className={`document-header__tick${decision === null ? ' document-header__tick--waiting' : ''}`}>
                  {decision && decision !== 'pending' ? <TickMark decision={decision} size="small" decorative /> : null}
                </span>
              );
            })}
          </div>
          <span id={`${id}-reason`} className="document-header__reason">
            {reason}
          </span>
        </div>
        <Button
          variant="primary"
          size="large"
          onClick={onApprove}
          disabled={!canApprove || approved}
          aria-describedby={`${id}-count ${id}-reason`}
        >
          {approved ? 'Approved' : 'Approve extraction'}
        </Button>
      </div>
    </header>
  );
}
```

`src/components/DocumentHeader.css`:

```css
.document-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-4-5) var(--space-1);
}

.document-header__name {
  font-size: var(--text-3xl);
  font-weight: var(--weight-heavy);
  letter-spacing: var(--tracking-tight);
  line-height: var(--leading-tight);
}

.document-header__meta {
  margin-top: var(--space-1);
  font-size: var(--text-base);
  color: var(--color-graphite-2);
}

.document-header__meta strong {
  font-weight: var(--weight-semibold);
  color: var(--color-graphite);
}

.document-header__signoff {
  display: flex;
  align-items: center;
  gap: var(--space-4-5);
}

.document-header__status {
  display: grid;
  justify-items: end;
  gap: var(--space-1-5);
}

.document-header__count {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.document-header__ticks {
  display: flex;
  gap: var(--space-1);
}

.document-header__tick {
  display: grid;
  place-items: center;
  width: var(--size-tick-box);
  height: var(--size-tick-box);
  border-radius: var(--radius-code);
  background: var(--color-card);
}

.document-header__tick--waiting {
  background: transparent;
  border: var(--border-thin) dashed var(--color-graphite-3);
}

.document-header__reason {
  font-size: var(--text-xs);
  color: var(--color-graphite-2);
}

/* Media queries can't read custom properties. 1000px matches NARROW_LAYOUT_QUERY. */
@media (max-width: 1000px) {
  .document-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .document-header__signoff {
    width: 100%;
    justify-content: space-between;
  }

  .document-header__status {
    justify-items: start;
  }
}
```

- [ ] **Step 2: Update the ReviewPage call site**

In `src/routes/ReviewPage.tsx`, replace the `<DocumentHeader ... />` element with:

```tsx
            <DocumentHeader
              borrowerName={borrowerName}
              periodEnd={periodEnd}
              figuresInThousands={figuresInThousands}
              status={status}
              totalCount={TOTAL_FIELD_COUNT}
              decisions={fields.map((f) => getDecision(f.id).decision)}
              canApprove={canApprove}
              approved={approved}
              onApprove={() => setApproved(true)}
            />
```

- [ ] **Step 3: Update the /system demos**

In `src/routes/SystemPage.tsx`, delete the `demoProvenance` constant and replace the three `<DocumentHeader ... />` demos with:

```tsx
          <div>
            <p className="state-label">Streaming, nothing decided yet</p>
            <DocumentHeader
              borrowerName="Halvorsen Marine Supply, LLC"
              periodEnd="2025-06-30"
              figuresInThousands
              status="streaming"
              totalCount={10}
              decisions={['pending', 'pending', 'pending', 'pending']}
              canApprove={false}
              approved={false}
              onApprove={() => {}}
            />
          </div>
          <div>
            <p className="state-label">Complete, partly reviewed</p>
            <DocumentHeader
              borrowerName="Halvorsen Marine Supply, LLC"
              periodEnd="2025-06-30"
              figuresInThousands
              status="complete"
              totalCount={10}
              decisions={['rejected', 'confirmed', 'confirmed', 'edited', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending']}
              canApprove={false}
              approved={false}
              onApprove={() => {}}
            />
          </div>
          <div>
            <p className="state-label">Approved</p>
            <DocumentHeader
              borrowerName="Halvorsen Marine Supply, LLC"
              periodEnd="2025-06-30"
              figuresInThousands
              status="complete"
              totalCount={10}
              decisions={['confirmed', 'confirmed', 'confirmed', 'confirmed', 'edited', 'edited', 'confirmed', 'confirmed', 'rejected', 'confirmed']}
              canApprove
              approved
              onApprove={() => {}}
            />
          </div>
```

- [ ] **Step 4: Verify**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

On `/`: while streaming, the header reads "N of 10 fields received" and unreceived boxes are dashed. When complete it reads "0 of 10 fields ticked". Each decision fills its box with the same pencil mark as the card. The meta line reads "Fiscal year ended June 30, 2025. All figures in thousands of U.S. dollars." Approve enables only when all 10 fields are ticked. Use the "Fails partway through" scenario to confirm the reason line changes.

- [ ] **Step 5: Commit**

```bash
git add src/components/DocumentHeader.* src/routes/ReviewPage.tsx src/routes/SystemPage.tsx
git commit -m "Add sign-off block with per-field tick row to the header

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Restyle the remaining components

**Files:**
- Modify: `src/components/FieldSkeleton.tsx`; replace `src/components/FieldSkeleton.css`
- Replace: `src/components/ErrorBanner.css`, `src/components/EmptyState.css`, `src/components/EditFieldDialog.css`, `src/components/ProgressIndicator.css`, `src/components/ScenarioControl.css`
- Modify: `src/components/EditFieldDialog.tsx` (Cancel variant)

**Interfaces:**
- Consumes: tokens from Task 4 only. No props change.

- [ ] **Step 1: FieldSkeleton matches the card shape**

Replace the return in `src/components/FieldSkeleton.tsx`:

```tsx
  return (
    <div className="field-skeleton" aria-hidden="true">
      <div className="field-skeleton__tick" />
      <div className="field-skeleton__body">
        <div className="field-skeleton__label" />
        <div className="field-skeleton__value" />
      </div>
    </div>
  );
```

`src/components/FieldSkeleton.css`:

```css
.field-skeleton {
  display: grid;
  grid-template-columns: var(--tick-column) minmax(0, 1fr);
  border-radius: var(--radius-card);
  background: var(--color-card);
}

.field-skeleton__tick {
  border-right: var(--border-thin) solid var(--color-card-divider);
}

.field-skeleton__body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4-5);
}

.field-skeleton__label,
.field-skeleton__value {
  height: var(--space-4);
  border-radius: var(--radius-code);
  background: linear-gradient(90deg, var(--color-option) 25%, var(--color-region) 37%, var(--color-option) 63%);
  background-size: 400% 100%;
  animation: field-skeleton-shimmer 1.4s ease infinite;
}

.field-skeleton__label {
  width: 40%;
}

.field-skeleton__value {
  width: 20%;
}

@keyframes field-skeleton-shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .field-skeleton__label,
  .field-skeleton__value {
    animation: none;
  }
}
```

- [ ] **Step 2: ErrorBanner**

`src/components/ErrorBanner.css`:

```css
.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
  padding: var(--space-3-5) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-red-wash);
}

.error-banner__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--color-red-ink);
}

.error-banner__text strong {
  color: var(--color-pencil-red);
}
```

- [ ] **Step 3: EmptyState**

`src/components/EmptyState.css`:

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-10);
  border-radius: var(--radius-region);
  background: var(--color-region);
}

.empty-state__title {
  font-size: var(--text-2xl);
  font-weight: var(--weight-heavy);
  letter-spacing: var(--tracking-tight);
}

.empty-state__description {
  max-width: 48ch;
  color: var(--color-graphite-2);
}
```

- [ ] **Step 4: EditFieldDialog**

In `src/components/EditFieldDialog.tsx`, change the Cancel button's `variant="secondary"` to `variant="quiet"`.

`src/components/EditFieldDialog.css`:

```css
.edit-field-dialog {
  width: var(--dialog-width);
}

.edit-field-dialog__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-6);
}

.edit-field-dialog__title {
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
}

.edit-field-dialog__original {
  font-size: var(--text-sm);
  color: var(--color-graphite-2);
}

.edit-field-dialog__quote {
  padding: var(--space-2-5) var(--space-3);
  border-radius: var(--radius-option);
  background: var(--color-ledger);
  font-family: var(--font-doc);
  font-size: var(--text-sm);
  color: var(--color-ledger-text);
  white-space: pre-wrap;
}

.edit-field-dialog__label {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.edit-field-dialog__input {
  padding: var(--space-2) var(--space-3);
  border: var(--border-thin) solid var(--color-input-border);
  border-radius: var(--radius-control);
  font-size: var(--text-md);
  font-variant-numeric: tabular-nums;
}

.edit-field-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
```

- [ ] **Step 5: ProgressIndicator and ScenarioControl**

`src/components/ProgressIndicator.css`:

```css
.progress-indicator {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.progress-indicator__label {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  color: var(--color-graphite-2);
}

.progress-indicator__bar {
  width: 100%;
  height: var(--space-1-5);
  border: none;
  border-radius: var(--radius-code);
  overflow: hidden;
}

.progress-indicator__bar::-webkit-progress-bar {
  background: var(--color-region);
}

.progress-indicator__bar::-webkit-progress-value {
  background: var(--color-pencil-blue);
  transition: width var(--duration-base) var(--easing-standard);
}

.progress-indicator__bar::-moz-progress-bar {
  background: var(--color-pencil-blue);
}
```

`src/components/ScenarioControl.css`:

```css
.scenario-control {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-graphite-2);
}

.scenario-control__select {
  padding: var(--space-1) var(--space-2);
  border: var(--border-thin) solid var(--color-input-border);
  border-radius: var(--radius-control);
  background: var(--color-card);
  font-size: var(--text-xs);
}
```

- [ ] **Step 6: Verify**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

On `/`: the idle state is a slate panel with a heavy title. Skeletons while streaming have the tick column. The "Fails partway" banner sits on a red wash inside the region. The Edit dialog shows the quote on ledger green.

- [ ] **Step 7: Commit**

```bash
git add src/components/FieldSkeleton.* src/components/ErrorBanner.css src/components/EmptyState.css src/components/EditFieldDialog.* src/components/ProgressIndicator.css src/components/ScenarioControl.css
git commit -m "Restyle remaining components to the workpaper tokens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: /system rewrite and legacy cleanup

**Files:**
- Replace: `src/routes/SystemPage.tsx`, `src/routes/SystemPage.css`
- Delete: `src/components/Badge.tsx`, `src/components/Badge.css`, `src/components/SourceEvidence.tsx`, `src/components/SourceEvidence.css`
- Modify: `src/components/Button.tsx` (drop legacy variants)
- Modify: `src/styles/tokens.css` (delete the legacy alias block)

**Interfaces:**
- Consumes: everything from Tasks 4 to 10
- Produces: `Button` variants are only `'primary' | 'quiet' | 'text'`

- [ ] **Step 1: Replace SystemPage**

`src/routes/SystemPage.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '../components/Button';
import { ConflictResolver } from '../components/ConflictResolver';
import { DocumentHeader } from '../components/DocumentHeader';
import { EditFieldDialog } from '../components/EditFieldDialog';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { FieldRow } from '../components/FieldRow';
import { FieldSkeleton } from '../components/FieldSkeleton';
import { Flag } from '../components/Flag';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { ReferenceButton } from '../components/ReferenceButton';
import { ScenarioControl } from '../components/ScenarioControl';
import { SourcePanel } from '../components/SourcePanel';
import { TickMark } from '../components/TickMark';
import { VarianceSchedule } from '../components/VarianceSchedule';
import { assignReferenceCodes, findAllMismatches, type LabelMismatch, type SourceCitation } from '../lib/sourceMatch';
import { allFields, provenance, sourcePages, TOTAL_FIELD_COUNT, type StreamScenario } from '../lib/streamExtraction';
import type { ExtractionField, FieldDecision, FieldReviewState } from '../lib/types';
import { useExtractionStream } from '../lib/useExtractionStream';
import './SystemPage.css';

const COLOR_TOKENS = [
  'graphite', 'graphite-2', 'graphite-3', 'region', 'card', 'option', 'line', 'input-border',
  'ledger', 'ledger-line', 'ledger-text', 'ledger-code',
  'pencil-blue', 'blue-wash', 'pencil-red', 'red-wash', 'red-ink', 'ochre', 'tick-pending',
];

const TYPE_TOKENS = ['text-2xs', 'text-xs', 'text-sm', 'text-base', 'text-md', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'];

const RADIUS_TOKENS = ['radius-region', 'radius-panel', 'radius-card', 'radius-option', 'radius-control', 'radius-code'];

const DECISIONS: FieldDecision[] = ['pending', 'confirmed', 'edited', 'rejected'];

const MISMATCHES = findAllMismatches(allFields, sourcePages);
const REFERENCES = assignReferenceCodes(allFields, sourcePages, MISMATCHES);
const FIELD_LABELS = Object.fromEntries(allFields.map((f) => [f.id, f.label]));
const FIELD_VALUES = Object.fromEntries(allFields.map((f) => [f.id, f.value]));
const ALL_FIELD_IDS = new Set(allFields.map((f) => f.id));
const PANEL_DEMO_FIELDS = ['total_revenue', 'total_debt', 'net_income', 'covenant_summary'];

const CITE_3A: SourceCitation[] = [{ page: 3, lineIndexes: [2], code: '3a', kind: 'cite', option: null }];
const DEBT_OPTIONS: SourceCitation[] = [
  { page: 4, lineIndexes: [8], code: '4a', kind: 'option', option: 1 },
  { page: 6, lineIndexes: [4], code: '6b', kind: 'option', option: 2 },
];
const NET_INCOME_CITATION: SourceCitation[] = [{ page: 3, lineIndexes: [10], code: '3b', kind: 'mismatch', option: null }];
const NET_INCOME_MISMATCH: LabelMismatch = {
  page: 3,
  lineIndex: 10,
  documentValue: '1,904',
  difference: 406,
  pageTitle: 'Consolidated statement of operations',
};

function sampleField(overrides: Partial<ExtractionField> = {}): ExtractionField {
  return {
    id: 'sample',
    label: 'Total revenue',
    value: '48,213',
    unit: 'USD',
    sourceQuote: 'Net sales 48,213',
    page: 3,
    confidence: 0.95,
    ...overrides,
  };
}

const CONFLICT_FIELD = sampleField({
  id: 'total_debt',
  label: 'Total debt',
  value: '21,500',
  sourceQuote: 'Total long-term debt 21,500',
  page: 4,
  confidence: 0.62,
  candidates: [{ value: '24,750', sourceQuote: 'Total debt, including current portion 24,750', page: 6 }],
});

function FieldRowDemo({
  field,
  initialReview,
  citations = [],
  mismatch = null,
}: {
  field: ExtractionField;
  initialReview: FieldReviewState;
  citations?: SourceCitation[];
  mismatch?: LabelMismatch | null;
}) {
  const [review, setReview] = useState<FieldReviewState>(initialReview);
  const [showing, setShowing] = useState(false);
  return (
    <FieldRow
      field={field}
      review={review}
      citations={citations}
      mismatch={mismatch}
      figuresInThousands
      isShowingSource={showing}
      onShowSource={() => setShowing((s) => !s)}
      onConfirm={() => setReview({ decision: 'confirmed', reviewedAt: new Date().toISOString() })}
      onReject={() => setReview({ decision: 'rejected', reviewedAt: new Date().toISOString() })}
      onEdit={(value) => setReview({ decision: 'edited', editedValue: value, reviewedAt: new Date().toISOString() })}
      onResolveCandidate={(value) =>
        setReview(
          value === field.value
            ? { decision: 'confirmed', reviewedAt: new Date().toISOString() }
            : { decision: 'edited', editedValue: value, resolvedCandidate: value, reviewedAt: new Date().toISOString() },
        )
      }
    />
  );
}

function SourcePanelDemo() {
  const [active, setActive] = useState<string | null>('net_income');
  return (
    <div className="component-grid">
      <div className="component-row">
        {PANEL_DEMO_FIELDS.map((id) => (
          <ReferenceButton
            key={id}
            codes={(REFERENCES.byField[id] ?? []).flatMap((c) => (c.code ? [c.code] : []))}
            label={FIELD_LABELS[id]}
            pressed={active === id}
            tone={MISMATCHES[id] ? 'red' : 'blue'}
            onClick={() => setActive((current) => (current === id ? null : id))}
          />
        ))}
      </div>
      <p className="state-label">On screens 1000px wide and under this panel becomes the drawer, so it is hidden here.</p>
      <div className="system-page__panel-demo">
        <SourcePanel
          pages={sourcePages}
          provenance={provenance}
          references={REFERENCES}
          fieldLabels={FIELD_LABELS}
          fieldValues={FIELD_VALUES}
          receivedFieldIds={ALL_FIELD_IDS}
          activeFieldId={active}
          drawerOpen={false}
          onCloseDrawer={() => {}}
        />
      </div>
    </div>
  );
}

function LiveStreamDemo() {
  const [scenario, setScenario] = useState<StreamScenario>('success');
  const { status, fields, errorMessage, begin, retry } = useExtractionStream(scenario);

  return (
    <div className="component-grid">
      <ScenarioControl value={scenario} onChange={setScenario} />
      {status === 'idle' ? (
        <EmptyState
          title="No extraction in progress"
          description="This demo drives the same hook and simulator the Review page uses."
          actionLabel="Run extraction"
          onAction={begin}
        />
      ) : (
        <>
          <ProgressIndicator label="Fields received" value={fields.length} max={TOTAL_FIELD_COUNT} />
          {status === 'failed' && errorMessage ? (
            <ErrorBanner message={errorMessage} receivedCount={fields.length} totalCount={TOTAL_FIELD_COUNT} onRetry={retry} />
          ) : null}
          <p className="state-label">
            Last received: {fields.slice(-3).map((f) => f.label).join(', ') || 'nothing yet'}
            {status === 'complete' ? '. Done.' : ''}
          </p>
        </>
      )}
    </div>
  );
}

export function SystemPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="system-page">
      <div>
        <h1 className="system-page__title">Design system</h1>
        <p className="system-page__intro">
          The interface borrows from audit workpapers: a pencil tick for every decision, a page-and-letter
          code tying each figure to its source line, and a variance when the two disagree. Components use
          these tokens through <code>var(--token-name)</code> only.
        </p>
      </div>

      <section className="system-section">
        <h2 className="system-section__title">Color</h2>
        <div className="swatch-grid">
          {COLOR_TOKENS.map((token) => (
            <div className="swatch" key={token}>
              <div className="swatch__fill" style={{ background: `var(--color-${token})` }} />
              <div className="swatch__label">{token}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Type</h2>
        <p className="system-page__intro">
          Libre Franklin for the interface and figures. Courier Prime for the source document and reference codes.
        </p>
        {TYPE_TOKENS.map((token) => (
          <div className="type-row" key={token}>
            <span className="type-row__name">{token}</span>
            <span style={{ fontSize: `var(--${token})` }}>Net sales 48,213</span>
          </div>
        ))}
        <p className="type-row__doc">Adjusted EBITDA (see Note 7) 6,120</p>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Radius by level</h2>
        <div className="radius-row">
          {RADIUS_TOKENS.map((token) => (
            <div className="radius-sample" key={token} style={{ borderRadius: `var(--${token})` }}>
              {token}
            </div>
          ))}
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Tick marks</h2>
        <div className="component-row">
          {DECISIONS.map((d) => (
            <div className="tick-sample" key={d}>
              <TickMark decision={d} />
              <span className="state-label">{d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Flags</h2>
        <div className="component-row">
          <Flag tone="danger" icon="warning">Doesn't match the document</Flag>
          <Flag tone="danger" icon="warning">No source cited</Flag>
          <Flag tone="caution" icon="split">Two possible values</Flag>
          <Flag tone="caution" icon="warning">Not found</Flag>
          <Flag tone="info" icon="calculator">Calculated, not read from the document</Flag>
          <Flag tone="caution" icon="warning">Model was unsure</Flag>
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Buttons and references</h2>
        <div className="component-row">
          <Button variant="text">Reject</Button>
          <Button variant="quiet">Edit</Button>
          <Button variant="primary">Confirm</Button>
          <Button variant="primary" disabled>Confirmed</Button>
          <Button variant="primary" size="large">Approve extraction</Button>
        </div>
        <div className="component-row">
          <ReferenceButton codes={['3a']} label="Show in source" pressed={false} onClick={() => {}} />
          <ReferenceButton codes={['3a']} label="Show in source" pressed onClick={() => {}} />
          <ReferenceButton codes={['4a', '6b']} label="Show both in source" pressed={false} onClick={() => {}} />
          <ReferenceButton codes={['3b']} label="Show the line on page 3" pressed tone="red" onClick={() => {}} />
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Variance and conflict options</h2>
        <VarianceSchedule
          fieldLabel="Net income"
          extractedValue="2,310"
          documentValue="1,904"
          documentSource="Consolidated statement of operations, page 3"
          difference={406}
          code="3b"
        />
        <ConflictResolver
          fieldId="demo-debt"
          fieldLabel="Total debt"
          originalValue="21,500"
          originalQuote="Total long-term debt 21,500"
          originalPage={4}
          candidates={[{ value: '24,750', sourceQuote: 'Total debt, including current portion 24,750', page: 6 }]}
          codes={['4a', '6b']}
          onResolve={() => {}}
        />
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Field card, every state</h2>
        <div className="component-grid component-grid--cards">
          <div>
            <p className="state-label">Loading</p>
            <FieldSkeleton />
          </div>
          <div>
            <p className="state-label">Not reviewed</p>
            <FieldRowDemo field={sampleField()} initialReview={{ decision: 'pending' }} citations={CITE_3A} />
          </div>
          <div>
            <p className="state-label">Confirmed</p>
            <FieldRowDemo field={sampleField({ id: 'confirmed' })} initialReview={{ decision: 'confirmed' }} citations={CITE_3A} />
          </div>
          <div>
            <p className="state-label">Edited</p>
            <FieldRowDemo
              field={sampleField({ id: 'edited' })}
              initialReview={{ decision: 'edited', editedValue: '49,800' }}
              citations={CITE_3A}
            />
          </div>
          <div>
            <p className="state-label">Rejected</p>
            <FieldRowDemo field={sampleField({ id: 'rejected' })} initialReview={{ decision: 'rejected' }} citations={CITE_3A} />
          </div>
          <div>
            <p className="state-label">Short text value</p>
            <FieldRowDemo
              field={sampleField({ id: 'name', label: 'Borrower legal name', value: 'Halvorsen Marine Supply, LLC', unit: undefined, sourceQuote: 'Halvorsen Marine Supply, LLC and Subsidiary', page: 1 })}
              initialReview={{ decision: 'pending' }}
              citations={[{ page: 1, lineIndexes: [0], code: '1a', kind: 'cite', option: null }]}
            />
          </div>
          <div>
            <p className="state-label">Model was unsure</p>
            <FieldRowDemo
              field={sampleField({ id: 'low-confidence', label: 'Fiscal year end', value: '2025-06-30', unit: undefined, sourceQuote: 'for the fiscal year ended June 30, 2025', page: 1, confidence: 0.41 })}
              initialReview={{ decision: 'pending' }}
              citations={[{ page: 1, lineIndexes: [2], code: '1b', kind: 'cite', option: null }]}
            />
          </div>
          <div>
            <p className="state-label">Not found</p>
            <FieldRowDemo
              field={sampleField({ id: 'missing', label: 'Guarantor', value: '', unit: undefined, sourceQuote: null, page: undefined, confidence: null, status: 'not_found' })}
              initialReview={{ decision: 'pending' }}
            />
          </div>
          <div>
            <p className="state-label">Doesn't match the document</p>
            <FieldRowDemo
              field={sampleField({ id: 'net-income', label: 'Net income', value: '2,310', sourceQuote: null, page: undefined, confidence: 0.88 })}
              initialReview={{ decision: 'pending' }}
              citations={NET_INCOME_CITATION}
              mismatch={NET_INCOME_MISMATCH}
            />
          </div>
          <div>
            <p className="state-label">No source cited, nothing to compare with</p>
            <FieldRowDemo
              field={sampleField({ id: 'ungrounded', label: 'Interest coverage', value: '3.2', unit: undefined, sourceQuote: null, page: undefined, confidence: 0.8 })}
              initialReview={{ decision: 'pending' }}
            />
          </div>
          <div>
            <p className="state-label">Calculated</p>
            <FieldRowDemo
              field={sampleField({
                id: 'derived',
                label: 'Debt service coverage ratio',
                value: '1.42',
                unit: undefined,
                sourceQuote: null,
                page: undefined,
                confidence: 0.9,
                derived: { formula: 'ebitda / annual_debt_service', inputLabels: ['EBITDA', 'Annual debt service'] },
              })}
              initialReview={{ decision: 'pending' }}
            />
          </div>
          <div>
            <p className="state-label">Narrative value</p>
            <FieldRowDemo
              field={sampleField({
                id: 'prose',
                label: 'Financial covenants',
                value: 'The Company is required to maintain a minimum fixed charge coverage ratio of 1.25 to 1.00... As of June 30, 2025, the Company was in compliance with all covenants, except as described in Note 9, for which the lender granted a waiver dated August 4, 2025.',
                unit: undefined,
                sourceQuote: 'Note 8 — Debt and Covenants',
                page: 6,
                confidence: 0.74,
              })}
              initialReview={{ decision: 'pending' }}
              citations={[{ page: 6, lineIndexes: [0], code: '6a', kind: 'cite', option: null }]}
            />
          </div>
          <div>
            <p className="state-label">Two possible values, unresolved</p>
            <FieldRowDemo field={CONFLICT_FIELD} initialReview={{ decision: 'pending' }} citations={DEBT_OPTIONS} />
          </div>
          <div>
            <p className="state-label">Two possible values, resolved</p>
            <FieldRowDemo
              field={{ ...CONFLICT_FIELD, id: 'total-debt-resolved' }}
              initialReview={{ decision: 'edited', editedValue: '24,750', resolvedCandidate: '24,750' }}
              citations={DEBT_OPTIONS}
            />
          </div>
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Source panel</h2>
        <SourcePanelDemo />
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Document header</h2>
        <div className="component-grid">
          <div className="system-page__region">
            <p className="state-label">Streaming, nothing decided yet</p>
            <DocumentHeader
              borrowerName="Halvorsen Marine Supply, LLC"
              periodEnd="2025-06-30"
              figuresInThousands
              status="streaming"
              totalCount={10}
              decisions={['pending', 'pending', 'pending', 'pending']}
              canApprove={false}
              approved={false}
              onApprove={() => {}}
            />
          </div>
          <div className="system-page__region">
            <p className="state-label">Complete, partly reviewed</p>
            <DocumentHeader
              borrowerName="Halvorsen Marine Supply, LLC"
              periodEnd="2025-06-30"
              figuresInThousands
              status="complete"
              totalCount={10}
              decisions={['rejected', 'confirmed', 'confirmed', 'edited', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending']}
              canApprove={false}
              approved={false}
              onApprove={() => {}}
            />
          </div>
          <div className="system-page__region">
            <p className="state-label">Approved</p>
            <DocumentHeader
              borrowerName="Halvorsen Marine Supply, LLC"
              periodEnd="2025-06-30"
              figuresInThousands
              status="complete"
              totalCount={10}
              decisions={['confirmed', 'confirmed', 'confirmed', 'confirmed', 'edited', 'edited', 'confirmed', 'confirmed', 'rejected', 'confirmed']}
              canApprove
              approved
              onApprove={() => {}}
            />
          </div>
        </div>
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Edit field dialog</h2>
        <div className="component-row">
          <Button variant="quiet" onClick={() => setDialogOpen(true)}>
            Open edit dialog
          </Button>
        </div>
        <EditFieldDialog
          open={dialogOpen}
          fieldId="demo-net-sales"
          fieldLabel="Total revenue"
          currentValue="48,213"
          unit="USD"
          sourceQuote="Net sales 48,213"
          onSave={() => setDialogOpen(false)}
          onClose={() => setDialogOpen(false)}
        />
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Error banner</h2>
        <ErrorBanner
          message="Extraction job lost connection to the document service before finishing."
          receivedCount={6}
          totalCount={10}
          onRetry={() => {}}
        />
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Empty state</h2>
        <EmptyState
          title="No extraction in progress"
          description="Run the extraction model against this borrower's financial statements to begin review."
          actionLabel="Run extraction"
          onAction={() => {}}
        />
      </section>

      <section className="system-section">
        <h2 className="system-section__title">Live streaming demo</h2>
        <p className="system-page__intro">
          Drives the same simulator as the Review page. Use the control to try the success, slow and failure paths.
        </p>
        <LiveStreamDemo />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Replace the /system styles**

`src/routes/SystemPage.css`:

```css
.system-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  max-width: var(--system-page-width);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6) var(--space-16);
}

.system-page__title {
  font-size: var(--text-3xl);
  font-weight: var(--weight-heavy);
  letter-spacing: var(--tracking-tight);
}

.system-page__intro {
  max-width: 70ch;
  margin-top: var(--space-2);
  color: var(--color-graphite-2);
}

.system-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.system-section__title {
  padding-bottom: var(--space-2);
  border-bottom: var(--border-thin) solid var(--color-line);
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
}

.swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--swatch-min), 1fr));
  gap: var(--space-3);
}

.swatch {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: var(--border-thin) solid var(--color-line);
  border-radius: var(--radius-option);
}

.swatch__fill {
  height: var(--space-10);
}

.swatch__label {
  padding: var(--space-2);
  font-size: var(--text-xs);
  background: var(--color-card);
}

.type-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
}

.type-row__name {
  width: var(--type-label-width);
  font-size: var(--text-xs);
  color: var(--color-graphite-2);
}

.type-row__doc {
  padding: var(--space-2-5) var(--space-3);
  border-radius: var(--radius-option);
  background: var(--color-ledger);
  font-family: var(--font-doc);
  color: var(--color-ledger-text);
}

.radius-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.radius-sample {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--radius-sample-width);
  height: var(--radius-sample-height);
  background: var(--color-region);
  font-size: var(--text-xs);
  color: var(--color-graphite-2);
}

.tick-sample {
  display: grid;
  justify-items: center;
  gap: var(--space-1);
}

.component-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.component-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.component-grid--cards,
.system-page__region {
  padding: var(--space-4);
  border-radius: var(--radius-region);
  background: var(--color-region);
}

.system-page__panel-demo {
  display: flex;
  height: var(--demo-panel-height);
}

.system-page__panel-demo .source-panel {
  flex: 1;
}

.state-label {
  margin-bottom: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-graphite-2);
}
```

The sizes this file needs (`--system-page-width`, `--swatch-min`, `--type-label-width`, `--radius-sample-width`, `--radius-sample-height`) were added to `tokens.css` in Task 4.

- [ ] **Step 3: Delete Badge and SourceEvidence**

Run: `git rm src/components/Badge.tsx src/components/Badge.css src/components/SourceEvidence.tsx src/components/SourceEvidence.css`

Then run: `grep -rn "Badge\|SourceEvidence" src`
Expected: no output.

- [ ] **Step 4: Drop the legacy Button variants**

Replace `src/components/Button.tsx` with:

```tsx
import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

type ButtonVariant = 'primary' | 'quiet' | 'text';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'regular' | 'large';
}

export function Button({ variant = 'quiet', size = 'regular', className, ...rest }: ButtonProps) {
  const classes = ['button', `button--${variant}`, size === 'large' ? 'button--large' : null, className]
    .filter(Boolean)
    .join(' ');
  return <button className={classes} {...rest} />;
}
```

`ErrorBanner` and `EmptyState` already use `variant="primary"`, and `EditFieldDialog` was moved to `quiet` in Task 10.

- [ ] **Step 5: Delete the legacy tokens**

In `src/styles/tokens.css`, delete everything from the `/* ---- Legacy aliases ----` comment through `--z-toast: 200;`, keeping the closing `}`.

Then confirm nothing still uses an old name:

Run: `grep -rnE "var\(--(color-(bg|surface|border|text-|interactive|focus-ring|status-|neutral-)|font-family-|font-size-|font-weight-|line-height-|radius-(sm|md|lg|full)\b|border-width-|shadow-(sm|md|lg)\b|duration-slow|z-toast)" src`
Expected: no output.

Run: `grep -rnE "#[0-9a-fA-F]{3,8}\b|[0-9]+px" src --include=*.css | grep -v "src/styles/tokens.css" | grep -v "max-width: 1000px"`
Expected: no output. Fix any line it prints by moving the value into a token.

- [ ] **Step 6: Verify**

Run: `npm run build && npm run lint && npm test`
Expected: all pass.

Open `/system`. Every section renders: colors, type, radius, tick marks, flags, buttons and references, variance and conflict, every field card state (each reference toggles), the source panel demo (switching between the four fields highlights correctly, and net income shows the red mismatch), headers, dialog, error, empty and the live stream.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "Rewrite /system for the workpaper system and remove legacy pieces

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: README

**Files:**
- Modify: `README.md`

**Interfaces:** none.

Use exact-string edits. Each "Replace" below quotes the current text exactly as it is in `README.md`.

- [ ] **Step 1: Running it**

Replace:

```
It opens at `http://localhost:5173`. There's no backend and no environment variables, and nothing to
build beyond Vite's default. `/` is the review workspace. `/system` shows the tokens and components.
```

with:

```
It opens at `http://localhost:5173`. There's no backend and no environment variables, and nothing to
build beyond Vite's default. `/` is the review workspace. `/system` shows the tokens and components.
`npm test` runs the unit tests for the source-matching logic.
```

- [ ] **Step 2: No source cited row**

Replace the start of the "No source cited" row:

```
| **No source cited** (not in the brief; the real data needed it, and I think it's the most important row here) | `net_income` has a value (2,310) and a fairly high confidence (0.88), but `source: null`, meaning the model gave a number with no citation. On top of that, page 3 of the document says `"Net income 1,904"`, a different number for the same line. The confidence score gave no warning. Only reading the source text did.
```

with:

```
| **No source cited / doesn't match the document** (not in the brief; the real data needed it, and I think it's the most important row here) | `net_income` has a value (2,310) and a fairly high confidence (0.88), but `source: null`, meaning the model gave a number with no citation. On top of that, page 3 of the document says `"Net income 1,904"`, a different number for the same line. The confidence score gave no warning. The interface now catches this case with one narrow check (see "What I found in the data"). The field shows a small variance table (2,310, 1,904, difference 406), and the source line is always marked as differing from the extraction.
```

- [ ] **Step 3: Narrative row**

Replace:

```
The full source viewer is the only way to check this one (see below). |
```

with:

```
The source panel is the only way to check this one (see below). |
```

- [ ] **Step 4: New section on the source panel**

Insert this section directly before `## What I found in the data and how the design responded`:

```
## How the source panel works

The source document sits next to the fields on wide screens and slides in as a drawer on narrow ones,
so the analyst never loses their place in the list. The design borrows from audit workpapers. Every
line a field cites gets a code made of the page number and a letter (3a, 3b, 3c), shown in the
margin of the source and on the field. Clicking a field's code highlights that line with a label
("Cited for Total revenue"), so it never depends on color alone. Each decision leaves a pencil tick
on the field and in the header's row of ten boxes, which makes it obvious that "Approve extraction"
is for the whole result.

```

- [ ] **Step 5: Net income finding**

Replace:

```
  This is the strongest case in the data for the "no source cited means no Confirm button" rule. By
  every signal the model gave, this wrong value looked like one of the more trustworthy fields.
```

with:

```
  This is the strongest case in the data for the "no source cited means no Confirm button" rule. By
  every signal the model gave, this wrong value looked like one of the more trustworthy fields. So I
  added one narrow check. For a value with no citation only, the app looks for exactly one line that
  is the field's label followed by a number. If that number differs, the field shows the variance and
  the line is marked in the source. It never changes the value. On this document it fires once, for
  net income.
```

- [ ] **Step 6: EBITDA finding**

Replace:

```
  fragile and overconfident, which is exactly what this project argues against. What the interface
  does instead: the `ebitda` source evidence links to page 5, and the `dscr` field lists `ebitda` as
  one of its inputs, so reading one carefully leads you to the other. This is why the full source
  document is one click from every field.
```

with:

```
  fragile and overconfident, which is exactly what this project argues against. What the interface
  does instead: the `ebitda` reference (3c) highlights a line that itself says "see Note 7," and Note 7
  is a short scroll away in the same panel. The `dscr` field names EBITDA as one of its inputs, so
  reading one carefully leads you to the other.
```

- [ ] **Step 7: Covenant finding**

Replace:

```
  invites a glance instead of a read), and make sure jumping to the cited page shows the whole page,
  including Note 9, not just the quoted line.
```

with:

```
  invites a glance instead of a read), and show the cited line (6a) inside the full page text, so
  Note 9 sits right below the highlight instead of hidden behind it.
```

- [ ] **Step 8: Limitations**

Replace:

```
- **No automatic cross-field or cross-source checks**, on purpose. See the EBITDA/DSCR and net income
  findings above. The interface shows the evidence (full source text, page citations, inputs for
  derived fields), but it doesn't try to automatically catch every way two numbers in a financial
  statement can disagree. That's a deliberate choice, not something left unfinished.
```

with:

```
- **Only one automatic check, on purpose.** The label match for uncited values catches the net income
  case and nothing else. See the EBITDA/DSCR finding above. The interface shows the evidence (full
  source text, coded line highlights, inputs for derived fields), but it doesn't try to automatically
  catch every way two numbers in a financial statement can disagree. That's a deliberate choice, not
  something left unfinished.
```

Replace:

```
- **Accessibility was handled structurally but not tested with a screen reader.** It uses labeled
  native controls, keyboard-accessible `<dialog>` and `<details>`, a live region for streaming, focus
  management when a dialog reopens (see Part 3, this one had a real bug), and `aria-describedby` on the
  disabled Approve button. I haven't tested it end to end with a screen reader.
- **No automated tests.** I checked it by typechecking and by clicking through every state in a
  browser with Playwright, but there's no committed test suite.
```

with:

```
- **Accessibility was handled structurally but not tested with a screen reader.** It uses labeled
  native controls, a live region for streaming and for the source panel, highlights that carry a text
  label as well as color, focus that moves into the drawer and back to the field that opened it,
  focus management when a dialog reopens (see Part 3, this one had a real bug), and
  `aria-describedby` on the disabled Approve button. I haven't tested it end to end with a screen reader.
- **Tests cover the matching logic only.** `npm test` runs unit tests for finding quotes, assigning
  reference codes and the net income check. The interface itself I checked by clicking through every
  state in a browser with Playwright.
```

- [ ] **Step 9: Part 3**

Replace:

```
**An AI-generated mistake I caught and fixed:**
```

with:

```
**The redesign:** the split view, reference codes and workpaper look went through several rounds of
mockups. I turned down three visual directions as hard to digest, had the layout simplified twice
(fewer lines, then separate boxes), and asked for the drawer on narrow screens before choosing the
direction that's built here.

**An AI-generated mistake I caught and fixed:**
```

- [ ] **Step 10: Verify and commit**

Run: `grep -n "jump\|Jump\|<details>" README.md`
Expected: no output. If anything is printed, reword that sentence to describe the source panel.

```bash
git add README.md
git commit -m "Update README for the source panel and net income check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Full verification

**Files:** none changed unless a check fails.

- [ ] **Step 1: Automated checks**

Run: `npm test && npm run build && npm run lint`
Expected: all pass.

- [ ] **Step 2: Contrast check**

Run:

```bash
node -e '
const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(x=>x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};
const cr=(a,b)=>{const[x,y]=[L(a),L(b)].sort((p,q)=>q-p);return ((x+0.05)/(y+0.05)).toFixed(2)};
[["#23262b","#dde2e5"],["#4d535c","#dde2e5"],["#5f6670","#ffffff"],["#865400","#ffffff"],["#2547b8","#ffffff"],["#b3261e","#ffffff"],
 ["#3f4a3c","#eaf0e6"],["#56634f","#eaf0e6"],["#2547b8","#eaf0e6"],["#b3261e","#eaf0e6"],["#b3261e","#fbe7e4"],["#6e1a14","#fbe7e4"],
 ["#4d535c","#f1f3f5"],["#ffffff","#23262b"],["#757d87","#ffffff"]].forEach(([f,b])=>console.log(f,b,cr(f,b)));'
```

Expected: every pair is 4.5 or higher, except `#757d87` on white (the input border), which needs 3.0 or higher.

- [ ] **Step 3: Browser pass at 1440×900**

Run `npm run dev`. Use Playwright or a browser at 1440×900 and check each item:
- Run the extraction. While streaming, codes in the source margin appear only for fields that have arrived, and no field's code changes as others arrive.
- Click each field's reference in turn. The right line is highlighted with the right label, the status line updates, and the window never scrolls (header stays at the top).
- Total debt highlights 4a and 6b as Option 1 and Option 2.
- Net income: the variance reads 2,310, 1,904, 406, the 3b code is red, and line 3b shows "Differs from extracted Net income, 2,310" even when nothing is selected.
- Confirm, Edit and Reject each draw the matching tick on the card and in the header row. Approve enables only after all 10.
- Switch the scenario to "Fails partway through". The banner appears under the header and the reason line reads "The extraction has to finish before you can approve." Click a reference, then Retry: the highlight and active card reset.
- Turn on reduced motion (macOS: System Settings, Accessibility, Display, Reduce motion). Ticks appear without drawing and the panel jumps instead of smooth-scrolling.

- [ ] **Step 4: Browser pass at 800×900**

- The source panel is hidden and the fields fill the width. The header stacks.
- Click a reference. The drawer slides in, focus is on Close, and the line is highlighted and centered.
- Tab stays inside the drawer (the fields behind are inert).
- Escape closes it and focus returns to the reference you clicked. Repeat with Close and with a scrim click.
- Open the drawer, then resize to 1440. The drawer closes and the side-by-side layout returns with the same field highlighted.

- [ ] **Step 5: Keyboard-only review**

At 1440 wide, without the mouse: tab to each field's reference and press Enter to show it, use the conflict radios with arrow keys, open and save the Edit dialog, confirm or reject every field, and approve. Focus is always visible as a blue outline.

- [ ] **Step 6: Report**

If every step passed, no commit is needed. If a check failed, fix it in the task that owns that code, re-run Steps 1 to 5, and commit with a message describing the fix.
