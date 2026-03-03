import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectFiltersForm } from "@/components/projects/project-filters";
import { ProjectPagination } from "@/components/projects/project-pagination";
import { getActiveWorkspace } from "@/lib/auth/workspace";
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

export default async function AppDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; scan?: string; risk?: string; sort?: string; page?: string }>;
}) {
  const filters = normalizeProjectFilters(await searchParams);
  const supabase = await createClient();
  const workspace = await getActiveWorkspace();
  const companyId = workspace?.company?.id;

  const { data: projects } = companyId
    ? await supabase
        .from("projects")
        .select("id, name, status, contract_value, site_due_date, variation_process, claim_submission_method")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
    : { data: [] };

  const projectIds = (projects ?? []).map((project) => project.id);
  const { data: documents } = projectIds.length
    ? await supabase
        .from("documents")
        .select("id, project_id, parse_status")
        .in("project_id", projectIds)
    : { data: [] };

  const { data: scans } = projectIds.length
    ? await supabase
        .from("contract_scans")
        .select("id, project_id, status, completed_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const scanIds = (scans ?? []).map((scan) => scan.id);
  const { data: findings } = scanIds.length
    ? await supabase
        .from("contract_scan_findings")
        .select("id, scan_id, severity")
        .in("scan_id", scanIds)
    : { data: [] };

  const findingsByScan = new Map<string, Array<{ severity: string }>>();
  (findings ?? []).forEach((finding) => {
    const list = findingsByScan.get(finding.scan_id) ?? [];
    list.push({ severity: finding.severity });
    findingsByScan.set(finding.scan_id, list);
  });

  const documentsByProject = new Map<string, number>();
  const indexedDocumentsByProject = new Map<string, number>();
  (documents ?? []).forEach((document) => {
    documentsByProject.set(document.project_id, (documentsByProject.get(document.project_id) ?? 0) + 1);
    if (document.parse_status === "indexed") {
      indexedDocumentsByProject.set(
        document.project_id,
        (indexedDocumentsByProject.get(document.project_id) ?? 0) + 1,
      );
    }
  });

  const latestScanByProject = new Map<string, { id: string; status: string }>();
  (scans ?? []).forEach((scan) => {
    if (!latestScanByProject.has(scan.project_id)) {
      latestScanByProject.set(scan.project_id, { id: scan.id, status: scan.status });
    }
  });

  const projectRows = (projects ?? []).map((project) => {
    const latestScan = latestScanByProject.get(project.id);
    const latestFindings = latestScan ? findingsByScan.get(latestScan.id) ?? [] : [];
    const highRiskCount = latestFindings.filter((finding) => finding.severity === "high").length;

    return {
      ...project,
      indexedDocuments: indexedDocumentsByProject.get(project.id) ?? 0,
      totalDocuments: documentsByProject.get(project.id) ?? 0,
      latestScanStatus: latestScan?.status ?? "none",
      highRiskCount,
    };
  });

  const filteredProjects = filterProjects(projectRows, filters);
  const sortedProjects = sortProjects(filteredProjects, filters.sort);
  const paginatedProjects = paginateProjects(sortedProjects, filters.page, 6);
  const completedScans = filteredProjects.filter((project) => project.latestScanStatus === "completed").length;
  const indexedDocuments = filteredProjects.reduce((total, project) => total + project.indexedDocuments, 0);
  const highRiskCount = filteredProjects.reduce((total, project) => total + (project.highRiskCount ?? 0), 0);

  return (
    <main>
      <div className="py-4">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <Badge>Workspace</Badge>
            <h1 className="mt-3 font-heading text-4xl">Project Dashboard</h1>
            <p className="mt-2 text-muted">
              Commercial control across contracts, claims, variations, and risk for{" "}
              {workspace?.company?.name ?? "your company"}.
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="secondary">
              <Link href="/app/projects">Manage projects</Link>
            </Button>
            <Button asChild>
              <Link href="/upload">New contract scan</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Portfolio filters</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectFiltersForm action="/app" filters={filters} />
          </CardContent>
        </Card>

        <section className="mt-6 grid gap-6 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Filtered Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold">{filteredProjects.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Completed Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold">{completedScans}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Indexed Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold">{indexedDocuments}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>High Risks Identified</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold">{highRiskCount}</p>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-6">
          {paginatedProjects.items.length ? (
            paginatedProjects.items.map((project) => (
              <Card key={project.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>{project.name}</CardTitle>
                    <p className="mt-2 text-sm text-muted">
                      Contract value {formatCurrency(project.contract_value)}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {project.highRiskCount ? `${project.highRiskCount} high risks` : "Workspace ready"}
                  </Badge>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm text-muted md:grid-cols-5">
                  <div>
                    <p className="font-medium text-text">Status</p>
                    <p>{project.status}</p>
                  </div>
                  <div>
                    <p className="font-medium text-text">Due on site</p>
                    <p>{project.site_due_date ?? "Not set"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-text">Claim submission</p>
                    <p>{project.claim_submission_method ?? "Not captured yet"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-text">Indexed documents</p>
                    <p>
                      {project.indexedDocuments} / {project.totalDocuments}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-text">Project workspace</p>
                    <Link className="underline-offset-4 hover:underline" href={`/app/projects/${project.id}`}>
                      Open workspace
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No projects match these filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted">
                <p>Try broadening the search or resetting the filter state.</p>
                <Button asChild variant="secondary">
                  <Link href="/app">Reset filters</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
        <ProjectPagination
          basePath="/app"
          currentPage={paginatedProjects.currentPage}
          filters={filters}
          totalPages={paginatedProjects.totalPages}
        />
      </div>
    </main>
  );
}
