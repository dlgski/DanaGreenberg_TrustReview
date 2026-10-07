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
