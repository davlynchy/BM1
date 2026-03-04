export type AssistantCitation = {
  sourceId: string;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  snippet: string;
  sectionTitle?: string;
};

export type AssistantThreadType = "project_assistant" | "contract_review";

export type AssistantMode = "auto" | "draft" | "answer";

export type AssistantRunStatus = "queued" | "in_progress" | "completed" | "failed";

export type AssistantMessageMetadata = {
  messageType?:
    | "system_progress"
    | "assistant_quick_review"
    | "assistant_deep_review"
    | "assistant_followup"
    | "email_draft";
  stage?:
    | "upload_complete"
    | "text_extracted"
    | "clauses_chunked"
    | "quick_red_flags_ready"
    | "deep_review_ready"
    | "report_complete";
  scanId?: string;
  isPartial?: boolean;
  version?: string;
};

export type AssistantThreadSummary = {
  id: string;
  title: string;
  threadType: AssistantThreadType;
  scanId: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  sourceCount: number;
};

export type AssistantSourceSelection = {
  id: string;
  documentId: string;
  documentName: string;
  parseStatus: string;
  pinned: boolean;
};

export type AssistantRunRecord = {
  id: string;
  status: AssistantRunStatus;
  mode: AssistantMode;
  requestedOutputType: string | null;
  currentStage: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AssistantMessageRecord = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  citations: AssistantCitation[];
  metadata: AssistantMessageMetadata;
};
