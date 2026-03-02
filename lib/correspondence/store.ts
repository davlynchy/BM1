import { createAdminClient } from "@/lib/supabase/admin";
import type { CorrespondenceAnalysis } from "@/lib/correspondence/schema";

type ParsedEmailMetadata = {
  subject?: string;
  sender?: string;
  to?: string;
  cc?: string;
  receivedAt?: string;
  bodyText?: string;
  attachments?: Array<Record<string, unknown>>;
};

export async function upsertProjectCorrespondenceFromEmail(params: {
  companyId: string;
  projectId: string;
  documentId: string;
  metadata: ParsedEmailMetadata;
}) {
  const supabase = createAdminClient();
  const basePayload = {
    company_id: params.companyId,
    project_id: params.projectId,
    document_id: params.documentId,
    subject: params.metadata.subject ?? "",
    sender: params.metadata.sender ?? "",
    received_at: params.metadata.receivedAt ?? null,
    body_text: params.metadata.bodyText ?? "",
    metadata: {
      to: params.metadata.to ?? "",
      cc: params.metadata.cc ?? "",
      attachments: params.metadata.attachments ?? [],
    },
    analysis_status: "queued",
    processing_error: null,
  };

  const { data: existing, error: existingError } = await supabase
    .from("project_correspondence")
    .select("id")
    .eq("document_id", params.documentId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const { data, error } = await supabase
      .from("project_correspondence")
      .update(basePayload)
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error || !data) {
      throw error ?? new Error("Unable to update correspondence.");
    }

    return data;
  }

  const { data, error } = await supabase
    .from("project_correspondence")
    .insert(basePayload)
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to create correspondence.");
  }

  return data;
}

export async function loadCorrespondenceByDocument(documentId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_correspondence")
    .select("id, company_id, project_id, subject, sender, body_text")
    .eq("document_id", documentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function markCorrespondenceAnalyzing(documentId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("project_correspondence")
    .update({
      analysis_status: "in_progress",
      processing_error: null,
    })
    .eq("document_id", documentId);

  if (error) {
    throw error;
  }
}

export async function updateCorrespondenceAnalysis(params: {
  correspondenceId: string;
  analysis: CorrespondenceAnalysis;
}) {
  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("project_correspondence")
    .select("metadata")
    .eq("id", params.correspondenceId)
    .single();

  if (existingError) {
    throw existingError;
  }

  const currentMetadata =
    existing?.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>)
      : {};

  const { error } = await supabase
    .from("project_correspondence")
    .update({
      analysis_status: "completed",
      processing_error: null,
      ai_summary: params.analysis.summary,
      draft_reply: params.analysis.draftReply,
      action_required: params.analysis.actionRequired,
      analyzed_at: new Date().toISOString(),
      metadata: {
        ...currentMetadata,
        priority: params.analysis.priority,
        recommendedTitle: params.analysis.recommendedTitle,
        recommendedAction: params.analysis.recommendedAction,
        sourceSignals: params.analysis.sourceSignals,
      },
    })
    .eq("id", params.correspondenceId);

  if (error) {
    throw error;
  }
}

export async function failCorrespondenceAnalysis(params: {
  documentId: string;
  errorMessage: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("project_correspondence")
    .update({
      analysis_status: "failed",
      processing_error: params.errorMessage,
    })
    .eq("document_id", params.documentId);

  if (error) {
    throw error;
  }
}
