export const DOCUMENT_PARSE_STATUSES = [
  "uploaded",
  "queued",
  "parsing",
  "chunking",
  "embedding",
  "indexed",
  "failed",
] as const;

export type DocumentParseStatus = (typeof DOCUMENT_PARSE_STATUSES)[number];

export const JOB_TYPES = [
  "document.parse",
  "document.chunk",
  "document.embed",
  "scan.extract",
  "correspondence.analyze",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ["queued", "in_progress", "completed", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type DocumentUploadKind = "contract" | "project_document" | "email";
export type DocumentStorageProvider = "supabase" | "r2";

export type ExtractedPage = {
  pageNumber: number;
  content: string;
  metadata: Record<string, unknown>;
};

export type ChunkMetadata = {
  pageNumber: number;
  sourceKind: string;
  documentType: string;
  sectionTitle?: string;
  sheetName?: string;
};

export type ExtractedChunk = {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: ChunkMetadata;
  pageNumber: number;
};

export type DocumentJobPayload = {
  documentId: string;
  companyId: string;
  projectId: string | null;
  bucket: string;
  storagePath: string;
  storageProvider?: DocumentStorageProvider;
  mimeType: string | null;
  documentType: string;
  fileName: string;
  pageCount?: number;
  chunkCount?: number;
};

export type ProjectDocumentListItem = {
  id: string;
  name: string;
  documentType: string;
  parseStatus: DocumentParseStatus;
  fileSize: number | null;
  pageCount: number | null;
  chunkCount: number | null;
  processingError: string | null;
  createdAt: string;
  updatedAt: string;
};
