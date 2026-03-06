import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getValidatedAssistantThread } from "@/lib/assistant/store";
import { requireProjectAccess } from "@/lib/projects/access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; messageId: string }> },
) {
  try {
    const { projectId, messageId } = await params;
    const { user, project } = await requireProjectAccess(projectId);
    const supabase = createAdminClient();

    const { data: message, error } = await supabase
      .from("assistant_messages")
      .select("id, thread_id, citations")
      .eq("id", messageId)
      .maybeSingle();

    if (error || !message) {
      return NextResponse.json({ error: "Assistant message not found." }, { status: 404 });
    }

    await getValidatedAssistantThread({
      threadId: String(message.thread_id),
      companyId: String(project.company_id),
      projectId: String(project.id),
      userId: String(user.id),
    });

    const citations = Array.isArray(message.citations) ? message.citations : [];

    return NextResponse.json({
      messageId: String(message.id),
      citations: citations.map((citation, index) => ({
        order: index + 1,
        ...citation,
        previewText:
          typeof citation === "object" &&
          citation &&
          "snippet" in citation &&
          typeof citation.snippet === "string"
            ? citation.snippet
            : "",
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load citations.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
