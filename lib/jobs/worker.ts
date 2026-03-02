import { handleDocumentChunkJob } from "@/lib/jobs/handlers/document-chunk";
import { handleCorrespondenceAnalyzeJob } from "@/lib/jobs/handlers/correspondence-analyze";
import { handleDocumentEmbedJob } from "@/lib/jobs/handlers/document-embed";
import { handleDocumentParseJob } from "@/lib/jobs/handlers/document-parse";
import { handleScanExtractJob } from "@/lib/jobs/handlers/scan-extract";
import type { DocumentJobPayload, JobType } from "@/types/ingestion";

export async function runDocumentJob(jobType: JobType, payload: DocumentJobPayload) {
  switch (jobType) {
    case "document.parse":
      await handleDocumentParseJob(payload);
      return;
    case "document.chunk":
      await handleDocumentChunkJob(payload);
      return;
    case "document.embed":
      await handleDocumentEmbedJob(payload);
      return;
    case "scan.extract":
      await handleScanExtractJob(payload);
      return;
    case "correspondence.analyze":
      await handleCorrespondenceAnalyzeJob(payload);
      return;
    default:
      throw new Error(`Unsupported job type: ${jobType}`);
  }
}
