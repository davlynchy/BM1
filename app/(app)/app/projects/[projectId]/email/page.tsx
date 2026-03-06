import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectPageShell } from "@/components/projects/project-page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectEmailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: emails }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle(),
    supabase
      .from("project_correspondence")
      .select("id, sender, subject, received_at, metadata, routing_status, routing_confidence")
      .eq("project_id", projectId)
      .order("received_at", { ascending: false })
      .limit(100),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <ProjectPageShell title="Email">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Emails</CardTitle>
            <div className="flex gap-2">
              <Link
                className="rounded-xl border border-border bg-panel px-3 py-2 text-sm"
                href="/api/outlook/connect/start"
              >
                Link Outlook
              </Link>
              <Link
                className="rounded-xl border border-border bg-panel px-3 py-2 text-sm"
                href="/app/email/unassigned"
              >
                Unassigned
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {emails?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-border text-sm text-muted">
                    <tr>
                      <th className="px-3 py-2">From</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Routing</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emails.map((email) => (
                      <tr className="border-b border-border/60 text-sm" key={email.id}>
                        <td className="px-3 py-3">{email.sender || "Unknown"}</td>
                        <td className="px-3 py-3 font-medium text-text">{email.subject || "(No subject)"}</td>
                        <td className="px-3 py-3 text-muted">
                          {email.received_at ? new Date(email.received_at).toLocaleDateString("en-AU") : "Unknown"}
                        </td>
                        <td className="px-3 py-3 text-muted">
                          {email.routing_status ?? "manual_assigned"}
                          {typeof email.routing_confidence === "number" ? ` (${Math.round(email.routing_confidence * 100)}%)` : ""}
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            className="underline"
                            href={`/app/projects/${projectId}/assistant?prompt=${encodeURIComponent(
                              `Review this email and draft a commercially strong response.\nSubject: ${email.subject || "(No subject)"}\nFrom: ${email.sender || "Unknown"}`,
                            )}`}
                          >
                            Ask Assistant
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted">No emails in this project yet. Link Outlook or upload .eml files in vault.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </ProjectPageShell>
  );
}
