import { NextResponse } from "next/server";

import { createProjectOutput } from "@/lib/outputs/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidatedAssistantThread, loadAssistantMessages } from "@/lib/assistant/store";
import { requireProjectAccess } from "@/lib/projects/access";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; messageId: string }> },
) {
  try {
    const { projectId, messageId } = await params;
    const { user, project } = await requireProjectAccess(projectId);
    const supabase = createAdminClient();

    const { data: message, error } = await supabase
      .from("assistant_messages")
      .select("id, thread_id, role, content, citations")
      .eq("id", messageId)
      .maybeSingle();

    if (error || !message) {
      return NextResponse.json({ error: "Assistant message not found." }, { status: 404 });
    }

    if (message.role !== "assistant") {
      return NextResponse.json({ error: "Only assistant messages can be opened in editor." }, { status: 400 });
    }

    const threadId = String(message.thread_id);
    await getValidatedAssistantThread({
      threadId,
      companyId: String(project.company_id),
      projectId: String(project.id),
      userId: String(user.id),
    });

    const { data: existing, error: existingError } = await supabase
      .from("project_outputs")
      .select("id")
      .eq("project_id", String(project.id))
      .eq("thread_id", threadId)
      .contains("metadata", { sourceMessageId: messageId })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing?.id) {
      return NextResponse.json({ outputId: String(existing.id), existing: true });
    }

    const threadMessages = await loadAssistantMessages(threadId);
    const latestUser = [...threadMessages]
      .reverse()
      .find((entry) => entry.role === "user");
    const userPrompt = latestUser?.content ?? "Assistant output";

    const output = await createProjectOutput({
      companyId: String(project.company_id),
      projectId: String(project.id),
      threadId,
      userId: String(user.id),
      type: "memo",
      title: `Memo: ${userPrompt.slice(0, 64)}`,
      body: String(message.content ?? ""),
      metadata: {
        sourceMessageId: messageId,
        citations: Array.isArray(message.citations) ? message.citations : [],
      },
    });

    return NextResponse.json({ outputId: output.id, existing: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open editor output.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
