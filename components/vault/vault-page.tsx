import { ProjectWorkbenchNav } from "@/components/projects/project-workbench-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VaultFileTable } from "@/components/vault/vault-file-table";
import { VaultUploadPanel } from "@/components/vault/vault-upload-panel";
import type { VaultFileRecord } from "@/types/vault";

export function VaultPage({
  project,
  documents,
}: {
  project: { id: string; name: string };
  documents: VaultFileRecord[];
}) {
  const indexedCount = documents.filter((document) => document.parseStatus === "indexed").length;

  return (
    <main className="space-y-6">
      <ProjectWorkbenchNav active="vault" projectId={project.id} projectName={project.name} />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{documents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Indexed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{indexedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Use</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              Upload contracts, correspondence, and supporting project files here, then use the
              assistant against them.
            </p>
          </CardContent>
        </Card>
      </section>

      <VaultUploadPanel projectId={project.id} />

      <Card>
        <CardHeader>
          <CardTitle>Project files</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length ? (
            <VaultFileTable documents={documents} projectId={project.id} />
          ) : (
            <p className="text-sm text-muted">No files uploaded yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
