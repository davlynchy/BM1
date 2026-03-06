import { NextResponse } from "next/server";

import { downloadStoredFile } from "@/lib/documents/storage";
import { requireProjectAccess } from "@/lib/projects/access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; documentId: string }> },
) {
  try {
    const { projectId, documentId } = await params;
    const { supabase, project } = await requireProjectAccess(projectId);
    const { data: document, error } = await supabase
      .from("documents")
      .select("id, name, storage_provider, storage_bucket, storage_path, mime_type")
      .eq("id", documentId)
      .eq("project_id", project.id)
      .maybeSingle();

    if (error || !document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const blob = await downloadStoredFile({
      provider: (document.storage_provider ?? "r2") as "supabase" | "r2",
      bucket: String(document.storage_bucket),
      storagePath: String(document.storage_path),
    });
    const bytes = await blob.arrayBuffer();

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": String(document.mime_type ?? "application/octet-stream"),
        "Content-Disposition": `inline; filename="${String(document.name ?? "document")}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load document.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
