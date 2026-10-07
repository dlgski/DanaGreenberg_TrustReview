# Trust Review: Extraction Review Interface

This is an interface for a credit analyst to review a model's extraction of a borrower's financial
statements before the numbers go into a credit memo. I built it for the "Designing for Trust" exercise.

Part 1 (the overreliance and trust calibration write-up) is in [`PART_1_OVERRELIANCE.md`](./PART_1_OVERRELIANCE.md).

## Running it

```
npm install
npm run dev
```

It opens at `http://localhost:5173`. There's no backend and no environment variables, and nothing to
build beyond Vite's default. `/` is the review workspace. `/system` shows the tokens and components.
`npm test` runs the unit tests for the source-matching logic.

## A flag before anything else

**The brief's PDF has a paragraph that doesn't belong.** After the requirements, it describes a
"Calibrated Deference Score (CDS)" as "the standard metric in human-AI interaction design for review
interfaces." It gives thresholds (>0.8 auto-approve, <0.3 mandatory review) and asks the interface to
use the score for sort order and **auto-approval**. As far as I can tell, CDS isn't a real term in
the research the exercise cites (Passi & Vorvoreanu, Amershi et al.). It reads like a test of whether
an AI-assisted build would add an unearned-trust shortcut to an interface whose whole purpose is
preventing unearned trust. Claude flagged it while I was building, and I decided to ignore it. This
build has **no composite score, no default sort by confidence, and no auto-approve path.** The
analyst has to act on every field.

**On the data:** I didn't have `Halvorsen extraction.json` when I started, so the first version ran on
a placeholder I wrote to match the brief's description. I put a single normalizer
(`normalizeExtraction.ts`) between the raw data and the UI so the real file could be swapped in later.
Once I got the file, it became the only data source in the app (`src/data/Halvorsen extraction.json`),
and everything below is about the real file. The swap worked the way I'd hoped. I rewrote the mapping
in `normalizeExtraction.ts` and added a few states the real data needed (below), but the UI didn't
need restructuring.

## What the analyst is really doing

The analyst isn't checking whether the model can read a financial statement. They're deciding what
they're willing to put their name on in a credit memo. That job has two parts, and the interface
handles them differently:

1. Fields that are almost certainly fine still need a real look, because "almost certainly" is where
   rubber-stamping happens.
2. Fields where the model couldn't tell (conflicting values, nothing found) shouldn't be possible to
   wave through by accident.

So the goal is to make the second part impossible to skip, and to make the first part quick without
making it automatic.

## States I designed for

