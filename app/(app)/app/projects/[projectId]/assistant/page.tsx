import { notFound } from "next/navigation";

import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";
import { ProjectWorkbenchNav } from "@/components/projects/project-workbench-nav";
import { listProjectOutputs } from "@/lib/outputs/store";
import { loadProjectAssistantWorkbench } from "@/lib/assistant/workbench";
import { createClient } from "@/lib/supabase/server";
import type { VaultFileRecord } from "@/types/vault";

export default async function ProjectAssistantPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ threadId?: string }>;
}) {
  const { projectId } = await params;
  const { threadId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const workbench = await loadProjectAssistantWorkbench({
    projectId,
    userId: user.id,
    threadId,
  });
  const outputs = await listProjectOutputs(projectId);

  return (
    <main className="space-y-6">
      <ProjectWorkbenchNav
        active="assistant"
        projectId={String(workbench.project.id)}
        projectName={String(workbench.project.name)}
      />
      <AssistantWorkspace
        initialState={{
          activeThread: workbench.activeThread,
          threads: workbench.threads,
          messages: workbench.messages,
          sources: workbench.sources,
          runs: workbench.runs,
          documents: workbench.documents.map((document) => ({
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
          })) as VaultFileRecord[],
          outputs,
        }}
        projectId={projectId}
      />
    </main>
  );
}
