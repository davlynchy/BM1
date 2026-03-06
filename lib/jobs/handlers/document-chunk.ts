import { loadDocumentPages, replaceDocumentChunks, updateDocumentStatus } from "@/lib/jobs/documents";
import { enqueueDocumentJob } from "@/lib/jobs/queue";
import { resetScanForDocument } from "@/lib/jobs/scans";
import { createDocumentChunks } from "@/lib/documents/chunking";
import type { DocumentJobPayload } from "@/types/ingestion";

export async function handleDocumentChunkJob(payload: DocumentJobPayload) {
  await updateDocumentStatus({
    documentId: payload.documentId,
    status: "chunking",
    processingError: null,
  });

  const pages = await loadDocumentPages(payload.documentId);
  const normalizedPages = pages.map((page) => ({
    pageNumber: page.page_number,
    content: page.content,
    metadata: (page.metadata ?? {}) as Record<string, unknown>,
  }));
  const pageIdsByNumber = new Map<number, string>(
    pages.map((page) => [page.page_number as number, page.id as string]),
  );
  const chunks = createDocumentChunks({
    pages: normalizedPages,
    documentType: payload.documentType,
  });

  await replaceDocumentChunks({
    documentId: payload.documentId,
    companyId: payload.companyId,
    projectId: payload.projectId,
    chunks: chunks.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      metadata: chunk.metadata,
      pageId: pageIdsByNumber.get(chunk.pageNumber) ?? null,
    })),
  });

  await updateDocumentStatus({
    documentId: payload.documentId,
    status: "embedding",
    chunkCount: chunks.length,
  });

  if (payload.documentType === "contract") {
    await resetScanForDocument(payload.documentId);
    await enqueueDocumentJob({
      companyId: payload.companyId,
      projectId: payload.projectId,
      documentId: payload.documentId,
      jobType: "scan.quick_extract",
      jobKey: `${payload.documentId}:scan.quick_extract`,
      payload: {
        ...payload,
        pageCount: normalizedPages.length,
        chunkCount: chunks.length,
      },
    });
  }

  await enqueueDocumentJob({
    companyId: payload.companyId,
    projectId: payload.projectId,
    documentId: payload.documentId,
    jobType: "document.embed",
    jobKey: `${payload.documentId}:document.embed`,
    payload: {
      ...payload,
      pageCount: normalizedPages.length,
      chunkCount: chunks.length,
    },
  });
}
