import { ProjectDocumentUpload } from "@/components/documents/project-document-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function VaultUploadPanel({ projectId }: { projectId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload files</CardTitle>
      </CardHeader>
      <CardContent>
        <ProjectDocumentUpload projectId={projectId} />
      </CardContent>
    </Card>
  );
}
