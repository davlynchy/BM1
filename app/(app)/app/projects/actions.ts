"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const createProjectSchema = z.object({
  name: z.string().min(2).max(160),
  contractValue: z.string().optional(),
  siteDueDate: z.string().optional(),
  claimSubmissionMethod: z.string().optional(),
  variationProcess: z.string().optional(),
  status: z.string().optional(),
});

const updateProjectSchema = createProjectSchema.extend({
  projectId: z.string().uuid(),
});

const deleteProjectSchema = z.object({
  projectId: z.string().uuid(),
});

const updateTodoStatusSchema = z.object({
  projectId: z.string().uuid(),
  todoId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "done", "dismissed"]),
});

const updateProjectStatusSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(["tender", "pre-construction", "construction", "post-construction"]),
});

const renameProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(2).max(160),
});

const updateProjectCardSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(2).max(160),
  status: z.enum(["tender", "pre-construction", "construction", "post-construction"]),
  siteDueDate: z.string().optional(),
});

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseOptionalCurrency(value: string) {
  if (!value) {
    return null;
  }

  const numeric = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

export async function createProjectAction(formData: FormData) {
  const parsed = createProjectSchema.safeParse({
    name: getString(formData, "name"),
    contractValue: getString(formData, "contractValue"),
    siteDueDate: getString(formData, "siteDueDate"),
    claimSubmissionMethod: getString(formData, "claimSubmissionMethod"),
    variationProcess: getString(formData, "variationProcess"),
    status: getString(formData, "status") || undefined,
  });

  if (!parsed.success) {
    redirect("/app?message=Enter+valid+project+details.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?message=Please+log+in+to+create+a+project.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_company_id")
    .eq("id", user.id)
    .single();

  if (!profile?.default_company_id) {
    redirect("/signup?message=Finish+creating+your+workspace+first.");
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      company_id: profile.default_company_id,
      name: parsed.data.name,
      status: parsed.data.status || "tender",
      contract_value: parseOptionalCurrency(parsed.data.contractValue ?? ""),
      site_due_date: parsed.data.siteDueDate || null,
      claim_submission_method: parsed.data.claimSubmissionMethod || null,
      variation_process: parsed.data.variationProcess || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !project) {
    redirect(`/app?message=${encodeURIComponent(error?.message ?? "Unable to create project.")}`);
  }

  redirect(`/app/projects/${project.id}`);
}

export async function updateProjectAction(formData: FormData) {
  const parsed = updateProjectSchema.safeParse({
    projectId: getString(formData, "projectId"),
    name: getString(formData, "name"),
    contractValue: getString(formData, "contractValue"),
    siteDueDate: getString(formData, "siteDueDate"),
    claimSubmissionMethod: getString(formData, "claimSubmissionMethod"),
    variationProcess: getString(formData, "variationProcess"),
    status: getString(formData, "status") || undefined,
  });

  if (!parsed.success) {
    redirect("/app/projects?message=Enter+valid+project+details.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name: parsed.data.name,
      status: parsed.data.status || "tender",
      contract_value: parseOptionalCurrency(parsed.data.contractValue ?? ""),
      site_due_date: parsed.data.siteDueDate || null,
      claim_submission_method: parsed.data.claimSubmissionMethod || null,
      variation_process: parsed.data.variationProcess || null,
    })
    .eq("id", parsed.data.projectId);

  if (error) {
    redirect(`/app/projects/${parsed.data.projectId}?message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/app/projects/${parsed.data.projectId}?message=Project+updated.`);
}

export async function deleteProjectAction(formData: FormData) {
  const parsed = deleteProjectSchema.safeParse({
    projectId: getString(formData, "projectId"),
  });

  if (!parsed.success) {
    redirect("/app/projects?message=Invalid+project+request.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", parsed.data.projectId);

  if (error) {
    redirect(`/app/projects/${parsed.data.projectId}?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/app/projects?message=Project+deleted.");
}

export async function updateTodoStatusAction(formData: FormData) {
  const parsed = updateTodoStatusSchema.safeParse({
    projectId: getString(formData, "projectId"),
    todoId: getString(formData, "todoId"),
    status: getString(formData, "status"),
  });

  if (!parsed.success) {
    redirect("/app/projects?message=Invalid+to-do+request.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_todos")
    .update({
      status: parsed.data.status,
    })
    .eq("id", parsed.data.todoId);

  if (error) {
    redirect(`/app/projects/${parsed.data.projectId}?message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/app/projects/${parsed.data.projectId}?message=To-do+updated.`);
}

export async function updateProjectStatusAction(formData: FormData) {
  const parsed = updateProjectStatusSchema.safeParse({
    projectId: getString(formData, "projectId"),
    status: getString(formData, "status"),
  });

  if (!parsed.success) {
    redirect("/app?message=Invalid+project+status+update.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      status: parsed.data.status,
    })
    .eq("id", parsed.data.projectId);

  if (error) {
    redirect(`/app?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/app?message=Project+status+updated.");
}

export async function renameProjectAction(formData: FormData) {
  const parsed = renameProjectSchema.safeParse({
    projectId: getString(formData, "projectId"),
    name: getString(formData, "name"),
  });

  if (!parsed.success) {
    redirect("/app?message=Invalid+project+name.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.projectId);

  if (error) {
    redirect(`/app?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/app?message=Project+renamed.");
}

export async function updateProjectCardAction(formData: FormData) {
  const parsed = updateProjectCardSchema.safeParse({
    projectId: getString(formData, "projectId"),
    name: getString(formData, "name"),
    status: getString(formData, "status"),
    siteDueDate: getString(formData, "siteDueDate"),
  });

  if (!parsed.success) {
    redirect("/app/projects?message=Invalid+project+details.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name: parsed.data.name,
      status: parsed.data.status,
      site_due_date: parsed.data.siteDueDate || null,
    })
    .eq("id", parsed.data.projectId);

  if (error) {
    redirect(`/app/projects?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/app/projects?message=Project+updated.");
}
