import { createClient } from "@/lib/supabase/server";

function slugifyCompanyName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function ensureUserWorkspace(preferredCompanyName?: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authenticated user is required.");
  }

  const { data: existingMembership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existingMembership?.company_id) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ default_company_id: existingMembership.company_id })
      .eq("id", user.id)
      .is("default_company_id", null);

    if (profileError) {
      throw profileError;
    }

    return existingMembership.company_id;
  }

  const companyName =
    preferredCompanyName ||
    user.user_metadata.company_name ||
    user.user_metadata.full_name ||
    "My Company";

  const baseSlug = slugifyCompanyName(companyName) || "company";
  let companyId: string | null = null;
  let lastCompanyError: string | null = null;

  for (let index = 0; index < 5; index += 1) {
    const candidateSlug = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        slug: candidateSlug,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (!companyError && company?.id) {
      companyId = company.id;
      break;
    }

    lastCompanyError = companyError?.message ?? "Company row was not returned after insert.";
  }

  if (!companyId) {
    throw new Error(`Unable to create company workspace. ${lastCompanyError ?? ""}`.trim());
  }

  const { error: memberError } = await supabase.from("company_members").insert({
    company_id: companyId,
    user_id: user.id,
    role: "owner",
    invited_by: user.id,
  });

  if (memberError) {
    throw memberError;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      default_company_id: companyId,
      full_name: user.user_metadata.full_name ?? "",
    })
    .eq("id", user.id);

  if (profileError) {
    throw profileError;
  }

  return companyId;
}

export async function getActiveWorkspace() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, default_company_id")
    .eq("id", user.id)
    .single();

  let companyId = profile?.default_company_id ?? null;

  if (!companyId) {
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    companyId = membership?.company_id ?? null;
  }

  if (!companyId) {
    return {
      profile: profile ?? null,
      company: null,
    };
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("id", companyId)
    .single();

  return {
    profile: profile ?? null,
    company: company ?? null,
  };
}
