import { NextResponse } from "next/server";

import {
  getValidatedAssistantThread,
  listAssistantRuns,
  listAssistantThreadSources,
  loadAssistantMessages,
} from "@/lib/assistant/store";
import { requireProjectAccess } from "@/lib/projects/access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; threadId: string }> },
) {
  try {
    const { projectId, threadId } = await params;
    const { user, project } = await requireProjectAccess(projectId);

    await getValidatedAssistantThread({
      threadId,
      companyId: String(project.company_id),
      projectId: String(project.id),
      userId: String(user.id),
    });

    const [messages, sources, runs] = await Promise.all([
      loadAssistantMessages(threadId),
      listAssistantThreadSources(threadId),
      listAssistantRuns(threadId),
    ]);

    return NextResponse.json({
      threadId,
      messages,
      sources,
      runs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load assistant thread.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
