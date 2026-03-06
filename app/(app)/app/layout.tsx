import { redirect } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";
import { WorkbenchSidebar } from "@/components/app/workbench-sidebar";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const workspace = await getActiveWorkspace();

  if (!workspace?.company) {
    redirect("/signup?message=Finish+setting+up+your+workspace.");
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status")
    .eq("company_id", workspace.company.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="min-h-screen bg-bg">
      <div className="grid gap-6 px-4 py-4 lg:grid-cols-[auto_1fr]">
        <div className="flex h-[calc(100vh-2rem)] flex-col">
          <WorkbenchSidebar
            companyName={workspace.company.name}
            userDisplayName={
              workspace.profile?.full_name?.trim() ||
              workspace.profile?.email?.split("@")[0] ||
              "User"
            }
            projects={(projects ?? []).map((project) => ({
              id: String(project.id),
              name: String(project.name),
              status: project.status ? String(project.status) : null,
            }))}
            signOutAction={signOutAction}
          />
        </div>
        <div className="py-2">{children}</div>
      </div>
    </div>
  );
}