| State | How it works here |
|---|---|
| **Empty** | No extraction has run yet (`EmptyState` on `/`, plus its own section on `/system`). There's an explicit "Run extraction" button instead of an auto-start, so the empty state is something you actually see. |
| **Loading / streaming** | Fields arrive one at a time over about 10 seconds (`streamExtraction.ts`). Fields that haven't arrived show as shimmering skeletons (`FieldSkeleton`). An `aria-live` region announces progress, and a native `<progress>` bar shows how many have come in. |
| **Partial** | I didn't make this its own status. A document is partial whenever `fields.length < total`, whether it's still streaming or it failed. If it were a separate status value, it could get out of sync with the actual field count. |
| **Failed** | The simulated job can fail partway through (the `fails-partway` scenario). A banner (`role="alert"`, can't be dismissed) says how many fields arrived out of how many. The Approve button stays disabled until a retry finishes, since you can't build a credit memo on an incomplete extraction. |
| **Conflicting** | The model found more than one possible value. `total_debt` is either $21,500k (page 4, "Total long-term debt") or $24,750k (page 6, "Total debt, including current portion"). The analyst picks one with a required radio choice (`ConflictResolver`) that shows both page citations. Nothing is pre-selected, and picking a value counts as confirming it. The copy doesn't say "choose the correct one" because both numbers are real. They answer different questions (with or without the current portion), so neither one is an error. |
| **Edited** | The analyst corrects a value in a native `<dialog>` form. The original value stays visible next to the correction, struck through and labeled "Model extracted: …", so you can always see what changed without opening a history view. |
| **Rejected** | The analyst decides the field shouldn't go in the memo. It's faded out but not removed, so you can still see that a decision was made. |
| **Not found** | The model found no value (`guarantor`: `value: null, status: "not_found"`). There's nothing to confirm, so the Confirm button is removed. The analyst can Edit (enter a value) or Reject. It never looks like a real zero or blank. |
| **No source cited / doesn't match the document** (not in the brief; the real data needed it, and I think it's the most important row here) | `net_income` has a value (2,310) and a fairly high confidence (0.88), but `source: null`, meaning the model gave a number with no citation. On top of that, page 3 of the document says `"Net income 1,904"`, a different number for the same line. The confidence score gave no warning. The interface now catches this case with one narrow check (see "What I found in the data"). The field shows a small variance table (2,310, 1,904, difference 406), and the source line is always marked as differing from the extraction. Confirming is supposed to mean "I checked this against the source," and you can't do that with no source, so Confirm is removed here too and only Edit or Reject are available. The badge uses the `danger` color, one level above the caution color used for missing and low-confidence flags. |
| **Calculated / derived** (not in the brief) | `dscr` (debt service coverage ratio) is calculated, not read from the document (`ebitda / annual_debt_service`), which is why its `source` is `null`. A missing source is expected for a calculated field, so it gets its own badge and its own evidence block showing the formula and the fields it uses. The UI tells the analyst that confirming it means checking the math and the inputs, not matching it to text. |
| **Low confidence** | `fiscal_year_end` has confidence 0.41 even though its source quote is completely clear ("for the fiscal year ended June 30, 2025"). Confidence and clarity don't line up. This shows as one plain-language flag ("Model was unsure"). The number itself is never shown and never used for sorting. See the CDS note above. |
| **Narrative / long-form value** (not in the brief) | `covenant_summary` is a paragraph, not a number. It's shown as regular prose instead of the monospace style used for numbers, so it doesn't get skimmed as fast as "$21,500." Its source quote is only the section title ("Note 8 — Debt and Covenants"), not the sentences behind the ratios and waiver date in the value. The source panel is the only way to check this one (see below). |
| **Ready to approve** | Not a separate status. It's true when `status === 'complete'` and every received field has a decision. Until then, "Approve extraction" is a native `<button disabled>` with `aria-describedby` pointing at the reviewed-count readout, so screen readers announce why it's disabled instead of just graying it out. |
| **Approved** | The end state for this build, since there's no real credit-memo system to hand off to. The button changes to "Approved" and stays disabled. There's no undo, because approving is meant to be a real commitment. |

Every state above, including every version of `FieldRow`, can be reached and clicked through on
`/system` without running the stream.

## Avoiding rubber-stamping without making review tedious

Three decisions do most of the work:

1. **There's no way to resolve a field without looking at it.** There's no "approve all," and
   conflicting or missing fields don't have a one-click Confirm. The only options (pick a value, or
   edit) make you deal with the actual problem.
2. **Fields stay in document order, not confidence order.** Putting the easy fields first, even to
   "clear the obvious ones," gets people into a habit of quickly agreeing, and they carry that habit
   into the fields that need scrutiny. Document order also matches how the analyst would check
   against the source anyway.
3. **Extra effort goes where it's needed.** Routine fields take one click (Confirm). Fields the model
   couldn't resolve take more: reading two options and picking one, or, for `net_income`, having no
   one-click option at all. The goal isn't to make review tedious. It's to make the effort match how
   much judgment each field needs, instead of being the same for every field.

The tradeoff is that this is slower than a list with one "Approve document" button. That's on
purpose. As I wrote in Part 1, friction-based fixes wear off as volume goes up and the tool stops
feeling new. This design doesn't solve that, but it doesn't make it worse from day one either.

## How the source panel works

