import { NextResponse } from "next/server";

import { analyzeCorrespondence } from "@/lib/correspondence/analyze";
import { loadCorrespondenceProjectContext } from "@/lib/correspondence/context";
import { updateCorrespondenceAnalysis } from "@/lib/correspondence/store";
import { createClient } from "@/lib/supabase/server";
import { syncCorrespondenceTodo } from "@/lib/todos/sync";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ correspondenceId: string }> },
) {
  try {
    const { correspondenceId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data: correspondence, error } = await supabase
      .from("project_correspondence")
      .select("id, company_id, project_id, subject, sender, body_text")
      .eq("id", correspondenceId)
      .maybeSingle();

    if (error || !correspondence) {
      return NextResponse.json({ error: "Correspondence item not found." }, { status: 404 });
    }

    const projectContext = await loadCorrespondenceProjectContext(
      correspondence.project_id ? String(correspondence.project_id) : null,
    );

    const analysis = await analyzeCorrespondence({
      subject: String(correspondence.subject ?? ""),
      sender: String(correspondence.sender ?? ""),
      bodyText: String(correspondence.body_text ?? ""),
      projectContext,
    });

    await updateCorrespondenceAnalysis({
      correspondenceId: String(correspondence.id),
      analysis,
    });

    await syncCorrespondenceTodo({
      companyId: String(correspondence.company_id),
      projectId: correspondence.project_id ? String(correspondence.project_id) : null,
      correspondenceId: String(correspondence.id),
      analysis,
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate draft.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
