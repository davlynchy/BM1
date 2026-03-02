import { NextResponse } from "next/server";

import { requireProjectAccess } from "@/lib/projects/access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const { supabase, project } = await requireProjectAccess(projectId);
    const { data, error } = await supabase
      .from("documents")
      .select(
        "id, name, document_type, parse_status, file_size, page_count, chunk_count, processing_error, created_at, updated_at",
      )
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      documents: (data ?? []).map((document) => ({
        id: document.id,
        name: document.name,
        documentType: document.document_type,
        parseStatus: document.parse_status,
        fileSize: document.file_size,
        pageCount: document.page_count,
        chunkCount: document.chunk_count,
        processingError: document.processing_error,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load documents.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
