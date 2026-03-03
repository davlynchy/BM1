import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ALLOWED_DOCUMENT_TYPE_SET,
  AUTHENTICATED_FILE_SIZE_LIMIT,
  MAX_BATCH_FILE_COUNT,
  MAX_BATCH_TOTAL_BYTES,
  MULTIPART_PART_SIZE,
} from "@/lib/documents/upload-policy";
import { buildCanonicalStoragePath, getBucketForDocumentType } from "@/lib/documents/storage";
import { createMultipartUpload } from "@/lib/storage/r2";
import { requireProjectAccess } from "@/lib/projects/access";
import { getRequestIp } from "@/lib/api/request";
import { enforceRateLimit } from "@/lib/rate-limit";

const manifestFileSchema = z.object({
  clientKey: z.string().min(1).max(120),
  name: z.string().min(1).max(260),
  size: z.number().int().positive(),
  type: z.string().min(1),
  relativePath: z.string().max(1024).nullish(),
});

const sessionSchema = z.object({
  source: z.enum(["vault", "intake"]).default("vault"),
  files: z.array(manifestFileSchema).min(1).max(MAX_BATCH_FILE_COUNT),
});

function inferDocumentType(mimeType: string) {
  return mimeType === "message/rfc822" ? "email" : "project_document";
}

function normalizeRelativePath(relativePath: string | null | undefined) {
  if (!relativePath) {
    return null;
  }

  return relativePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") || null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const parsed = sessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload manifest." }, { status: 400 });
    }

    const { supabase, user, project } = await requireProjectAccess(projectId);
    await enforceRateLimit({
      scope: "project_upload_session",
      key: String(user.id),
      limit: 25,
      windowMinutes: 30,
      companyId: String(project.company_id),
      userId: String(user.id),
      metadata: {
        ip: getRequestIp(request),
        projectId,
      },
    });

    const totalBytes = parsed.data.files.reduce((sum, file) => sum + file.size, 0);

    if (totalBytes > MAX_BATCH_TOTAL_BYTES) {
      return NextResponse.json({ error: "Upload batch exceeds the 5GB batch limit." }, { status: 400 });
    }

    for (const file of parsed.data.files) {
      if (!ALLOWED_DOCUMENT_TYPE_SET.has(file.type as never)) {
        return NextResponse.json({ error: `Unsupported file type for ${file.name}.` }, { status: 400 });
      }

      if (file.size > AUTHENTICATED_FILE_SIZE_LIMIT) {
        return NextResponse.json({ error: `${file.name} exceeds the 2GB size limit.` }, { status: 400 });
      }
    }

    const { data: batch, error: batchError } = await supabase
      .from("upload_batches")
      .insert({
        company_id: project.company_id,
        project_id: project.id,
        created_by: user.id,
        source: parsed.data.source,
        status: "uploading",
        file_count: parsed.data.files.length,
        total_bytes: totalBytes,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      throw batchError ?? new Error("Unable to create upload batch.");
    }

    const descriptors = [];

    for (const file of parsed.data.files) {
      const documentType = inferDocumentType(file.type);
      const bucket = getBucketForDocumentType(documentType, "r2");
      const relativePath = normalizeRelativePath(file.relativePath);
      const { data: document, error: documentError } = await supabase
        .from("documents")
        .insert({
          company_id: project.company_id,
          project_id: project.id,
          name: file.name,
          source_filename: file.name,
          document_type: documentType,
          storage_provider: "r2",
          storage_bucket: bucket,
          storage_path: "",
          mime_type: file.type,
          file_size: file.size,
          parse_status: "uploaded",
          uploaded_by: user.id,
          relative_path: relativePath,
          upload_batch_id: batch.id,
          upload_state: "created",
        })
        .select("id")
        .single();

      if (documentError || !document) {
        throw documentError ?? new Error("Unable to create document record.");
      }

      const storagePath = buildCanonicalStoragePath({
        companyId: project.company_id,
        projectId: project.id,
        documentId: document.id,
        documentType,
        fileName: file.name,
      });
      const upload = await createMultipartUpload({
        key: storagePath,
        contentType: file.type,
        metadata: {
          documentId: document.id,
          companyId: String(project.company_id),
          projectId: String(project.id),
        },
      });

      const { error: updateError } = await supabase
        .from("documents")
        .update({
          storage_path: storagePath,
          upload_state: "uploading",
        })
        .eq("id", document.id);

      if (updateError) {
        throw updateError;
      }

      descriptors.push({
        clientKey: file.clientKey,
        documentId: document.id,
        uploadId: upload.uploadId,
        bucket,
        storagePath,
        mimeType: file.type,
        relativePath,
        partSize: MULTIPART_PART_SIZE,
        partCount: Math.max(1, Math.ceil(file.size / MULTIPART_PART_SIZE)),
      });
    }

    return NextResponse.json({
      batchId: batch.id,
      files: descriptors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start upload session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
