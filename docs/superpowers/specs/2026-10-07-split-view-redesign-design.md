# Split-view review and visual redesign

Date: 2026-10-07
Approved mockup: `.superpowers/brainstorm/72387-1791380452/content/visual-v6.html`

## Goal

Make the extracted data the focus of the review screen, put the source document beside it
instead of at the bottom of the page, show the analyst exactly which lines a value came from, and
make the net income discrepancy impossible to miss. Replace the default-looking visual style with
a deliberate one.

## What stays the same

- Review rules: no auto-approve, no confidence sort, no "approve all." Confirm stays removed for
  conflicting, not-found and ungrounded fields. Approve needs a decision on every field and a
  completed job.
- Data flow: `normalizeExtraction.ts` is still the only place that knows the raw JSON shape.
  `useExtractionStream` and `useFieldReviews` are unchanged.
- States: empty, streaming, partial, failed, conflicting, edited, rejected, not found, no source
  cited, calculated, low confidence, narrative, ready to approve, approved. All still reachable on
  `/system`.
- Frontend only. No backend.

## Layout

```
┌ result region (tinted, rounded) ───────────────────────────────────────────┐
│ Borrower name                          0 of 10 fields reviewed  [Approve   │
│ Fiscal year, figures in thousands      ▬▬▬▬▬▬▬▬▬▬                extraction]│
│ ┌ field card ─────────────────┐  ┌ source panel ───────────────────────┐  │
│ │ Label              flag     │  │ Source document          [Close]*   │  │
│ │ 48,213 USD thousands        │  │ filename, 6 pages                   │  │
│ │ Show in source  Rej Edit Cnf│  │ status line (aria-live)             │  │
│ └─────────────────────────────┘  │ ── Page 3 ───────────────────────── │  │
│ ┌ field card ─────────────────┐  │ Net sales 48,213                    │  │
│ │ ...  (scrolls)              │  │ [Cited for EBITDA]                  │  │
│ └─────────────────────────────┘  │ Adjusted EBITDA (see Note 7) 6,120  │  │
│                                  └─────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                                                    * Close shows only in drawer mode
```

- The result region fills the viewport height (minus the app nav). The header is its title row.
- Wide screens (over 1000px): two columns, fields about 55%, source about 45%. Each column scrolls
  on its own. The source panel is its own rounded box with a gap between it and the fields.
- Narrow screens (1000px and under): fields take the full width. "Show in source" opens the source
  panel as a drawer from the right over a dimmed scrim. It closes with the Close button, Escape, or
  a click on the scrim. Opening moves focus to Close. Closing returns focus to the button that
  opened it. Widening the window while the drawer is open closes it. The drawer has
  `role="dialog"` and `aria-modal="true"` only while open.
- Motion: the drawer slide (260ms) and smooth scrolling to a highlight. Both are turned off under
  `prefers-reduced-motion`.

## Header and approval

- Borrower name (h1), then one line: "Fiscal year ended June 30, 2025. All figures in thousands of
  U.S. dollars." The thousands part only appears when `figuresInThousands` is true.
