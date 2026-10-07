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
  const panelRef = useRef<HTMLElement>(null);

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
      if (event.key === 'Escape') {
        onCloseDrawer();
        return;
      }
      if (event.key !== 'Tab') return;
      // aria-modal: keep Tab and Shift+Tab inside the drawer.
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]') ?? [],
      );
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panelRef.current?.contains(active)) {
        event.preventDefault();
        firstEl.focus();
      } else if (event.shiftKey && active === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
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
        ref={panelRef}
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

        <div className="source-panel__body" ref={bodyRef} tabIndex={0} role="region" aria-label="Source document text">
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
