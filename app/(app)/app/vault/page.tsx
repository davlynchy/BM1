import { redirect } from "next/navigation";

import { getRecentProjectForUser } from "@/lib/projects/workbench";

export default async function VaultRedirectPage() {
  const project = await getRecentProjectForUser();

  if (!project) {
    redirect("/app/projects?message=Create+a+project+to+open+your+vault.");
  }

  redirect(`/app/projects/${project.id}/vault`);
}
