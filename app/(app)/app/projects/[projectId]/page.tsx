import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectAssistant } from "@/components/assistant/project-assistant";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { ProjectDocumentUpload } from "@/components/documents/project-document-upload";
import { RetryDocumentButton } from "@/components/documents/retry-document-button";
import { updateTodoStatusAction } from "@/app/(app)/app/projects/actions";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { Button } from "@/components/ui/button";
import { EditProjectForm } from "@/components/projects/edit-project-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import type { AssistantMessageRecord } from "@/types/assistant";
import type { DocumentParseStatus } from "@/types/ingestion";

function formatBytes(value: number | null) {
  if (!value) {
    return "-";
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

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

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { projectId } = await params;
  const { message } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, status, contract_value, site_due_date, variation_process, claim_submission_method, created_at",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const { data: documents } = await supabase
    .from("documents")
    .select(
      "id, name, document_type, parse_status, file_size, page_count, chunk_count, processing_error, created_at, updated_at",
    )
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  const { data: scans } = await supabase
    .from("contract_scans")
    .select("id, status, summary, completed_at, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  const latestScan = scans?.[0] ?? null;
  const { data: findings } = latestScan
    ? await supabase
        .from("contract_scan_findings")
        .select("id, severity, title, summary")
        .eq("scan_id", latestScan.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const { data: obligations } = latestScan
    ? await supabase
        .from("contract_obligations")
        .select("id, category, title, due_rule")
        .eq("scan_id", latestScan.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const { data: correspondence } = await supabase
    .from("project_correspondence")
    .select(
      "id, subject, sender, received_at, body_text, analysis_status, ai_summary, draft_reply, action_required, processing_error, metadata",
    )
    .eq("project_id", project.id)
    .order("received_at", { ascending: false });

  const { data: todos } = await supabase
    .from("project_todos")
    .select("id, title, summary, priority, status, due_date, source_type, source_ref, metadata")
    .eq("project_id", project.id)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  const assistantThread = user
    ? await supabase
        .from("assistant_threads")
        .select("id")
        .eq("project_id", project.id)
        .eq("created_by", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const assistantMessagesQuery =
    assistantThread.data?.id
      ? await supabase
          .from("assistant_messages")
          .select("id, role, content, citations, created_at")
          .eq("thread_id", assistantThread.data.id)
          .order("created_at", { ascending: true })
      : { data: [] };

  const assistantMessages: AssistantMessageRecord[] = (assistantMessagesQuery.data ?? []).map((entry) => ({
    id: String(entry.id),
    role: entry.role as AssistantMessageRecord["role"],
    content: String(entry.content),
    createdAt: String(entry.created_at),
    citations: Array.isArray(entry.citations) ? (entry.citations as AssistantMessageRecord["citations"]) : [],
  }));

  const indexedDocuments = (documents ?? []).filter((document) => document.parse_status === "indexed").length;
  const highRisks = (findings ?? []).filter((finding) => finding.severity === "high").length;
  const mediumRisks = (findings ?? []).filter((finding) => finding.severity === "medium").length;
  const openTodos = (todos ?? []).filter((todo) => todo.status === "open" || todo.status === "in_progress").length;
  const correspondenceActionItems = (correspondence ?? []).filter((item) => item.action_required).length;
  const topThemes =
    latestScan &&
    typeof latestScan.summary === "object" &&
    latestScan.summary &&
    "topThemes" in latestScan.summary &&
    Array.isArray(latestScan.summary.topThemes)
      ? (latestScan.summary.topThemes as string[])
      : [];

  return (
    <main className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{project.name}</CardTitle>
            <p className="mt-2 text-sm text-muted">
              Commercial overview for this project workspace.
            </p>
          </div>
          <Link className="text-sm text-muted underline-offset-4 hover:underline" href="/app/projects">
            Back to projects
          </Link>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted md:grid-cols-4">
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
            <p>{project.claim_submission_method ?? "Not captured yet"}</p>
          </div>
          <div>
            <p className="font-medium text-text">Variation process</p>
            <p>{project.variation_process ?? "Not captured yet"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? (
            <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
              {message}
            </div>
          ) : null}
          <EditProjectForm project={project} />
          <DeleteProjectButton projectId={project.id} projectName={project.name} />
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{documents?.length ?? 0}</p>
            <p className="mt-2 text-sm text-muted">{indexedDocuments} indexed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Scan status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{latestScan?.status ?? "Not started"}</p>
            <p className="mt-2 text-sm text-muted">
              {latestScan?.completed_at
                ? `Completed ${new Date(latestScan.completed_at).toLocaleString("en-AU")}`
                : "Run a contract scan by uploading a contract."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>High risks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{highRisks}</p>
            <p className="mt-2 text-sm text-muted">{mediumRisks} medium risks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Obligations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{obligations?.length ?? 0}</p>
            <p className="mt-2 text-sm text-muted">Structured commercial obligations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open to-dos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{openTodos}</p>
            <p className="mt-2 text-sm text-muted">{correspondenceActionItems} from correspondence</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Latest contract scan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestScan ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{latestScan.status}</Badge>
                  {topThemes.map((theme) => (
                    <Badge key={theme} variant="secondary">
                      {theme}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted">
                  {typeof latestScan.summary === "object" &&
                  latestScan.summary &&
                  "executiveSummary" in latestScan.summary
                    ? String(latestScan.summary.executiveSummary)
                    : "Contract scan summary unavailable."}
                </p>
                {findings?.length ? (
                  <div className="space-y-3">
                    {findings.slice(0, 4).map((finding) => (
                      <div className="rounded-xl border border-border bg-bg p-4" key={finding.id}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-text">{finding.title}</p>
                          <Badge variant={finding.severity === "high" ? "default" : "secondary"}>
                            {finding.severity}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted">{finding.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    Findings will appear here once extraction completes.
                  </p>
                )}
                <Link
                  className="text-sm font-medium text-text underline-offset-4 hover:underline"
                  href={`/scan/${latestScan.id}`}
                >
                  Open full scan report
                </Link>
              </>
            ) : (
              <p className="text-sm text-muted">No contract scan exists for this project yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key obligations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {obligations?.length ? (
              obligations.slice(0, 6).map((obligation) => (
                <div className="rounded-xl border border-border bg-bg p-4" key={obligation.id}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {obligation.category}
                  </p>
                  <p className="mt-2 font-medium text-text">{obligation.title}</p>
                  <p className="mt-2 text-sm text-muted">{obligation.due_rule}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">
                Structured obligations will appear once a contract scan completes.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Upload documents</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectDocumentUpload projectId={project.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document ingestion</CardTitle>
        </CardHeader>
        <CardContent>
          {documents?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-text">{document.name}</p>
                        {document.processing_error ? (
                          <p className="mt-1 text-xs text-muted">{document.processing_error}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{document.document_type}</TableCell>
                    <TableCell>
                      <DocumentStatusBadge status={document.parse_status as DocumentParseStatus} />
                    </TableCell>
                    <TableCell>{formatBytes(document.file_size)}</TableCell>
                    <TableCell>{document.page_count ?? "-"}</TableCell>
                    <TableCell>{document.chunk_count ?? "-"}</TableCell>
                    <TableCell>
                      {document.parse_status === "failed" ? (
                        <RetryDocumentButton documentId={document.id} />
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted">No project documents uploaded yet.</p>
          )}
        </CardContent>
      </Card>

      <ProjectAssistant
        initialMessages={assistantMessages}
        initialThreadId={assistantThread.data?.id ?? null}
        projectId={project.id}
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Correspondence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {correspondence?.length ? (
              correspondence.map((item) => {
                const metadata =
                  item.metadata && typeof item.metadata === "object"
                    ? (item.metadata as Record<string, unknown>)
                    : {};

                return (
                  <div className="rounded-xl border border-border bg-bg p-4" key={item.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-text">{item.subject || "Untitled email"}</p>
                      <Badge variant="secondary">{item.analysis_status}</Badge>
                      {item.action_required ? <Badge>Action required</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      From {item.sender || "Unknown sender"}
                      {item.received_at
                        ? ` on ${new Date(item.received_at).toLocaleString("en-AU")}`
                        : ""}
                    </p>
                    <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-text">
                      {item.body_text}
                    </p>
                    {item.ai_summary ? (
                      <div className="mt-3 rounded-xl border border-border bg-panel p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted">
                          AI summary
                        </p>
                        <p className="mt-2 text-sm text-text">{item.ai_summary}</p>
                      </div>
                    ) : null}
                    {item.draft_reply ? (
                      <div className="mt-3 rounded-xl border border-border bg-panel p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted">
                          Draft reply
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-text">
                          {item.draft_reply}
                        </p>
                      </div>
                    ) : null}
                    {Array.isArray(metadata.sourceSignals) && metadata.sourceSignals.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(metadata.sourceSignals as string[]).map((signal) => (
                          <Badge key={`${item.id}-${signal}`} variant="secondary">
                            {signal}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {item.processing_error ? (
                      <p className="mt-3 text-sm text-muted">{item.processing_error}</p>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted">
                Upload `.eml` files and they will be parsed, analysed, and surfaced here.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>To-do</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todos?.length ? (
              todos.map((todo) => (
                <div className="rounded-xl border border-border bg-bg p-4" key={todo.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-text">{todo.title}</p>
                    <Badge variant={todo.priority === "high" ? "default" : "secondary"}>
                      {todo.priority}
                    </Badge>
                    <Badge variant="secondary">{todo.status}</Badge>
                    <Badge variant="secondary">{todo.source_type}</Badge>
                  </div>
                  {todo.summary ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{todo.summary}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <form action={updateTodoStatusAction}>
                      <input name="projectId" type="hidden" value={project.id} />
                      <input name="todoId" type="hidden" value={todo.id} />
                      <input name="status" type="hidden" value="in_progress" />
                      <Button size="sm" type="submit" variant="secondary">
                        Start
                      </Button>
                    </form>
                    <form action={updateTodoStatusAction}>
                      <input name="projectId" type="hidden" value={project.id} />
                      <input name="todoId" type="hidden" value={todo.id} />
                      <input name="status" type="hidden" value="done" />
                      <Button size="sm" type="submit">
                        Done
                      </Button>
                    </form>
                    <form action={updateTodoStatusAction}>
                      <input name="projectId" type="hidden" value={project.id} />
                      <input name="todoId" type="hidden" value={todo.id} />
                      <input name="status" type="hidden" value="dismissed" />
                      <Button size="sm" type="submit" variant="ghost">
                        Dismiss
                      </Button>
                    </form>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">
                Action items from contract scans and correspondence will appear here.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
