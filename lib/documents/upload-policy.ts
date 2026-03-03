export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "message/rfc822",
] as const;

export const ALLOWED_DOCUMENT_TYPE_SET = new Set(ALLOWED_DOCUMENT_TYPES);

export const LEGACY_INTAKE_FILE_SIZE_LIMIT = 30 * 1024 * 1024;
export const ANONYMOUS_UPLOAD_THRESHOLD = 25 * 1024 * 1024;
export const AUTHENTICATED_FILE_SIZE_LIMIT = 2 * 1024 * 1024 * 1024;
export const MAX_BATCH_FILE_COUNT = 500;
export const MAX_BATCH_TOTAL_BYTES = 5 * 1024 * 1024 * 1024;
export const MULTIPART_PART_SIZE = 10 * 1024 * 1024;

