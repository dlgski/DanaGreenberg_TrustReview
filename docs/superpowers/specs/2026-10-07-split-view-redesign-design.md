# Split-view review and workpaper redesign

Date: 2026-10-07
Approved mockups: layout from `layout-split-v5.html`, visual design from `visual-v7.html`
(both in `.superpowers/brainstorm/72387-1791380452/content/`, kept locally and not committed).

## Goal

Make the extracted data the focus of the review screen, put the source document beside it
instead of at the bottom of the page, show the analyst exactly which line each value came from, and
make the net income discrepancy impossible to miss. Replace the default-looking visual style with
one taken from the analyst's own world: the audit workpaper, where checked figures get a pencil tick
mark and a cross-reference code that ties them to the source.

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
┌ result region (slate, rounded) ────────────────────────────────────────────┐
│ Borrower name                         1 of 10 fields ticked     [Approve   │
│ Fiscal year, figures in thousands     [✗][ ][ ][ ][ ][ ][ ][ ][ ][ ] extr.]│
│ ┌──┬ field ───────────────────┐  ┌ source panel (ledger green) ─────────┐  │
│ │✓ │ Total revenue    48,213  │  │ Source document             [Close]* │  │
│ │  │           USD thousands  │  │ filename, pages, model, time         │  │
│ │  │ [3a] Show in source  R E C│  │ status line (aria-live)              │  │
│ └──┴──────────────────────────┘  │ ─────────────────────────────────────│  │
│ ┌──┬ field ───────────────────┐  │ Page 3                               │  │
│ │◌ │ ...  (scrolls)           │  │ 3a ▌Cited for Total revenue          │  │
│ └──┴──────────────────────────┘  │    ▌Net sales 48,213                 │  │
│                                  │ 3b  Net income 1,904                 │  │
│                                  │     Differs from extracted net income│  │
│                                  └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                                                    * Close shows only in drawer mode
```

- The result region fills the viewport height (minus the app nav). The header is its title row.
  The page itself never scrolls. Only the field list and the source body scroll.
- Wide screens (over 1000px): two columns, fields about 55%, source about 45%, with a 16px gap. The
  source panel is its own rounded box.
- Narrow screens (1000px and under): fields take the full width. Choosing a field's reference opens
  the source panel as a drawer from the right over a dimmed scrim. It closes with the Close button,
  Escape, or a click on the scrim. Opening moves focus to Close. Closing returns focus to the
  reference button that opened it. Widening the window while the drawer is open closes it. The
  drawer has `role="dialog"` and `aria-modal="true"` only while open.
- Motion: the drawer slide (260ms), smooth scrolling inside the source body, and the tick mark
  drawing itself (380ms) when a decision is made. All are turned off under
  `prefers-reduced-motion`. Scrolling to a highlight scrolls only the source body
  (`scrollTo` on the container, not `scrollIntoView`, which also scrolled the page in the mockup).

## Header and approval

- Borrower name (h1, 26px, weight 800), then one line: "Fiscal year ended June 30, 2025. All
  figures in thousands of U.S. dollars." The thousands part only appears when
  `figuresInThousands` is true.
- Sign-off block on the right:
  - "N of 10 fields ticked" in bold.
  - A tick row: one small white box per field, in field order. Each box shows the same pencil mark
    as the field's tick column once a decision is made. It's decorative (`aria-hidden`) because the
    count says the same thing in text.
  - The reason line: "Every field needs a decision before you can approve." It changes to "Every
    field has a decision." when complete.
  - "Approve extraction" button (graphite). Its `aria-describedby` points at the count and reason.
- While streaming, the count reads "N of 10 fields received" and the tick row shows received
  fields as empty boxes and the rest as dashed outlines. If the job failed, the existing error
  banner sits directly under the header, inside the region.
- Approved: the button reads "Approved" and stays disabled, as today.

## Field cards

Each field is a white card (10px radius, no shadow) with two columns.

**Tick column (46px, left).** Shows the decision as a pencil mark, with an `aria-label` naming it:

| Decision | Mark | Color |
|---|---|---|
| Pending | Dashed circle | gray |
| Confirmed | ✓ stroke | blue pencil |
| Edited | Pencil stroke | blue pencil |
| Rejected | ✗ stroke | red pencil |

The mark draws itself (stroke-dashoffset animation) when the decision is made.

**Body, top to bottom:**

1. Line item: label (15px, weight 600) on the left and the figure right-aligned on the same line,
   the way a financial statement sets it. Figures are 24px bold with tabular figures, with the unit
   ("USD thousands") in small gray text underneath. Short text values (borrower name) sit on their
   own line below the label at 17px. Narrative values are body prose (max 62ch). Not found shows
   "The model found no value for this field." in italic gray. Edited values keep "Model extracted:
   …" below, as today.
2. At most one flag below the line item: an icon with text, never color alone.
   - "Model was unsure" (ochre, warning icon)
   - "Two possible values" (ochre, split icon). Each option row below names its own source line,
     which is where the analyst sees that one includes the current portion of debt.
   - "Doesn't match the document" (red pencil, warning icon). Only when a label mismatch is found.
   - "No source cited" (red pencil, warning icon). Ungrounded with no mismatch found.
   - "Not found" (ochre, warning icon)
   - "Calculated, not read from the document" (blue pencil, calculator icon)
3. Field-specific block, when needed: the variance schedule, the conflict options, or the
   calculated-field explanation ("EBITDA 6,120 divided by Annual debt service 4,310. Confirm the
   math and both inputs." with input names in bold).
4. Footer: the reference button on the left, actions on the right in the order Reject (text
   button), Edit (quiet button), Confirm (graphite). Confirm is omitted where it is today. Not found
   uses "Add value" and the mismatch uses "Edit value" instead of "Edit". Fields with no source line
   show "No source line" in gray instead of a reference.

The card currently shown in the source gets a 1.5px blue pencil border.

### Reference codes

- Every source line that a field cites gets a code: the page number plus a letter, assigned in
  line order within the page (1a, 1b, 3a, 3b, 3c, 4a, 6a, 6b, 6c for this data). A mismatch line
  gets a code too.
- The field's reference button shows its code(s) in Courier Prime inside a small outlined box,
  followed by "Show in source" ("Show both in source" for two options, "Show the line on page N"
  for the mismatch, in red pencil).
- The button is a toggle (`aria-pressed`). Pressed, the code box fills solid. Its accessible name
  includes the code, e.g. "3a Show in source".
- Conflict option rows also show their code next to the source description.

### Variance schedule (net income)

A small table on a red wash, no border:

| | |
|---|---:|
| Model extracted, no source cited | 2,310 |
| Consolidated statement of operations, page 3 | 1,904 |
| **Difference** (red pencil, rule above) | **406** |

Below it: "Check line 3b before deciding. Edit the value if the statement is right." The extracted
value is not struck through, because the analyst decides which is right. The table has a visually
hidden caption, "Net income variance". The difference is the absolute value of extracted minus
document. The row label for the document value comes from the page's first line, in sentence case.

### Conflict options

Each option is a full-width radio row on a light gray fill: radio, code plus source description,
figure right-aligned (18px bold). The selected row gets a blue wash and inner outline. Picking an
option confirms the field, as today. The fieldset has a visually hidden legend.

## Source panel

- Material: ledger-pad green (`#eaf0e6`), 14px radius, no border or shadow (shadow only in drawer
  mode).
