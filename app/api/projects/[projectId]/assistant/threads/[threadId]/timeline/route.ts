import { NextResponse } from "next/server";

import { loadAssistantThreadDetail } from "@/lib/assistant/workbench";
import { requireProjectAccess } from "@/lib/projects/access";

function mapDocuments(documents: Array<Record<string, unknown>>) {
  return documents.map((document) => ({
    id: String(document.id),
    name: String(document.name),
    documentType: String(document.document_type),
    parseStatus: String(document.parse_status),
    fileSize: typeof document.file_size === "number" ? document.file_size : null,
    pageCount: typeof document.page_count === "number" ? document.page_count : null,
    chunkCount: typeof document.chunk_count === "number" ? document.chunk_count : null,
    processingError: typeof document.processing_error === "string" ? document.processing_error : null,
    createdAt: String(document.created_at),
    updatedAt: String(document.updated_at),
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; threadId: string }> },
) {
  try {
    const { projectId, threadId } = await params;
    const { user } = await requireProjectAccess(projectId);
    const detail = await loadAssistantThreadDetail({
      projectId,
      threadId,
      userId: String(user.id),
    });

    return NextResponse.json({
      ...detail,
      documents: mapDocuments(detail.documents as Array<Record<string, unknown>>),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load thread timeline.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
