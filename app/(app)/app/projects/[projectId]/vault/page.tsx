import { notFound } from "next/navigation";
import { Share2 } from "lucide-react";

import { ProjectPageShell } from "@/components/projects/project-page-shell";
import { VaultPage } from "@/components/vault/vault-page";
import { createClient } from "@/lib/supabase/server";
import type { VaultFileRecord } from "@/types/vault";

export default async function ProjectVaultPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: documents }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle(),
    supabase
      .from("documents")
      .select("id, name, relative_path, document_type, parse_status, file_size, page_count, chunk_count, processing_error, created_at, updated_at")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false }),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <ProjectPageShell
      title="Vault"
      rightSlot={(
        <div className="inline-flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </div>
      )}
    >
      <VaultPage
        documents={(documents ?? []).map((document) => ({
          id: String(document.id),
          name: String(document.name),
          relativePath: document.relative_path ? String(document.relative_path) : null,
          documentType: String(document.document_type),
          parseStatus: document.parse_status,
          fileSize: document.file_size,
          pageCount: document.page_count,
          chunkCount: document.chunk_count,
          processingError: document.processing_error,
          createdAt: String(document.created_at),
          updatedAt: String(document.updated_at),
        })) as VaultFileRecord[]}
        project={{ id: String(project.id), name: String(project.name) }}
      />
    </ProjectPageShell>
  );
}
