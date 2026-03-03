import { createDocumentChunks } from "@/lib/documents/chunking";
import { parseDocumentByMimeType } from "@/lib/documents/parsers";
import { upsertProjectCorrespondenceFromEmail } from "@/lib/correspondence/store";
import { downloadStoredFile } from "@/lib/documents/storage";
import { replaceDocumentPages, updateDocumentStatus } from "@/lib/jobs/documents";
import { enqueueDocumentJob } from "@/lib/jobs/queue";
import type { DocumentJobPayload } from "@/types/ingestion";

export async function handleDocumentParseJob(payload: DocumentJobPayload) {
  await updateDocumentStatus({
    documentId: payload.documentId,
    status: "parsing",
    processingError: null,
  });

  const file = await downloadStoredFile({
    provider: payload.storageProvider,
    bucket: payload.bucket,
    storagePath: payload.storagePath,
  });
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseDocumentByMimeType({
    mimeType: payload.mimeType,
    buffer,
  });

  if (payload.documentType === "email" && payload.projectId) {
    const emailMetadata =
      parsed.metadata && typeof parsed.metadata.correspondence === "object"
        ? (parsed.metadata.correspondence as Record<string, unknown>)
        : null;

    if (emailMetadata) {
      await upsertProjectCorrespondenceFromEmail({
        companyId: payload.companyId,
        projectId: payload.projectId,
        documentId: payload.documentId,
        metadata: {
          subject: typeof emailMetadata.subject === "string" ? emailMetadata.subject : "",
          sender: typeof emailMetadata.sender === "string" ? emailMetadata.sender : "",
          to: typeof emailMetadata.to === "string" ? emailMetadata.to : "",
          cc: typeof emailMetadata.cc === "string" ? emailMetadata.cc : "",
          receivedAt:
            typeof emailMetadata.receivedAt === "string" ? emailMetadata.receivedAt : undefined,
          bodyText: typeof emailMetadata.bodyText === "string" ? emailMetadata.bodyText : "",
          attachments: Array.isArray(emailMetadata.attachments)
            ? (emailMetadata.attachments as Array<Record<string, unknown>>)
            : [],
        },
      });
    }
  }

  const pages = await replaceDocumentPages({
    documentId: payload.documentId,
    companyId: payload.companyId,
    pages: parsed.pages,
  });

  await updateDocumentStatus({
    documentId: payload.documentId,
    status: "chunking",
    pageCount: pages.length,
    parserVersion: parsed.parserVersion,
  });

  const chunks = createDocumentChunks({
    pages: parsed.pages,
    documentType: payload.documentType,
  });

  await enqueueDocumentJob({
    companyId: payload.companyId,
    projectId: payload.projectId,
    documentId: payload.documentId,
    jobType: "document.chunk",
    jobKey: `${payload.documentId}:document.chunk`,
    payload: {
      ...payload,
      pageCount: parsed.pages.length,
      chunkCount: chunks.length,
    },
  });

  if (payload.documentType === "email") {
    await enqueueDocumentJob({
      companyId: payload.companyId,
      projectId: payload.projectId,
      documentId: payload.documentId,
      jobType: "correspondence.analyze",
      jobKey: `${payload.documentId}:correspondence.analyze`,
      payload,
    });
  }
}
