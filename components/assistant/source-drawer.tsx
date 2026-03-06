"use client";

import type { AssistantCitation, AssistantSourceSelection } from "@/types/assistant";
import type { VaultFileRecord } from "@/types/vault";

export function SourceDrawer({
  documents,
  selectedDocumentIds,
  onToggle,
  attachedSources,
  citations,
  selectedCitationOrder,
  onSelectCitation,
}: {
  documents: VaultFileRecord[];
  selectedDocumentIds: string[];
  onToggle: (documentId: string) => void;
  attachedSources: AssistantSourceSelection[];
  citations: AssistantCitation[];
  selectedCitationOrder?: number | null;
  onSelectCitation?: (order: number) => void;
}) {
  const showSelection = citations.length === 0;

  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <p className="font-medium text-text">Sources</p>
      <p className="mt-1 text-xs text-muted">
        {citations.length
          ? "Evidence referenced in the selected assistant answer."
          : "Select indexed vault files for this thread."}
      </p>

      {citations.length ? (
        <div className="mt-3 space-y-2">
          {citations.map((citation, index) => {
            const citationNumber = citation.citationOrder ?? index + 1;
            return (
            <button
              className={`w-full rounded-lg border px-3 py-2 text-left ${
                selectedCitationOrder === citationNumber ? "border-brand bg-brand/10" : "border-border bg-panel"
              }`}
              key={`${citation.sourceId}-${index}`}
              onClick={() => onSelectCitation?.(citationNumber)}
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex min-w-5 items-center justify-center rounded-sm bg-lime-500 px-1 text-xs font-bold leading-5 text-black">
                  {citationNumber}
                </span>
                <p className="truncate text-sm font-medium text-text">
                  {citation.documentName}
                  {(citation.page ?? citation.pageNumber) ? ` - p.${citation.page ?? citation.pageNumber}` : ""}
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">{citation.snippet}</p>
            </button>
          );
          })}
        </div>
      ) : null}

      {showSelection ? (
        <div className="mt-3 max-h-[18rem] space-y-2 overflow-y-auto pr-1">
          {documents.map((document) => (
            <label className="flex items-start gap-3 rounded-lg border border-border bg-panel px-3 py-2" key={document.id}>
              <input
                checked={selectedDocumentIds.includes(document.id)}
                onChange={() => onToggle(document.id)}
                type="checkbox"
              />
              <div className="min-w-0">
                <p className="truncate font-medium text-text">{document.name}</p>
                <p className="text-sm text-muted">
                  {document.documentType} - {document.parseStatus}
                </p>
              </div>
            </label>
          ))}
        </div>
      ) : null}

      <div className="mt-4 space-y-2 border-t border-border pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Attached now</p>
        {attachedSources.length ? (
          attachedSources.map((source) => (
            <div className="rounded-lg border border-border bg-panel px-3 py-2 text-sm" key={source.id}>
              <p className="font-medium text-text">{source.documentName}</p>
              <p className="text-muted">{source.parseStatus}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">No pinned sources yet.</p>
        )}
      </div>
    </div>
  );
}
