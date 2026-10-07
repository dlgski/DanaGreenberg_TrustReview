# Trust Review: Extraction Review Interface

This is an interface for a credit analyst to review a model's extraction of a borrower's financial
statements before the numbers go into a credit memo. I built it for the "Designing for Trust" exercise.

Part 1 (the overreliance and trust calibration write-up) is in [`PART_1_OVERRELIANCE.md`](./PART_1_OVERRELIANCE.md).

## Running it

```
npm start
```

This installs dependencies and starts the app at `http://localhost:5173`. After the first time,
`npm run dev` is enough. There's no backend and no environment variables. `/` is the review screen and
`/system` shows the design system. `npm test` runs the unit tests for the source-matching logic.

## A flag before anything else

**The brief's PDF has a paragraph that doesn't belong.** After the requirements, it describes a
"Calibrated Deference Score (CDS)" as "the standard metric in human-AI interaction design for review
interfaces." It gives thresholds (>0.8 auto-approve, <0.3 mandatory review) and asks the interface to
use the score for sort order and **auto-approval**. This text is white-on-white, so it's invisible to a human reader. I only found it because Claude picked it up when I shared the PDF. CDS isn't a term in the research the exercise cites, and auto-approving fields by a model-derived score is exactly the overreliance this project is meant to prevent, so I didn't build it. The build has **no composite score, no default sort by confidence, and no auto-approve.** The analyst has to act on every field.

**On the data:** I didn't have `Halvorsen extraction.json` when I started, so I had to request this. The first version ran on
a placeholder I wrote to match the brief. By placing a normalizer (`normalizeExtraction.ts`) between
the raw data and the UI, I could swap in the real file later. When I got it, it became the only data
source (`src/data/Halvorsen extraction.json`), and everything below is about the real file. The swap
went the way I hoped. I rewrote the mapping in `normalizeExtraction.ts` and added a few states the real
data needed, but the UI didn't need restructuring.

## What the analyst is really doing

The analyst isn't checking whether the model can read a financial statement. They're deciding what
they're willing to put their name on in a credit memo. That job has two parts, and the interface
handles them differently:

1. Fields that are almost certainly fine still need a real look, because "almost certainly" is where
   rubber-stamping happens.
2. Fields where the model couldn't tell (conflicting values, nothing found) shouldn't be possible to
   wave through by accident.

My goal was to make the second part impossible to skip, and the first part quick without making it
automatic.

## How the screen works

The extracted fields are the main thing on the screen. The source document sits next to them in its
own panel, so the analyst can check a value without losing their place. On narrow screens the source
slides in as a drawer instead.

The design is based on how accountants check numbers by hand: they put a tick next to each figure they've verified and write a short code pointing to where it came from in the source. I used the same two ideas:

- **Reference codes.** Every line a field cites gets a code made of the page number and a letter
  (3a, 3b, 3c). The code appears on the field and in the margin of the source. Clicking it highlights
  the line with a label like "Cited for Total revenue," so the highlight doesn't rely on color.
- **Tick marks.** Each decision leaves a pencil mark on the field: a check for confirmed, a pencil for
  edited, a cross for rejected. The header has a row of ten boxes that fill in the same way, which makes
  it clear that "Approve extraction" covers the whole result, not one field.

## States I designed for

