"use client";

import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import type { AssistantMessageRecord } from "@/types/assistant";

const HIDDEN_SEEDED_PROMPT = "Review this contract for red flags.";

function formatStageLabel(stage?: string) {
  switch (stage) {
    case "upload_complete":
      return "Upload complete";
    case "text_extracted":
      return "Text extracted";
    case "clauses_chunked":
      return "Clauses grouped";
    case "quick_red_flags_ready":
      return "Quick review ready";
    case "deep_review_ready":
      return "Deep review ready";
    case "report_complete":
      return "Review complete";
    default:
      return "Progress";
  }
}

export function ReviewMessageList({
  messages,
  isUpdating,
}: {
  messages: AssistantMessageRecord[];
  isUpdating: boolean;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const visibleMessages = messages.filter(
    (message) => !(message.role === "user" && message.content.trim() === HIDDEN_SEEDED_PROMPT),
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visibleMessages, isUpdating]);

  return (
    <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
      {visibleMessages.map((message) => {
        const isUser = message.role === "user";
        const isProgress = message.metadata.messageType === "system_progress";

        return (
          <div
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            key={message.id}
          >
            <div
              className={`max-w-[90%] rounded-2xl border px-4 py-3 shadow-sm ${
                isUser
                  ? "border-brand/30 bg-brand text-brand-foreground"
                  : isProgress
                    ? "border-border bg-panel"
                    : "border-border bg-bg"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide">
                <Badge variant={isUser ? "secondary" : "outline"}>
                  {isUser ? "You" : isProgress ? "Working" : "Bidmetric AI"}
                </Badge>
                {message.metadata.stage ? (
                  <span className="text-muted">{formatStageLabel(message.metadata.stage)}</span>
                ) : null}
                {message.metadata.isPartial ? (
                  <span className="text-muted">Live</span>
                ) : null}
              </div>
              <p
                className={`mt-3 whitespace-pre-wrap text-sm leading-6 ${
                  isUser ? "text-brand-foreground" : "text-text"
                }`}
              >
                {message.content}
              </p>
              {message.citations.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {message.citations.map((citation) => (
                    <div
                      className="rounded-full border border-border bg-panel px-3 py-1 text-xs text-muted"
                      key={`${message.id}-${citation.sourceId}`}
                    >
                      {citation.sectionTitle ?? citation.documentName}
                      {citation.pageNumber ? ` p.${citation.pageNumber}` : ""}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      {isUpdating ? (
        <div className="flex justify-start">
          <div className="rounded-2xl border border-border bg-panel px-4 py-3 text-sm text-muted">
            Updating review timeline...
          </div>
        </div>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
