import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AssistantCitation,
  AssistantMessageMetadata,
  AssistantMessageRecord,
  AssistantRunRecord,
  AssistantSourceSelection,
  AssistantThreadSummary,
  AssistantThreadType,
} from "@/types/assistant";

export async function getOrCreateAssistantThread(params: {
  companyId: string;
  projectId: string;
  userId: string;
  threadType?: AssistantThreadType;
  scanId?: string | null;
  title?: string;
}) {
  const supabase = createAdminClient();
  const threadType = params.threadType ?? "project_assistant";
  const { data: existing, error: existingError } = await supabase
    .from("assistant_threads")
    .select("id, title")
    .eq("company_id", params.companyId)
    .eq("project_id", params.projectId)
    .eq("created_by", params.userId)
    .eq("thread_type", threadType)
    .eq("scan_id", params.scanId ?? null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  return createAssistantThread(params);
}

export async function createAssistantThread(params: {
  companyId: string;
  projectId: string;
  userId: string;
  threadType?: AssistantThreadType;
  scanId?: string | null;
  title?: string;
}) {
  const supabase = createAdminClient();
  const { data: created, error: createError } = await supabase
    .from("assistant_threads")
    .insert({
      company_id: params.companyId,
      project_id: params.projectId,
      created_by: params.userId,
      thread_type: params.threadType ?? "project_assistant",
      scan_id: params.scanId ?? null,
      title:
        params.title ??
        (params.threadType === "contract_review" ? "Contract review" : "Project assistant"),
    })
    .select("id, title")
    .single();

  if (createError || !created) {
    throw createError ?? new Error("Unable to create assistant thread.");
  }

  return created;
}

export async function getValidatedAssistantThread(params: {
  threadId: string;
  companyId: string;
  projectId: string;
  userId: string;
  threadType?: AssistantThreadType;
  scanId?: string | null;
}) {
  const supabase = createAdminClient();
  const query = supabase
    .from("assistant_threads")
    .select("id, title")
    .eq("id", params.threadId)
    .eq("company_id", params.companyId)
    .eq("project_id", params.projectId)
    .eq("created_by", params.userId);

  if (params.threadType) {
    query.eq("thread_type", params.threadType);
  }

  if (params.scanId !== undefined) {
    query.eq("scan_id", params.scanId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Assistant thread not found for this project.");
  }

  return data;
}

export async function loadAssistantMessages(threadId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("id, role, content, citations, metadata, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (message): AssistantMessageRecord => ({
      id: String(message.id),
      role: message.role as AssistantMessageRecord["role"],
      content: String(message.content),
      createdAt: String(message.created_at),
      citations: Array.isArray(message.citations)
        ? (message.citations as AssistantCitation[])
        : [],
      metadata:
        message.metadata && typeof message.metadata === "object"
          ? (message.metadata as AssistantMessageMetadata)
          : {},
    }),
  );
}

export async function insertAssistantMessage(params: {
  threadId: string;
  companyId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: AssistantCitation[];
  metadata?: AssistantMessageMetadata;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_messages")
    .insert({
      thread_id: params.threadId,
      company_id: params.companyId,
      role: params.role,
      content: params.content,
      citations: params.citations ?? [],
      metadata: params.metadata ?? {},
    })
    .select("id, role, content, citations, metadata, created_at")
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to save assistant message.");
  }

  return {
    id: String(data.id),
    role: data.role as AssistantMessageRecord["role"],
    content: String(data.content),
    createdAt: String(data.created_at),
    citations: Array.isArray(data.citations) ? (data.citations as AssistantCitation[]) : [],
    metadata:
      data.metadata && typeof data.metadata === "object"
        ? (data.metadata as AssistantMessageMetadata)
        : {},
  } satisfies AssistantMessageRecord;
}

