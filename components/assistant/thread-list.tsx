"use client";

import { Badge } from "@/components/ui/badge";
import type { AssistantThreadSummary } from "@/types/assistant";

function displayTitle(thread: AssistantThreadSummary) {
  const title = (thread.title ?? "").trim();
  const generic = /^(new query|new chat|project assistant)$/i.test(title);
  if (!generic) {
    return title || "Chat";
  }

  const preview = (thread.lastMessagePreview ?? "").replace(/\[(\d+)\]/g, "").replace(/\s+/g, " ").trim();
  if (!preview) {
    return "Chat";
  }

  return preview.length > 72 ? `${preview.slice(0, 72).trim()}...` : preview;
}

export function ThreadList({
  threads,
  activeThreadId,
  onSelect,
}: {
  threads: AssistantThreadSummary[];
  activeThreadId: string | null;
  onSelect: (threadId: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {threads.length ? (
        threads.map((thread) => (
          <button
            className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
              activeThreadId === thread.id ? "bg-bg text-text" : "text-muted hover:bg-bg/70 hover:text-text"
            }`}
            key={thread.id}
            onClick={() => onSelect(thread.id)}
            type="button"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-medium text-text">{displayTitle(thread)}</p>
              <Badge variant="outline">{thread.threadType === "contract_review" ? "Review" : "Thread"}</Badge>
            </div>
            <p className="mt-1.5 line-clamp-1 text-sm text-muted">
              {thread.lastMessagePreview ?? "No messages yet."}
            </p>
          </button>
        ))
      ) : (
        <div className="rounded-xl border border-border bg-bg px-3 py-4 text-sm text-muted">
          No threads yet. Create one from the assistant composer.
        </div>
      )}
    </div>
  );
}
