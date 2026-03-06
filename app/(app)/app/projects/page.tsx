import Link from "next/link";

import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { ProjectCardActions } from "@/components/projects/project-card-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

function isPreConstructionStatus(value: string | null) {
  if (!value) {
    return true;
  }
  return ["tender", "pre-construction", "pre_construction"].includes(value.toLowerCase());
}

function isPostConstructionStatus(value: string | null) {
  if (!value) {
    return false;
  }
  return ["construction", "post-construction", "post_construction"].includes(value.toLowerCase());
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

export default async function ProjectsPage({
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

  const preConstructionProjects = projectRows.filter((project) => isPreConstructionStatus(project.status));
  const postConstructionProjects = projectRows.filter((project) => isPostConstructionStatus(project.status));

  return (
    <main className="space-y-8">
      <header className="relative pt-5 text-center">
        <h1 className="font-heading text-6xl">Projects</h1>
        {projectRows.length ? (
          <div className="absolute right-2 top-0">
            <CreateProjectModal triggerLabel="New Project" />
          </div>
        ) : null}
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
            {[
              { label: "Pre-construction", items: preConstructionProjects },
              ...(postConstructionProjects.length ? [{ label: "Post-construction", items: postConstructionProjects }] : []),
            ].map((group) => (
              <section className="space-y-4" key={group.label}>
                <h3 className="text-3xl font-semibold">{group.label}</h3>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((project) => (
                    <Card className="group relative h-full transition-transform hover:-translate-y-0.5" key={project.id}>
                      <Link
                        aria-label={`Open ${project.name}`}
                        className="absolute inset-0 z-10 rounded-xl"
                        href={`/app/projects/${project.id}`}
                      />
                      <CardHeader className="pointer-events-none relative z-20 pr-12">
                        <CardTitle className="text-2xl">{project.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="pointer-events-none relative z-20 space-y-2 text-sm text-muted">
                        <p>
                          Vault:{" "}
                          {project.indexedDocs ? (
                            <span className="font-semibold text-[#5f976f]">Scanned</span>
                          ) : (
                            <Link
                              className="pointer-events-auto relative z-30 font-semibold text-red-500 underline-offset-2 hover:underline"
                              href={`/app/projects/${project.id}/vault`}
                            >
                              No Docs
                            </Link>
                          )}
                        </p>
                        <p>
                          Tender Due:{" "}
                          <span className="font-semibold text-text">
                            {formatDate(project.siteDueDate)}
                          </span>
                        </p>
                        {project.claimSubmissionMethod ? (
                          <p>
                            Progress Claim:{" "}
                            <span className="font-semibold text-text">{project.claimSubmissionMethod}</span>
                          </p>
                        ) : null}
                      </CardContent>
                      <div className="absolute right-3 top-3 z-20">
                        <ProjectCardActions
                          currentStatus={project.status}
                          projectId={project.id}
                          projectName={project.name}
                          siteDueDate={project.siteDueDate}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
