import { VaultUploadPanel } from "@/components/vault/vault-upload-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VaultFileRecord } from "@/types/vault";

function formatSize(size: number | null) {
  if (!size) {
    return "Unknown";
  }
  const mb = size / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export function VaultPage({
  project,
  documents,
}: {
  project: { id: string; name: string };
  documents: VaultFileRecord[];
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <VaultUploadPanel projectId={project.id} />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tender docs</CardTitle>
          <div className="text-sm text-muted">Project vault</div>
        </CardHeader>
        <CardContent>
          {documents.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-border text-sm text-muted">
                  <tr>
                    <th className="px-3 py-2">Files</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Added</th>
                    <th className="px-3 py-2">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr className="border-b border-border/60 text-sm" key={document.id}>
                      <td className="px-3 py-3 font-medium text-text">{document.name}</td>
                      <td className="px-3 py-3 uppercase text-muted">{document.documentType}</td>
                      <td className="px-3 py-3 text-muted">{new Date(document.createdAt).toLocaleDateString("en-AU")}</td>
                      <td className="px-3 py-3 text-muted">{formatSize(document.fileSize)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted">No files yet. Upload files to start this project workspace.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
