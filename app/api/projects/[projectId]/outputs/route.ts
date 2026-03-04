import { NextResponse } from "next/server";
import { z } from "zod";

import { loadAssistantMessages } from "@/lib/assistant/store";
import { createProjectOutput, listProjectOutputs } from "@/lib/outputs/store";
import { requireProjectAccess } from "@/lib/projects/access";

const createOutputSchema = z.object({
  threadId: z.string().uuid(),
  type: z.enum(["email", "memo", "summary", "checklist"]),
  title: z.string().trim().min(1).max(180),
  sourceMessageId: z.string().uuid().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    await requireProjectAccess(projectId);
    const outputs = await listProjectOutputs(projectId);
    return NextResponse.json({ outputs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load outputs.";
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
    const parsed = createOutputSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid output request." }, { status: 400 });
    }

    const messages = await loadAssistantMessages(parsed.data.threadId);
    const sourceMessage =
      (parsed.data.sourceMessageId
        ? messages.find((message) => message.id === parsed.data.sourceMessageId)
        : undefined) ??
      [...messages].reverse().find((message) => message.role === "assistant");

    if (!sourceMessage) {
      return NextResponse.json({ error: "No assistant answer available to convert." }, { status: 400 });
    }

    const output = await createProjectOutput({
      companyId: String(project.company_id),
      projectId: String(project.id),
      threadId: parsed.data.threadId,
      userId: String(user.id),
      type: parsed.data.type,
      title: parsed.data.title,
      body: sourceMessage.content,
      metadata: {
        sourceMessageId: sourceMessage.id,
        citations: sourceMessage.citations,
      },
    });

    return NextResponse.json({ output });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create output.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
