import { notFound } from "next/navigation";

import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";
import { ProjectPageShell } from "@/components/projects/project-page-shell";
import { loadAssistantWorkspaceInitialState } from "@/lib/assistant/workspace-v1";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectAssistantPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ threadId?: string; emailId?: string; todoId?: string; prompt?: string }>;
}) {
  const { projectId } = await params;
  const { threadId, emailId, todoId, prompt } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const initialState = await loadAssistantWorkspaceInitialState({
    projectId,
    userId: user.id,
    threadId,
  });

  let initialPrompt: string | null = null;

  if (prompt?.trim()) {
    initialPrompt = prompt.trim();
  } else if (emailId) {
    const { data: email } = await supabase
      .from("project_correspondence")
      .select("subject, sender, body_text")
      .eq("id", emailId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (email) {
      initialPrompt = `Review this email and draft a commercially strong response.\nSubject: ${email.subject || "(No subject)"}\nFrom: ${email.sender || "Unknown"}\n\n${email.body_text || ""}`;
    }
  } else if (todoId) {
    const { data: todo } = await supabase
      .from("project_todos")
      .select("title, summary")
      .eq("id", todoId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (todo) {
      initialPrompt = `Help me action this task:\n${todo.title}\n\n${todo.summary || ""}`;
    }
  }

  return (
    <ProjectPageShell title="AI Assistant">
      <AssistantWorkspace
        initialPrompt={initialPrompt}
        initialState={initialState}
        projectId={projectId}
      />
    </ProjectPageShell>
  );
}
