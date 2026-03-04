import { createHash } from "node:crypto";

export function buildDocumentFingerprint(params: {
  fileName: string;
  fileSize: number;
  mimeType: string;
}) {
  return createHash("sha256")
    .update(params.fileName.trim().toLowerCase())
    .update("|")
    .update(String(params.fileSize))
    .update("|")
    .update(params.mimeType.trim().toLowerCase())
    .digest("hex");
}
