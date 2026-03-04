import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fapp%2Fvault&message=Log+in+to+open+your+vault+and+upload+documents.");
  }

  redirect("/app/vault");
}
