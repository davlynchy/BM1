import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentParseStatus } from "@/types/ingestion";

export async function updateDocumentStatus(params: {
  documentId: string;
  status: DocumentParseStatus;
  processingError?: string | null;
  pageCount?: number | null;
  chunkCount?: number | null;
  parserVersion?: string | null;
  indexedAt?: string | null;
}) {
  const supabase = createAdminClient();
  const updatePayload: Record<string, unknown> = {
    parse_status: params.status,
  };

  if (params.processingError !== undefined) {
    updatePayload.processing_error = params.processingError;
  }
  if (params.pageCount !== undefined) {
    updatePayload.page_count = params.pageCount;
  }
  if (params.chunkCount !== undefined) {
    updatePayload.chunk_count = params.chunkCount;
  }
  if (params.parserVersion !== undefined) {
    updatePayload.parser_version = params.parserVersion;
  }
  if (params.indexedAt !== undefined) {
    updatePayload.indexed_at = params.indexedAt;
  }

  const { error } = await supabase
    .from("documents")
    .update(updatePayload)
    .eq("id", params.documentId);

  if (error) {
    throw error;
  }
}

export async function replaceDocumentPages(params: {
  documentId: string;
  companyId: string;
  pages: Array<{
    pageNumber: number;
    content: string;
    metadata: Record<string, unknown>;
  }>;
}) {
  const supabase = createAdminClient();
  await supabase.from("document_pages").delete().eq("document_id", params.documentId);

  const { data, error } = await supabase
    .from("document_pages")
    .insert(
      params.pages.map((page) => ({
        document_id: params.documentId,
        company_id: params.companyId,
        page_number: page.pageNumber,
        content: page.content,
        metadata: page.metadata,
      })),
    )
    .select("id, page_number");

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function loadDocumentPages(documentId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("document_pages")
    .select("id, page_number, content, metadata")
    .eq("document_id", documentId)
    .order("page_number", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function replaceDocumentChunks(params: {
  documentId: string;
  companyId: string;
  chunks: Array<{
    chunkIndex: number;
    content: string;
    tokenCount: number;
    metadata: Record<string, unknown>;
    pageId?: string | null;
  }>;
}) {
  const supabase = createAdminClient();
  await supabase.from("document_chunks").delete().eq("document_id", params.documentId);

  const { data, error } = await supabase
    .from("document_chunks")
    .insert(
      params.chunks.map((chunk) => ({
        document_id: params.documentId,
        company_id: params.companyId,
        page_id: chunk.pageId ?? null,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        token_count: chunk.tokenCount,
        metadata: chunk.metadata,
      })),
    )
    .select("id, chunk_index, content");

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function loadDocumentChunks(documentId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("document_chunks")
    .select("id, chunk_index, content, metadata")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function updateChunkEmbeddings(params: {
  documentId: string;
  chunks: Array<{ id: string; embedding: number[] }>;
}) {
  const supabase = createAdminClient();

  for (const chunk of params.chunks) {
    const { error } = await supabase
      .from("document_chunks")
      .update({
        embedding: chunk.embedding,
      })
      .eq("id", chunk.id)
      .eq("document_id", params.documentId);

    if (error) {
      throw error;
    }
  }
}
