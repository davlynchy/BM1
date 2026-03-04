import { createAdminClient } from "@/lib/supabase/admin";

export type CorrespondenceProjectContext = {
  executiveSummary?: string;
  negotiationPoints: string[];
  topRisks: string[];
  obligations: string[];
};

export async function loadCorrespondenceProjectContext(
  projectId: string | null,
): Promise<CorrespondenceProjectContext | null> {
  if (!projectId) {
    return null;
  }

  const supabase = createAdminClient();
  const { data: scan } = await supabase
    .from("contract_scans")
    .select("id, summary, status")
    .eq("project_id", projectId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!scan?.id) {
    return null;
  }

  const [{ data: findings }, { data: obligations }] = await Promise.all([
    supabase
      .from("contract_scan_findings")
      .select("title, summary")
      .eq("scan_id", scan.id)
      .order("created_at", { ascending: true })
      .limit(5),
    supabase
      .from("contract_obligations")
      .select("title, due_rule")
      .eq("scan_id", scan.id)
      .order("created_at", { ascending: true })
      .limit(5),
  ]);

  const summary =
    scan.summary && typeof scan.summary === "object"
      ? (scan.summary as Record<string, unknown>)
      : {};

  return {
    executiveSummary:
      typeof summary.executiveSummary === "string" ? summary.executiveSummary : undefined,
    negotiationPoints: Array.isArray(summary.negotiationPoints)
      ? summary.negotiationPoints.map((item) => String(item))
      : [],
    topRisks: (findings ?? []).map((finding) => `${finding.title}: ${finding.summary}`),
    obligations: (obligations ?? []).map((obligation) => `${obligation.title}: ${obligation.due_rule}`),
  };
}
