import { analyzeCorrespondence } from "@/lib/correspondence/analyze";
import {
  failCorrespondenceAnalysis,
  loadCorrespondenceByDocument,
  markCorrespondenceAnalyzing,
  updateCorrespondenceAnalysis,
} from "@/lib/correspondence/store";
import { syncCorrespondenceTodo } from "@/lib/todos/sync";
import type { DocumentJobPayload } from "@/types/ingestion";

export async function handleCorrespondenceAnalyzeJob(payload: DocumentJobPayload) {
  const correspondence = await loadCorrespondenceByDocument(payload.documentId);

  if (!correspondence) {
    return;
  }

  try {
    await markCorrespondenceAnalyzing(payload.documentId);

    const analysis = await analyzeCorrespondence({
      subject: String(correspondence.subject ?? ""),
      sender: String(correspondence.sender ?? ""),
      bodyText: String(correspondence.body_text ?? ""),
    });

    await updateCorrespondenceAnalysis({
      correspondenceId: String(correspondence.id),
      analysis,
    });

    await syncCorrespondenceTodo({
      companyId: String(correspondence.company_id),
      projectId: correspondence.project_id ? String(correspondence.project_id) : null,
      correspondenceId: String(correspondence.id),
      analysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Correspondence analysis failed.";
    await failCorrespondenceAnalysis({
      documentId: payload.documentId,
      errorMessage: message,
    });
    throw error;
  }
}
