import { NextResponse } from "next/server";

import { retrieveProjectSourcesV1 } from "@/lib/assistant/retrieval-v1";
import { getValidatedAssistantThread, listAssistantThreadSources } from "@/lib/assistant/store";
import { requireProjectAccess } from "@/lib/projects/access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const { project, user } = await requireProjectAccess(projectId);
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const threadId = url.searchParams.get("threadId");

    if (!query) {
      return NextResponse.json({ error: "Missing q query parameter." }, { status: 400 });
    }

    let sourceDocumentIds: string[] = [];
    if (threadId) {
      await getValidatedAssistantThread({
        threadId,
        companyId: String(project.company_id),
        projectId: String(project.id),
        userId: String(user.id),
      });
      const sources = await listAssistantThreadSources(threadId);
      sourceDocumentIds = sources.map((source) => source.documentId);
    }

    const sources = await retrieveProjectSourcesV1({
      companyId: String(project.company_id),
      projectId: String(project.id),
      question: query,
      documentIds: sourceDocumentIds.length ? sourceDocumentIds : undefined,
      limit: 12,
    });

    return NextResponse.json({
      query,
      count: sources.length,
      sources,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run retrieval preview.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
