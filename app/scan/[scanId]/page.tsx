import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

function visibleFindingsCount(isFreePreview: boolean) {
  return isFreePreview ? 3 : Number.POSITIVE_INFINITY;
}

export default async function ScanPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?message=Login+to+view+your+scan.");
  }

  const { data: scan } = await supabase
    .from("contract_scans")
    .select("id, company_id, project_id, contract_document_id, status, is_free_preview, summary, processing_error")
    .eq("id", scanId)
    .maybeSingle();

  if (!scan) {
    notFound();
  }

  const { data: findings } = await supabase
    .from("contract_scan_findings")
    .select("id, severity, title, summary, implication, recommended_action, citation")
    .eq("scan_id", scanId)
    .order("created_at", { ascending: true });

  const { data: obligations } = await supabase
    .from("contract_obligations")
    .select("id, category, title, due_rule, submission_path, notice_period_days, citation")
    .eq("scan_id", scanId)
    .order("created_at", { ascending: true });

  const { data: project } = scan.project_id
    ? await supabase.from("projects").select("id, name").eq("id", scan.project_id).maybeSingle()
    : { data: null };

  const { data: document } = scan.contract_document_id
    ? await supabase
        .from("documents")
        .select("id, name, parse_status")
        .eq("id", scan.contract_document_id)
        .maybeSingle()
    : { data: null };

  const visibleCount = visibleFindingsCount(scan.is_free_preview);
  const isCompleted = scan.status === "completed";
  const isProcessing = scan.status !== "completed";
  const isFailed = scan.status === "failed";
  const topThemes =
    typeof scan.summary === "object" &&
    scan.summary &&
    "topThemes" in scan.summary &&
    Array.isArray(scan.summary.topThemes)
      ? (scan.summary.topThemes as string[])
      : [];

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <Badge>{scan.is_free_preview ? "Free summary" : "Full report"}</Badge>
            <div>
              <h1 className="font-[var(--font-heading)] text-4xl">
                {project?.name ?? "Contract scan"}
              </h1>
              <p className="mt-2 text-muted">
                {document?.name ?? "Uploaded contract"} is being prepared as commercial intelligence.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="secondary">
              <Link href="/app">Back to dashboard</Link>
            </Button>
            {scan.is_free_preview ? <Button>Unlock full report</Button> : null}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Executive summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted">
              {typeof scan.summary === "object" && scan.summary && "executiveSummary" in scan.summary
                ? String(scan.summary.executiveSummary)
                : "Commercial review complete."}
            </p>
            <div className="flex flex-wrap gap-2">
              {topThemes.map((theme) => (
                <Badge key={theme} variant="secondary">
                  {theme}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {isFailed ? (
          <Card>
            <CardHeader>
              <CardTitle>Scan failed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted">
              <p>
                Bidmetric indexed the document, but the commercial extraction step failed.
              </p>
              <p>
                {typeof scan.processing_error === "string" && scan.processing_error
                  ? scan.processing_error
                  : "Review the worker logs and retry after correcting the underlying issue."}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {isProcessing && !isFailed ? (
          <Card>
            <CardHeader>
              <CardTitle>Processing contract</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted">
              <p>
                Current document status: <span className="font-medium text-text">{document?.parse_status ?? "queued"}</span>
              </p>
              <p>
                Bidmetric is extracting text, normalizing sections, chunking clauses, and
                generating embeddings for this contract now.
              </p>
              <p>
                Detailed commercial findings will appear once the contract extraction stage
                is implemented on top of this indexed document.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Top risks identified</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isCompleted && findings?.length ? (
                findings.map((finding, index) => {
                  const visible = index < visibleCount;
                  const citation = finding.citation as {
                    section?: string;
                    snippet?: string;
                    page?: number;
                  } | null;

                  return (
                    <div
                      className={`rounded-xl border border-border p-4 ${visible ? "bg-bg" : "relative overflow-hidden"}`}
                      key={finding.id}
                    >
                      {!visible ? (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel/80 backdrop-blur-sm">
                          <div className="text-center">
                            <p className="font-medium text-text">Locked in full report</p>
                            <p className="mt-1 text-sm text-muted">
                              Upgrade to see the remaining findings and recommendations.
                            </p>
                          </div>
                        </div>
                      ) : null}
                      <div className={visible ? "" : "blur-sm"}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-text">{finding.title}</p>
                          <Badge variant={finding.severity === "high" ? "default" : "secondary"}>
                            {finding.severity}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm text-muted">{finding.summary}</p>
                        <p className="mt-3 text-sm text-text">{finding.implication}</p>
                        <p className="mt-3 text-sm text-muted">{finding.recommended_action}</p>
                        {citation ? (
                          <div className="mt-4 rounded-lg border border-border bg-panel px-3 py-2 text-xs text-muted">
                            {citation.section ? `${citation.section} · ` : ""}
                            {citation.snippet}
                            {citation.page ? ` (p. ${citation.page})` : ""}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-border bg-bg p-4 text-sm text-muted">
                  Risk findings will appear here once contract extraction is added in the next stage.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commercial obligations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isCompleted && obligations?.length ? (
                obligations.map((obligation) => {
                  const citation = obligation.citation as {
                    section?: string;
                    snippet?: string;
                    page?: number;
                  } | null;

                  return (
                    <div className="rounded-xl border border-border bg-bg p-4" key={obligation.id}>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        {obligation.category}
                      </p>
                      <p className="mt-2 font-medium text-text">{obligation.title}</p>
                      <p className="mt-2 text-sm text-muted">{obligation.due_rule}</p>
                      <p className="mt-1 text-sm text-muted">{obligation.submission_path}</p>
                      {citation ? (
                        <p className="mt-3 text-xs text-muted">
                          {citation.section ? `${citation.section}: ` : ""}
                          {citation.snippet}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-border bg-bg p-4 text-sm text-muted">
                  Structured obligations will be populated once contract extraction is implemented.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
