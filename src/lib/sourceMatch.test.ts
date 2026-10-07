import { describe, expect, it } from 'vitest';
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
