import { NextResponse } from "next/server";

import {
  createAssistantRun,
  getValidatedAssistantThread,
  insertAssistantMessage,
  listAssistantRuns,
  loadAssistantMessages,
} from "@/lib/assistant/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProjectAccess } from "@/lib/projects/access";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; messageId: string }> },
) {
  try {
    const { projectId, messageId } = await params;
    const { user, project } = await requireProjectAccess(projectId);
    const supabase = createAdminClient();

    const { data: targetMessage, error } = await supabase
      .from("assistant_messages")
      .select("id, thread_id, role")
      .eq("id", messageId)
      .maybeSingle();

    if (error || !targetMessage) {
      return NextResponse.json({ error: "Assistant message not found." }, { status: 404 });
    }

    if (targetMessage.role !== "assistant") {
      return NextResponse.json({ error: "Improve is only available for assistant answers." }, { status: 400 });
    }

    const threadId = String(targetMessage.thread_id);
    await getValidatedAssistantThread({
      threadId,
      companyId: String(project.company_id),
      projectId: String(project.id),
      userId: String(user.id),
    });

    const messages = await loadAssistantMessages(threadId);
    const targetIndex = messages.findIndex((message) => message.id === messageId);
    if (targetIndex <= 0) {
      return NextResponse.json({ error: "Unable to resolve source prompt for improve." }, { status: 400 });
    }

    const sourceUserMessage = [...messages.slice(0, targetIndex)]
      .reverse()
      .find((message) => message.role === "user");

    if (!sourceUserMessage?.content?.trim()) {
      return NextResponse.json({ error: "Unable to resolve source prompt for improve." }, { status: 400 });
    }

    const insertedUserMessage = await insertAssistantMessage({
      threadId,
      companyId: String(project.company_id),
      role: "user",
      content: sourceUserMessage.content.trim(),
      metadata: {
        messageType: "assistant_followup",
      },
    });

    const recentRuns = await listAssistantRuns(threadId);
    const mode = (recentRuns[0]?.mode ?? "auto") as "auto" | "draft" | "answer";

    const run = await createAssistantRun({
      threadId,
      companyId: String(project.company_id),
      projectId: String(project.id),
      userId: String(user.id),
      mode,
      status: "queued",
      currentStage: "queued",
      metadata: {
        userMessageId: insertedUserMessage.id,
        improvedFromMessageId: messageId,
      },
    });

    return NextResponse.json({
      threadId,
      runId: run.id,
      prompt: insertedUserMessage.content,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to improve assistant answer.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
