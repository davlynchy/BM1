"use client";

import { Badge } from "@/components/ui/badge";
import type { AssistantThreadSummary } from "@/types/assistant";

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
    <div className="space-y-2">
      {threads.length ? (
        threads.map((thread) => (
          <button
            className={`w-full rounded-xl border px-3 py-3 text-left ${
              activeThreadId === thread.id ? "border-brand bg-brand/10" : "border-border bg-bg"
            }`}
            key={thread.id}
            onClick={() => onSelect(thread.id)}
            type="button"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-medium text-text">{thread.title}</p>
              <Badge variant="outline">{thread.threadType === "contract_review" ? "Review" : "Thread"}</Badge>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted">
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