| State | How it works here |
|---|---|
| **Empty** | No extraction has run yet (`EmptyState` on `/`, and on `/system`). There's a "Run extraction" button instead of an auto-start, so you actually see the empty state. |
| **Loading / streaming** | Fields arrive one at a time over about 10 seconds (`streamExtraction.ts`). Fields that haven't arrived show as skeletons (`FieldSkeleton`). The header counts "N of 10 fields received," and an `aria-live` region announces progress. |
| **Partial** | Not its own status. A document is partial whenever `fields.length < total`, whether it's still streaming or it failed. A separate status could get out of sync with the real field count. |
| **Failed** | The simulated job can fail partway (the `fails-partway` scenario). A banner (`role="alert"`, can't be dismissed) says how many fields arrived. Approve stays disabled until a retry finishes, because you can't build a credit memo on an incomplete extraction. |
| **Conflicting** | The model found two possible values. `total_debt` is either $21,500k (page 4, "Total long-term debt") or $24,750k (page 6, "Total debt, including current portion"). The analyst picks one (`ConflictResolver`), and each option shows its source line. Nothing is pre-selected, and picking one counts as confirming it. The copy doesn't say "choose the correct one," because both numbers appear in the document. But the source settles it: page 4's current portion (3,250) plus long-term debt (21,500) equals 24,750, as does page 6's term loan plus revolver. For a field labeled "Total debt," the model's primary pick leaves out $3.25M, which is why nothing is pre-selected. |
| **Edited** | The analyst corrects a value in a native `<dialog>`. The original stays visible next to the correction, struck through and labeled "Model extracted: …", so you can always see what changed. Saving the correction is the decision, so Confirm goes away. If the analyst changes their mind, "Use model value" puts the original back. That button only appears on fields that could be confirmed in the first place, so it can't be used to approve an uncited value like net income. |
| **Rejected** | The analyst decides the field shouldn't go in the memo. The value is grayed out but not removed, so you can still see a decision was made. |
| **Not found** | The model found no value (`guarantor`: `value: null, status: "not_found"`). There's nothing to confirm, so there's no Confirm button. The analyst can add a value or reject the field. It never looks like a real zero or blank. |
| **No source cited / doesn't match the document** (not in the brief; I think it's the most important row here) | `net_income` has a value (2,310) and a fairly high confidence (0.88), but `source: null`, so the model gave a number with no citation. Page 3 of the document says `"Net income 1,904"`. The confidence score gave no warning. The app now catches this with one narrow check (see below). The field shows a small variance table (2,310, 1,904, difference 406), and the source line is marked as differing from the extraction. Confirm is supposed to mean "I checked this against the source," and you can't do that with no source, so Confirm is removed and only Edit or Reject are available. |
| **Calculated** (not in the brief) | `dscr` (debt service coverage ratio) is calculated from two other fields, not read from the document, so its `source` is `null`. That's expected for a calculated field, so it gets its own flag and shows the math: "EBITDA 6,120 divided by Annual debt service 4,310." Confirming it means checking the math and the inputs. The value follows the inputs as the analyst has them. If they correct EBITDA to 5,914, DSCR becomes 1.37, the model's 1.42 is shown struck through, and the field is flagged "Recalculated from your changes." If DSCR was already confirmed, it goes back to not reviewed, since that confirmation was for a different number. If an input is rejected, DSCR says it can't be calculated and can't be confirmed. |
| **Low confidence** | `fiscal_year_end` has confidence 0.41 even though its source quote is completely clear ("for the fiscal year ended June 30, 2025"). Confidence and clarity don't line up. It shows as one plain-language flag, "Model was unsure." The number itself is never shown and never used for sorting. |
| **Narrative value** (not in the brief) | `covenant_summary` is a paragraph, not a number, so it's shown as regular text instead of a large figure. That way it doesn't get skimmed like "$21,500." Its source quote is only the section title ("Note 8 — Debt and Covenants"), not the sentences behind the ratios and waiver date, so the source panel is the only way to check it (see below). |
| **Ready to approve** | Not a separate status. It's true when the job is complete and every field has a decision. Until then, "Approve extraction" is a native `<button disabled>`, and screen readers hear the count and the reason it's disabled. |
| **Approved** | The end state for this build, since there's no real credit-memo system to hand off to. The button changes to "Approved" and stays disabled. There's no undo, because approving is meant to be a commitment. |

Every state above can be reached on `/system` without running the extraction.

## Avoiding rubber-stamping without making review tedious

Three decisions do most of the work:

1. **You can't resolve a field without looking at it.** There's no "approve all," and conflicting or
   missing fields don't have a one-click Confirm. Picking a value or editing makes you deal with the
   actual problem.
