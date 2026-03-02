import { NextResponse } from "next/server";

import { enqueueDocumentJob } from "@/lib/jobs/queue";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data: document, error } = await supabase
      .from("documents")
      .select("id, company_id, project_id, storage_bucket, storage_path, mime_type, document_type, name")
      .eq("id", documentId)
      .single();

    if (error || !document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        parse_status: "queued",
        processing_error: null,
      })
      .eq("id", document.id);

    if (updateError) {
      throw updateError;
    }

    const { error: cleanupJobsError } = await supabase
      .from("jobs")
      .delete()
      .eq("document_id", document.id)
      .in("job_type", ["document.parse", "document.chunk", "document.embed"])
      .in("status", ["queued", "failed"]);

    if (cleanupJobsError) {
      throw cleanupJobsError;
    }

    const job = await enqueueDocumentJob({
      companyId: document.company_id,
      projectId: document.project_id,
      documentId: document.id,
      jobType: "document.parse",
      jobKey: `${document.id}:document.parse`,
      payload: {
        documentId: document.id,
        companyId: document.company_id,
        projectId: document.project_id,
        bucket: document.storage_bucket,
        storagePath: document.storage_path,
        mimeType: document.mime_type,
        documentType: document.document_type,
        fileName: document.name,
      },
    });

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retry document.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
