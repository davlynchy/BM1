"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { shouldCreatePreviewScan } from "@/lib/billing/entitlements";
import {
  buildCanonicalStoragePath,
  ensurePrivateBuckets,
  getBucketForDocumentType,
  moveStoredFile,
} from "@/lib/documents/storage";
import { clearPendingScanCookie, readPendingScanCookie } from "@/lib/intake/pending-scan";
import { enqueueDocumentJob } from "@/lib/jobs/queue";
import { createClient } from "@/lib/supabase/server";

const completeScanSchema = z.object({
  projectName: z.string().min(2).max(160),
});

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function completePendingScanAction(formData: FormData) {
  const parsed = completeScanSchema.safeParse({
    projectName: getString(formData, "projectName"),
  });

  if (!parsed.success) {
    redirect("/app/intake?message=Enter+a+project+name+to+continue.");
  }

  const pendingScan = await readPendingScanCookie();

  if (!pendingScan) {
    redirect("/upload?message=Your+upload+session+expired.+Please+upload+again.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?message=Please+log+in+to+complete+your+scan.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_company_id")
    .eq("id", user.id)
    .single();

  const companyId = profile?.default_company_id;

  if (!companyId) {
    redirect("/signup?message=Finish+creating+your+workspace+first.");
  }

  const isFreePreview = await shouldCreatePreviewScan(companyId);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      company_id: companyId,
      name: parsed.data.projectName,
      status: "pre-construction",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    redirect(
      `/app/intake?message=${encodeURIComponent(projectError?.message ?? "Unable to create project.")}`,
    );
  }

  await ensurePrivateBuckets();

  const documentType = "contract";
  const bucket = getBucketForDocumentType(documentType);
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .insert({
      company_id: companyId,
      project_id: project.id,
      name: pendingScan.fileName,
      source_filename: pendingScan.fileName,
      document_type: documentType,
      storage_bucket: bucket,
      storage_path: "",
      mime_type: pendingScan.mimeType,
      file_size: pendingScan.fileSize,
      parse_status: "uploaded",
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (documentError || !document) {
    redirect(
      `/app/intake?message=${encodeURIComponent(documentError?.message ?? "Unable to register document.")}`,
    );
  }

  const canonicalStoragePath = buildCanonicalStoragePath({
    companyId,
    projectId: project.id,
    documentId: document.id,
    documentType,
    fileName: pendingScan.fileName,
  });

  await moveStoredFile({
    sourceBucket: pendingScan.bucket,
    sourcePath: pendingScan.storagePath,
    destinationBucket: bucket,
    destinationPath: canonicalStoragePath,
  });

  const { error: documentUpdateError } = await supabase
    .from("documents")
    .update({
      storage_bucket: bucket,
      storage_path: canonicalStoragePath,
      parse_status: "queued",
    })
    .eq("id", document.id);

  if (documentUpdateError) {
    redirect(`/app/intake?message=${encodeURIComponent(documentUpdateError.message)}`);
  }

  const { data: scan, error: scanError } = await supabase
    .from("contract_scans")
    .insert({
      company_id: companyId,
      project_id: project.id,
      contract_document_id: document.id,
      status: "queued",
      is_free_preview: isFreePreview,
      summary: {
        executiveSummary:
          "Your contract is being processed. Bidmetric is extracting text and preparing a clause index now.",
        topThemes: ["document ingestion", "clause indexing", "commercial extraction"],
        sourceFile: pendingScan.fileName,
      },
      created_by: user.id,
    })
    .select("id")
    .single();

  if (scanError || !scan) {
    redirect(`/app/intake?message=${encodeURIComponent(scanError?.message ?? "Unable to create scan.")}`);
  }

  await enqueueDocumentJob({
    companyId,
    projectId: project.id,
    documentId: document.id,
    jobType: "document.parse",
    jobKey: `${document.id}:document.parse`,
    payload: {
      documentId: document.id,
      companyId,
      projectId: project.id,
      bucket,
      storagePath: canonicalStoragePath,
      mimeType: pendingScan.mimeType,
      documentType,
      fileName: pendingScan.fileName,
    },
  });

  await clearPendingScanCookie();
  redirect(`/scan/${scan.id}`);
}
