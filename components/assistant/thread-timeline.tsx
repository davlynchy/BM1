"use client";

import { ReviewMessageList } from "@/components/scan/review-message-list";
import type { AssistantMessageRecord } from "@/types/assistant";

export function ThreadTimeline({
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
  return (
    <ReviewMessageList
      isUpdating={isUpdating}
      messages={messages}
      userDisplayName={userDisplayName}
      onCitationDoubleClick={onCitationDoubleClick}
      onCopy={onCopy}
      onImprove={onImprove}
      onOpenEditor={onOpenEditor}
      onShare={onShare}
    />
  );
}