- Header: "Source document" (15px bold), then "filename, N pages. Codes in the margin match the
  fields." Model and extraction time on a second line. Close button in drawer mode.
- Status line with `aria-live="polite"`, separated from the pages by a hairline: "Choose a field's
  code to find its line here." When showing: "Showing line 3a, cited for Total revenue." or
  "Showing lines 4a and 6b for Total debt." If a quote can't be found: "Couldn't find the quoted
  text on page N. Showing the whole page."
- Pages render in order with a "Page N" heading. Each line is a two-column row: a 40px right-aligned
  margin for the reference code, then the text in Courier Prime 13px at line-height 1.75. Codes on
  cited lines are always visible, in a muted green-gray, so the analyst can see every line the
  extraction used.

### Highlighting

- One field at a time. Choosing a field's reference again clears it (wide) or just reopens the
  drawer (narrow).
- A highlighted line gets a white background, a 3px blue pencil bar on its left, bold text, and a
  label above it: "Cited for Total revenue", or "Option 1 for Total debt" and "Option 2 for Total
  debt". Its margin code turns blue. The label is real text, so screen readers and monochrome
  displays get it too. Field names keep their casing.
- Highlights use `<mark>`. The source body scrolls the first highlight to its vertical center.
  Focus stays in the field list on wide screens.

