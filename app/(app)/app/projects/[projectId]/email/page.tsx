import { notFound } from "next/navigation";

import { ProjectEmailWorkspace } from "@/components/email/project-email-workspace";
import { ProjectPageShell } from "@/components/projects/project-page-shell";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectEmailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: emails }, { data: emailDocuments }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle(),
    supabase
      .from("project_correspondence")
      .select("id, sender, subject, received_at, body_text, metadata, routing_status, routing_confidence")
      .eq("project_id", projectId)
      .order("received_at", { ascending: false })
      .limit(100),
    supabase
      .from("documents")
      .select("id, name, parse_status, processing_error, created_at")
      .eq("project_id", projectId)
      .eq("document_type", "email")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <ProjectPageShell title="Email">
      <div className="mx-auto max-w-6xl">
        <ProjectEmailWorkspace
          emailDocuments={(emailDocuments ?? []).map((document) => ({
            id: String(document.id),
            name: String(document.name),
            parseStatus: String(document.parse_status),
            processingError: document.processing_error ? String(document.processing_error) : null,
            createdAt: document.created_at ? String(document.created_at) : null,
          }))}
          emails={(emails ?? []).map((email) => ({
            id: String(email.id),
            sender: email.sender ? String(email.sender) : null,
            subject: email.subject ? String(email.subject) : null,
            receivedAt: email.received_at ? String(email.received_at) : null,
            bodyText: email.body_text ? String(email.body_text) : null,
            metadata: email.metadata && typeof email.metadata === "object" ? (email.metadata as Record<string, unknown>) : null,
            routingStatus: email.routing_status ? String(email.routing_status) : null,
            routingConfidence: typeof email.routing_confidence === "number" ? email.routing_confidence : null,
          }))}
          projectId={projectId}
        />
      </div>
    </ProjectPageShell>
  );
}