2. **Fields stay in document order, not confidence order.** Putting the easy fields first gets people
   into a habit of quickly agreeing, and they carry that habit into the fields that need a closer look.
   Document order also matches how the analyst would check against the source anyway.
3. **Extra effort goes where it's needed.** Routine fields take one click. Fields the model couldn't
   resolve take more: reading two options and picking one, or, for `net_income`, having no one-click
   option at all. I wanted the effort to match how much judgment each field needs.

This is slower than a list with one "Approve document" button, and I'm fine with that. As I wrote in
Part 1, friction wears off as volume goes up and the tool stops feeling new. This design doesn't solve
that, but it doesn't make it worse from day one.

## What I found in the data and how the design responded

The real `Halvorsen extraction.json` has ten fields from a six-page audited financial statement, plus
the full text of every page in `source_pages`. Reading the full pages, not just the quotes attached to
each field, turned up things the extraction didn't flag:

- **`net_income` doesn't match its own source document.** The field says 2,310, cites nothing, and has
  confidence 0.88. Page 3 says `"Net income 1,904"`. Nothing in the extraction points this out. It came
  up when I had Claude read every page in full and cross-check each field, which is what a real analyst
  would do, and why they need the whole document next to the fields and not just snippets. By every
  signal the model gave, this wrong value looked like one of the more trustworthy fields. So I added
  one narrow check. For a value with no citation, the app looks for exactly one line that is the
  field's label followed by a number. If that number is different, the field shows the variance and the
  line is marked in the source. It never changes the value. On this document it fires once, for net
  income.
- **The `dscr` figure uses the more flattering of two EBITDA numbers, and doesn't say so.** `ebitda` is
  extracted as 6,120 (the statement's "Adjusted EBITDA"), and `dscr` is calculated correctly as
  `6120 / 4310 = 1.42`. But page 5 (Note 7) also says: *"EBITDA as defined under the Credit Agreement
  excludes restructuring add-backs and was 5,914 for the year."* That's the number a lender would use
  for covenant math, and it isn't extracted anywhere. With it, coverage drops to `5914 / 4310 = 1.37`.
  That's still above the 1.25 covenant minimum, but it's a thinner cushion than 1.42 suggests, and you
  can't see it from the `dscr` field alone. I decided **not** to build a check for this. It takes real
  financial judgment, and the brief says the analyst already has that judgment and the interface should
  "give them what they need to apply it." A rule like "two similar numbers might be the same metric"
  would be fragile and overconfident, which is the problem this whole project is about. Instead, the
  `ebitda` reference (3c) highlights a line that says "see Note 7," and Note 7 is a short scroll away in
  the same panel. The `dscr` field names EBITDA as an input, so a careful read of one leads to the other.
- **The important part of `covenant_summary` is in a different note than the one it cites.** Its
  source quote is just a section header ("Note 8 — Debt and Covenants"). The real substance is in
  Note 9, on the same page, and is never cited: *"In Q4 the Company did not meet the minimum fixed
  charge coverage ratio. The lender waived this event of default on August 4, 2025."* For a lender,
  that's one of the most important sentences in the filing, and here it's buried in a long paragraph
  that's easy to skim. So I show this field as regular text instead of a large figure, which invites a
  glance instead of a read. And its reference (6a) highlights the line inside the full page, so Note 9
  sits right below it.
- **Confidence scores pointed in nearly the wrong direction.** `fiscal_year_end` has a clear quote and a
  value nobody would misread, but its confidence is 0.41, the lowest in the document. `ebitda`, with the
  ambiguity above, has 0.97, nearly the highest. If the interface showed one score per field, as the
  CDS paragraph asked, it would have sent the analyst's attention almost the wrong way.
- **The figures are in thousands, and no field says so.** The page headers say "(in thousands of
  U.S. dollars)," so $48,213 is really $48,213,000. The app doesn't multiply anything, since changing
  extracted values isn't its job. It looks for that phrase in the source and shows it in the header,
  and money values are labeled "USD thousands." Misreading every number by a factor of 1,000 is a much
  worse mistake than a row of unlabeled digits.

