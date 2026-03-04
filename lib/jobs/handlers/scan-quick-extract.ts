import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueDocumentJob } from "@/lib/jobs/queue";
import { buildContractScanContext } from "@/lib/scans/context";
import { replaceContractScanPreview, updateContractScanProgress, updateContractScanStatus } from "@/lib/scans/persist";
import { extractQuickContractReview } from "@/lib/scans/quick-review";
import { appendQuickReview, appendReviewProgress } from "@/lib/scans/review-thread";
import type { AssistantCitation } from "@/types/assistant";
import type { DocumentJobPayload } from "@/types/ingestion";
import type { ScanFinding } from "@/types/scans";

function citationsFromFindings(findings: ScanFinding[], documentId: string): AssistantCitation[] {
  return findings.map((finding, index) => ({
    sourceId: `quick-${index}`,
    documentId,
    documentName: "Contract review",
    pageNumber: finding.citation.page,
    snippet: finding.citation.snippet,
    sectionTitle: finding.citation.section,
  }));
}

export async function handleScanQuickExtractJob(payload: DocumentJobPayload) {
  const supabase = createAdminClient();
  const { data: scan, error: scanError } = await supabase
    .from("contract_scans")
    .select("id, company_id, project_id")
    .eq("contract_document_id", payload.documentId)
    .maybeSingle();

  if (scanError) {
    throw scanError;
  }

  if (!scan) {
    return;
  }

  const { data: thread, error: threadError } = await supabase
    .from("assistant_threads")
    .select("id")
    .eq("scan_id", scan.id)
    .eq("thread_type", "contract_review")
    .maybeSingle();

  if (threadError) {
    throw threadError;
  }

  await updateContractScanStatus({
    scanId: scan.id,
    status: "in_progress",
    processingError: null,
  });

  if (thread?.id) {
    await appendReviewProgress({
      threadId: String(thread.id),
      companyId: String(scan.company_id),
      scanId: String(scan.id),
      stage: "clauses_chunked",
      content: "I have extracted the contract text and grouped the key commercial clauses. I'm pulling out the first red flags now.",
    });
  }

  await updateContractScanProgress({
    scanId: scan.id,
    status: "in_progress",
    currentStage: "clauses_chunked",
    progressMessage: "Contract text extracted and clauses chunked.",
  });

  const { data: chunks, error: chunksError } = await supabase
    .from("document_chunks")
    .select("id, chunk_index, content, metadata")
    .eq("document_id", payload.documentId)
    .order("chunk_index", { ascending: true });

  if (chunksError) {
    throw chunksError;
  }

  if (!chunks?.length) {
    throw new Error("No contract chunks found for quick review.");
  }

  const context = buildContractScanContext(
    chunks.map((chunk) => ({
      id: String(chunk.id),
      chunk_index: Number(chunk.chunk_index),
      content: String(chunk.content),
      metadata: (chunk.metadata ?? {}) as Record<string, unknown>,
    })),
  );

  const { review, promptVersion } = await extractQuickContractReview(context);

  await replaceContractScanPreview({
    scanId: String(scan.id),
    companyId: String(scan.company_id),
    review,
  });

  await updateContractScanProgress({
    scanId: String(scan.id),
    status: "in_progress",
    currentStage: "quick_red_flags_ready",
    progressMessage: "Quick red-flag review ready.",
    summaryPatch: {
      ...review.summary,
      quickReviewCompletedAt: new Date().toISOString(),
      promptVersion,
    },
  });

  if (thread?.id) {
    await appendQuickReview({
      threadId: String(thread.id),
      companyId: String(scan.company_id),
      scanId: String(scan.id),
      review,
      citations: citationsFromFindings(review.findings, payload.documentId),
    });
    await appendReviewProgress({
      threadId: String(thread.id),
      companyId: String(scan.company_id),
      scanId: String(scan.id),
      stage: "quick_red_flags_ready",
      content: "The first-pass red flags are ready. I'm now deepening the review and drafting negotiation points.",
    });
  }

  await enqueueDocumentJob({
    companyId: String(scan.company_id),
    projectId: scan.project_id ? String(scan.project_id) : null,
    documentId: payload.documentId,
    jobType: "scan.deep_extract",
    jobKey: `${payload.documentId}:scan.deep_extract`,
    payload,
  });
}
