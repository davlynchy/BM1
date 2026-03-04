import { NextResponse } from "next/server";

import { generateAssistantReply } from "@/lib/assistant/respond";
import { retrieveProjectSources } from "@/lib/assistant/retrieval";
import {
  createAssistantThread,
  getValidatedAssistantThread,
  getOrCreateAssistantThread,
  insertAssistantMessage,
  loadAssistantMessages,
} from "@/lib/assistant/store";
import { getRequestIp } from "@/lib/api/request";
import { requireProjectAccess } from "@/lib/projects/access";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const { user, project } = await requireProjectAccess(projectId);
    await enforceRateLimit({
      scope: "assistant",
      key: String(user.id),
      limit: 30,
      windowMinutes: 10,
      companyId: String(project.company_id),
      userId: String(user.id),
      metadata: {
        ip: getRequestIp(request),
        projectId,
      },
    });
    const body = (await request.json()) as { message?: string; threadId?: string | null };
    const message = String(body.message ?? "").trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const thread =
      body.threadId === "__new__"
        ? await createAssistantThread({
            companyId: String(project.company_id),
            projectId: String(project.id),
            userId: String(user.id),
            threadType: "project_assistant",
          })
        : body.threadId && body.threadId.length
          ? await getValidatedAssistantThread({
              threadId: body.threadId,
              companyId: String(project.company_id),
              projectId: String(project.id),
              userId: String(user.id),
              threadType: "project_assistant",
            })
          : await getOrCreateAssistantThread({
              companyId: String(project.company_id),
              projectId: String(project.id),
              userId: String(user.id),
              threadType: "project_assistant",
            });

    const userMessage = await insertAssistantMessage({
      threadId: String(thread.id),
      companyId: String(project.company_id),
      role: "user",
      content: message,
    });

    const priorMessages = await loadAssistantMessages(String(thread.id));
    const sources = await retrieveProjectSources({
      companyId: String(project.company_id),
      projectId: String(project.id),
      question: message,
    });

    const assistantReply = await generateAssistantReply({
      question: message,
      messages: priorMessages
        .filter((entry) => entry.id !== userMessage.id)
        .map((entry) => ({
          role: entry.role === "system" ? "assistant" : entry.role,
          content: entry.content,
        })),
      sources,
    });

    const assistantMessage = await insertAssistantMessage({
      threadId: String(thread.id),
      companyId: String(project.company_id),
      role: "assistant",
      content: assistantReply.answer,
      citations: assistantReply.citations,
    });

    return NextResponse.json({
      threadId: String(thread.id),
      messages: [userMessage, assistantMessage],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assistant request failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
