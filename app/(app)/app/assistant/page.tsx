import { redirect } from "next/navigation";

import { getRecentProjectForUser } from "@/lib/projects/workbench";

export default async function AssistantRedirectPage() {
  const project = await getRecentProjectForUser();

  if (!project) {
    redirect("/app/projects?message=Create+a+project+to+start+using+the+assistant.");
  }

  redirect(`/app/projects/${project.id}/assistant`);
}
