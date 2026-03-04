import { Badge } from "@/components/ui/badge";
import type { AssistantRunRecord } from "@/types/assistant";

export function RunStatusCard({ run }: { run: AssistantRunRecord }) {
  return (
    <div className="rounded-xl border border-border bg-bg p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{run.mode}</Badge>
          <Badge variant={run.status === "failed" ? "default" : "outline"}>{run.status}</Badge>
        </div>
        {run.requestedOutputType ? (
          <Badge variant="outline">{run.requestedOutputType}</Badge>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted">
        {run.currentStage ?? (run.status === "completed" ? "Answer ready" : "Pending")}
      </p>
      {run.error ? <p className="mt-2 text-sm text-muted">{run.error}</p> : null}
    </div>
  );
}