### Mismatch marker

The mismatch line is always marked, selected or not: margin code in red pencil, bold text, and a
red-pencil note under it, "Differs from extracted Net income, 2,310" (field name keeps its casing). When that field's reference
is active, the line also gets the white background and a red pencil bar.

## Finding quotes in the page

New pure function `findQuoteLines(pageText, quote)` in `src/lib/sourceMatch.ts`:

- Case-insensitive, whitespace-collapsed substring search of the quote in the page text.
- Returns the indexes of every line the match touches, or `null` if there is no match.
- Every quote in the current data matches. Pages 1 and 6 differ only by case.

New pure function `assignReferenceCodes(fields, sourcePages)` in the same file. It returns a map
from field id to its codes, plus a map from page and line to code, using the rules under
"Reference codes" above.

## Finding the net income discrepancy

New pure function `findLabelMismatch(field, sourcePages)` in `src/lib/sourceMatch.ts`. It runs only
for ungrounded fields: a value, no source quote, not calculated, no candidates.

- It looks for a line matching `^<label>\s+<number>$`, case-insensitive, where the number may have
  thousands commas, a decimal point, or parentheses for negatives.
- If exactly one such line exists and its number differs from the extracted value (compared as
  numbers after stripping commas), it returns `{ page, lineIndex, documentValue }`.
- No match, several matches, or an equal number returns `null`. The field then shows the "No source
  cited" treatment.
- It never changes any value and is never used to sort, approve or hide anything.

For this data it finds exactly one result: `net_income`, page 3, "Net income 1,904". This changes
the README's "no cross-checking" stance to "one narrow, explainable check for uncited values." The
README and its limitations section get updated to match.

## Visual system (tokens)

`tokens.css` stays the only place for raw values. New semantic tokens:

| Token | Value | Use |
|---|---|---|
| `--color-graphite` | `#23262b` | Primary text, primary buttons |
| `--color-graphite-2` | `#4d535c` | Secondary text |
| `--color-graphite-3` | `#5f6670` | Quiet text, units |
| `--color-region` | `#dde2e5` | Result region, quiet buttons |
| `--color-card` | `#ffffff` | Field cards, tick boxes, highlighted source line |
| `--color-option` | `#f1f3f5` | Conflict option rows |
| `--color-ledger` | `#eaf0e6` | Source panel |
| `--color-ledger-line` | `#cdd8c6` | Hairlines in the source panel |
| `--color-ledger-text` | `#3f4a3c` | Source text |
| `--color-ledger-code` | `#56634f` | Margin codes |
| `--color-pencil-blue` | `#2547b8` | Ticks, references, highlights, focus ring, selected field |
| `--color-blue-wash` | `#e2e8fa` | Selected option |
| `--color-pencil-red` | `#b3261e` | Rejected tick, mismatch, no source |
| `--color-red-wash` | `#fbe7e4` | Variance schedule |
| `--color-ochre` | `#865400` | Caution flags |

