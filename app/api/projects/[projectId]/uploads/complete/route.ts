import { NextResponse } from "next/server";
import { z } from "zod";

import { shouldCreatePreviewScan } from "@/lib/billing/entitlements";
import { enqueueDocumentJob } from "@/lib/jobs/queue";
import { ensureContractReviewThread } from "@/lib/scans/review-thread";
import { completeMultipartUpload, headR2Object } from "@/lib/storage/r2";
import { requireProjectAccess } from "@/lib/projects/access";

const completedUploadSchema = z.object({
  documentId: z.string().uuid(),
  uploadId: z.string().min(1),
  parts: z.array(
    z.object({
      partNumber: z.number().int().positive(),
      etag: z.string().min(1),
    }),
  ).min(1),
});

const completeSchema = z.object({
  batchId: z.string().uuid(),
  uploaded: z.array(completedUploadSchema).min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const parsed = completeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload completion payload." }, { status: 400 });
    }

    const { supabase, project, user } = await requireProjectAccess(projectId);
    const { data: batch, error: batchError } = await supabase
      .from("upload_batches")
      .select("id, source")
      .eq("id", parsed.data.batchId)
      .eq("project_id", project.id)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: "Upload batch not found." }, { status: 404 });
    }

    const queuedDocuments = [];
    const createdReviewThreads: Array<{ threadId: string; scanId: string }> = [];
    const isFreePreview = await shouldCreatePreviewScan(String(project.company_id));

    for (const uploaded of parsed.data.uploaded) {
      const { data: document, error } = await supabase
        .from("documents")
        .select("id, company_id, project_id, name, document_type, mime_type, file_size, storage_provider, storage_bucket, storage_path")
        .eq("id", uploaded.documentId)
        .eq("project_id", project.id)
        .eq("upload_batch_id", batch.id)
        .single();

      if (error || !document) {
        throw error ?? new Error("Uploaded document not found.");
      }

      if (document.storage_provider !== "r2") {
        throw new Error("Document is not configured for R2 completion.");
      }

      const completeResult = await completeMultipartUpload({
        key: document.storage_path,
        uploadId: uploaded.uploadId,
        parts: uploaded.parts,
      });
      const head = await headR2Object(document.storage_path);

      if (document.file_size && head.contentLength && Number(document.file_size) !== head.contentLength) {
        throw new Error(`Uploaded file size mismatch for ${document.name}.`);
      }

      const { error: updateError } = await supabase
        .from("documents")
        .update({
          parse_status: "queued",
          upload_state: "uploaded",
          upload_completed_at: new Date().toISOString(),
          storage_etag: completeResult.etag ?? head.etag,
          storage_version: completeResult.version ?? head.version,
        })
        .eq("id", document.id);

      if (updateError) {
        throw updateError;
      }

      await enqueueDocumentJob({
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
          storageProvider: "r2",
          mimeType: document.mime_type,
          documentType: document.document_type,
          fileName: document.name,
        },
      });

      if (document.document_type === "contract") {
        const { data: existingScan, error: existingScanError } = await supabase
          .from("contract_scans")
          .select("id")
          .eq("project_id", project.id)
          .eq("contract_document_id", document.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingScanError) {
          throw existingScanError;
        }

        const { data: scan, error: scanError } = existingScan
          ? { data: existingScan, error: null }
          : await supabase
              .from("contract_scans")
              .insert({
                company_id: document.company_id,
                project_id: project.id,
                contract_document_id: document.id,
                status: "queued",
                is_free_preview: isFreePreview,
                summary: {
                  executiveSummary:
                    "Your contract is being processed. Bidmetric is extracting text and preparing a clause index now.",
                  topThemes: ["document ingestion", "clause indexing", "commercial extraction"],
                  sourceFile: document.name,
                },
                created_by: user.id,
              })
              .select("id")
              .single();

        if (scanError || !scan) {
          throw scanError ?? new Error("Unable to create contract scan.");
        }

        const thread = await ensureContractReviewThread({
          companyId: String(document.company_id),
          projectId: String(project.id),
          scanId: String(scan.id),
          userId: String(user.id),
          contractName: String(document.name),
        });

        createdReviewThreads.push({
          threadId: String(thread.id),
          scanId: String(scan.id),
        });
      }

      queuedDocuments.push({
        id: document.id,
        name: document.name,
        parseStatus: "queued",
      });
    }

    const { error: batchUpdateError } = await supabase
      .from("upload_batches")
      .update({
        status: "finalized",
        completed_at: new Date().toISOString(),
      })
      .eq("id", batch.id);

    if (batchUpdateError) {
      throw batchUpdateError;
    }

    return NextResponse.json({
      batchId: batch.id,
      documents: queuedDocuments,
      assistantUrl: createdReviewThreads.length
        ? `/app/projects/${project.id}/assistant?threadId=${encodeURIComponent(createdReviewThreads[0].threadId)}`
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finalize upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
