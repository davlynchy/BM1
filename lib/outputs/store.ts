import { createAdminClient } from "@/lib/supabase/admin";
import type { ProjectOutputRecord, ProjectOutputType, ProjectOutputVersion } from "@/types/outputs";

function isMissingRelationError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code ?? "") : "";
  return code === "PGRST205" || code === "PGRST204" || code === "42P01";
}

function mapOutput(row: Record<string, unknown>): ProjectOutputRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    projectId: row.project_id ? String(row.project_id) : null,
    threadId: row.thread_id ? String(row.thread_id) : null,
    sourceRunId: row.source_run_id ? String(row.source_run_id) : null,
    type: row.type as ProjectOutputType,
    title: String(row.title),
    body: String(row.body ?? ""),
    status: row.status as ProjectOutputRecord["status"],
    version: Number(row.version ?? 1),
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listProjectOutputs(projectId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_outputs")
    .select("id, company_id, project_id, thread_id, source_run_id, type, title, body, status, version, metadata, created_at, updated_at")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []).map((row) => mapOutput(row as Record<string, unknown>));
}

export async function getProjectOutput(outputId: string, projectId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_outputs")
    .select("id, company_id, project_id, thread_id, source_run_id, type, title, body, status, version, metadata, created_at, updated_at")
    .eq("id", outputId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return null;
    }
    throw error;
  }

  return data ? mapOutput(data as Record<string, unknown>) : null;
}

export async function listProjectOutputVersions(outputId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_output_versions")
    .select("id, output_id, version, title, body, metadata, created_at")
    .eq("output_id", outputId)
    .order("version", { ascending: false });

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []).map(
    (row): ProjectOutputVersion => ({
      id: String(row.id),
      outputId: String(row.output_id),
      version: Number(row.version),
      title: String(row.title),
      body: String(row.body ?? ""),
      metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
      createdAt: String(row.created_at),
    }),
  );
}

export async function createProjectOutput(params: {
  companyId: string;
  projectId: string;
  threadId: string | null;
  sourceRunId?: string | null;
  userId: string;
  type: ProjectOutputType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_outputs")
    .insert({
      company_id: params.companyId,
      project_id: params.projectId,
      thread_id: params.threadId,
      source_run_id: params.sourceRunId ?? null,
      created_by: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      status: "draft",
      version: 1,
      metadata: params.metadata ?? {},
    })
    .select("id, company_id, project_id, thread_id, source_run_id, type, title, body, status, version, metadata, created_at, updated_at")
    .single();

  if (error || !data) {
    if (isMissingRelationError(error)) {
      throw new Error("Outputs are not available yet. Run the latest Supabase migrations.");
    }
    throw error ?? new Error("Unable to create project output.");
  }

  const output = mapOutput(data as Record<string, unknown>);
  await createProjectOutputVersion({
    outputId: output.id,
    companyId: output.companyId,
    projectId: params.projectId,
    userId: params.userId,
    version: 1,
    title: output.title,
    body: output.body,
    metadata: output.metadata,
  });

  return output;
}

export async function updateProjectOutput(params: {
  outputId: string;
  title: string;
  body: string;
  status?: ProjectOutputRecord["status"];
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  const { data: current, error: currentError } = await supabase
    .from("project_outputs")
    .select("id, company_id, project_id, version, metadata")
    .eq("id", params.outputId)
    .single();

  if (currentError || !current) {
    if (isMissingRelationError(currentError)) {
      throw new Error("Outputs are not available yet. Run the latest Supabase migrations.");
    }
    throw currentError ?? new Error("Project output not found.");
  }

  const nextVersion = Number(current.version ?? 1) + 1;
  const metadata =
    params.metadata ?? (current.metadata && typeof current.metadata === "object" ? (current.metadata as Record<string, unknown>) : {});

  const { data, error } = await supabase
    .from("project_outputs")
    .update({
      title: params.title,
      body: params.body,
      status: params.status ?? "draft",
      version: nextVersion,
      metadata,
    })
    .eq("id", params.outputId)
    .select("id, company_id, project_id, thread_id, source_run_id, type, title, body, status, version, metadata, created_at, updated_at")
    .single();

  if (error || !data) {
    if (isMissingRelationError(error)) {
      throw new Error("Outputs are not available yet. Run the latest Supabase migrations.");
    }
    throw error ?? new Error("Unable to update project output.");
  }

  await createProjectOutputVersion({
    outputId: String(data.id),
    companyId: String(data.company_id),
    projectId: data.project_id ? String(data.project_id) : null,
    userId: null,
    version: nextVersion,
    title: params.title,
    body: params.body,
    metadata,
  });

  return mapOutput(data as Record<string, unknown>);
}

async function createProjectOutputVersion(params: {
  outputId: string;
  companyId: string;
  projectId: string | null;
  userId: string | null;
  version: number;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("project_output_versions").insert({
    output_id: params.outputId,
    company_id: params.companyId,
    project_id: params.projectId,
    created_by: params.userId,
    version: params.version,
    title: params.title,
    body: params.body,
    metadata: params.metadata ?? {},
  });

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error("Output versions are not available yet. Run the latest Supabase migrations.");
    }
    throw error;
  }
}