All text colors meet WCAG AA (4.5:1) on the surfaces they sit on. Checked: margin codes 5.5:1 on
ledger, red pencil 5.6:1 on ledger, ochre 6.4:1 on white, quiet text 5.8:1 on white.

- Type: Libre Franklin (400, 500, 600, 700, 800) for the interface and figures. Courier Prime (400,
  700) for source text, margin codes and reference codes. Both are self-hosted through
  `@fontsource` packages, so there are no external requests. Figures use
  `font-variant-numeric: tabular-nums lining-nums`.
- Type scale: 11.5, 12.5, 13, 14, 15, 17, 18, 24, 26.
- Radius by level: region 20px, source panel 14px, card 10px, option row 8px, control 7px, code
  box 4px.
- No drop shadows except the drawer.
- Avoided on purpose (they read as generic): cream backgrounds with serif display type, all-caps
  labels, dot-separated metadata, monospace for small UI labels, arrows on links, identical cards
  with matching shadows.

## Components

| Component | Change |
|---|---|
| `ReviewPage` | New region and split layout. Owns `activeSourceFieldId`. Computes reference codes and mismatches once. Renders `SourcePanel`. Removes the bottom `<details>` viewer. |
| `DocumentHeader` | Restyled. New sign-off block with count, tick row, reason and Approve. Provenance moves to `SourcePanel`. |
| `FieldRow` | Restyled two-column card with `TickMark`, line-item layout, `Flag`, and footer. Gets `codes`, `isShowingSource`, `onShowSource` and `mismatch`. |
| `SourceEvidence` | Replaced by `ReferenceButton`. The quote now only appears in the panel. |
| `SourcePanel` (new) | Pages, coded line rows, highlights, mismatch marker, status line, drawer behavior. |
| `TickMark` (new) | The pencil mark for a decision, with the draw animation and `aria-label`. Also used small in the header tick row. |
| `ReferenceButton` (new) | Code box(es) plus label, `aria-pressed` toggle. |
| `VarianceSchedule` (new) | The net income table. |
| `ConflictResolver` | Restyled as option rows with codes. Same props plus `codes`. |
| `Badge` | Replaced by `Flag` (icon plus text). `Badge` is removed if nothing else uses it. |
| `Button` | Variants become `primary` (graphite), `quiet`, `text`. `danger` and `ghost` map to these. |
| `Icon` (new) | Inline SVG set: warning, split, calculator. |
| `FieldSkeleton`, `ErrorBanner`, `EmptyState`, `EditFieldDialog`, `ProgressIndicator`, `ScenarioControl` | Restyled to the new tokens. Behavior unchanged. |
| `SystemPage` | Updated sections for the new tokens, `Flag`, `Icon`, `TickMark` (all four), `ReferenceButton`, `SourcePanel` (with a highlight and a mismatch), `VarianceSchedule`, and every field card state. |

## Testing

- Add Vitest for pure logic. Unit tests for:
  - `findQuoteLines`: exact match, case-only difference, a quote spanning lines, not found.
  - `assignReferenceCodes`: codes for this data match 1a, 1b, 3a, 3b, 3c, 4a, 6a, 6b, 6c; letters
    follow line order; a field with two options gets two codes.
  - `findLabelMismatch`: the net income case, an equal number, no matching line, two matching
    lines, a negative in parentheses, and skipped for cited, calculated and conflicting fields.
- Manual browser check with Playwright at 1440px and 800px: highlight for each field type, both
  Total debt options, net income mismatch, tick marks for all four decisions and the header tick
  row, the page not scrolling when a highlight is shown, drawer open and close and focus return,
  Escape, resize while open, approval gating, the streaming and failed scenarios, and reduced
  motion.
- Keyboard-only pass through one full review.
- `npm run build` and `npm run lint` pass.

## Out of scope

- Any other cross-field check, including the EBITDA definition gap. That stays a README finding.
- Persistence, a document queue, or a dark theme.
