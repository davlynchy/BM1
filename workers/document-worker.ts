import { randomUUID } from "node:crypto";

import { failJob, claimNextJob, completeJob, requeueStaleJobs } from "@/lib/jobs/queue";
import { updateDocumentStatus } from "@/lib/jobs/documents";
import { failScanForDocument, queueScanForDocument } from "@/lib/jobs/scans";
import { updateAssistantRun } from "@/lib/assistant/store";
import { log } from "@/lib/logger";
import { runDocumentJob } from "@/lib/jobs/worker";
import type { AssistantJobPayload, DocumentJobPayload, JobPayload, JobType } from "@/types/ingestion";

const POLL_INTERVAL_MS = 2000;
const STALE_JOB_SWEEP_INTERVAL = 30;

async function tick(workerId: string) {
  const job = await claimNextJob(workerId);

  if (!job) {
    return false;
  }

  try {
    await runDocumentJob(job.job_type as JobType, job.payload as JobPayload);
    await completeJob(job.id as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown job error";
    const payload = job.payload as JobPayload;

    if (
      job.document_id &&
      (job.job_type === "document.parse" ||
        job.job_type === "document.chunk" ||
        job.job_type === "document.embed")
    ) {
      await updateDocumentStatus({
        documentId: String(job.document_id),
        status: "failed",
        processingError: message,
      });
    }

    if (
      (job.job_type === "scan.quick_extract" || job.job_type === "scan.deep_extract") &&
      (payload as DocumentJobPayload).documentId
    ) {
      const nextStatus = await failJob(job.id as string, message);
      const documentPayload = payload as DocumentJobPayload;

      if (nextStatus === "queued") {
        await queueScanForDocument(documentPayload.documentId, message);
      } else {
        await failScanForDocument(documentPayload.documentId, message);
      }

      return true;
    }

    if (job.job_type === "assistant.quick_answer" || job.job_type === "assistant.deep_answer") {
      const nextStatus = await failJob(job.id as string, message);
      const assistantPayload = payload as AssistantJobPayload;

      await updateAssistantRun({
        runId: assistantPayload.runId,
        status: nextStatus === "queued" ? "queued" : "failed",
        currentStage: nextStatus === "queued" ? "retrying" : "failed",
        error: message,
      });

      return true;
    }

    await failJob(job.id as string, message);
  }

  return true;
}

async function main() {
  const workerId = `worker:${randomUUID()}`;
  let idleLoops = 0;

  for (;;) {
    if (idleLoops % STALE_JOB_SWEEP_INTERVAL === 0) {
      const recoveredJobs = await requeueStaleJobs();

      if (recoveredJobs.length) {
        log("warn", "Recovered stale jobs", {
          workerId,
          recoveredJobCount: recoveredJobs.length,
          recoveredJobIds: recoveredJobs.map((job) => job.id),
        });
      }
    }

    const foundJob = await tick(workerId);

    if (!foundJob) {
      idleLoops += 1;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    } else {
      idleLoops = 0;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
