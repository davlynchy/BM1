import { redirect } from "next/navigation";

import { IntakeSessionPage } from "@/components/intake/intake-session-page";
import { getOwnedIntakeSession } from "@/lib/intake/session";
import { createClient } from "@/lib/supabase/server";

export default async function IntakeSessionRoute({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?intakeSessionId=${encodeURIComponent(sessionId)}`);
  }

  const session = await getOwnedIntakeSession({
    sessionId,
    userId: user.id,
  });

  if (!session) {
    redirect("/upload?message=Your+upload+session+expired.+Please+select+the+contract+again.");
  }

  if (session.scan_id) {
    redirect(`/scan/${session.scan_id}`);
  }

  if (new Date(session.expires_at).getTime() < Date.now() || session.status === "expired") {
    redirect("/upload?message=Your+upload+session+expired.+Please+select+the+contract+again.");
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .eq("company_id", session.company_id)
    .order("created_at", { ascending: false });

  return (
    <IntakeSessionPage
      projects={(projects ?? []).map((project) => ({
        id: project.id,
        name: project.name,
        createdAt: project.created_at,
      }))}
      session={session}
    />
  );
}
