import { NextResponse } from "next/server";
import { z } from "zod";

import {
  appendAssistantThreadMessage,
  appendContractReviewThreadMessage,
  loadAssistantThreadDetail,
} from "@/lib/assistant/workbench";
import { requireProjectAccess } from "@/lib/projects/access";

function mapDocuments(documents: Array<Record<string, unknown>>) {
  return documents.map((document) => ({
    id: String(document.id),
    name: String(document.name),
    documentType: String(document.document_type),
    parseStatus: String(document.parse_status),
    fileSize: typeof document.file_size === "number" ? document.file_size : null,
    pageCount: typeof document.page_count === "number" ? document.page_count : null,
    chunkCount: typeof document.chunk_count === "number" ? document.chunk_count : null,
    processingError: typeof document.processing_error === "string" ? document.processing_error : null,
    createdAt: String(document.created_at),
    updatedAt: String(document.updated_at),
  }));
}

const messageSchema = z.object({
  message: z.string().trim().min(1),
  mode: z.enum(["auto", "draft", "answer"]).default("auto"),
  sourceDocumentIds: z.array(z.string().uuid()).default([]),
  selectedOutputType: z.enum(["email", "memo", "summary", "checklist"]).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; threadId: string }> },
) {
  try {
    const { projectId, threadId } = await params;
    const { user, project, supabase } = await requireProjectAccess(projectId);
    const parsed = messageSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid assistant message." }, { status: 400 });
    }

    const { data: thread, error: threadError } = await supabase
      .from("assistant_threads")
      .select("id, thread_type")
      .eq("id", threadId)
      .eq("project_id", project.id)
      .maybeSingle();

    if (threadError || !thread) {
      return NextResponse.json({ error: "Assistant thread not found." }, { status: 404 });
    }

    const result =
      thread.thread_type === "contract_review"
        ? await appendContractReviewThreadMessage({
            projectId,
            userId: String(user.id),
            threadId,
            message: parsed.data.message,
          })
        : await appendAssistantThreadMessage({
            projectId,
            userId: String(user.id),
            threadId,
            message: parsed.data.message,
            mode: parsed.data.mode,
            sourceDocumentIds: parsed.data.sourceDocumentIds,
            selectedOutputType: parsed.data.selectedOutputType ?? null,
          });

    const detail = await loadAssistantThreadDetail({
      projectId,
      threadId,
      userId: String(user.id),
    });

    return NextResponse.json({
      result,
      detail: {
        ...detail,
        documents: mapDocuments(detail.documents as Array<Record<string, unknown>>),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assistant request failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
