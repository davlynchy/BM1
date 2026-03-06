import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function UnassignedEmailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_company_id")
    .eq("id", user.id)
    .maybeSingle();

  const companyId = profile?.default_company_id ?? null;
  const { data: emails } = companyId
    ? await supabase
        .from("project_correspondence")
        .select("id, sender, subject, received_at, routing_confidence, routing_reasons, metadata")
        .eq("company_id", companyId)
        .is("project_id", null)
        .order("received_at", { ascending: false })
        .limit(200)
    : { data: [] };

  const { data: projects } = companyId
    ? await supabase.from("projects").select("id, name").eq("company_id", companyId).order("name", { ascending: true })
    : { data: [] };

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="font-heading text-5xl">Unassigned Emails</h1>
        <Link className="rounded-xl border border-border bg-panel px-3 py-2 text-sm" href="/app">
          Back to dashboard
        </Link>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Needs review</CardTitle>
        </CardHeader>
        <CardContent>
          {emails?.length ? (
            <div className="space-y-3">
              {emails.map((email) => (
                <div className="space-y-3 rounded-xl border border-border bg-panel p-4" key={email.id}>
                  <div className="space-y-1">
                    <p className="font-medium text-text">{email.subject || "(No subject)"}</p>
                    <p className="text-sm text-muted">{email.sender || "Unknown sender"}</p>
                    <p className="text-xs text-muted">
                      Confidence: {typeof email.routing_confidence === "number" ? `${Math.round(email.routing_confidence * 100)}%` : "n/a"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      ((email.metadata as { suggestions?: Array<{ projectId?: string; projectName?: string }> } | null)?.suggestions ?? [])
                        .filter((suggestion) => suggestion.projectId && suggestion.projectName)
                        .slice(0, 3)
                    ).map((suggestion) => (
                      <form action={`/api/email/${email.id}/assign-project`} key={suggestion.projectId} method="post">
                        <input name="projectId" type="hidden" value={suggestion.projectId} />
                        <button className="rounded-xl border border-border bg-bg px-3 py-2 text-sm" type="submit">
                          Send to {suggestion.projectName}
                        </button>
                      </form>
                    ))}
                  </div>
                  <form action={`/api/email/${email.id}/assign-project`} className="grid gap-3 md:grid-cols-[220px_auto]" method="post">
                    <select className="rounded-xl border border-border bg-bg px-3 py-2 text-sm" defaultValue="" name="projectId" required>
                      <option disabled value="">
                        Select project
                      </option>
                      {(projects ?? []).map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <button className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white" type="submit">
                      Send to Vault
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No unmatched emails.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
