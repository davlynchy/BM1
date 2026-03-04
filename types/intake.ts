export const INTAKE_SESSION_STATUSES = [
  "awaiting_auth",
  "awaiting_project",
  "awaiting_upload",
  "processing",
  "completed",
  "expired",
  "cancelled",
] as const;

export type IntakeSessionStatus = (typeof INTAKE_SESSION_STATUSES)[number];

export const INTAKE_PROJECT_SELECTION_MODES = ["create_new", "existing"] as const;
export type IntakeProjectSelectionMode = (typeof INTAKE_PROJECT_SELECTION_MODES)[number];

export const INTAKE_UPLOAD_STATES = ["created", "uploading", "uploaded", "failed"] as const;
export type IntakeUploadState = (typeof INTAKE_UPLOAD_STATES)[number];

export type IntakeSelectedFile = {
  name: string;
  size: number;
  type: string;
  relativePath?: string | null;
};

export type IntakeSession = {
  id: string;
  status: IntakeSessionStatus;
  source_mode: string;
  user_id: string | null;
  company_id: string | null;
  file_name: string;
  file_size: number;
  mime_type: string;
  selected_files: IntakeSelectedFile[];
  project_selection_mode: IntakeProjectSelectionMode | null;
  project_id: string | null;
  new_project_name: string | null;
  document_id: string | null;
  scan_id: string | null;
  storage_provider: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  metadata: Record<string, unknown>;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type IntakeSessionSummary = Pick<
  IntakeSession,
  "id" | "status" | "file_name" | "file_size" | "mime_type" | "metadata"
>;

export type IntakeCompletedPart = {
  partNumber: number;
  etag: string;
};

export type IntakeUploadDescriptor = {
  clientKey: string;
  documentId: string;
  uploadId: string;
  bucket: string;
  storagePath: string;
  mimeType: string;
  relativePath: null;
  partSize: number;
  partCount: number;
};
