import {
  createAssistantRun,
  getValidatedAssistantThread,
  insertAssistantMessage,
  listAssistantRuns,
  listAssistantThreadSources,
  listAssistantThreads,
  loadAssistantMessages,
  replaceAssistantThreadSources,
  updateAssistantRun,
} from "@/lib/assistant/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueAssistantJob } from "@/lib/jobs/queue";
import { requireProjectAccess } from "@/lib/projects/access";
import type { AssistantMode, AssistantMessageRecord, AssistantThreadSummary, AssistantThreadType } from "@/types/assistant";

export async function loadProjectAssistantWorkbench(params: {
  projectId: string;
  userId: string;
  threadId?: string;
}) {
  const { supabase, project } = await requireProjectAccess(params.projectId);
  const threads = await listAssistantThreads({
    companyId: String(project.company_id),
    projectId: String(project.id),
    userId: params.userId,
  });

  const activeThread =
    (params.threadId ? threads.find((thread) => thread.id === params.threadId) : null) ??
    threads[0] ??
    null;

  if (!activeThread) {
    const { data: documents } = await supabase
      .from("documents")
      .select("id, name, document_type, parse_status, file_size, page_count, chunk_count, processing_error, created_at, updated_at")
      .eq("project_id", project.id)
      .order("updated_at", { ascending: false });

    return {
      project,
      threads,
      activeThread: null,
      messages: [] as AssistantMessageRecord[],
      sources: [],
      runs: [],
      documents: documents ?? [],
    };
  }

  return loadAssistantThreadDetail({
    projectId: String(project.id),
    threadId: activeThread.id,
    userId: params.userId,
  });
}

export async function loadAssistantThreadDetail(params: {
  projectId: string;
  threadId: string;
  userId: string;
}) {
  const { supabase, project } = await requireProjectAccess(params.projectId);
  const thread = await getValidatedAssistantThread({
    threadId: params.threadId,
    companyId: String(project.company_id),
    projectId: String(project.id),
    userId: params.userId,
  });

  const [threads, messages, sources, runs, documents] = await Promise.all([
    listAssistantThreads({
      companyId: String(project.company_id),
      projectId: String(project.id),
      userId: params.userId,
    }),
    loadAssistantMessages(String(thread.id)),
    listAssistantThreadSources(String(thread.id)),
    listAssistantRuns(String(thread.id)),
    supabase
      .from("documents")
      .select("id, name, document_type, parse_status, file_size, page_count, chunk_count, processing_error, created_at, updated_at")
      .eq("project_id", project.id)
      .order("updated_at", { ascending: false }),
  ]);

  const activeThread = threads.find((item) => item.id === thread.id) ?? ({
    id: String(thread.id),
    title: String(thread.title),
    threadType: "project_assistant",
    scanId: null,
    lastMessagePreview: null,
    lastMessageAt: null,
    sourceCount: sources.length,
  } satisfies AssistantThreadSummary);

  return {
    project,
    threads,
    activeThread,
    messages,
    sources,
    runs,
    documents: documents.data ?? [],
  };
}

export async function createProjectAssistantThread(params: {
  projectId: string;
  userId: string;
  title: string;
  sourceDocumentIds: string[];
}) {
  const { project } = await requireProjectAccess(params.projectId);
  const { createAssistantThread } = await import("@/lib/assistant/store");
  const thread = await createAssistantThread({
    companyId: String(project.company_id),
    projectId: String(project.id),
    userId: params.userId,
    threadType: "project_assistant",
    title: params.title || "New thread",
  });

  await replaceAssistantThreadSources({
    threadId: String(thread.id),
    companyId: String(project.company_id),
    projectId: String(project.id),
    documentIds: params.sourceDocumentIds,
  });

  return thread;
}

export async function appendAssistantThreadMessage(params: {
  projectId: string;
  userId: string;
  threadId: string;
  message: string;
  mode: AssistantMode;
  sourceDocumentIds: string[];
  selectedOutputType?: string | null;
}) {
  return appendQueuedThreadMessage({
    projectId: params.projectId,
    userId: params.userId,
    threadId: params.threadId,
    message: params.message,
    mode: params.mode,
    selectedOutputType: params.selectedOutputType ?? null,
    sourceDocumentIds: params.sourceDocumentIds,
    threadType: "project_assistant",
  });
}

