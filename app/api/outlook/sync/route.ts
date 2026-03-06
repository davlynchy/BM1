import { NextResponse } from "next/server";

import { decideEmailProject } from "@/lib/outlook/routing";
import { createMutableServerClient } from "@/lib/supabase/server";

type GraphMessage = {
  id: string;
  internetMessageId?: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  from?: { emailAddress?: { address?: string } };
  toRecipients?: Array<{ emailAddress?: { address?: string } }>;
  hasAttachments?: boolean;
};

export async function POST() {
  const supabase = await createMutableServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_company_id")
    .eq("id", user.id)
    .single();
  const companyId = profile?.default_company_id;

  if (!companyId) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 400 });
  }

  const { data: account } = await supabase
    .from("outlook_accounts")
    .select("id, access_token, status")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account?.access_token || account.status !== "connected") {
    return NextResponse.json({ error: "Outlook account is not connected." }, { status: 400 });
  }

  const graphResponse = await fetch(
    "https://graph.microsoft.com/v1.0/me/messages?$top=25&$select=id,internetMessageId,conversationId,subject,bodyPreview,receivedDateTime,from,toRecipients,hasAttachments",
    {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
      },
    },
  );

  if (!graphResponse.ok) {
    return NextResponse.json({ error: "Unable to sync Outlook messages." }, { status: 400 });
  }

  const graphPayload = (await graphResponse.json()) as { value?: GraphMessage[] };
  const messages = graphPayload.value ?? [];

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("company_id", companyId);
  const projectCandidates = (projects ?? []).map((project) => ({
    id: String(project.id),
    name: String(project.name),
  }));

  let routed = 0;
  let needsReview = 0;

  for (const message of messages) {
    const sender = message.from?.emailAddress?.address ?? "";
    const subject = message.subject ?? "";
    const bodyPreview = message.bodyPreview ?? "";
    const decision = decideEmailProject({
      sender,
      subject,
      bodyPreview,
      projects: projectCandidates,
    });

    const projectId = decision.routingStatus === "auto_assigned" ? decision.projectId : null;
    if (projectId) {
      routed += 1;
    } else {
      needsReview += 1;
    }

    await supabase.from("outlook_messages_raw").upsert(
      {
        company_id: companyId,
        account_id: account.id,
        microsoft_message_id: message.id,
        internet_message_id: message.internetMessageId ?? null,
        conversation_id: message.conversationId ?? null,
        sender,
        recipients: (message.toRecipients ?? [])
          .map((recipient) => recipient.emailAddress?.address)
          .filter(Boolean),
        subject,
        body_preview: bodyPreview,
        received_at: message.receivedDateTime ?? null,
        has_attachments: Boolean(message.hasAttachments),
      },
      { onConflict: "account_id,microsoft_message_id" },
    );

    const { data: existing } = await supabase
      .from("project_correspondence")
      .select("id")
      .eq("company_id", companyId)
      .eq("internet_message_id", message.internetMessageId ?? "")
      .maybeSingle();

    const payload = {
      company_id: companyId,
      project_id: projectId,
      assigned_project_id: decision.projectId,
      source: "outlook_sync",
      routing_status: decision.routingStatus,
      routing_confidence: decision.confidence,
      routing_reasons: decision.reasons,
      internet_message_id: message.internetMessageId ?? null,
      conversation_id: message.conversationId ?? null,
      sender,
      subject,
      body_text: bodyPreview,
      received_at: message.receivedDateTime ?? null,
      metadata: {
        toRecipients: (message.toRecipients ?? [])
          .map((recipient) => recipient.emailAddress?.address)
          .filter(Boolean),
        suggestions: decision.suggestions,
      },
    };

    if (existing?.id) {
      await supabase.from("project_correspondence").update(payload).eq("id", existing.id);
    } else {
      const { data: inserted } = await supabase
        .from("project_correspondence")
        .insert(payload)
        .select("id")
        .single();

      if (inserted?.id) {
        await supabase.from("email_routing_events").insert({
          company_id: companyId,
          correspondence_id: inserted.id,
          predicted_project_id: decision.projectId,
          confidence: decision.confidence,
          routing_status: decision.routingStatus,
          reasons: decision.reasons,
        });
      }
    }
  }

  await supabase
    .from("outlook_sync_cursors")
    .upsert(
      {
        company_id: companyId,
        account_id: account.id,
        cursor_type: "recent_sync",
        cursor_value: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "account_id,cursor_type" },
    );

  return NextResponse.json({
    success: true,
    messageCount: messages.length,
    routed,
    needsReview,
  });
}