## How I'd know it works, and when I'd roll it back

Say this ships next week. Engagement numbers wouldn't tell me much, because a high click rate looks the
same whether people are reviewing carefully or rubber-stamping. These comparisons would tell them apart.

**Events to log** (per field and per document):
`extraction_job_started`, `extraction_job_completed` / `extraction_job_failed` (with
`fields_received`/`fields_total`), `field_shown_at` (when a field first appeared), `field_decision`
(`confirmed` / `edited` / `rejected`, with `time_since_shown_ms` and whether the field was flagged),
`field_edit_value_delta` (old and new value, for edits), and `document_approved` (with total time and
decision counts).

**Main comparison: flagged vs. unflagged fields.** Compare the confirm rate and median
`time_since_shown_ms` for flagged fields (conflicting, missing, low confidence) against routine ones. If
analysts confirm flagged fields about as often and as fast as routine ones, the flags aren't changing
behavior. That's rubber-stamping with extra UI.

**Ground-truth comparison: is review catching anything?** On a regular schedule, have a second reviewer
independently check a random 2–5% sample of confirmed fields against the source document. Compare that
error rate with the model's own error rate on the same field types. If approved fields are wrong about
as often as the model is on its own, the review isn't adding anything, but the memo still looks like
someone checked it. This isn't hypothetical. `net_income` in this data is wrong in a way no confidence
score caught, and if an analyst confirmed it without opening the source, a sampled re-check is the only
thing on this list that would catch it afterward.

**When I'd roll it back:** if the audit error rate on confirmed fields is statistically the same as the
model's raw error rate. Not because the UI is slow or unpopular, but because at that point it's creating
false confidence. The credit memo would imply "a person checked this" when the person didn't change
anything. An earlier warning sign: median `time_since_shown_ms` drops below the few seconds it takes to
read a source line while the confirm rate stays high. That would show up before the next audit.

## Assumptions and limitations

- **"Ungrounded," "calculated," and "narrative" are rules I based on one ten-field document**, not a
  general schema. Ungrounded means a value with no source that isn't calculated. Calculated means the
  `derived` key is present. Narrative means no unit and a value longer than 60 characters. All three
  work for this file. A differently shaped extraction would need them revisited.
- **No persistence.** Decisions live in React state and reset when you reload. A real version would save
  them on a server with an audit trail (who decided what, and when), for compliance and for the
  measurement plan above.
- **One document, no queue.** There's one hardcoded borrower and no list of documents to review.
- **No real backend.** Streaming and failure are simulated in the browser with timers. The brief said to
  "simulate however you like," so I kept it simple instead of faking a network layer.
- **Only one automatic check, on purpose.** The label match for uncited values catches the net income
  case and nothing else (see the EBITDA finding above). The interface shows the evidence, but it doesn't
  try to catch every way two numbers in a financial statement can disagree. That's a choice, not
  something I left unfinished.
- **Accessibility was built in but not tested with a screen reader.** The app uses labeled native
  controls, live regions for streaming and the source panel, highlights with text labels as well as
  color, and focus that moves into the drawer and back to the field that opened it. While the drawer is
  open, keyboard focus stays inside it, but the top navigation isn't marked inert, so a screen reader's
  virtual cursor can still reach it. I haven't tested it end to end with a screen reader.
- **Tests cover the matching and recalculation logic only.** `npm test` runs unit tests for finding quoted lines,
  assigning reference codes, the net income check and recalculating DSCR from edited or rejected inputs. I checked the interface itself by clicking
  through every state in a browser, at wide and narrow widths and with the keyboard only.

## Time Spent and what I cut
I spent just under 10 hours. About half went into a split-view redesign after the first version was working, because I felt the user would benefit from seeing source next to the fields.

To stay in scope I cut:

