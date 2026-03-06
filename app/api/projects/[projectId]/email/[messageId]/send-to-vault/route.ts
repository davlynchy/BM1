import { NextResponse } from "next/server";

import { createMutableServerClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; messageId: string }> },
) {
  const { projectId, messageId } = await params;
  const supabase = await createMutableServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, company_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { data: correspondence } = await supabase
    .from("project_correspondence")
    .select("id, subject, sender, body_text, document_id")
    .eq("id", messageId)
    .maybeSingle();

  if (!correspondence) {
    return NextResponse.json({ error: "Email not found." }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("project_correspondence")
    .update({
      project_id: projectId,
      assigned_project_id: projectId,
      routing_status: "manual_assigned",
      source: correspondence.document_id ? "eml_upload" : "manual",
    })
    .eq("id", correspondence.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await supabase.from("project_todos").insert({
    company_id: project.company_id,
    project_id: projectId,
    source_type: "correspondence",
    source_ref: correspondence.id,
    title: `Respond: ${correspondence.subject || "Email follow-up"}`,
    summary: `Sender: ${correspondence.sender || "Unknown"}\n${correspondence.body_text || ""}`,
    priority: "medium",
    status: "open",
  });

  return NextResponse.json({
    success: true,
    assistantUrl: `/app/projects/${projectId}/assistant?emailId=${correspondence.id}`,
  });
}
