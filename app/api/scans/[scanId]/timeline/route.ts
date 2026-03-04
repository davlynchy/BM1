import { NextResponse } from "next/server";

import { loadAssistantMessages } from "@/lib/assistant/store";
import { canAccessFullReport } from "@/lib/billing/entitlements";
import { getContractReviewThread } from "@/lib/scans/review-thread";
import { createClient } from "@/lib/supabase/server";

function visibleFindingsCount(isLockedPreview: boolean) {
  return isLockedPreview ? 3 : Number.POSITIVE_INFINITY;
}

function visibleObligationsCount(isLockedPreview: boolean) {
  return isLockedPreview ? 2 : Number.POSITIVE_INFINITY;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scanId: string }> },
) {
  try {
    const { scanId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data: scan, error } = await supabase
      .from("contract_scans")
      .select("id, company_id, project_id, contract_document_id, status, is_free_preview, summary, processing_error")
      .eq("id", scanId)
      .maybeSingle();

    if (error || !scan) {
      return NextResponse.json({ error: "Scan not found." }, { status: 404 });
    }

    const hasFullAccess = await canAccessFullReport(String(scan.company_id), Boolean(scan.is_free_preview));
    const isLockedPreview = Boolean(scan.is_free_preview) && !hasFullAccess;
    const findingsLimit = visibleFindingsCount(isLockedPreview);
    const obligationsLimit = visibleObligationsCount(isLockedPreview);

    const thread = await getContractReviewThread(scanId);
    const messages = thread ? await loadAssistantMessages(String(thread.id)) : [];
    const [{ data: findings }, { data: obligations }, { data: document }, { data: project }] = await Promise.all([
      supabase
        .from("contract_scan_findings")
        .select("id, severity, title, summary, implication, recommended_action, citation")
        .eq("scan_id", scanId)
        .order("created_at", { ascending: true })
        .limit(Number.isFinite(findingsLimit) ? findingsLimit : 50),
      supabase
        .from("contract_obligations")
        .select("id, category, title, due_rule, submission_path, notice_period_days, citation")
        .eq("scan_id", scanId)
        .order("created_at", { ascending: true })
        .limit(Number.isFinite(obligationsLimit) ? obligationsLimit : 50),
      scan.contract_document_id
        ? supabase
            .from("documents")
            .select("id, name, parse_status")
            .eq("id", scan.contract_document_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      scan.project_id
        ? supabase.from("projects").select("id, name").eq("id", scan.project_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return NextResponse.json({
      scan,
      project,
      document,
      messages,
      findings: findings ?? [],
      obligations: obligations ?? [],
      isLockedPreview,
      hasFullAccess,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load review timeline.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
