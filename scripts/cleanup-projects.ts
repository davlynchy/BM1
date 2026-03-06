import fs from "node:fs";
import { createAdminClient } from "@/lib/supabase/admin";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) {
    return;
  }

  const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function cleanupProject(projectId: string, companyId: string) {
  const supabase = createAdminClient();

  await supabase.from("project_output_versions").delete().eq("project_id", projectId);
  await supabase.from("project_outputs").delete().eq("project_id", projectId);
  await supabase.from("assistant_runs").delete().eq("project_id", projectId);

  const { data: threads } = await supabase
    .from("assistant_threads")
    .select("id")
    .eq("project_id", projectId);
  const threadIds = (threads ?? []).map((thread) => String(thread.id));

  if (threadIds.length > 0) {
    await supabase.from("assistant_messages").delete().in("thread_id", threadIds);
    await supabase.from("assistant_thread_sources").delete().in("thread_id", threadIds);
  }

  await supabase.from("assistant_threads").delete().eq("project_id", projectId);
  await supabase.from("jobs").delete().eq("project_id", projectId);
  await supabase.from("document_chunks").delete().eq("project_id", projectId);

  const { data: docs } = await supabase
    .from("documents")
    .select("id")
    .eq("project_id", projectId);
  const docIds = (docs ?? []).map((document) => String(document.id));

  if (docIds.length > 0) {
    await supabase.from("document_pages").delete().in("document_id", docIds);
  }

  await supabase.from("documents").delete().eq("project_id", projectId);
  await supabase.from("project_correspondence").delete().eq("project_id", projectId);
  await supabase.from("project_todos").delete().eq("project_id", projectId);
  await supabase.from("contract_scan_findings").delete().eq("company_id", companyId);
  await supabase.from("contract_obligations").delete().eq("company_id", companyId);
  await supabase.from("contract_scans").delete().eq("project_id", projectId);
  await supabase.from("projects").delete().eq("id", projectId);
}

async function main() {
  loadEnvLocal();

  const removeAll = process.argv.includes("--all");
  const supabase = createAdminClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, company_id, name")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const candidates = (projects ?? []).filter((project) => {
    if (removeAll) {
      return true;
    }
    return /^smoke\b/i.test(project.name ?? "");
  });

  for (const project of candidates) {
    await cleanupProject(String(project.id), String(project.company_id));
  }

  console.log(
    JSON.stringify({
      ok: true,
      removedCount: candidates.length,
      mode: removeAll ? "all" : "smoke",
      removedProjectNames: candidates.map((project) => project.name),
    }),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }),
  );
  process.exit(1);
});
