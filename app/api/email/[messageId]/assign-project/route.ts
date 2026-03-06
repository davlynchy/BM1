import { NextResponse } from "next/server";

import { createMutableServerClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params;
  const supabase = await createMutableServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let projectId: string | null = null;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { projectId?: string };
    projectId = body.projectId ?? null;
  } else {
    const formData = await request.formData();
    projectId = String(formData.get("projectId") ?? "") || null;
  }

  if (!projectId) {
    return NextResponse.json({ error: "Project is required." }, { status: 400 });
  }

  const [{ data: profile }, { data: project }, { data: correspondence }] = await Promise.all([
    supabase.from("profiles").select("default_company_id").eq("id", user.id).maybeSingle(),
    supabase.from("projects").select("id, company_id").eq("id", projectId).maybeSingle(),
    supabase
      .from("project_correspondence")
      .select("id, company_id, project_id")
      .eq("id", messageId)
      .maybeSingle(),
  ]);

  if (!profile?.default_company_id) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 400 });
  }

  if (!project || String(project.company_id) !== String(profile.default_company_id)) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  if (!correspondence || String(correspondence.company_id) !== String(profile.default_company_id)) {
    return NextResponse.json({ error: "Email not found." }, { status: 404 });
  }

  const fromProjectId = correspondence.project_id ? String(correspondence.project_id) : null;
  const { error: updateError } = await supabase
    .from("project_correspondence")
    .update({
      project_id: projectId,
      assigned_project_id: projectId,
      routing_status: "manual_assigned",
      source: "manual",
    })
    .eq("id", messageId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await supabase.from("email_routing_feedback").insert({
    company_id: profile.default_company_id,
    correspondence_id: messageId,
    user_id: user.id,
    from_project_id: fromProjectId,
    to_project_id: projectId,
    feedback_type: "manual_reassign",
  });

  const redirectTo = `/app/projects/${projectId}/email`;
  if (contentType.includes("application/json")) {
    return NextResponse.json({
      success: true,
      projectId,
      redirectTo,
      assistantUrl: `/app/projects/${projectId}/assistant?emailId=${messageId}`,
    });
  }

  return NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 });
}
