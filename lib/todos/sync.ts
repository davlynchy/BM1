import { createAdminClient } from "@/lib/supabase/admin";
import type { CorrespondenceAnalysis } from "@/lib/correspondence/schema";
import type { ContractScanExtraction } from "@/types/scans";

export async function syncScanTodos(params: {
  companyId: string;
  projectId: string | null;
  scanId: string;
  extraction: ContractScanExtraction;
}) {
  if (!params.projectId) {
    return;
  }

  const supabase = createAdminClient();
  await supabase
    .from("project_todos")
    .delete()
    .eq("project_id", params.projectId)
    .eq("source_type", "contract_scan")
    .like("source_ref", `${params.scanId}:%`);

  const todos = params.extraction.findings
    .filter((finding) => finding.severity === "high" || finding.severity === "medium")
    .map((finding, index) => ({
      company_id: params.companyId,
      project_id: params.projectId,
      source_type: "contract_scan",
      source_ref: `${params.scanId}:finding:${index}`,
      title: finding.title,
      summary: `${finding.summary}\n\nImplication: ${finding.implication}\nRecommended action: ${finding.recommendedAction}`,
      priority: finding.severity === "high" ? "high" : "medium",
      metadata: {
        citation: finding.citation,
      },
    }));

  if (!todos.length) {
    return;
  }

  const { error } = await supabase.from("project_todos").insert(todos);

  if (error) {
    throw error;
  }
}

export async function syncCorrespondenceTodo(params: {
  companyId: string;
  projectId: string | null;
  correspondenceId: string;
  analysis: CorrespondenceAnalysis;
}) {
  if (!params.projectId) {
    return;
  }

  const supabase = createAdminClient();
  await supabase
    .from("project_todos")
    .delete()
    .eq("project_id", params.projectId)
    .eq("source_type", "correspondence")
    .eq("source_ref", params.correspondenceId);

  if (!params.analysis.actionRequired) {
    return;
  }

  const { error } = await supabase.from("project_todos").insert({
    company_id: params.companyId,
    project_id: params.projectId,
    source_type: "correspondence",
    source_ref: params.correspondenceId,
    title: params.analysis.recommendedTitle,
    summary: `${params.analysis.summary}\n\nRecommended action: ${params.analysis.recommendedAction}`,
    priority: params.analysis.priority,
    metadata: {
      sourceSignals: params.analysis.sourceSignals,
    },
  });

  if (error) {
    throw error;
  }
}
