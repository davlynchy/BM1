import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectWorkbenchNav } from "@/components/projects/project-workbench-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listProjectOutputs } from "@/lib/outputs/store";
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

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, contract_value, site_due_date, variation_process, claim_submission_method")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const [{ data: documents }, { data: scans }, { data: todos }, outputs] = await Promise.all([
    supabase
      .from("documents")
      .select("id, parse_status")
      .eq("project_id", project.id),
    supabase
      .from("contract_scans")
      .select("id, status, summary, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_todos")
      .select("id, title, priority, status")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(6),
    listProjectOutputs(project.id),
  ]);

  const indexedCount = (documents ?? []).filter((document) => document.parse_status === "indexed").length;
  const activeScans = (scans ?? []).filter((scan) => scan.status !== "completed" && scan.status !== "failed").length;
  const latestScan = scans?.[0] ?? null;

  return (
    <main className="space-y-6">
      <ProjectWorkbenchNav active="dashboard" projectId={project.id} projectName={project.name} />

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold capitalize">{project.status}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Indexed docs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{indexedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active runs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{activeScans}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Outputs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{outputs.length}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Project brief</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-muted md:grid-cols-2">
            <div>
              <p className="font-medium text-text">Contract value</p>
              <p>{formatCurrency(project.contract_value)}</p>
            </div>
            <div>
              <p className="font-medium text-text">Due on site</p>
              <p>{project.site_due_date ?? "Not set"}</p>
            </div>
            <div>
              <p className="font-medium text-text">Claim submission</p>
              <p>{project.claim_submission_method ?? "Not set"}</p>
            </div>
            <div>
              <p className="font-medium text-text">Variation process</p>
              <p>{project.variation_process ?? "Not captured yet"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Latest contract review</CardTitle>
            </div>
            <Link className="text-sm text-muted underline-offset-4 hover:underline" href={`/app/projects/${project.id}/assistant`}>
              Open assistant
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted">
            {latestScan ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{latestScan.status}</Badge>
                </div>
                <p>
                  {latestScan.summary && typeof latestScan.summary === "object" && "executiveSummary" in latestScan.summary
                    ? String(latestScan.summary.executiveSummary)
                    : "No completed review summary yet."}
                </p>
              </>
            ) : (
              <p>No contract review thread has been created yet. Upload a contract in the vault to start.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent outputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted">
            {outputs.length ? (
              outputs.slice(0, 5).map((output) => (
                <Link className="block rounded-xl border border-border bg-bg px-4 py-3" href={`/app/projects/${project.id}/outputs/${output.id}`} key={output.id}>
                  <p className="font-medium text-text">{output.title}</p>
                  <p className="mt-1">{output.type} · v{output.version}</p>
                </Link>
              ))
            ) : (
              <p>No outputs created yet. Use the assistant to turn answers into drafts, memos, and checklists.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Action queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted">
            {todos?.length ? (
              todos.map((todo) => (
                <div className="rounded-xl border border-border bg-bg px-4 py-3" key={todo.id}>
                  <div className="flex flex-wrap gap-2">
                    <p className="font-medium text-text">{todo.title}</p>
                    <Badge variant={todo.priority === "high" ? "default" : "secondary"}>{todo.priority}</Badge>
                    <Badge variant="outline">{todo.status}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p>No pending action items.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
