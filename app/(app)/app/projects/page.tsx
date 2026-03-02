import Link from "next/link";

import { CreateProjectForm } from "@/components/projects/create-project-form";
import { ProjectFiltersForm } from "@/components/projects/project-filters";
import { ProjectPagination } from "@/components/projects/project-pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { filterProjects, normalizeProjectFilters, paginateProjects, sortProjects } from "@/lib/projects/filters";
import { createClient } from "@/lib/supabase/server";

function formatCurrency(value: number | null) {
  if (value == null) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; q?: string; status?: string; scan?: string; risk?: string; sort?: string; page?: string }>;
}) {
  const { message, ...rest } = await searchParams;
  const filters = normalizeProjectFilters(rest);
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, contract_value, site_due_date, claim_submission_method, variation_process, created_at")
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((project) => project.id);
  const { data: documents } = projectIds.length
    ? await supabase.from("documents").select("project_id, parse_status").in("project_id", projectIds)
    : { data: [] };
  const { data: scans } = projectIds.length
    ? await supabase
        .from("contract_scans")
        .select("id, project_id, status")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const scanIds = (scans ?? []).map((scan) => scan.id);
  const { data: findings } = scanIds.length
    ? await supabase.from("contract_scan_findings").select("scan_id, severity").in("scan_id", scanIds)
    : { data: [] };

  const latestScanByProject = new Map<string, string>();
  (scans ?? []).forEach((scan) => {
    if (!latestScanByProject.has(scan.project_id)) {
      latestScanByProject.set(scan.project_id, scan.status);
    }
  });

  const findingsByScan = new Map<string, number>();
  (findings ?? []).forEach((finding) => {
    if (finding.severity === "high") {
      findingsByScan.set(finding.scan_id, (findingsByScan.get(finding.scan_id) ?? 0) + 1);
    }
  });

  const firstScanIdByProject = new Map<string, string>();
  (scans ?? []).forEach((scan) => {
    if (!firstScanIdByProject.has(scan.project_id)) {
      firstScanIdByProject.set(scan.project_id, scan.id);
    }
  });

  const indexedDocsByProject = new Map<string, number>();
  (documents ?? []).forEach((document) => {
    if (document.parse_status === "indexed") {
      indexedDocsByProject.set(document.project_id, (indexedDocsByProject.get(document.project_id) ?? 0) + 1);
    }
  });

  const projectRows = (projects ?? []).map((project) => ({
    ...project,
    latestScanStatus: latestScanByProject.get(project.id) ?? "none",
    highRiskCount: findingsByScan.get(firstScanIdByProject.get(project.id) ?? "") ?? 0,
    indexedDocuments: indexedDocsByProject.get(project.id) ?? 0,
  }));
  const filteredProjects = filterProjects(projectRows, filters);
  const sortedProjects = sortProjects(filteredProjects, filters.sort);
  const paginatedProjects = paginateProjects(sortedProjects, filters.page, 10);

  return (
    <main className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? (
            <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
              {message}
            </div>
          ) : null}
          <CreateProjectForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Project filters</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectFiltersForm action="/app/projects" filters={filters} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Projects</CardTitle>
            <p className="mt-2 text-sm text-muted">
              All project workspaces, contract scans, and document activity.
            </p>
          </div>
          <Badge variant="secondary">{filteredProjects.length} shown</Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted">
          {paginatedProjects.items.length ? (
            paginatedProjects.items.map((project) => (
              <Link
                className="flex flex-col gap-3 rounded-xl border border-border bg-bg px-4 py-4 transition-colors hover:bg-panel md:flex-row md:items-center md:justify-between"
                href={`/app/projects/${project.id}`}
                key={project.id}
              >
                <div>
                  <p className="font-medium text-text">{project.name}</p>
                  <p className="mt-1">{formatCurrency(project.contract_value)}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-xs uppercase tracking-wide text-muted">
                  <span>{project.status}</span>
                  <span>{project.site_due_date ?? "No site date"}</span>
                  <span>{project.latestScanStatus}</span>
                  <span>{project.highRiskCount} high</span>
                </div>
              </Link>
            ))
          ) : (
            <p>No projects match the current filters.</p>
          )}
        </CardContent>
      </Card>
      <ProjectPagination
        basePath="/app/projects"
        currentPage={paginatedProjects.currentPage}
        filters={filters}
        totalPages={paginatedProjects.totalPages}
      />
    </main>
  );
}
