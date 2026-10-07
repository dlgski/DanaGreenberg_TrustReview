import { describe, expect, it } from 'vitest';
import type { ExtractionField, SourcePage } from './types';
import { normalizeExtraction } from './normalizeExtraction';
import {
  assignReferenceCodes,
  describeSelection,
  findAllMismatches,
  findLabelMismatch,
  findQuoteLines,
  isUngrounded,
  lineKey,
  pageLines,
  pageTitle,
  parseAmount,
  type SourceCitation,
} from './sourceMatch';

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
  it.each<[string, number]>([
    ['1,904', 1904],
    [' 2,310 ', 2310],
    ['(1,250)', -1250],
    ['-75', -75],
    ['1.42', 1.42],
    ['$6,120', 6120],
  ])('parses %s', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it.each<string>(['2025-06-30', 'Halvorsen Marine Supply, LLC', '', '()'])('rejects %s', (raw) => {
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

  it('says a mismatching line differs from the extracted value instead of calling it cited', () => {
    const mismatch: SourceCitation = { page: 3, lineIndexes: [0], code: '3b', kind: 'mismatch', option: null };
    expect(describeSelection('Net income', [mismatch])).toBe(
      'Showing line 3b, which differs from the extracted Net income.',
    );
  });

  it('handles a field with nothing to show', () => {
    expect(describeSelection('Guarantor', [])).toBe('Nothing to show in the source for Guarantor.');
  });
});
