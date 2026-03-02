import type { DocumentParseStatus } from "@/types/ingestion";

export const DOCUMENT_STATUS_LABELS: Record<DocumentParseStatus, string> = {
  uploaded: "Uploaded",
  queued: "Queued",
  parsing: "Parsing",
  chunking: "Chunking",
  embedding: "Embedding",
  indexed: "Indexed",
  failed: "Failed",
};

export function isTerminalDocumentStatus(status: DocumentParseStatus) {
  return status === "indexed" || status === "failed";
}
