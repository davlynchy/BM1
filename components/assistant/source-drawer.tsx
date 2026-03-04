"use client";

import type { AssistantSourceSelection } from "@/types/assistant";
import type { VaultFileRecord } from "@/types/vault";

export function SourceDrawer({
  documents,
  selectedDocumentIds,
  onToggle,
  attachedSources,
}: {
  documents: VaultFileRecord[];
  selectedDocumentIds: string[];
  onToggle: (documentId: string) => void;
  attachedSources: AssistantSourceSelection[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-bg p-4">
        <p className="font-medium text-text">Attached sources</p>
        <div className="mt-3 space-y-2">
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

      <div className="rounded-xl border border-border bg-bg p-4">
        <p className="font-medium text-text">Select vault sources</p>
        <div className="mt-3 max-h-[24rem] space-y-2 overflow-y-auto pr-1">
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
                  {document.documentType} · {document.parseStatus}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
