import { handleDocumentChunkJob } from "@/lib/jobs/handlers/document-chunk";
import { handleCorrespondenceAnalyzeJob } from "@/lib/jobs/handlers/correspondence-analyze";
import { handleDocumentEmbedJob } from "@/lib/jobs/handlers/document-embed";
import { handleDocumentParseJob } from "@/lib/jobs/handlers/document-parse";
import { handleScanDeepExtractJob } from "@/lib/jobs/handlers/scan-deep-extract";
import { handleScanQuickExtractJob } from "@/lib/jobs/handlers/scan-quick-extract";
import { handleAssistantQuickAnswerJob } from "@/lib/jobs/handlers/assistant-quick-answer";
import type { AssistantJobPayload, DocumentJobPayload, JobPayload, JobType } from "@/types/ingestion";

export async function runDocumentJob(jobType: JobType, payload: JobPayload) {
  switch (jobType) {
    case "document.parse":
      await handleDocumentParseJob(payload as DocumentJobPayload);
      return;
    case "document.chunk":
      await handleDocumentChunkJob(payload as DocumentJobPayload);
      return;
    case "document.embed":
      await handleDocumentEmbedJob(payload as DocumentJobPayload);
      return;
    case "scan.quick_extract":
      await handleScanQuickExtractJob(payload as DocumentJobPayload);
      return;
    case "scan.deep_extract":
      await handleScanDeepExtractJob(payload as DocumentJobPayload);
      return;
    case "correspondence.analyze":
      await handleCorrespondenceAnalyzeJob(payload as DocumentJobPayload);
      return;
    case "assistant.quick_answer":
      await handleAssistantQuickAnswerJob(payload as AssistantJobPayload);
      return;
    case "assistant.deep_answer":
      await handleAssistantQuickAnswerJob(payload as AssistantJobPayload);
      return;
    default:
      throw new Error(`Unsupported job type: ${jobType}`);
  }
}
