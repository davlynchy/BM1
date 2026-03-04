import { createAdminClient } from "@/lib/supabase/admin";
import { insertAssistantMessage, getOrCreateAssistantThread, loadAssistantMessages } from "@/lib/assistant/store";
import type { AssistantCitation, AssistantMessageRecord } from "@/types/assistant";
import type { QuickReviewResult, ContractScanExtraction } from "@/types/scans";

type ReviewStage = NonNullable<AssistantMessageRecord["metadata"]["stage"]>;

export async function ensureContractReviewThread(params: {
  companyId: string;
  projectId: string;
  scanId: string;
  userId: string;
  contractName: string;
}) {
  const thread = await getOrCreateAssistantThread({
    companyId: params.companyId,
    projectId: params.projectId,
    userId: params.userId,
    threadType: "contract_review",
    scanId: params.scanId,
    title: `Contract review: ${params.contractName}`,
  });

  const existingMessages = await loadAssistantMessages(String(thread.id));

  if (!existingMessages.length) {
    await insertAssistantMessage({
      threadId: String(thread.id),
      companyId: params.companyId,
      role: "assistant",
      content: `Uploading complete. I'm reviewing ${params.contractName} for commercial red flags now.`,
      metadata: {
        messageType: "system_progress",
        stage: "upload_complete",
        scanId: params.scanId,
        isPartial: true,
      },
    });
  }

  return thread;
}

export async function getContractReviewThread(scanId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_threads")
    .select("id, title")
    .eq("scan_id", scanId)
    .eq("thread_type", "contract_review")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function appendReviewProgress(params: {
  threadId: string;
  companyId: string;
  scanId: string;
  stage: ReviewStage;
  content: string;
}) {
  return insertAssistantMessage({
    threadId: params.threadId,
    companyId: params.companyId,
    role: "assistant",
    content: params.content,
    metadata: {
      messageType: "system_progress",
      stage: params.stage,
      scanId: params.scanId,
      isPartial: true,
    },
  });
}

function renderFindings(findings: QuickReviewResult["findings"]) {
  return findings
    .slice(0, 5)
    .map(
      (finding, index) =>
        `${index + 1}. ${finding.title}\nWhy it matters: ${finding.summary}\nCommercial impact: ${finding.implication}\nRecommended move: ${finding.recommendedAction}`,
    )
    .join("\n\n");
}

function buildCitationList(citations: AssistantCitation[]) {
  return citations.map((citation) => ({
    sourceId: citation.sourceId,
    documentId: citation.documentId,
    documentName: citation.documentName,
    pageNumber: citation.pageNumber,
    snippet: citation.snippet,
    sectionTitle: citation.sectionTitle,
  }));
}

export async function appendQuickReview(params: {
  threadId: string;
  companyId: string;
  scanId: string;
  review: QuickReviewResult;
  citations: AssistantCitation[];
}) {
  return insertAssistantMessage({
    threadId: params.threadId,
    companyId: params.companyId,
    role: "assistant",
    content: [
      "Preliminary review complete. These are the main red flags I'd raise first:",
      "",
      params.review.summary.executiveSummary,
      "",
      renderFindings(params.review.findings),
    ].join("\n"),
    citations: buildCitationList(params.citations),
    metadata: {
      messageType: "assistant_quick_review",
      stage: "quick_red_flags_ready",
      scanId: params.scanId,
      isPartial: true,
      version: "quick-review-v1",
    },
  });
}

export async function appendDeepReview(params: {
  threadId: string;
  companyId: string;
  scanId: string;
  review: ContractScanExtraction;
  citations: AssistantCitation[];
}) {
  const negotiationPoints = params.review.summary.negotiationPoints ?? [];
  const priorityActions = params.review.summary.priorityActions ?? [];

  return insertAssistantMessage({
    threadId: params.threadId,
    companyId: params.companyId,
    role: "assistant",
    content: [
      "Deep review complete. Here is the stronger commercial position I would take.",
      "",
      params.review.summary.executiveSummary,
      "",
      negotiationPoints.length
        ? `Negotiation points:\n${negotiationPoints.map((item, index) => `${index + 1}. ${item}`).join("\n")}`
        : "",
      priorityActions.length
        ? `Priority actions:\n${priorityActions.map((item, index) => `${index + 1}. ${item}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    citations: buildCitationList(params.citations),
    metadata: {
      messageType: "assistant_deep_review",
      stage: "deep_review_ready",
      scanId: params.scanId,
      isPartial: false,
      version: "deep-review-v1",
    },
  });
}
