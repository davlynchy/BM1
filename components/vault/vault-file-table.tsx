import Link from "next/link";

import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { RetryDocumentButton } from "@/components/documents/retry-document-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DocumentParseStatus } from "@/types/ingestion";
import type { VaultFileRecord } from "@/types/vault";

function formatBytes(value: number | null) {
  if (!value) {
    return "-";
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function VaultFileTable({
  documents,
  projectId,
}: {
  documents: VaultFileRecord[];
  projectId: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Pages</TableHead>
          <TableHead>Chunks</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((document) => (
          <TableRow key={document.id}>
            <TableCell>
              <div>
                <p className="font-medium text-text">{document.name}</p>
                {document.processingError ? (
                  <p className="mt-1 text-xs text-muted">{document.processingError}</p>
                ) : null}
              </div>
            </TableCell>
            <TableCell>{document.documentType}</TableCell>
            <TableCell>
              <DocumentStatusBadge status={document.parseStatus as DocumentParseStatus} />
            </TableCell>
            <TableCell>{formatBytes(document.fileSize)}</TableCell>
            <TableCell>{document.pageCount ?? "-"}</TableCell>
            <TableCell>{document.chunkCount ?? "-"}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-2">
                {document.parseStatus === "failed" ? <RetryDocumentButton documentId={document.id} /> : null}
                <Link
                  className="text-sm text-muted underline-offset-4 hover:underline"
                  href={`/app/projects/${projectId}/assistant`}
                >
                  Ask AI
                </Link>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