export async function appendContractReviewThreadMessage(params: {
  projectId: string;
  userId: string;
  threadId: string;
  message: string;
}) {
  return appendQueuedThreadMessage({
    projectId: params.projectId,
    userId: params.userId,
    threadId: params.threadId,
    message: params.message,
    mode: "answer",
    selectedOutputType: null,
    sourceDocumentIds: [],
    threadType: "contract_review",
  });
}

async function appendQueuedThreadMessage(params: {
  projectId: string;
  userId: string;
  threadId: string;
  message: string;
  mode: AssistantMode;
  selectedOutputType: string | null;
  sourceDocumentIds: string[];
  threadType: AssistantThreadType;
}) {
  const { project } = await requireProjectAccess(params.projectId);
  const thread = await getValidatedAssistantThread({
    threadId: params.threadId,
    companyId: String(project.company_id),
    projectId: String(project.id),
    userId: params.userId,
    threadType: params.threadType,
  });

  if (params.sourceDocumentIds.length) {
    await replaceAssistantThreadSources({
      threadId: String(thread.id),
      companyId: String(project.company_id),
      projectId: String(project.id),
      documentIds: params.sourceDocumentIds,
    });
  }

  const scanContext =
    params.threadType === "contract_review" ? await resolveScanContextForThread(String(thread.id)) : null;

  if (params.threadType === "contract_review" && !scanContext?.scanId) {
    throw new Error("Contract review thread is missing its scan.");
  }

  const userMessage = await insertAssistantMessage({
    threadId: String(thread.id),
    companyId: String(project.company_id),
    role: "user",
    content: params.message,
    metadata:
      params.threadType === "contract_review" && scanContext?.scanId
        ? {
            messageType: "assistant_followup",
            scanId: scanContext.scanId,
          }
        : {},
  });

  const run = await createAssistantRun({
    threadId: String(thread.id),
    companyId: String(project.company_id),
    projectId: String(project.id),
    userId: params.userId,
    mode: params.mode,
    requestedOutputType: params.selectedOutputType,
    status: "queued",
    currentStage: "queued",
    metadata: {
      userMessageId: userMessage.id,
      threadType: params.threadType,
    },
  });

  const progressMessage = await insertAssistantMessage({
    threadId: String(thread.id),
    companyId: String(project.company_id),
    role: "system",
    content:
      params.threadType === "contract_review"
        ? "Review started. I am reading the contract clauses and preparing your answer."
        : "Working on this now. I am retrieving your project sources and drafting a response.",
    metadata: {
      messageType: "system_progress",
      isPartial: true,
    },
  });

  try {
    await enqueueAssistantJob({
      companyId: String(project.company_id),
      projectId: String(project.id),
      jobType: "assistant.quick_answer",
      jobKey: `${run.id}:assistant.quick_answer`,
      payload: {
        runId: run.id,
        threadId: String(thread.id),
        companyId: String(project.company_id),
        projectId: String(project.id),
        userId: params.userId,
        question: params.message,
        mode: params.mode,
        threadType: params.threadType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to queue assistant run.";
    await updateAssistantRun({
      runId: run.id,
      status: "failed",
      currentStage: "failed",
      error: message,
      metadata: {
        progressMessageId: progressMessage.id,
      },
    });
    throw error;
  }

  return {
    userMessage,
    progressMessage,
    runId: run.id,
  };
}

async function resolveScanContextForThread(threadId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_threads")
    .select("scan_id")
    .eq("id", threadId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.scan_id) {
    return null;
  }

  const { data: scan, error: scanError } = await supabase
    .from("contract_scans")
    .select("contract_document_id")
    .eq("id", data.scan_id)
    .maybeSingle();

  if (scanError) {
    throw scanError;
  }

  return {
    scanId: String(data.scan_id),
    documentId: scan?.contract_document_id ? String(scan.contract_document_id) : null,
  };
}
