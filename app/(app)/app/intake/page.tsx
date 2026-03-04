import { redirect } from "next/navigation";

import { getLatestActiveIntakeSessionForUser } from "@/lib/intake/session";
import { createClient } from "@/lib/supabase/server";

export default async function IntakePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activeSession = await getLatestActiveIntakeSessionForUser(user.id);

  if (!activeSession) {
    redirect("/upload?message=Upload+a+contract+to+start+your+scan.");
  }

  redirect(`/app/intake/${activeSession.id}`);
}
