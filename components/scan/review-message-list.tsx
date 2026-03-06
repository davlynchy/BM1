"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { AssistantMessageRecord } from "@/types/assistant";

const HIDDEN_SEEDED_PROMPT = "Review this contract for red flags.";

function initials(value: string) {
  const parts = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return parts.join("") || "U";
}

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

function renderInlineWithBold(text: string, keyPrefix: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return segments.map((segment, index) => {
    const boldMatch = segment.match(/^\*\*([^*]+)\*\*$/);
    if (!boldMatch) {
      return <span key={`${keyPrefix}-${index}`}>{segment}</span>;
    }
    return (
      <strong className="font-semibold" key={`${keyPrefix}-${index}`}>
        {boldMatch[1]}
      </strong>
    );
  });
}

export function ReviewMessageList({
  messages,
  isUpdating,
  userDisplayName,
  onCitationDoubleClick,
  onCopy,
  onShare,
  onImprove,
  onOpenEditor,
}: {
  messages: AssistantMessageRecord[];
  isUpdating: boolean;
  userDisplayName?: string;
  onCitationDoubleClick?: (params: { messageId: string; order: number; citationSnippet: string }) => void;
  onCopy?: (messageId: string) => void;
  onShare?: (messageId: string) => void;
  onImprove?: (messageId: string) => void;
  onOpenEditor?: (messageId: string) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const [hoverSnippet, setHoverSnippet] = useState<{
    text: string;
    left: number;
    top: number;
    above: boolean;
  } | null>(null);
  const visibleMessages = messages.filter(
    (message) => !(message.role === "user" && message.content.trim() === HIDDEN_SEEDED_PROMPT),
  );
  const lastMessageId = visibleMessages.at(-1)?.id ?? null;
  const safeUserDisplayName = (userDisplayName ?? "User").trim() || "User";
  const userInitials = initials(safeUserDisplayName);

  useEffect(() => {
    const container = listRef.current;
    if (!container) {
      return;
    }
    requestAnimationFrame(() => {
      if (visibleMessages.length <= 2) {
        container.scrollTop = 0;
        return;
      }
      container.scrollTop = container.scrollHeight;
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
  }, [lastMessageId, visibleMessages.length]);

  useEffect(() => {
    function hideTooltip() {
      setHoverSnippet(null);
    }

    window.addEventListener("scroll", hideTooltip, true);
    return () => {
      window.removeEventListener("scroll", hideTooltip, true);
    };
  }, []);

  function renderContent(message: AssistantMessageRecord) {
    const citationByOrder = new Map<number, AssistantMessageRecord["citations"][number]>();
    message.citations.forEach((citation, index) => {
      citationByOrder.set(citation.citationOrder ?? index + 1, citation);
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
                  const leadBold = part.match(/^([^:\n]{3,80}):\s+(.*)$/);
                  if (!leadBold) {
                    return (
                      <span key={`${message.id}-${lineIndex}-${partIndex}`}>
                        {renderInlineWithBold(part, `${message.id}-${lineIndex}-${partIndex}`)}
                      </span>
                    );
                  }
                  return (
                    <span key={`${message.id}-${lineIndex}-${partIndex}`}>
                      <strong className="font-semibold">{leadBold[1]}:</strong>{" "}
                      {renderInlineWithBold(leadBold[2], `${message.id}-${lineIndex}-${partIndex}-tail`)}
                    </span>
                  );
                }

                const order = Number(match[1]);
                const citation = citationByOrder.get(order);
                return (
                  <span className="group relative mx-1 inline-flex" key={`${message.id}-${lineIndex}-${partIndex}`}>
                    <button
                      className="inline-flex min-w-5 items-center justify-center rounded-sm bg-lime-500 px-1 text-xs font-bold leading-5 text-black"
                      onClick={() =>
                        onCitationDoubleClick?.({
                          messageId: message.id,
                          order,
                          citationSnippet: citation?.snippet ?? "",
                        })}
                      onMouseEnter={(event) => {
                        if (!citation?.snippet) {
                          return;
                        }
                        const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        const left = window.innerWidth / 2;
                        const above = rect.bottom + 220 > window.innerHeight;
                        const top = above ? rect.top - 10 : rect.bottom + 10;
                        setHoverSnippet({
                          text: citation.snippet,
                          left,
                          top,
                          above,
                        });
                      }}
                      onMouseLeave={() => setHoverSnippet(null)}
                      onDoubleClick={() =>
                        onCitationDoubleClick?.({
                          messageId: message.id,
                          order,
                          citationSnippet: citation?.snippet ?? "",
                        })}
                      type="button"
                    >
                      {order}
                    </button>
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
    <div className="h-full min-h-0 space-y-7 overflow-y-auto pr-1" ref={listRef}>
      {visibleMessages.map((message) => {
        const isUser = message.role === "user";
        const isProgress = message.metadata.messageType === "system_progress";

        return (
          <div className="flex items-start gap-4" id={`m-${message.id}`} key={message.id}>
            <div className={`mt-1 flex h-12 w-12 items-center justify-center rounded-xl border text-3xl font-semibold ${
              isUser ? "border-border bg-panel text-text" : "border-black bg-black text-white"
            }`}>
              {isUser ? userInitials : "B"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide">
                <Badge variant="outline">{isUser ? safeUserDisplayName : isProgress ? "Thinking" : "Assistant"}</Badge>
                {message.metadata.stage ? (
                  <span className="text-muted">{formatStageLabel(message.metadata.stage)}</span>
                ) : null}
                {message.metadata.isPartial ? <span className="text-muted">Live</span> : null}
              </div>
              <div className="mt-2 text-text">{renderContent(message)}</div>
              {message.citations.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {message.citations.map((citation) => (
                    <div
                      className="rounded-full border border-border bg-panel px-3 py-1 text-xs text-muted"
                      key={`${message.id}-${citation.chunkId ?? citation.sourceId ?? citation.documentId}`}
                    >
                      {citation.sectionTitle ?? citation.documentName}
                      {(citation.page ?? citation.pageNumber) ? ` p.${citation.page ?? citation.pageNumber}` : ""}
                    </div>
                  ))}
                </div>
              ) : null}
              {!isUser && !isProgress ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
                  <button className="hover:text-text" onClick={() => onCopy?.(message.id)} type="button">Copy</button>
                  <button className="hover:text-text" onClick={() => onShare?.(message.id)} type="button">Share</button>
                  <button className="hover:text-text" onClick={() => onImprove?.(message.id)} type="button">Improve</button>
                  <button className="hover:text-text" onClick={() => onOpenEditor?.(message.id)} type="button">Editor</button>
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
      {hoverSnippet ? (
        <div
          className="pointer-events-none fixed z-50 w-[760px] max-w-[calc(100vw-24px)] rounded-md border-2 border-lime-500 bg-white px-4 py-3 text-[13px] normal-case leading-6 text-text shadow-panel"
          style={{
            left: hoverSnippet.left,
            top: hoverSnippet.top,
            transform: hoverSnippet.above ? "translate(-50%, -100%)" : "translateX(-50%)",
          }}
        >
          {hoverSnippet.text}
        </div>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
