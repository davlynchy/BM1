"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ensureUserWorkspace } from "@/lib/auth/workspace";
import { getEnv } from "@/lib/env";
import { readPendingScanCookie } from "@/lib/intake/pending-scan";
import { createClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  next: z.string().optional(),
});

const signUpSchema = z.object({
  companyName: z.string().min(2).max(120),
  email: z.email(),
  password: z.string().min(8),
  next: z.string().optional(),
});

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getSafeRedirectPath(next: string | undefined, hasPendingScan: boolean) {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  return hasPendingScan ? "/app/intake" : "/app";
}

export async function signInAction(formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: getString(formData, "email"),
    password: getString(formData, "password"),
    next: getString(formData, "next") || undefined,
  });

  if (!parsed.success) {
    redirect("/login?message=Enter+a+valid+email+and+password.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  await ensureUserWorkspace();

  const pendingScan = await readPendingScanCookie();
  redirect(getSafeRedirectPath(parsed.data.next, Boolean(pendingScan)) as never);
}

export async function signUpAction(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    companyName: getString(formData, "companyName"),
    email: getString(formData, "email"),
    password: getString(formData, "password"),
    next: getString(formData, "next") || undefined,
  });

  if (!parsed.success) {
    redirect("/signup?message=Enter+valid+account+details.");
  }

  const supabase = await createClient();
  const env = getEnv();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      data: {
        company_name: parsed.data.companyName,
        full_name: parsed.data.companyName,
      },
    },
  });

  if (error) {
    redirect(`/signup?message=${encodeURIComponent(error.message)}`);
  }

  if (data.session) {
    await ensureUserWorkspace(parsed.data.companyName);
    const pendingScan = await readPendingScanCookie();
    redirect(getSafeRedirectPath(parsed.data.next, Boolean(pendingScan)) as never);
  }

  const next = encodeURIComponent(parsed.data.next || "/app");
  redirect(`/login?message=Check+your+email+to+complete+sign+up.&next=${next}`);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
