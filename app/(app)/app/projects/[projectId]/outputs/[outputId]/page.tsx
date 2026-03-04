import { notFound } from "next/navigation";

import { OutputEditor } from "@/components/outputs/output-editor";
import { ProjectWorkbenchNav } from "@/components/projects/project-workbench-nav";
import { getProjectOutput, listProjectOutputVersions } from "@/lib/outputs/store";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectOutputPage({
  params,
}: {
  params: Promise<{ projectId: string; outputId: string }>;
}) {
  const { projectId, outputId } = await params;
  const supabase = await createClient();
  const [{ data: project }, output, versions] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle(),
    getProjectOutput(outputId, projectId),
    listProjectOutputVersions(outputId),
  ]);

  if (!project || !output) {
    notFound();
  }

  return (
    <main className="space-y-6">
      <ProjectWorkbenchNav active="assistant" projectId={projectId} projectName={String(project.name)} />
      <OutputEditor initialOutput={output} projectId={projectId} versions={versions} />
    </main>
  );
}
