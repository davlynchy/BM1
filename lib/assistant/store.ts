import { createAdminClient } from "@/lib/supabase/admin";
import type { AssistantCitation, AssistantMessageRecord } from "@/types/assistant";

export async function getOrCreateAssistantThread(params: {
  companyId: string;
  projectId: string;
  userId: string;
}) {
  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("assistant_threads")
    .select("id, title")
    .eq("company_id", params.companyId)
    .eq("project_id", params.projectId)
    .eq("created_by", params.userId)
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
}) {
  const supabase = createAdminClient();
  const { data: created, error: createError } = await supabase
    .from("assistant_threads")
    .insert({
      company_id: params.companyId,
      project_id: params.projectId,
      created_by: params.userId,
      title: "Project assistant",
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
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_threads")
    .select("id, title")
    .eq("id", params.threadId)
    .eq("company_id", params.companyId)
    .eq("project_id", params.projectId)
    .eq("created_by", params.userId)
    .maybeSingle();

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
    .select("id, role, content, citations, created_at")
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
    }),
  );
}

export async function insertAssistantMessage(params: {
  threadId: string;
  companyId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: AssistantCitation[];
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
    })
    .select("id, role, content, citations, created_at")
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
  } satisfies AssistantMessageRecord;
}
