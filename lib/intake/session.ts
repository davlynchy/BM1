import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  IntakeProjectSelectionMode,
  IntakeSelectedFile,
  IntakeSession,
  IntakeSessionSummary,
} from "@/types/intake";

const INTAKE_SESSION_COOKIE = "bidmetric_intake_session";
const ACTIVE_STATUSES = new Set(["awaiting_auth", "awaiting_project", "awaiting_upload", "processing"]);

function normalizeSession(row: Record<string, unknown>) {
  return {
    ...row,
    selected_files: Array.isArray(row.selected_files) ? row.selected_files : [],
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
  } as IntakeSession;
}

export function getIntakeSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  };
}

export async function readIntakeSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(INTAKE_SESSION_COOKIE)?.value ?? null;
}

export async function writeIntakeSessionCookie(sessionId: string) {
  const cookieStore = await cookies();
  cookieStore.set(INTAKE_SESSION_COOKIE, sessionId, getIntakeSessionCookieOptions());
}

export async function clearIntakeSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(INTAKE_SESSION_COOKIE);
}

export async function createPublicIntakeSession(params: {
  file: IntakeSelectedFile;
  requiresReattach?: boolean;
  userId?: string | null;
  companyId?: string | null;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("intake_sessions")
    .insert({
      status: params.userId ? "awaiting_project" : "awaiting_auth",
      source_mode: "public_intake",
      user_id: params.userId ?? null,
      company_id: params.companyId ?? null,
      file_name: params.file.name,
      file_size: params.file.size,
      mime_type: params.file.type,
      selected_files: [params.file],
      metadata: {
        requiresReattach: Boolean(params.requiresReattach),
      },
      expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to create intake session.");
  }

  return normalizeSession(data as Record<string, unknown>);
}

export async function getPublicIntakeSessionSummary(sessionId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("intake_sessions")
    .select("id, status, file_name, file_size, mime_type, metadata")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    ...data,
    metadata: data.metadata && typeof data.metadata === "object" ? data.metadata : {},
  } as IntakeSessionSummary;
}

export async function attachIntakeSessionToWorkspace(params: {
  sessionId: string;
  userId: string;
  companyId: string;
}) {
  const supabase = createAdminClient();
  const session = await getIntakeSessionById(params.sessionId);

  if (!session) {
    throw new Error("Upload session not found.");
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await supabase.from("intake_sessions").update({ status: "expired" }).eq("id", session.id);
    throw new Error("Your upload session expired. Please select the contract again.");
  }

  if (session.user_id && session.user_id !== params.userId) {
    throw new Error("This upload session belongs to another account.");
  }

  const nextStatus = session.status === "awaiting_auth" ? "awaiting_project" : session.status;
  const { error } = await supabase
    .from("intake_sessions")
    .update({
      user_id: params.userId,
      company_id: params.companyId,
      status: nextStatus,
    })
    .eq("id", session.id);

  if (error) {
    throw error;
  }
}

export async function getIntakeSessionById(sessionId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("intake_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeSession(data as Record<string, unknown>);
}

export async function getOwnedIntakeSession(params: { sessionId: string; userId: string }) {
  const session = await getIntakeSessionById(params.sessionId);

  if (!session || session.user_id !== params.userId) {
    return null;
  }

  return session;
}

export async function getLatestActiveIntakeSessionForUser(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("intake_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error || !data?.length) {
    return null;
  }

  const active = data.find((row) => ACTIVE_STATUSES.has(String(row.status)));
  return active ? normalizeSession(active as Record<string, unknown>) : null;
}

export async function selectIntakeProject(params: {
  sessionId: string;
  userId: string;
  mode: IntakeProjectSelectionMode;
  projectId?: string | null;
  newProjectName?: string | null;
}) {
  const session = await getOwnedIntakeSession({
    sessionId: params.sessionId,
    userId: params.userId,
  });

  if (!session) {
    throw new Error("Upload session not found.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("intake_sessions")
    .update({
      project_selection_mode: params.mode,
      project_id: params.projectId ?? null,
      new_project_name: params.newProjectName ?? null,
      status: "awaiting_upload",
    })
    .eq("id", params.sessionId);

  if (error) {
    throw error;
  }
}

export async function markIntakeProcessing(sessionId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("intake_sessions")
    .update({ status: "processing" })
    .eq("id", sessionId);

  if (error) {
    throw error;
  }
}

export async function markIntakeCompleted(params: {
  sessionId: string;
  projectId: string;
  documentId: string;
  scanId: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("intake_sessions")
    .update({
      status: "completed",
      project_id: params.projectId,
      document_id: params.documentId,
      scan_id: params.scanId,
    })
    .eq("id", params.sessionId);

  if (error) {
    throw error;
  }
}

export async function updateIntakeSession(sessionId: string, values: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("intake_sessions")
    .update(values)
    .eq("id", sessionId);

  if (error) {
    throw error;
  }
}

export async function getDefaultCompanyIdForUser(supabase: SupabaseClient, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("default_company_id")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return profile?.default_company_id ?? null;
}
