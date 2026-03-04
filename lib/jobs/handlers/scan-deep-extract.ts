import { createAdminClient } from "@/lib/supabase/admin";
import { buildContractScanContext } from "@/lib/scans/context";
import { extractDeepContractReview } from "@/lib/scans/deep-review";
import { replaceContractScanOutputs, updateContractScanProgress, updateContractScanStatus } from "@/lib/scans/persist";
import { appendDeepReview, appendReviewProgress } from "@/lib/scans/review-thread";
import { syncScanTodos } from "@/lib/todos/sync";
import type { AssistantCitation } from "@/types/assistant";
import type { DocumentJobPayload } from "@/types/ingestion";

function citationsFromExtraction(extraction: Awaited<ReturnType<typeof extractDeepContractReview>>["extraction"]): AssistantCitation[] {
  return extraction.findings.slice(0, 6).map((finding, index) => ({
    sourceId: `deep-${index}`,
    documentId: "",
    documentName: "Contract review",
    pageNumber: finding.citation.page,
    snippet: finding.citation.snippet,
    sectionTitle: finding.citation.section,
  }));
}

export async function handleScanDeepExtractJob(payload: DocumentJobPayload) {
  const supabase = createAdminClient();
  const { data: scan, error: scanError } = await supabase
    .from("contract_scans")
    .select("id, company_id, project_id, contract_document_id")
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

  if (thread?.id) {
    await appendReviewProgress({
      threadId: String(thread.id),
      companyId: String(scan.company_id),
      scanId: String(scan.id),
      stage: "deep_review_ready",
      content: "I'm refining the first review with stronger clause support, obligations, and negotiation points.",
    });
  }

  const { data: chunks, error: chunksError } = await supabase
    .from("document_chunks")
    .select("id, chunk_index, content, metadata")
    .eq("document_id", payload.documentId)
    .order("chunk_index", { ascending: true });

  if (chunksError) {
    throw chunksError;
  }

  if (!chunks?.length) {
    throw new Error("No indexed contract chunks found for deep review.");
  }

  const context = buildContractScanContext(
    chunks.map((chunk) => ({
      id: String(chunk.id),
      chunk_index: Number(chunk.chunk_index),
      content: String(chunk.content),
      metadata: (chunk.metadata ?? {}) as Record<string, unknown>,
    })),
  );

  const { extraction, promptVersion } = await extractDeepContractReview(context);

  await replaceContractScanOutputs({
    scanId: String(scan.id),
    companyId: String(scan.company_id),
    extraction,
  });

  await syncScanTodos({
    companyId: String(scan.company_id),
    projectId: scan.project_id ? String(scan.project_id) : null,
    scanId: String(scan.id),
    extraction,
  });

  await updateContractScanStatus({
    scanId: String(scan.id),
    status: "completed",
    summary: {
      ...extraction.summary,
      currentStage: "report_complete",
      deepReviewCompletedAt: new Date().toISOString(),
      lastProgressMessage: "Deep review complete.",
    },
    processingError: null,
    promptVersion,
  });

  if (thread?.id) {
    await appendDeepReview({
      threadId: String(thread.id),
      companyId: String(scan.company_id),
      scanId: String(scan.id),
      review: extraction,
      citations: citationsFromExtraction(extraction),
    });
  }

  await updateContractScanProgress({
    scanId: String(scan.id),
    status: "completed",
    currentStage: "report_complete",
    progressMessage: "Deep review complete.",
    summaryPatch: {
      ...extraction.summary,
      deepReviewCompletedAt: new Date().toISOString(),
      promptVersion,
    },
  });
}
