export const DOCUMENT_STORAGE_PROVIDERS = ["supabase", "r2"] as const;
export type DocumentStorageProvider = (typeof DOCUMENT_STORAGE_PROVIDERS)[number];

export const DOCUMENT_UPLOAD_STATES = [
  "created",
  "uploading",
  "uploaded",
  "failed",
] as const;
export type DocumentUploadState = (typeof DOCUMENT_UPLOAD_STATES)[number];

export const UPLOAD_BATCH_STATUSES = [
  "created",
  "uploading",
  "uploaded",
  "finalized",
  "failed",
  "cancelled",
] as const;
export type UploadBatchStatus = (typeof UPLOAD_BATCH_STATUSES)[number];

export type UploadManifestFile = {
  clientKey: string;
  name: string;
  size: number;
  type: string;
  relativePath?: string | null;
};

export type UploadDescriptor = {
  clientKey: string;
  documentId: string;
  uploadId: string;
  bucket: string;
  storagePath: string;
  mimeType: string;
  relativePath: string | null;
  partSize: number;
  partCount: number;
};

export type CompletedUploadPart = {
  partNumber: number;
  etag: string;
};
