import { embedTexts } from "@/lib/ai/embeddings";
import { loadDocumentChunks, updateChunkEmbeddings, updateDocumentStatus } from "@/lib/jobs/documents";
import { enqueueDocumentJob } from "@/lib/jobs/queue";
import { resetScanForDocument } from "@/lib/jobs/scans";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentJobPayload } from "@/types/ingestion";

export async function handleDocumentEmbedJob(payload: DocumentJobPayload) {
  await updateDocumentStatus({
    documentId: payload.documentId,
    status: "embedding",
    processingError: null,
  });

  const chunks = await loadDocumentChunks(payload.documentId);

  for (let index = 0; index < chunks.length; index += 25) {
    const batch = chunks.slice(index, index + 25);
    const embeddings = await embedTexts(batch.map((chunk) => String(chunk.content)));

    await updateChunkEmbeddings({
      documentId: payload.documentId,
      chunks: batch.map((chunk, batchIndex) => ({
        id: String(chunk.id),
        embedding: embeddings[batchIndex],
      })),
    });
  }

  await updateDocumentStatus({
    documentId: payload.documentId,
    status: "indexed",
    indexedAt: new Date().toISOString(),
  });

  if (payload.documentType === "contract") {
    const supabase = createAdminClient();
    const { data: scan } = await supabase
      .from("contract_scans")
      .select("id")
      .eq("contract_document_id", payload.documentId)
      .maybeSingle();

    if (scan) {
      await resetScanForDocument(payload.documentId);
      await enqueueDocumentJob({
        companyId: payload.companyId,
        projectId: payload.projectId,
        documentId: payload.documentId,
        jobType: "scan.extract",
        jobKey: `${payload.documentId}:scan.extract`,
        payload,
      });
    }
  }
}
