import { createAdminClient } from "@/lib/supabase/admin";
import type { AssistantJobPayload, DocumentJobPayload, JobType } from "@/types/ingestion";

export async function enqueueDocumentJob(params: {
  companyId: string;
  projectId: string | null;
  documentId: string;
  jobType: JobType;
  payload: DocumentJobPayload;
  jobKey?: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      company_id: params.companyId,
      project_id: params.projectId,
      document_id: params.documentId,
      job_type: params.jobType,
      status: "queued",
      payload: params.payload,
      job_key: params.jobKey ?? null,
    })
    .select("id, status")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function enqueueAssistantJob(params: {
  companyId: string;
  projectId: string;
  jobType: "assistant.quick_answer" | "assistant.deep_answer";
  payload: AssistantJobPayload;
  jobKey?: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      company_id: params.companyId,
      project_id: params.projectId,
      document_id: null,
      job_type: params.jobType,
      status: "queued",
      payload: params.payload,
      job_key: params.jobKey ?? null,
    })
    .select("id, status")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function claimNextJob(workerId: string) {
  const supabase = createAdminClient();
  const { data: queuedJobs, error: fetchError } = await supabase
    .from("jobs")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (fetchError) {
    throw fetchError;
  }

  const jobId = queuedJobs?.[0]?.id;

  if (!jobId) {
    return null;
  }

  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: "in_progress",
      locked_at: new Date().toISOString(),
      locked_by: workerId,
      started_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .single();

  if (error) {
    return null;
  }

  return data;
}

export async function claimJobsBatch(params: {
  workerId: string;
  batchSize?: number;
  jobTypes?: string[];
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_jobs_batch", {
    p_worker_id: params.workerId,
    p_batch_size: params.batchSize ?? 5,
    p_job_types: params.jobTypes?.length ? params.jobTypes : null,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as Array<Record<string, unknown>>;
}

export async function completeJob(jobId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      job_key: null,
    })
    .eq("id", jobId);

  if (error) {
    throw error;
  }
}

export async function failJob(jobId: string, lastError: string) {
  const supabase = createAdminClient();
  const { data: currentJob, error: fetchError } = await supabase
    .from("jobs")
    .select("attempts, max_attempts")
    .eq("id", jobId)
    .single();

  if (fetchError || !currentJob) {
    throw fetchError ?? new Error("Unable to load failed job.");
  }

  const attempts = currentJob.attempts + 1;
  const nextStatus = attempts >= currentJob.max_attempts ? "failed" : "queued";
  const { error } = await supabase
    .from("jobs")
    .update({
      attempts,
      last_error: lastError,
      status: nextStatus,
      locked_at: null,
      locked_by: null,
      completed_at: nextStatus === "failed" ? new Date().toISOString() : null,
    })
    .eq("id", jobId);

  if (error) {
    throw error;
  }

  return nextStatus;
}

export async function requeueStaleJobs(staleBeforeMs = 15 * 60 * 1000) {
  const supabase = createAdminClient();
  const threshold = new Date(Date.now() - staleBeforeMs).toISOString();
  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: "queued",
      locked_at: null,
      locked_by: null,
      started_at: null,
      last_error: "Recovered stale in_progress job.",
    })
    .eq("status", "in_progress")
    .lt("locked_at", threshold)
    .select("id, document_id, job_type, payload");

  if (error) {
    throw error;
  }

  return data ?? [];
}
