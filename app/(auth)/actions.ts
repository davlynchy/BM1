"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ensureUserWorkspace } from "@/lib/auth/workspace";
import { attachIntakeSessionToWorkspace, readIntakeSessionCookie } from "@/lib/intake/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMutableServerClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  next: z.string().optional(),
  intakeSessionId: z.string().uuid().optional(),
});

const signUpSchema = z.object({
  companyName: z.string().min(2).max(120),
  email: z.email(),
  password: z.string().min(8),
  next: z.string().optional(),
  intakeSessionId: z.string().uuid().optional(),
});

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getSafeRedirectPath(next: string | undefined, intakeSessionId?: string) {
  if (intakeSessionId) {
    return `/app/intake/${intakeSessionId}`;
  }

  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  return "/app";
}

async function resolveIntakeSessionId(formData: FormData, key: string) {
  return getString(formData, key) || (await readIntakeSessionCookie()) || undefined;
}

export async function signInAction(formData: FormData) {
  const intakeSessionId = await resolveIntakeSessionId(formData, "intakeSessionId");
  const parsed = signInSchema.safeParse({
    email: getString(formData, "email"),
    password: getString(formData, "password"),
    next: getString(formData, "next") || undefined,
    intakeSessionId,
  });

  if (!parsed.success) {
    redirect("/login?message=Enter+a+valid+email+and+password.");
  }

  const supabase = await createMutableServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    redirect(`/login?message=${encodeURIComponent(error?.message ?? "Unable to create session.")}`);
  }

  const companyId = await ensureUserWorkspace();

  if (parsed.data.intakeSessionId) {
    await attachIntakeSessionToWorkspace({
      sessionId: parsed.data.intakeSessionId,
      userId: data.user.id,
      companyId,
    });
  }

  redirect(getSafeRedirectPath(parsed.data.next, parsed.data.intakeSessionId) as never);
}

export async function signUpAction(formData: FormData) {
  const intakeSessionId = await resolveIntakeSessionId(formData, "intakeSessionId");
  const parsed = signUpSchema.safeParse({
    companyName: getString(formData, "companyName"),
    email: getString(formData, "email"),
    password: getString(formData, "password"),
    next: getString(formData, "next") || undefined,
    intakeSessionId,
  });

  if (!parsed.success) {
    redirect("/signup?message=Enter+valid+account+details.");
  }

  const admin = createAdminClient();
  const { error: createUserError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      company_name: parsed.data.companyName,
      full_name: parsed.data.companyName,
    },
  });

  if (createUserError) {
    redirect(`/signup?message=${encodeURIComponent(createUserError.message)}`);
  }

  const supabase = await createMutableServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    redirect(`/signup?message=${encodeURIComponent(error?.message ?? "Unable to create session.")}`);
  }

  const companyId = await ensureUserWorkspace(parsed.data.companyName);

  if (parsed.data.intakeSessionId) {
    await attachIntakeSessionToWorkspace({
      sessionId: parsed.data.intakeSessionId,
      userId: data.user.id,
      companyId,
    });
  }

  redirect(getSafeRedirectPath(parsed.data.next, parsed.data.intakeSessionId) as never);
}

export async function signOutAction() {
  const supabase = await createMutableServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
