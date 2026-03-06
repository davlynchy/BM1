import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createAssistantRun,
  createAssistantThread,
  getValidatedAssistantThread,
  insertAssistantMessage,
  replaceAssistantThreadSources,
  updateAssistantThreadTitle,
} from "@/lib/assistant/store";
import { requireProjectAccess } from "@/lib/projects/access";

const bodySchema = z.object({
  threadId: z.string().uuid().optional(),
  message: z.string().trim().min(1),
  mode: z.enum(["auto", "draft", "answer"]).default("answer"),
  sourceDocumentIds: z.array(z.string().uuid()).default([]),
  selectedOutputType: z.enum(["email", "memo", "summary", "checklist"]).nullable().optional(),
});

function buildThreadTitle(message: string) {
  const cleaned = message
    .replace(/\s+/g, " ")
    .replace(/\[(\d+)\]/g, "")
    .trim();
  if (!cleaned) {
    return "New chat";
  }
  return cleaned.length > 80 ? `${cleaned.slice(0, 80).trim()}...` : cleaned;
}

function isGenericTitle(title: string) {
  const normalized = title.trim().toLowerCase();
  return normalized === "new query" || normalized === "new chat" || normalized === "project assistant";
}

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
    let existingTitle: string | null = null;
    if (!threadId) {
      const thread = await createAssistantThread({
        companyId: String(project.company_id),
        projectId: String(project.id),
        userId: String(user.id),
        threadType: "project_assistant",
        title: buildThreadTitle(parsed.data.message),
      });
      threadId = String(thread.id);
    } else {
      const thread = await getValidatedAssistantThread({
        threadId,
        companyId: String(project.company_id),
        projectId: String(project.id),
        userId: String(user.id),
      });
      existingTitle = String(thread.title ?? "");
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

    if (existingTitle && isGenericTitle(existingTitle)) {
      await updateAssistantThreadTitle({
        threadId,
        title: buildThreadTitle(parsed.data.message),
      });
    }

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
