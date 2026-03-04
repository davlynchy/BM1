import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContractObligation, ScanFinding, ScanSummary } from "@/types/scans";

function citationLabel(citation: Record<string, unknown> | null | undefined) {
  if (!citation) {
    return null;
  }

  const section = typeof citation.section === "string" ? citation.section : null;
  const page = typeof citation.page === "number" ? citation.page : null;

  if (!section && !page) {
    return null;
  }

  if (section && page) {
    return `${section} · p.${page}`;
  }

  return section ?? `p.${page}`;
}

export function ReviewSidebar({
  summary,
  findings,
  obligations,
  documentName,
  isLockedPreview,
}: {
  summary: ScanSummary | null;
  findings: ScanFinding[];
  obligations: ContractObligation[];
  documentName: string;
  isLockedPreview: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Contract brief</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted">
          <p>{documentName}</p>
          {summary?.currentStage ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{summary.currentStage.replaceAll("_", " ")}</Badge>
              {summary.confidence ? <Badge variant="secondary">{summary.confidence} confidence</Badge> : null}
            </div>
          ) : null}
          {summary?.topThemes?.length ? (
            <div className="flex flex-wrap gap-2">
              {summary.topThemes.map((theme) => (
                <Badge key={theme} variant="outline">
                  {theme}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Negotiation points</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary?.negotiationPoints?.length ? (
            summary.negotiationPoints.map((item) => (
              <div className="rounded-xl border border-border bg-bg p-3 text-sm text-text" key={item}>
                {item}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">
              Negotiation points will appear as the deeper review completes.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isLockedPreview ? "Preview risks" : "Top risks"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {findings.length ? (
            findings.map((finding) => (
              <div className="rounded-xl border border-border bg-bg p-3" key={`${finding.title}-${finding.citation.section}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-text">{finding.title}</p>
                  <Badge variant={finding.severity === "high" ? "default" : "secondary"}>
                    {finding.severity}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted">{finding.summary}</p>
                {citationLabel(finding.citation) ? (
                  <p className="mt-2 text-xs text-muted">{citationLabel(finding.citation)}</p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">Risk findings will populate here as the review runs.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isLockedPreview ? "Preview obligations" : "Key obligations"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {obligations.length ? (
            obligations.map((obligation) => (
              <div className="rounded-xl border border-border bg-bg p-3" key={`${obligation.category}-${obligation.title}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {obligation.category}
                </p>
                <p className="mt-2 font-medium text-text">{obligation.title}</p>
                <p className="mt-2 text-sm text-muted">{obligation.dueRule}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">Structured obligations will show up after the deeper pass.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
