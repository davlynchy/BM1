import { createAdminClient } from "@/lib/supabase/admin";
import type { ContractScanExtraction } from "@/types/scans";

function mapCompletedScanToExtraction(params: {
  summary: Record<string, unknown>;
  findings: Array<Record<string, unknown>>;
  obligations: Array<Record<string, unknown>>;
}): ContractScanExtraction {
  return {
    summary: {
      executiveSummary: String(params.summary.executiveSummary ?? "Commercial review complete."),
      topThemes: Array.isArray(params.summary.topThemes)
        ? params.summary.topThemes.map((theme) => String(theme))
        : ["commercial extraction"],
      confidence:
        params.summary.confidence === "low" ||
        params.summary.confidence === "medium" ||
        params.summary.confidence === "high"
          ? params.summary.confidence
          : "medium",
    },
    findings: params.findings.map((finding) => ({
      severity:
        finding.severity === "low" || finding.severity === "medium" || finding.severity === "high"
          ? finding.severity
          : "medium",
      title: String(finding.title ?? ""),
      summary: String(finding.summary ?? ""),
      implication: String(finding.implication ?? ""),
      recommendedAction: String(finding.recommended_action ?? ""),
      citation: ((finding.citation ?? {}) as ContractScanExtraction["findings"][number]["citation"]),
    })),
    obligations: params.obligations.map((obligation) => ({
      category: String(obligation.category ?? ""),
      title: String(obligation.title ?? ""),
      dueRule: String(obligation.due_rule ?? ""),
      submissionPath: String(obligation.submission_path ?? ""),
      noticePeriodDays:
        typeof obligation.notice_period_days === "number" ? obligation.notice_period_days : null,
      citation: ((obligation.citation ?? {}) as ContractScanExtraction["obligations"][number]["citation"]),
    })),
  };
}

export async function findReusableCompletedScan(params: {
  companyId: string;
  projectId: string;
  fingerprint: string;
  excludeDocumentId: string;
}) {
  const supabase = createAdminClient();
  const { data: scans, error } = await supabase
    .from("contract_scans")
    .select("id, summary, contract_document_id, created_at")
    .eq("company_id", params.companyId)
    .eq("project_id", params.projectId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  if (!scans?.length) {
    return null;
  }

  const documentIds = scans
    .map((scan) => scan.contract_document_id)
    .filter((value): value is string => typeof value === "string" && value !== params.excludeDocumentId);

  if (!documentIds.length) {
    return null;
  }

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, document_fingerprint")
    .in("id", documentIds)
    .eq("document_fingerprint", params.fingerprint);

  if (documentsError) {
    throw documentsError;
  }

  const matchingDocumentIds = new Set((documents ?? []).map((document) => String(document.id)));
  const matchingScan = scans.find((scan) => matchingDocumentIds.has(String(scan.contract_document_id)));

  if (!matchingScan) {
    return null;
  }

  const [{ data: findings, error: findingsError }, { data: obligations, error: obligationsError }] =
    await Promise.all([
      supabase
        .from("contract_scan_findings")
        .select("severity, title, summary, implication, recommended_action, citation")
        .eq("scan_id", matchingScan.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("contract_obligations")
        .select("category, title, due_rule, submission_path, notice_period_days, citation")
        .eq("scan_id", matchingScan.id)
        .order("created_at", { ascending: true }),
    ]);

  if (findingsError) {
    throw findingsError;
  }

  if (obligationsError) {
    throw obligationsError;
  }

  return {
    sourceScanId: String(matchingScan.id),
    extraction: mapCompletedScanToExtraction({
      summary: (matchingScan.summary ?? {}) as Record<string, unknown>,
      findings: (findings ?? []) as Array<Record<string, unknown>>,
      obligations: (obligations ?? []) as Array<Record<string, unknown>>,
    }),
  };
}
