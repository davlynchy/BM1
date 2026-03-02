export type AssistantCitation = {
  sourceId: string;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  snippet: string;
  sectionTitle?: string;
};

export type AssistantMessageRecord = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  citations: AssistantCitation[];
};
