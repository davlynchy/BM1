import Link from "next/link";

import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

function isTenderStatus(value: string | null) {
  if (!value) {
    return true;
  }
  return ["tender", "pre-construction", "pre_construction"].includes(value.toLowerCase());
}

export default async function AppDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
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
  const { data: projects } = companyId
    ? await supabase
        .from("projects")
        .select("id, name, status, claim_submission_method, site_due_date")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const { data: docs } =
    projects && projects.length
      ? await supabase
          .from("documents")
          .select("project_id, parse_status")
          .in(
            "project_id",
            projects.map((project) => project.id),
          )
      : { data: [] };

  const indexedByProject = new Map<string, number>();
  (docs ?? []).forEach((doc) => {
    if (doc.parse_status === "indexed") {
      indexedByProject.set(String(doc.project_id), (indexedByProject.get(String(doc.project_id)) ?? 0) + 1);
    }
  });

  const projectRows = (projects ?? []).map((project) => ({
    id: String(project.id),
    name: String(project.name),
    status: project.status ? String(project.status) : null,
    indexedDocs: indexedByProject.get(String(project.id)) ?? 0,
    siteDueDate: project.site_due_date ? String(project.site_due_date) : null,
    claimSubmissionMethod: project.claim_submission_method ? String(project.claim_submission_method) : null,
  }));

  const tenderProjects = projectRows.filter((project) => isTenderStatus(project.status));
  const liveProjects = projectRows.filter((project) => !isTenderStatus(project.status));

  return (
    <main className="space-y-8">
      <header className="space-y-5 pt-1 text-center">
        <h1 className="font-heading text-4xl text-text/90">Bidmetric</h1>
        <h2 className="font-heading text-6xl">Projects</h2>
      </header>

      <section className="space-y-6">
        {!projectRows.length ? (
          <div className="mx-auto max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create your first project</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-start">
                {message ? (
                  <div className="mr-3 rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">
                    {message}
                  </div>
                ) : null}
                <CreateProjectModal triggerLabel="Create project" />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-10">
            {([
              { label: "Tenders", items: tenderProjects },
              { label: "Live", items: liveProjects },
            ] as const).map((group) => (
              <section className="space-y-4" key={group.label}>
                <h3 className="text-3xl font-semibold">{group.label}</h3>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.length ? (
                    group.items.map((project) => (
                      <Link href={`/app/projects/${project.id}`} key={project.id}>
                        <Card className="h-full transition-transform hover:-translate-y-0.5">
                          <CardHeader>
                            <CardTitle className="text-2xl">{project.name}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm text-muted">
                            <p>
                              Vault:{" "}
                              <span className={project.indexedDocs ? "font-semibold text-[#5f976f]" : "font-semibold text-red-500"}>
                                {project.indexedDocs ? "Scanned" : "No Docs"}
                              </span>
                            </p>
                            <p>
                              Tender Due:{" "}
                              <span className="font-semibold text-text">
                                {project.siteDueDate ?? "Not set"}
                              </span>
                            </p>
                            {project.claimSubmissionMethod ? (
                              <p>
                                Progress Claim:{" "}
                                <span className="font-semibold text-text">{project.claimSubmissionMethod}</span>
                              </p>
                            ) : null}
                          </CardContent>
                        </Card>
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm text-muted">No projects in this section.</p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
