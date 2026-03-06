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

  function renderContent(message: AssistantMessageRecord) {
    const citationByOrder = new Map<number, AssistantMessageRecord["citations"][number]>();
    message.citations.forEach((citation, index) => {
      citationByOrder.set(index + 1, citation);
    });

    const rawLines = message.content.split("\n");
    const lines = rawLines.flatMap((line) => {
      if (line.trim().length < 240 || line.includes(":")) {
        return [line];
      }

      const split = line.split(/(?<=[.!?])\s+(?=[A-Z])/g).map((item) => item.trim()).filter(Boolean);
      return split.length > 1 ? split : [line];
    });
    return (
      <div className="space-y-2 text-[17px] leading-7">
        {lines.map((line, lineIndex) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div className="h-2" key={`${message.id}-line-${lineIndex}`} />;
          }

          const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
          const display = isBullet ? trimmed.slice(2).trim() : trimmed;
          const parts = display.split(/(\[\d+\])/g).filter(Boolean);

          return (
            <div
              className={isBullet ? "ml-4 list-item list-disc" : ""}
              key={`${message.id}-line-${lineIndex}`}
            >
              {parts.map((part, partIndex) => {
                const match = part.match(/^\[(\d+)\]$/);
                if (!match) {
                  return <span key={`${message.id}-${lineIndex}-${partIndex}`}>{part}</span>;
                }

                const order = Number(match[1]);
                const citation = citationByOrder.get(order);
                return (
                  <span
                    className="mx-1 inline-flex min-w-5 items-center justify-center rounded-sm bg-lime-500 px-1 text-xs font-bold leading-5 text-black"
                    key={`${message.id}-${lineIndex}-${partIndex}`}
                    title={citation?.snippet ?? `Citation ${order}`}
                  >
                    {order}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
      {visibleMessages.map((message) => {
        const isUser = message.role === "user";
        const isProgress = message.metadata.messageType === "system_progress";

        return (
          <div className={`flex ${isUser ? "justify-end" : "justify-start"}`} key={message.id}>
            <div
              className={`max-w-[92%] rounded-2xl border px-5 py-4 shadow-sm ${
                isUser
                  ? "border-brand/60 bg-brand text-white"
                  : isProgress
                    ? "border-border bg-panel"
                    : "border-border bg-bg"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide">
                <Badge className={isUser ? "bg-white text-brand" : ""} variant={isUser ? "secondary" : "outline"}>
                  {isUser ? "You" : isProgress ? "Working" : "Bidmetric AI"}
                </Badge>
                {message.metadata.stage ? (
                  <span className="text-muted">{formatStageLabel(message.metadata.stage)}</span>
                ) : null}
                {message.metadata.isPartial ? (
                  <span className="text-muted">Live</span>
                ) : null}
              </div>
              <div className={`mt-3 ${isUser ? "text-white" : "text-text"}`}>
                {renderContent(message)}
              </div>
              {message.citations.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {message.citations.map((citation) => (
                    <div
                      className="rounded-full border border-border bg-panel px-3 py-1 text-xs text-muted shadow-sm"
                      key={`${message.id}-${citation.chunkId ?? citation.sourceId ?? citation.documentId}`}
                    >
                      {citation.sectionTitle ?? citation.documentName}
                      {(citation.page ?? citation.pageNumber) ? ` p.${citation.page ?? citation.pageNumber}` : ""}
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
