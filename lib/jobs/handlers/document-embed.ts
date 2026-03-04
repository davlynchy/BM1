import { embedTexts } from "@/lib/ai/embeddings";
import { loadDocumentChunks, updateChunkEmbeddings, updateDocumentStatus } from "@/lib/jobs/documents";
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
}
