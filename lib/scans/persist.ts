import { createAdminClient } from "@/lib/supabase/admin";
import type { ContractScanExtraction } from "@/types/scans";

export async function updateContractScanStatus(params: {
  scanId: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  summary?: Record<string, unknown>;
  processingError?: string | null;
  promptVersion?: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("contract_scans")
    .update({
      status: params.status,
      summary: params.summary,
      processing_error: params.processingError ?? null,
      prompt_version: params.promptVersion ?? null,
      completed_at: params.status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", params.scanId);

  if (error) {
    throw error;
  }
}

export async function replaceContractScanOutputs(params: {
  scanId: string;
  companyId: string;
  extraction: ContractScanExtraction;
}) {
  const supabase = createAdminClient();

  const { error: deleteFindingsError } = await supabase
    .from("contract_scan_findings")
    .delete()
    .eq("scan_id", params.scanId);

  if (deleteFindingsError) {
    throw deleteFindingsError;
  }

  const { error: deleteObligationsError } = await supabase
    .from("contract_obligations")
    .delete()
    .eq("scan_id", params.scanId);

  if (deleteObligationsError) {
    throw deleteObligationsError;
  }

  const { error: findingsError } = await supabase
    .from("contract_scan_findings")
    .insert(
      params.extraction.findings.map((finding) => ({
        scan_id: params.scanId,
        company_id: params.companyId,
        severity: finding.severity,
        title: finding.title,
        summary: finding.summary,
        implication: finding.implication,
        recommended_action: finding.recommendedAction,
        citation: finding.citation,
      })),
    );

  if (findingsError) {
    throw findingsError;
  }

  const { error: obligationsError } = await supabase
    .from("contract_obligations")
    .insert(
      params.extraction.obligations.map((obligation) => ({
        scan_id: params.scanId,
        company_id: params.companyId,
        category: obligation.category,
        title: obligation.title,
        due_rule: obligation.dueRule,
        submission_path: obligation.submissionPath,
        notice_period_days: obligation.noticePeriodDays,
        citation: obligation.citation,
      })),
    );

  if (obligationsError) {
    throw obligationsError;
  }
}