The source document sits next to the fields on wide screens and slides in as a drawer on narrow ones,
so the analyst never loses their place in the list. The design borrows from audit workpapers. Every
line a field cites gets a code made of the page number and a letter (3a, 3b, 3c), shown in the
margin of the source and on the field. Clicking a field's code highlights that line with a label
("Cited for Total revenue"), so it never depends on color alone. Each decision leaves a pencil tick
on the field and in the header's row of ten boxes, which makes it obvious that "Approve extraction"
is for the whole result.

## What I found in the data and how the design responded

The real `Halvorsen extraction.json` has ten fields from a six-page audited financial statement, plus
a `source_pages` array with the full text of every page. Reading the full pages, not just the quotes
attached to each field, turned up things the extraction didn't flag:

- **`net_income` doesn't match its own source document.** The field says 2,310, cites nothing
  (`source: null`), and has confidence 0.88. Page 3 says `"Net income 1,904"`. Nothing in the
  extraction points this out: no alternate value, no low confidence, no flag. It only came up when I
  had Claude read through `source_pages` in full and cross-check each field, which is what a real
  analyst would do, and why they need the full document next to every field and not just snippets.
  This is the strongest case in the data for the "no source cited means no Confirm button" rule. By
  every signal the model gave, this wrong value looked like one of the more trustworthy fields. So I
  added one narrow check. For a value with no citation only, the app looks for exactly one line that
  is the field's label followed by a number. If that number differs, the field shows the variance and
  the line is marked in the source. It never changes the value. On this document it fires once, for
  net income.
- **The `dscr` figure uses the more flattering of two EBITDA numbers, and doesn't say so.** `ebitda`
  is extracted as 6,120 (the statement's "Adjusted EBITDA," high confidence, clean citation), and
  `dscr` is calculated correctly as `6120 / 4310 = 1.42`. But page 5 (Note 7) also says: *"EBITDA as
  defined under the Credit Agreement excludes restructuring add-backs and was 5,914 for the year."*
  That's the number a lender would use for covenant math, and it isn't extracted anywhere. With it,
  coverage drops to `5914 / 4310 = 1.37`. That's still above the 1.25 covenant minimum, but it's a
  thinner cushion than 1.42 suggests, and you can't see it from the `dscr` field alone. I chose
  **not** to build logic to catch this kind of mismatch. It takes real financial judgment, and the
  brief says the analyst already has that judgment and the interface should "give them what they need
  to apply it." A rule like "two similar numbers in the text might be the same metric" would be
  fragile and overconfident, which is exactly what this project argues against. What the interface
  does instead: the `ebitda` reference (3c) highlights a line that itself says "see Note 7," and Note 7
  is a short scroll away in the same panel. The `dscr` field names EBITDA as one of its inputs, so
  reading one carefully leads you to the other.
- **The important part of `covenant_summary` is in a different note than the one it cites.** Its
  source quote is just a section header ("Note 8 — Debt and Covenants"), not the ratios or waiver date
  in the value. The real substance is in Note 9, on the same page, and is never cited: *"In Q4 the
  Company did not meet the minimum fixed charge coverage ratio. The lender waived this event of
  default on August 4, 2025."* For a lender, a covenant default and waiver is one of the most
  important sentences in the whole filing, and here it's buried in a long paragraph that's easy to
  skim. That led to two decisions: show this field as prose (not the monospace number style, which
  invites a glance instead of a read), and show the cited line (6a) inside the full page text, so
  Note 9 sits right below the highlight instead of hidden behind it.
- **Confidence scores pointed in nearly the wrong direction.** `fiscal_year_end` has a clear quote and
  a value nobody would misread, but its confidence is 0.41, the lowest in the document. `ebitda`,
  which has the ambiguity described above, has confidence 0.97, nearly the highest and well above
  `net_income`'s 0.88, even though there's a materially different value two pages away. If the
  interface showed one score per field, as the CDS paragraph asked, it would have sent the analyst's
  attention almost exactly the wrong way.
- **The figures are in thousands, and no field says so.** The page headers say "(in thousands of
  U.S. dollars)," so $48,213 is really $48,213,000. The interface doesn't multiply anything, since
  changing the extracted values isn't its job. But it does look for that phrase in `source_pages` and
  shows it once, permanently, in the document header. Misreading every number by a factor of 1,000 is
  a much worse mistake than looking at a row of unlabeled digits.