- Approve block on the right: "N of 10 fields reviewed" in bold, the reason line ("Approve the
  extraction once every field has a decision."), a segmented meter with one segment per field, and
  the "Approve extraction" button. The button's `aria-describedby` points at the count and reason.
- While streaming, the count reads "N of 10 fields received" until the job completes, and the meter
  shows received fields. If the job failed, the existing error banner sits directly under the
  header, inside the region.
- Approved: the button reads "Approved" and stays disabled, as today.
- Provenance (model name, completion time) moves to the source panel header next to the filename.

## Field cards

Each field is a white card (12px radius, no shadow). From top to bottom:

1. Label (small, secondary text) and, on the right, at most one flag: an icon with text, never
   color alone.
   - "Model was unsure" (caution, warning icon)
   - "Two possible values" (caution, split icon)
   - "Doesn't match the document" (danger, warning icon). Only when a label mismatch is found
     (see below).
   - "No source cited" (danger, warning icon). Ungrounded with no mismatch found.
   - "Not found" (caution, warning icon)
   - "Calculated" (info, calculator icon)
   - After a decision: "Confirmed", "Edited" or "Rejected" with a check, pencil or cross icon,
     replacing the risk flag.
2. Value: numbers at 28px semibold with tabular figures and the unit in small gray after them.
   Short text at 18px. Narrative values as body prose (max 62ch). Not found shows "The model found
   no value for this field." in italic gray. Edited values keep "Model extracted: …" below, as today.
3. Field-specific block, when needed: the mismatch comparison, the conflict options, or the
   calculated-field explanation.
4. Footer: "Show in source" on the left, actions on the right in the order Reject (text button),
   Edit (quiet button), Confirm (primary). Confirm is omitted where it is today. Not found uses
   "Add value" instead of "Edit". Fields with nothing to show in the source show a gray note
   instead ("Not read from the document" for calculated, "Nothing to show in the source" for not
   found, "The model cited no source" for ungrounded without a mismatch).

The card for the field currently shown in the source gets a 1.5px petrol border.

### Net income mismatch block

A two-cell comparison: "Model extracted" with the extracted value, and "Page N says" with the
document's value, both at 22px bold. Below it, one sentence: "The model cited no source for 2,310.
Page 3 reports net income of 1,904. Check the page before deciding." Brick-red tint, no border.
The extracted value is not struck through, because the analyst decides which is right. The footer
link reads "Show the line on page N".

### Conflict options

Each option is a full-width radio row: value (18px semibold), then its source line and page.
The note above reads "Both numbers appear in the document. Choose the one the memo needs." Picking
an option confirms the field, as today. "Show both in source" highlights every option's line.

## Source panel

- Header: "Source document", filename and page count, model and extraction time, Close (drawer only).
- Status line with `aria-live="polite"`: "Choose Show in source on a field to find its line here."
  When showing: "Showing page 3, the line cited for EBITDA." or "Showing both options for Total
  debt, pages 4 and 6." If a quote can't be found: "Couldn't find the quoted text on page N.
  Showing the whole page."
- Pages render in order with a "Page N" heading and a hairline. Page text is split into lines and
  set in IBM Plex Mono at 12px in a muted color.

### Highlighting

- "Show in source" is a toggle button (`aria-pressed`). Only one field is shown at a time. Pressing
  the active one again clears it (wide screens) or just reopens the drawer (narrow).
- Every highlighted line gets a light petrol tint, bold text and a label above it: "Cited for
  EBITDA", or "Option 1 for Total debt" and "Option 2 for Total debt". The label is real text, so
  screen readers and monochrome displays get it too. Field names keep their casing.
- Highlights use `<mark>`. The panel scrolls the first highlight to the middle of the view. Focus
  stays in the field list on wide screens.

### Mismatch marker

When a label mismatch exists, the matching line is always marked in the source, highlighted or not:
bold text with a brick-red line under it reading "Differs from the extracted net income (2,310)".
When that field's "Show the line on page 3" is active, the line also gets a brick-red tint.

## Finding quotes in the page

New pure function `findQuoteLines(pageText, quote)` in `src/lib/sourceMatch.ts`:

- Case-insensitive, whitespace-collapsed substring search of the quote in the page text.
- Returns the indexes of every line the match touches, or `null` if there is no match.
- Every quote in the current data matches. Pages 1 and 6 differ only by case.

## Finding the net income discrepancy

New pure function `findLabelMismatch(field, sourcePages)` in `src/lib/sourceMatch.ts`. It runs only
for ungrounded fields: a value, no source quote, not calculated, no candidates.

- It looks for a line matching `^<label>\s+<number>$`, case-insensitive, where the number may have
  thousands commas, a decimal point, or parentheses for negatives.
- If exactly one such line exists and its number differs from the extracted value (compared as
  numbers after stripping commas), it returns `{ page, lineIndex, documentValue }`.
- No match, several matches, or an equal number returns `null`. The field then shows the existing
  "No source cited" treatment.
- It never changes any value and is never used to sort, approve or hide anything.

For this data it finds exactly one result: `net_income`, page 3, "Net income 1,904". This changes
the README's "no cross-checking" stance to "one narrow, explainable check for uncited values." The
README and its limitations section get updated to match.

## Visual system (tokens)

`tokens.css` stays the only place for raw values. New semantic tokens:

| Token | Value | Use |
|---|---|---|
| `--color-ink` | `#1a2230` | Primary text |
| `--color-ink-2` | `#4a5568` | Secondary text |
| `--color-ink-3` | `#5f6a7d` | Quiet text, units (darkened from the mockup's `#7b8597`, which failed AA at 3.7:1) |
| `--color-region` | `#e8ecf1` | Result region, quiet buttons, option rows |
| `--color-card` | `#ffffff` | Field cards |
| `--color-paper` | `#f8f9f6` | Source panel |
| `--color-line` | `#d9dee6` | Hairlines |
| `--color-accent` | `#145c7a` | Actions, citations, focus ring, selected field |
| `--color-accent-tint` | `#e3eff4` | Citation highlight, selected option |
| `--color-danger` | `#a8261b` | Mismatch, no source |
| `--color-danger-tint` | `#fcebe8` | Mismatch block and line |
| `--color-caution` | `#8a5a00` | Caution flags |

All text and flag colors meet WCAG AA (4.5:1) on every surface they sit on (checked: lowest is
`--color-ink-3` on the region at 4.6:1). The source text color is `#59606b` (6.0:1 on paper).

- Type: Public Sans (400, 500, 600, 700) for the interface. IBM Plex Mono (400, 600) for source
  text and formulas. Both are self-hosted through `@fontsource` packages, so there are no external
  requests. Values use `font-variant-numeric: tabular-nums`.
- Type scale: 12, 13, 14, 15, 18, 22, 24, 28.
- Radius by level: region 22px, source panel 16px, card 12px, option row 10px, control 8px.
- No drop shadows except the drawer.
- Icons: small inline SVGs in a new `Icon` component (warning, split, calculator, document, check,
  pencil, cross).

## Components

| Component | Change |
|---|---|
| `ReviewPage` | New region and split layout. Owns `activeSourceFieldId`. Renders `SourcePanel`. Removes the bottom `<details>` viewer. |
| `DocumentHeader` | Restyled. New approve block with count, reason and segmented meter. Provenance moves out. |
| `FieldRow` | Restyled card. Flag replaces badges. New footer. Gets `isShowingSource` and `onShowSource`. |
| `SourceEvidence` | Replaced by a `ShowInSourceButton` (toggle). The quote itself now only appears in the panel. |
| `SourcePanel` (new) | Pages, line rendering, highlights, mismatch marker, status line, drawer behavior. |
| `MismatchCompare` (new) | The two-cell comparison block. |
| `ConflictResolver` | Restyled as option rows. Same props and behavior. |
| `Badge` | Replaced by `Flag` (icon plus text). `Badge` is removed if nothing else uses it. |
| `Button` | Variants become `primary`, `quiet`, `text`. `danger` and `ghost` map to these. |
| `Icon` (new) | Inline SVG set. |
| `FieldSkeleton`, `ErrorBanner`, `EmptyState`, `EditFieldDialog`, `ProgressIndicator`, `ScenarioControl` | Restyled to the new tokens. Behavior unchanged. |
| `SystemPage` | Updated sections for the new tokens, `Flag`, `Icon`, `SourcePanel` (with a highlight and a mismatch), `MismatchCompare`, and every field card state. |

## Testing

- Add Vitest for pure logic. Unit tests for `findQuoteLines` (exact, case-only difference,
  multi-line, not found) and `findLabelMismatch` (the net income case, equal number, no line,
  two matching lines, negative in parentheses, skipped for cited, calculated and conflicting
  fields).
- Manual browser check with Playwright at 1440px and 800px: highlight for each field type, both
  Total debt options, net income mismatch, drawer open and close and focus return, Escape, resize
  while open, approval gating, the streaming and failed scenarios, and reduced motion.
- Keyboard-only pass through one full review.
- `npm run build` and `npm run lint` pass.

## Out of scope

- Any other cross-field check, including the EBITDA definition gap. That stays a README finding.
- Persistence, a document queue, or a dark theme.
