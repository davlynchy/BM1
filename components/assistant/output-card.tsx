"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectOutputRecord } from "@/types/outputs";

export function OutputCard({
  output,
  projectId,
}: {
  output: ProjectOutputRecord;
  projectId: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-text">{output.title}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">{output.type}</Badge>
            <Badge variant="outline">v{output.version}</Badge>
          </div>
        </div>
        <Button asChild size="sm" variant="secondary">
          <Link href={`/app/projects/${projectId}/outputs/${output.id}`}>Open</Link>
        </Button>
      </div>
      <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-muted">{output.body}</p>
    </div>
  );
}