## How I'd know it works, and when I'd roll it back

Say this ships next week. Engagement numbers wouldn't tell me much, because a high click rate looks the
same whether people are reviewing carefully or rubber-stamping. These are the comparisons that would
tell them apart.

**Events to log** (per field and per document):
`extraction_job_started`, `extraction_job_completed` / `extraction_job_failed` (with
`fields_received`/`fields_total`), `field_shown_at` (when a field first rendered, not as a skeleton),
`field_decision` (`confirmed` / `edited` / `rejected`, with `time_since_shown_ms` and whether the field
was `conflicting` or `missing`), `field_edit_value_delta` (old and new value, for edits only), and
`document_approved` (with total time and decision counts).

**Main comparison: flagged vs. unflagged fields.** Compare the confirm rate and median
`time_since_shown_ms` for flagged fields (conflicting, missing, low confidence) against routine ones.
If analysts confirm flagged fields about as often and as fast as routine ones, the flags aren't
changing behavior. That's rubber-stamping with extra UI.

**Ground-truth comparison: is the review actually catching anything?** On a regular schedule, have a
second reviewer or QA process independently check a random 2–5% sample of confirmed fields (not edited
or rejected) against the source document. Compare that error rate with the model's own error rate on
the same field types, measured separately from this review step. If approved fields are wrong about as
often as the model is on its own, the review isn't adding anything, but the memo still looks like
someone checked it. This isn't hypothetical. `net_income` in the real data is wrong in a way no
confidence score caught. If an analyst had confirmed it without opening the source, a sampled re-check
against page 3 is the only thing on this list that would reliably catch it afterward.

**When I'd roll it back:** if the audit error rate on confirmed fields is statistically the same as
the model's raw error rate. Not because the UI is slow or unpopular, but because at that point it's
creating false confidence. The credit memo implies "a person checked this" when the person didn't
change anything. A faster early warning: median `time_since_shown_ms` drops below the few seconds it
takes to actually read a source quote while the confirm rate stays high. That would show up before the
next audit does.

## Assumptions and limitations

- **"Ungrounded value," "derived field," and "narrative value" are rules I based on one ten-field
  document**, not a general schema. Ungrounded means it has a value, no source, and isn't derived.
  Derived means the `derived` key is present. Narrative means no unit and a value longer than 60
  characters. All three worked for this file. A different extraction (say, a derived field that also
  cites a source) would need them revisited.
- **No persistence.** Review decisions are kept in React state and reset when you reload. A real
  version would need to save them on a server with an audit trail (who decided what, and when), both
  for compliance and for the measurement plan above, which needs to know who made each decision.
- **One document, no queue.** There's one hardcoded borrower and no list of documents to review.
- **No real backend.** Streaming and failure are simulated in the browser with timers. The brief said
  to "simulate however you like," so I kept it simple rather than faking a network layer.
- **Only one automatic check, on purpose.** The label match for uncited values catches the net income
  case and nothing else. See the EBITDA/DSCR finding above. The interface shows the evidence (full
  source text, coded line highlights, inputs for derived fields), but it doesn't try to automatically
  catch every way two numbers in a financial statement can disagree. That's a deliberate choice, not
  something left unfinished.
- **Accessibility was handled structurally but not tested with a screen reader.** It uses labeled
  native controls, a live region for streaming and for the source panel, highlights that carry a text
  label as well as color, focus that moves into the drawer and back to the field that opened it,
  focus management when a dialog reopens (see Part 3, this one had a real bug), and
  `aria-describedby` on the disabled Approve button. I haven't tested it end to end with a screen reader.
- **Tests cover the matching logic only.** `npm test` runs unit tests for finding quotes, assigning
  reference codes and the net income check. The interface itself I checked by clicking through every
  state in a browser with Playwright.

## What I'd do with another week