export async function listAssistantThreads(params: {
  companyId: string;
  projectId: string;
  userId: string;
}) {
  const supabase = createAdminClient();
  const { data: threads, error } = await supabase
    .from("assistant_threads")
    .select("id, title, thread_type, scan_id, updated_at")
    .eq("company_id", params.companyId)
    .eq("project_id", params.projectId)
    .eq("created_by", params.userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const threadIds = (threads ?? []).map((thread) => String(thread.id));
  const [{ data: messages }, { data: sources }] = await Promise.all([
    threadIds.length
      ? supabase
          .from("assistant_messages")
          .select("thread_id, content, created_at")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    threadIds.length
      ? supabase
          .from("assistant_thread_sources")
          .select("thread_id")
          .in("thread_id", threadIds)
      : Promise.resolve({ data: [] }),
  ]);

  const lastMessageByThread = new Map<string, { content: string; createdAt: string }>();
  (messages ?? []).forEach((message) => {
    const threadId = String(message.thread_id);
    if (!lastMessageByThread.has(threadId)) {
      lastMessageByThread.set(threadId, {
        content: String(message.content),
        createdAt: String(message.created_at),
      });
    }
  });

  const sourceCountByThread = new Map<string, number>();
  (sources ?? []).forEach((source) => {
    const threadId = String(source.thread_id);
    sourceCountByThread.set(threadId, (sourceCountByThread.get(threadId) ?? 0) + 1);
  });

  return (threads ?? []).map(
    (thread): AssistantThreadSummary => ({
      id: String(thread.id),
      title: String(thread.title),
      threadType: thread.thread_type as AssistantThreadType,
      scanId: thread.scan_id ? String(thread.scan_id) : null,
      lastMessagePreview: lastMessageByThread.get(String(thread.id))?.content ?? null,
      lastMessageAt: lastMessageByThread.get(String(thread.id))?.createdAt ?? null,
      sourceCount: sourceCountByThread.get(String(thread.id)) ?? 0,
    }),
  );
}

export async function listAssistantThreadSources(threadId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_thread_sources")
    .select("id, pinned, document_id, documents(id, name, parse_status)")
    .eq("thread_id", threadId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (item): AssistantSourceSelection => ({
      id: String(item.id),
      documentId: String(item.document_id),
      documentName:
        item.documents && typeof item.documents === "object" && "name" in item.documents
          ? String(item.documents.name)
          : "Document",
      parseStatus:
        item.documents && typeof item.documents === "object" && "parse_status" in item.documents
          ? String(item.documents.parse_status)
          : "queued",
      pinned: Boolean(item.pinned),
    }),
  );
}

export async function replaceAssistantThreadSources(params: {
  threadId: string;
  companyId: string;
  projectId: string;
  documentIds: string[];
}) {
  const supabase = createAdminClient();
  const { error: deleteError } = await supabase
    .from("assistant_thread_sources")
    .delete()
    .eq("thread_id", params.threadId);

  if (deleteError) {
    throw deleteError;
  }

  if (!params.documentIds.length) {
    return;
  }

  const { error: insertError } = await supabase.from("assistant_thread_sources").insert(
    params.documentIds.map((documentId) => ({
      thread_id: params.threadId,
      company_id: params.companyId,
      project_id: params.projectId,
      document_id: documentId,
      source_kind: "document",
      pinned: false,
    })),
  );

  if (insertError) {
    throw insertError;
  }
}

export async function createAssistantRun(params: {
  threadId: string;
  companyId: string;
  projectId: string;
  userId: string;
  mode: "auto" | "draft" | "answer";
  requestedOutputType?: string | null;
  status?: "queued" | "in_progress" | "completed" | "failed";
  currentStage?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_runs")
    .insert({
      thread_id: params.threadId,
      company_id: params.companyId,
      project_id: params.projectId,
      created_by: params.userId,
      mode: params.mode,
      requested_output_type: params.requestedOutputType ?? null,
      status: params.status ?? "queued",
      current_stage: params.currentStage ?? null,
      error: params.error ?? null,
      metadata: params.metadata ?? {},
    })
    .select("id, status, mode, requested_output_type, current_stage, error, metadata, created_at, updated_at")
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to create assistant run.");
  }

  return {
    id: String(data.id),
    status: data.status as AssistantRunRecord["status"],
    mode: data.mode as AssistantRunRecord["mode"],
    requestedOutputType: data.requested_output_type ? String(data.requested_output_type) : null,
    currentStage: data.current_stage ? String(data.current_stage) : null,
    error: data.error ? String(data.error) : null,
    metadata: data.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, unknown>) : {},
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  } satisfies AssistantRunRecord;
}

export async function updateAssistantRun(params: {
  runId: string;
  status?: "queued" | "in_progress" | "completed" | "failed";
  currentStage?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  const updatePayload: Record<string, unknown> = {};

  if (params.status) {
    updatePayload.status = params.status;
  }

  if (params.currentStage !== undefined) {
    updatePayload.current_stage = params.currentStage;
  }

  if (params.error !== undefined) {
    updatePayload.error = params.error;
  }

  if (params.metadata !== undefined) {
    updatePayload.metadata = params.metadata;
  }

  const { error } = await supabase.from("assistant_runs").update(updatePayload).eq("id", params.runId);

  if (error) {
    throw error;
  }
}

export async function listAssistantRuns(threadId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_runs")
    .select("id, status, mode, requested_output_type, current_stage, error, metadata, created_at, updated_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (item): AssistantRunRecord => ({
      id: String(item.id),
      status: item.status as AssistantRunRecord["status"],
      mode: item.mode as AssistantRunRecord["mode"],
      requestedOutputType: item.requested_output_type ? String(item.requested_output_type) : null,
      currentStage: item.current_stage ? String(item.current_stage) : null,
      error: item.error ? String(item.error) : null,
      metadata: item.metadata && typeof item.metadata === "object" ? (item.metadata as Record<string, unknown>) : {},
      createdAt: String(item.created_at),
      updatedAt: String(item.updated_at),
    }),
  );
}