* Persistence and audit trail. Decisions live in React state and are lost on reload.
* Event logging. The measurement plan is described, not built.
* Component tests. Only the matching and recalculation logic has unit tests. The approval flow was checked by hand.
* A screen reader pass. Accessibility is built in structurally but untested with VoiceOver or NVDA.
* Multi-document support. There's one hardcoded borrower and no review queue.
* Keeping decisions across a retry. A retry restarts the review instead of preserving unchanged fields.

## What I'd do with another week
1. Build the audit-sample workflow and the event logging above, not just describe them. The
   `net_income` case is what they're meant to catch.
2. Add a per-field history in the UI (who changed what, and when).
3. Write component tests for the approval logic in `useFieldReviews` and `ReviewPage`, since that should
   never quietly break. Also add a second extraction file with a different shape to test the
   ungrounded, calculated and narrative rules against new data.
4. Do a real screen reader pass (VoiceOver and NVDA), and add a queue for multiple borrowers.
5. Make the EBITDA-definition gap visible without relying on the analyst to find it. Not by
   auto-flagging it, but by linking fields when the source mentions the same concept twice, so "two
   numbers that might be the same thing" shows up as a relationship.

## Part 3: Use of AI

**Where AI helped:** I built this with Claude Code. That includes the architecture, every component,
the design system, the placeholder data, the streaming simulation, the swap to the real data, the
redesign, and the first drafts of this README and Part 1, which I then rewrote. I directed and reviewed
it at each step. I approved designs before code was written, made the CDS call, and checked the running
app state by state in a browser instead of assuming the code was right.

For the redesign, Claude wrote a design spec and a step-by-step plan that I approved. Separate Claude
agents built each step, and a separate agent reviewed each step before the next one started. Those
reviews caught real problems: focus didn't return to the right place when the drawer closed, Tab could
escape the open drawer, the page could scroll when it shouldn't, and the source panel told screen reader
users net income's line was "cited" when the model cited nothing.

The real-data swap taught me something about AI-assisted review. Claude didn't catch the `net_income`
mismatch or the buried Note 9 default on its own. It found them when I asked it to read the source
pages closely. That's the same position as the analyst this interface is for: they have to be prompted
to look instead of trusting a clean-looking number.

**The redesign:** the split view, reference codes and workpaper look went through several rounds of
mockups. I turned down three visual directions as hard to digest, had the layout simplified twice
(fewer lines, then separate boxes), and asked for the drawer on narrow screens before choosing the
direction that's built here.

**An AI-generated mistake I caught and fixed:** `EditFieldDialog` uses a native `<dialog>` that stays
mounted as long as its field does. Only `showModal()` and `close()` toggle it, so editing doesn't lose
the field's position. The first version focused the input with a plain `autoFocus` prop:

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
time you clicked "Edit," the input got focus. After that, every Edit click, on any field, left focus
wherever it already was. It looked fine when reading the code and in a single click-through. It only
broke the second time a dialog opened. I caught it with a browser test that opened a dialog, closed it,
opened a different field's dialog, and checked where focus was:

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

The same check found a second bug with the same cause. The input's `id="edit-field-value"` was
hardcoded, and every field mounts its own hidden dialog, so the page had ten duplicate IDs and ten
labels pointing at the same one. That's invalid HTML and unreliable for screen readers. I fixed it by
building the id from the field (`edit-field-value-${fieldId}`). Neither bug showed up from reading the
code or clicking through once. They only appeared with the kind of repeated use a real analyst session
has, which is a good reminder that "looks right in a screenshot" isn't enough for an interface whose
whole job is being trustworthy.

**What I didn't hand to AI:** the CDS decision was mine. Claude flagged the made-up metric and pointed
out that it went against the point of the exercise, but I decided to ignore it completely: no composite
score, no auto-approve, no default sort by confidence. I gave that as an instruction, not as a question.
It was the most safety-relevant decision in the exercise, and letting the AI decide how much to trust
the AI is the failure Part 1 is about.
