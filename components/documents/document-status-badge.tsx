import { Badge } from "@/components/ui/badge";
import { DOCUMENT_STATUS_LABELS } from "@/lib/documents/status";
import type { DocumentParseStatus } from "@/types/ingestion";

export function DocumentStatusBadge({ status }: { status: DocumentParseStatus }) {
  const variant = status === "failed" || status === "queued" ? "secondary" : "default";
  return <Badge variant={variant}>{DOCUMENT_STATUS_LABELS[status]}</Badge>;
}
