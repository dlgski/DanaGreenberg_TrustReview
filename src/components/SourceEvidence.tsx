import './SourceEvidence.css';

interface SourceEvidenceProps {
  quote: string | null;
  page?: number;
  missingMessage?: string;
  label?: string;
}

function jumpToSourcePage(page: number) {
  const container = document.getElementById('full-source-viewer');
  if (container && 'open' in container) {
    (container as unknown as HTMLDetailsElement).open = true;
  }
  requestAnimationFrame(() => {
    document.getElementById(`source-page-${page}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

export function SourceEvidence({ quote, page, missingMessage, label = 'View source text' }: SourceEvidenceProps) {
  if (!quote) {
    return <p className="source-evidence__missing">{missingMessage ?? 'No matching text found in the document.'}</p>;
  }

  return (
    <details className="source-evidence">
      <summary>
        {label}
        {page ? <span className="source-evidence__page"> — page {page}</span> : null}
      </summary>
      <blockquote className="source-evidence__quote">
        {quote}
        {page ? (
          <a
            className="source-evidence__jump"
            href={`#source-page-${page}`}
            onClick={() => jumpToSourcePage(page)}
          >
            Jump to page {page} in full source
          </a>
        ) : null}
      </blockquote>
    </details>
  );
}
