import { NextResponse } from "next/server";
import { z } from "zod";

import { createAssistantThread, listAssistantThreads, replaceAssistantThreadSources } from "@/lib/assistant/store";
import { requireProjectAccess } from "@/lib/projects/access";

const createThreadSchema = z.object({
  title: z.string().trim().min(1).max(160).default("New thread"),
  threadType: z.enum(["project_assistant"]).default("project_assistant"),
  sourceDocumentIds: z.array(z.string().uuid()).default([]),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const { user, project } = await requireProjectAccess(projectId);
    const threads = await listAssistantThreads({
      companyId: String(project.company_id),
      projectId: String(project.id),
      userId: String(user.id),
    });

    return NextResponse.json({ threads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load threads.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const { user, project } = await requireProjectAccess(projectId);
    const body = await request.json();
    const parsed = createThreadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid thread request." }, { status: 400 });
    }

    const thread = await createAssistantThread({
      companyId: String(project.company_id),
      projectId: String(project.id),
      userId: String(user.id),
      threadType: "project_assistant",
      title: parsed.data.title,
    });
    await replaceAssistantThreadSources({
      threadId: String(thread.id),
      companyId: String(project.company_id),
      projectId: String(project.id),
      documentIds: parsed.data.sourceDocumentIds,
    });

    return NextResponse.json({
      thread: {
        id: String(thread.id),
        title: String(thread.title),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create thread.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
