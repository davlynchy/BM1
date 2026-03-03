import { NextResponse } from "next/server";

import { requireProjectAccess } from "@/lib/projects/access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; batchId: string }> },
) {
  try {
    const { projectId, batchId } = await params;
    const { supabase, project } = await requireProjectAccess(projectId);

    const { data: batch, error: batchError } = await supabase
      .from("upload_batches")
      .select("id, status, source, file_count, total_bytes, created_at, completed_at")
      .eq("id", batchId)
      .eq("project_id", project.id)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: "Upload batch not found." }, { status: 404 });
    }

    const { data: documents, error: documentsError } = await supabase
      .from("documents")
      .select("id, name, relative_path, upload_state, parse_status, processing_error, created_at, updated_at")
      .eq("upload_batch_id", batch.id)
      .order("created_at", { ascending: true });

    if (documentsError) {
      throw documentsError;
    }

    return NextResponse.json({
      batch,
      documents: documents ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load upload batch.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
