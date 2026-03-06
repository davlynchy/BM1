import { listAssistantRuns, listAssistantThreadSources, listAssistantThreads, loadAssistantMessages } from "@/lib/assistant/store";
import { listProjectOutputs } from "@/lib/outputs/store";
import { requireProjectAccess } from "@/lib/projects/access";
import type { AssistantMessageRecord, AssistantRunRecord, AssistantSourceSelection, AssistantThreadSummary } from "@/types/assistant";
import type { ProjectOutputRecord } from "@/types/outputs";
import type { VaultFileRecord } from "@/types/vault";

type AssistantWorkspaceInitialState = {
  activeThread: AssistantThreadSummary | null;
  threads: AssistantThreadSummary[];
  messages: AssistantMessageRecord[];
  sources: AssistantSourceSelection[];
  runs: AssistantRunRecord[];
  documents: VaultFileRecord[];
  outputs: ProjectOutputRecord[];
};

export async function loadAssistantWorkspaceInitialState(params: {
  projectId: string;
  userId: string;
  threadId?: string;
}) {
  const { supabase, project } = await requireProjectAccess(params.projectId);
  const threads = await listAssistantThreads({
    companyId: String(project.company_id),
    projectId: String(project.id),
    userId: params.userId,
  });

  const activeThread =
    (params.threadId ? threads.find((thread) => thread.id === params.threadId) : null) ?? threads[0] ?? null;

  const [documentsResult, outputs] = await Promise.all([
    supabase
      .from("documents")
      .select("id, name, document_type, parse_status, file_size, page_count, chunk_count, processing_error, created_at, updated_at")
      .eq("project_id", project.id)
      .order("updated_at", { ascending: false }),
    listProjectOutputs(String(project.id)),
  ]);

  const documents = (documentsResult.data ?? []).map(
    (document): VaultFileRecord => ({
      id: String(document.id),
      name: String(document.name),
      documentType: String(document.document_type),
      parseStatus: document.parse_status,
      fileSize: document.file_size,
      pageCount: document.page_count,
      chunkCount: document.chunk_count,
      processingError: document.processing_error,
      createdAt: String(document.created_at),
      updatedAt: String(document.updated_at),
    }),
  );

  if (!activeThread) {
    return {
      activeThread: null,
      threads,
      messages: [],
      sources: [],
      runs: [],
      documents,
      outputs,
    } satisfies AssistantWorkspaceInitialState;
  }

  const [messages, sources, runs] = await Promise.all([
    loadAssistantMessages(activeThread.id),
    listAssistantThreadSources(activeThread.id),
    listAssistantRuns(activeThread.id),
  ]);

  return {
    activeThread,
    threads,
    messages,
    sources,
    runs,
    documents,
    outputs,
  } satisfies AssistantWorkspaceInitialState;
}
