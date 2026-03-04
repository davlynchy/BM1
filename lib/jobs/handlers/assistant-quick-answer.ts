import { generateAssistantReply } from "@/lib/assistant/respond";
import {
  insertAssistantMessage,
  listAssistantThreadSources,
  loadAssistantMessages,
  updateAssistantRun,
} from "@/lib/assistant/store";
import { retrieveProjectSources } from "@/lib/assistant/retrieval";
import { answerContractReviewQuestion } from "@/lib/scans/respond";
import { retrieveScanSources } from "@/lib/scans/retrieval";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AssistantJobPayload } from "@/types/ingestion";

export async function handleAssistantQuickAnswerJob(payload: AssistantJobPayload) {
  await updateAssistantRun({
    runId: payload.runId,
    status: "in_progress",
    currentStage: "retrieving_sources",
    error: null,
  });

  if (payload.threadType === "contract_review") {
    const scanContext = await resolveScanContextForThread(payload.threadId);

    if (!scanContext?.scanId || !scanContext.documentId) {
      throw new Error("Contract review thread is missing its scan context.");
    }

    const priorMessages = await loadAssistantMessages(payload.threadId);
    const sources = await retrieveScanSources({
      companyId: payload.companyId,
      projectId: payload.projectId,
      scanId: scanContext.scanId,
      documentId: scanContext.documentId,
      question: payload.question,
    });

    await updateAssistantRun({
      runId: payload.runId,
      status: "in_progress",
      currentStage: "generating_answer",
    });

    const reply = await answerContractReviewQuestion({
      question: payload.question,
      messages: priorMessages,
      sources,
    });

    const assistantMessage = await insertAssistantMessage({
      threadId: payload.threadId,
      companyId: payload.companyId,
      role: "assistant",
      content: reply.answer,
      citations: reply.citations,
      metadata: {
        messageType: "assistant_followup",
        scanId: scanContext.scanId,
      },
    });

    await updateAssistantRun({
      runId: payload.runId,
      status: "completed",
      currentStage: "answer_ready",
      metadata: {
        sourceCount: sources.length,
        messageId: assistantMessage.id,
      },
    });

    return;
  }

  const currentSources = await listAssistantThreadSources(payload.threadId);
  const priorMessages = await loadAssistantMessages(payload.threadId);
  const sources = await retrieveProjectSources({
    companyId: payload.companyId,
    projectId: payload.projectId,
    question: payload.question,
    documentIds: currentSources.map((source) => source.documentId),
  });

  await updateAssistantRun({
    runId: payload.runId,
    status: "in_progress",
    currentStage: "generating_answer",
  });

  const assistantReply = await generateAssistantReply({
    question: payload.question,
    messages: priorMessages.map((entry) => ({
      role: entry.role === "system" ? "assistant" : entry.role,
      content: entry.content,
    })),
    sources,
  });

  const assistantMessage = await insertAssistantMessage({
    threadId: payload.threadId,
    companyId: payload.companyId,
    role: "assistant",
    content: assistantReply.answer,
    citations: assistantReply.citations,
  });

  await updateAssistantRun({
    runId: payload.runId,
    status: "completed",
    currentStage: "answer_ready",
    metadata: {
      sourceCount: sources.length,
      messageId: assistantMessage.id,
    },
  });
}

async function resolveScanContextForThread(threadId: string) {
  const supabase = createAdminClient();
  const { data: thread, error: threadError } = await supabase
    .from("assistant_threads")
    .select("scan_id")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    throw threadError;
  }

  if (!thread?.scan_id) {
    return null;
  }

  const { data: scan, error: scanError } = await supabase
    .from("contract_scans")
    .select("contract_document_id")
    .eq("id", thread.scan_id)
    .maybeSingle();

  if (scanError) {
    throw scanError;
  }

  if (!scan?.contract_document_id) {
    return null;
  }

  return {
    scanId: String(thread.scan_id),
    documentId: String(scan.contract_document_id),
  };
}
