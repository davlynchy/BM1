import { NextResponse } from "next/server";

import { insertAssistantMessage, loadAssistantMessages } from "@/lib/assistant/store";
import { canAccessFullReport } from "@/lib/billing/entitlements";
import { answerContractReviewQuestion } from "@/lib/scans/respond";
import { getContractReviewThread } from "@/lib/scans/review-thread";
import { retrieveScanSources } from "@/lib/scans/retrieval";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ scanId: string }> },
) {
  try {
    const { scanId } = await params;
    const body = (await request.json()) as { message?: string };
    const message = String(body.message ?? "").trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data: scan, error } = await supabase
      .from("contract_scans")
      .select("id, company_id, project_id, contract_document_id, is_free_preview")
      .eq("id", scanId)
      .maybeSingle();

    if (error || !scan || !scan.contract_document_id || !scan.project_id) {
      return NextResponse.json({ error: "Scan not found." }, { status: 404 });
    }

    const hasFullAccess = await canAccessFullReport(String(scan.company_id), Boolean(scan.is_free_preview));

    if (!hasFullAccess) {
      return NextResponse.json({ error: "Upgrade the workspace to ask follow-up questions." }, { status: 402 });
    }

    const thread = await getContractReviewThread(scanId);
    if (!thread) {
      return NextResponse.json({ error: "Review thread not found." }, { status: 404 });
    }

    const userMessage = await insertAssistantMessage({
      threadId: String(thread.id),
      companyId: String(scan.company_id),
      role: "user",
      content: message,
      metadata: {
        messageType: "assistant_followup",
        scanId,
      },
    });

    const priorMessages = await loadAssistantMessages(String(thread.id));
    const sources = await retrieveScanSources({
      companyId: String(scan.company_id),
      projectId: String(scan.project_id),
      scanId,
      documentId: String(scan.contract_document_id),
      question: message,
    });
    const reply = await answerContractReviewQuestion({
      question: message,
      messages: priorMessages,
      sources,
    });

    const assistantMessage = await insertAssistantMessage({
      threadId: String(thread.id),
      companyId: String(scan.company_id),
      role: "assistant",
      content: reply.answer,
      citations: reply.citations,
      metadata: {
        messageType: "assistant_followup",
        scanId,
        isPartial: false,
      },
    });

    return NextResponse.json({
      messages: [userMessage, assistantMessage],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to answer review question.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
