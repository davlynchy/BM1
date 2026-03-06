export type DocumentIndexStatus =
  | "uploaded"
  | "queued"
  | "parsing"
  | "chunking"
  | "embedding"
  | "indexed"
  | "failed";

export type VaultFileRecord = {
  id: string;
  name: string;
  relativePath?: string | null;
  documentType: string;
  parseStatus: DocumentIndexStatus;
  fileSize: number | null;
  pageCount: number | null;
  chunkCount: number | null;
  processingError: string | null;
  createdAt: string;
  updatedAt: string;
};
