import type { Source } from "@/engine/types";

interface SourceListProps {
  sources: Source[];
}

/** Resolved citations for a remedy or condition. External links open safely. */
export function SourceList({ sources }: SourceListProps) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        No external sources are attached to this record yet. Condition associations here come from the
        project&apos;s legacy dataset and have not been independently verified.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {sources.map((s) => (
        <li key={s.id} className="text-sm">
          {s.url ? (
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-accent-strong underline underline-offset-2 hover:text-accent"
            >
              {s.title}
            </a>
          ) : (
            <span className="font-medium text-fg">{s.title}</span>
          )}
          {s.publisher && <span className="text-fg-faint"> — {s.publisher}</span>}
          {s.accessed && <span className="text-fg-faint"> (accessed {s.accessed})</span>}
        </li>
      ))}
    </ul>
  );
}
