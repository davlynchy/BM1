import { NextResponse } from "next/server";

import { shouldCreatePreviewScan } from "@/lib/billing/entitlements";
import { buildDocumentFingerprint } from "@/lib/documents/fingerprint";
import {
  getDefaultCompanyIdForUser,
  getOwnedIntakeSession,
  markIntakeCompleted,
  markIntakeProcessing,
  updateIntakeSession,
} from "@/lib/intake/session";
import { enqueueDocumentJob } from "@/lib/jobs/queue";
import { findReusableCompletedScan } from "@/lib/scans/duplicates";
import { enforceContractScanQuota } from "@/lib/scans/limits";
import { replaceContractScanOutputs } from "@/lib/scans/persist";
import { ensureContractReviewThread, appendDeepReview } from "@/lib/scans/review-thread";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
    }

    const companyId = await getDefaultCompanyIdForUser(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ error: "Finish creating your workspace first." }, { status: 400 });
    }

    const session = await getOwnedIntakeSession({
      sessionId,
      userId: user.id,
    });

    if (!session) {
      return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
    }

    if (session.scan_id) {
      const response = NextResponse.json({ scanId: session.scan_id });
      response.cookies.delete("bidmetric_intake_session");
      return response;
    }

    if (!session.storage_bucket || !session.storage_path || !session.storage_provider) {
      return NextResponse.json({ error: "Upload the contract before continuing." }, { status: 400 });
    }

    let projectId = session.project_id;

    if (session.project_selection_mode === "existing") {
      if (!projectId) {
        return NextResponse.json({ error: "Choose an existing project." }, { status: 400 });
      }

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (projectError || !project) {
        return NextResponse.json({ error: "Choose a valid project." }, { status: 400 });
      }
    } else {
      if (projectId) {
        const { data: project } = await supabase
          .from("projects")
          .select("id")
          .eq("id", projectId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (!project) {
          projectId = null;
        }
      }

      if (!projectId) {
        const projectName = String(session.new_project_name ?? "").trim();
        if (!projectName) {
          return NextResponse.json({ error: "Enter a project name to continue." }, { status: 400 });
        }

        const { data: project, error: projectError } = await supabase
          .from("projects")
          .insert({
            company_id: companyId,
            name: projectName,
            status: "pre-construction",
            created_by: user.id,
          })
          .select("id")
          .single();

        if (projectError || !project) {
          return NextResponse.json(
            { error: projectError?.message ?? "Unable to create project." },
            { status: 400 },
          );
        }

        projectId = project.id;
        await updateIntakeSession(session.id, { project_id: projectId });
      }
    }

    await markIntakeProcessing(session.id);

    const documentType = "contract";
    const bucket = session.storage_bucket;
    const canonicalStoragePath = session.storage_path;
    const documentId = session.document_id;

    if (!documentId) {
      return NextResponse.json({ error: "Upload the contract before continuing." }, { status: 400 });
    }

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, project_id, company_id, storage_provider, storage_bucket, storage_path")
      .eq("id", documentId)
      .eq("project_id", projectId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (documentError || !document) {
      return NextResponse.json(
        { error: documentError?.message ?? "Unable to find the uploaded contract." },
        { status: 400 },
      );
    }

    if (
      document.storage_provider !== "r2" ||
      document.storage_bucket !== bucket ||
      document.storage_path !== canonicalStoragePath
    ) {
      return NextResponse.json({ error: "Upload the contract before continuing." }, { status: 400 });
    }

    const fingerprint = buildDocumentFingerprint({
      fileName: session.file_name,
      fileSize: session.file_size,
      mimeType: session.mime_type,
    });
    const { error: documentUpdateError } = await supabase
      .from("documents")
      .update({
        parse_status: "queued",
        upload_state: "uploaded",
        upload_completed_at: new Date().toISOString(),
        document_fingerprint: fingerprint,
      })
      .eq("id", documentId);

    if (documentUpdateError) {
      return NextResponse.json({ error: documentUpdateError.message }, { status: 400 });
    }

    const isFreePreview = await shouldCreatePreviewScan(companyId);
    const reusableScan = await findReusableCompletedScan({
      companyId,
      projectId: projectId!,
      fingerprint,
      excludeDocumentId: documentId,
    });

    if (reusableScan) {
      const { data: clonedScan, error: clonedScanError } = await supabase
        .from("contract_scans")
        .insert({
          company_id: companyId,
          project_id: projectId,
          contract_document_id: documentId,
          status: "completed",
          is_free_preview: isFreePreview,
          summary: reusableScan.extraction.summary,
          created_by: user.id,
          processing_error: null,
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (clonedScanError || !clonedScan) {
        return NextResponse.json(
          { error: clonedScanError?.message ?? "Unable to reuse existing scan." },
          { status: 400 },
        );
      }

      await replaceContractScanOutputs({
        scanId: clonedScan.id,
        companyId,
        extraction: reusableScan.extraction,
      });

      const reviewThread = await ensureContractReviewThread({
        companyId,
        projectId: projectId!,
        scanId: clonedScan.id,
        userId: user.id,
        contractName: session.file_name,
      });
      await appendDeepReview({
        threadId: String(reviewThread.id),
        companyId,
        scanId: clonedScan.id,
        review: reusableScan.extraction,
        citations: reusableScan.extraction.findings.slice(0, 4).map((finding, index) => ({
          sourceId: `reused-${index}`,
          documentId,
          documentName: session.file_name,
          pageNumber: finding.citation.page,
          snippet: finding.citation.snippet,
          sectionTitle: finding.citation.section,
        })),
      });

      await markIntakeCompleted({
        sessionId: session.id,
        projectId: projectId!,
        documentId: documentId!,
        scanId: clonedScan.id,
      });

      const response = NextResponse.json({ scanId: clonedScan.id });
      response.cookies.delete("bidmetric_intake_session");
      return response;
    }

    await enforceContractScanQuota({
      companyId,
      userId: user.id,
      reason: "finalize",
    });

    const { data: existingScan } = await supabase
      .from("contract_scans")
      .select("id")
      .eq("project_id", projectId)
      .eq("contract_document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: scan, error: scanError } = existingScan
      ? { data: existingScan, error: null }
      : await supabase
          .from("contract_scans")
          .insert({
            company_id: companyId,
            project_id: projectId,
            contract_document_id: documentId,
            status: "queued",
            is_free_preview: isFreePreview,
            summary: {
              executiveSummary:
                "Your contract is being processed. Bidmetric is extracting text and preparing a clause index now.",
              topThemes: ["document ingestion", "clause indexing", "commercial extraction"],
              sourceFile: session.file_name,
            },
            created_by: user.id,
          })
          .select("id")
          .single();

    if (scanError || !scan) {
      return NextResponse.json(
        { error: scanError?.message ?? "Unable to create scan." },
        { status: 400 },
      );
    }

    await ensureContractReviewThread({
      companyId,
      projectId: projectId!,
      scanId: scan.id,
      userId: user.id,
      contractName: session.file_name,
    });

    await enqueueDocumentJob({
      companyId,
      projectId: projectId!,
      documentId: documentId!,
      jobType: "document.parse",
      jobKey: `${documentId}:document.parse`,
      payload: {
        documentId: documentId!,
        companyId,
        projectId: projectId!,
        bucket,
        storagePath: canonicalStoragePath,
        storageProvider: "r2",
        mimeType: session.mime_type,
        documentType,
        fileName: session.file_name,
      },
    });

    await markIntakeCompleted({
      sessionId: session.id,
      projectId: projectId!,
      documentId: documentId!,
      scanId: scan.id,
    });

    const response = NextResponse.json({ scanId: scan.id });
    response.cookies.delete("bidmetric_intake_session");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to continue to the scan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
