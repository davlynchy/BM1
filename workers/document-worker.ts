import { randomUUID } from "node:crypto";

import { failJob, claimNextJob, completeJob, requeueStaleJobs } from "@/lib/jobs/queue";
import { updateDocumentStatus } from "@/lib/jobs/documents";
import { failScanForDocument, queueScanForDocument } from "@/lib/jobs/scans";
import { log } from "@/lib/logger";
import { runDocumentJob } from "@/lib/jobs/worker";
import type { DocumentJobPayload, JobType } from "@/types/ingestion";

const POLL_INTERVAL_MS = 2000;
const STALE_JOB_SWEEP_INTERVAL = 30;

async function tick(workerId: string) {
  const job = await claimNextJob(workerId);

  if (!job) {
    return false;
  }

  try {
    await runDocumentJob(job.job_type as JobType, job.payload as DocumentJobPayload);
    await completeJob(job.id as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown job error";
    const payload = job.payload as DocumentJobPayload;

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

    if (job.job_type === "scan.extract" && payload.documentId) {
      const nextStatus = await failJob(job.id as string, message);

      if (nextStatus === "queued") {
        await queueScanForDocument(payload.documentId, message);
      } else {
        await failScanForDocument(payload.documentId, message);
      }

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