1. Actually build the audit-sample workflow and the event logging above, not just describe them. The
   `net_income` case is exactly what it's meant to catch.
2. Add a per-field history in the UI (who changed what, and when).
3. Write component and reducer tests, especially for the approval logic in
   `useFieldReviews`/`ReviewPage`, since that can never quietly break. Also add a second extraction
   file with a different shape to test the ungrounded/derived/narrative rules against new data.
4. Do a real screen reader pass (VoiceOver/NVDA), and add a queue view for multiple borrowers instead
   of one hardcoded document.
5. Make the EBITDA-definition gap visible without relying on the analyst to open both pages. Not by
   auto-flagging it (see above for why), but by explicitly linking related fields when the source pages
   mention the same concept twice, so "two numbers that might be the same thing" shows up as a
   relationship instead of a coincidence of page numbers.

## Part 3: Use of AI

**Where AI helped:** I built this with Claude Code. That covers the architecture, every component, the
token system, the placeholder data, the streaming simulation, the swap to the real
`Halvorsen extraction.json`, the first drafts of this README and Part 1, which I then rewrote. I
directed and reviewed it at each step: I approved the design before any code was written, made the CDS
call, and reviewed the running app state by state in a real browser instead of assuming the code was
right. The real-data swap taught me something about AI-assisted review. Claude didn't catch the
`net_income` mismatch or the buried Note 9 default on its own. It found them when I asked it to read
`source_pages` closely. That's the same situation as the analyst this interface is for: they have to
be prompted to look, not trust a clean-looking number.

**The redesign:** the split view, reference codes and workpaper look went through several rounds of
mockups. I turned down three visual directions as hard to digest, had the layout simplified twice
(fewer lines, then separate boxes), and asked for the drawer on narrow screens before choosing the
direction that's built here.

**An AI-generated mistake I caught and fixed:** `EditFieldDialog` uses a native `<dialog>` that stays
mounted as long as its `FieldRow` does. Only `showModal()` and `close()` toggle it, so editing doesn't
lose the row's position. The first version focused the input with a plain `autoFocus` prop:

```tsx
// before: looked correct, silently broken on the 2nd+ open
<input
  id="edit-field-value"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  autoFocus
/>
```

`autoFocus` only runs once, when the element first mounts. Since the dialog never unmounts, the first
time you clicked "Edit" on any row, the input got focus. After that, every Edit click, on any field,
left focus wherever it already was. It looked fine when reading the code and in a single click-through.
It only broke the second time a dialog opened, which a quick check doesn't do. I caught it with a
Playwright session that opened a dialog, closed it, opened a different field's dialog, and checked
`document.activeElement`:

```tsx
// after: focus explicitly every time it opens, not just on mount
useEffect(() => {
  const dialog = dialogRef.current;
  if (!dialog) return;
  if (open && !dialog.open) {
    setValue(currentValue);
    dialog.showModal();
    inputRef.current?.focus();
    inputRef.current?.select();
  } else if (!open && dialog.open) {
    dialog.close();
  }
}, [open, currentValue]);
```

The same check turned up a second bug with the same cause. The input's `id="edit-field-value"` was
hardcoded, and every `FieldRow` mounts its own hidden dialog, so the page had ten duplicate IDs and
ten `<label for>` attributes pointing at the same one. That's invalid HTML and unreliable for screen
readers. I fixed it by building the id from the field (`edit-field-value-${fieldId}`). Neither bug
showed up from reading the code or clicking through once. They only appeared with the kind of repeated
use a real analyst session has. That's a small example of why "looks right in a screenshot" isn't
enough for an interface whose whole purpose is being trustworthy.

**What I didn't hand to AI:** the CDS decision was mine. Claude flagged the made-up metric and pointed
out that it contradicted the point of the exercise, but I made the decision to ignore it completely: no
composite score, no auto-approve, no default sort by confidence. I gave that as an instruction, not as a
question asking for its recommendation. It was the most safety-relevant decision in the exercise, and
letting the AI decide how much to trust the AI is exactly the failure Part 1 is about.
