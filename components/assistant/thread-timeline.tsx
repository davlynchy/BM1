"use client";

import { ReviewMessageList } from "@/components/scan/review-message-list";
import type { AssistantMessageRecord } from "@/types/assistant";

export function ThreadTimeline({
  messages,
  isUpdating,
}: {
  messages: AssistantMessageRecord[];
  isUpdating: boolean;
}) {
  return <ReviewMessageList isUpdating={isUpdating} messages={messages} />;
}
