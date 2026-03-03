import { NextResponse } from "next/server";
import { z } from "zod";

import { createMultipartPartUrls } from "@/lib/storage/r2";
import { requireProjectAccess } from "@/lib/projects/access";

const partRequestSchema = z.object({
  documentId: z.string().uuid(),
  uploadId: z.string().min(1),
  partNumbers: z.array(z.number().int().positive()).min(1).max(250),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const parsed = partRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid multipart request." }, { status: 400 });
    }

    const { supabase, project } = await requireProjectAccess(projectId);
    const { data: document, error } = await supabase
      .from("documents")
      .select("id, storage_provider, storage_path, project_id")
      .eq("id", parsed.data.documentId)
      .eq("project_id", project.id)
      .single();

    if (error || !document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    if (document.storage_provider !== "r2") {
      return NextResponse.json({ error: "Document is not configured for R2 upload." }, { status: 400 });
    }

    const parts = await createMultipartPartUrls({
      key: document.storage_path,
      uploadId: parsed.data.uploadId,
      partNumbers: parsed.data.partNumbers,
    });

    return NextResponse.json({ parts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sign multipart upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
