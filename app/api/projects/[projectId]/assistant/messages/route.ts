import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createAssistantRun,
  createAssistantThread,
  getValidatedAssistantThread,
  insertAssistantMessage,
  replaceAssistantThreadSources,
} from "@/lib/assistant/store";
import { requireProjectAccess } from "@/lib/projects/access";

const bodySchema = z.object({
  threadId: z.string().uuid().optional(),
  message: z.string().trim().min(1),
  mode: z.enum(["auto", "draft", "answer"]).default("answer"),
  sourceDocumentIds: z.array(z.string().uuid()).default([]),
  selectedOutputType: z.enum(["email", "memo", "summary", "checklist"]).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const { user, project } = await requireProjectAccess(projectId);
    const parsed = bodySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid assistant payload." }, { status: 400 });
    }

    let threadId = parsed.data.threadId;
    if (!threadId) {
      const thread = await createAssistantThread({
        companyId: String(project.company_id),
        projectId: String(project.id),
        userId: String(user.id),
        threadType: "project_assistant",
        title: "New query",
      });
      threadId = String(thread.id);
    } else {
      await getValidatedAssistantThread({
        threadId,
        companyId: String(project.company_id),
        projectId: String(project.id),
        userId: String(user.id),
      });
    }

    if (parsed.data.sourceDocumentIds.length) {
      await replaceAssistantThreadSources({
        threadId,
        companyId: String(project.company_id),
        projectId: String(project.id),
        documentIds: parsed.data.sourceDocumentIds,
      });
    }

    const userMessage = await insertAssistantMessage({
      threadId,
      companyId: String(project.company_id),
      role: "user",
      content: parsed.data.message,
      metadata: {},
    });

    const run = await createAssistantRun({
      threadId,
      companyId: String(project.company_id),
      projectId: String(project.id),
      userId: String(user.id),
      mode: parsed.data.mode,
      requestedOutputType: parsed.data.selectedOutputType ?? null,
      status: "queued",
      currentStage: "queued",
      metadata: {
        userMessageId: userMessage.id,
      },
    });

    return NextResponse.json({
      threadId,
      runId: run.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create assistant run.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
