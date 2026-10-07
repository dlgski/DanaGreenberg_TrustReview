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
