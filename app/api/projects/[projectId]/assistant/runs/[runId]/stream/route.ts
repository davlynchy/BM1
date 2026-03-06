import { TextEncoder } from "node:util";

import { getOpenAIClient } from "@/lib/ai/client";
import { retrieveProjectSourcesV1 } from "@/lib/assistant/retrieval-v1";
import {
  getValidatedAssistantThread,
  insertAssistantMessage,
  listAssistantThreadSources,
  loadAssistantMessages,
  updateAssistantRun,
} from "@/lib/assistant/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProjectAccess } from "@/lib/projects/access";
import type { AssistantCitation } from "@/types/assistant";
import { createProjectOutput } from "@/lib/outputs/store";

const encoder = new TextEncoder();

function sse(event: string, payload: Record<string, unknown>) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function parseCitationNumbers(answer: string) {
  const matches = answer.match(/\[(\d+)\]/g) ?? [];
  const ids = new Set<number>();
  for (const match of matches) {
    const parsed = Number(match.replace(/\[|\]/g, ""));
    if (Number.isInteger(parsed) && parsed > 0) {
      ids.add(parsed);
    }
  }
  return Array.from(ids).sort((a, b) => a - b);
}

function buildPrompt(params: {
  question: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  sources: Array<AssistantCitation & { content: string }>;
}) {
  const recentConversation = params.messages
    .slice(-8)
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
    .join("\n");

  const context = params.sources
    .map(
      (source, index) =>
        [
          `[${index + 1}]`,
          `Document: ${source.documentName}`,
          `Page: ${source.page ?? "Unknown"}`,
          `Snippet: ${source.snippet}`,
          `Content: ${source.content}`,
        ].join("\n"),
    )
    .join("\n\n");

  return [
    "You are Bidmetric's grounded project assistant for construction subcontractors.",
    "Only answer using the provided evidence context.",
    "If evidence is missing, reply: I could not find this in the project documents.",
    "Every factual claim must include one or more citation tags like [1], [2].",
    "Be commercially practical and concise.",
    "Use this output structure:",
    "1) Short heading",
    "2) Key points as bullets",
    "3) Action steps as bullets",
    "4) Risks or caveats as bullets",
    "Do not include markdown tables.",
    "",
    "Conversation:",
    recentConversation || "None",
    "",
    "Question:",
    params.question,
    "",
    "Evidence:",
    context || "No evidence retrieved.",
  ].join("\n");
}

async function loadRunContext(params: { runId: string; projectId: string; userId: string }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_runs")
    .select("id, thread_id, status, metadata, project_id, company_id, created_by, mode, requested_output_type")
    .eq("id", params.runId)
    .eq("project_id", params.projectId)
    .single();

  if (error || !data) {
    throw error ?? new Error("Assistant run not found.");
  }

  await getValidatedAssistantThread({
    threadId: String(data.thread_id),
    companyId: String(data.company_id),
    projectId: String(data.project_id),
    userId: params.userId,
  });

  return {
    runId: String(data.id),
    threadId: String(data.thread_id),
    companyId: String(data.company_id),
    userId: data.created_by ? String(data.created_by) : params.userId,
    status: String(data.status),
    mode: String(data.mode),
    requestedOutputType: data.requested_output_type ? String(data.requested_output_type) : null,
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; runId: string }> },
) {
  const { projectId, runId } = await params;
  const { user, project } = await requireProjectAccess(projectId);
  const runContext = await loadRunContext({
    runId,
    projectId: String(project.id),
    userId: String(user.id),
  });

  const stream = new ReadableStream({
    async start(controller) {
      const close = () => {
        try {
          controller.close();
        } catch {
          // stream already closed
        }
      };

      try {
        if (request.signal.aborted) {
          close();
          return;
        }

        await updateAssistantRun({
          runId: runContext.runId,
          status: "in_progress",
          currentStage: "retrieving",
          error: null,
        });
        controller.enqueue(sse("stage", { stage: "retrieving" }));

        const userMessageId = typeof runContext.metadata.userMessageId === "string"
          ? runContext.metadata.userMessageId
          : null;

        const messages = await loadAssistantMessages(runContext.threadId);
        const userMessage = userMessageId
          ? messages.find((entry) => entry.id === userMessageId)
          : messages.filter((entry) => entry.role === "user").at(-1);

        if (!userMessage) {
          throw new Error("Run is missing its user message.");
        }

        const selectedSources = await listAssistantThreadSources(runContext.threadId);
        const retrieved = await retrieveProjectSourcesV1({
          companyId: runContext.companyId,
          projectId: String(project.id),
          question: userMessage.content,
          documentIds: selectedSources.length
            ? selectedSources.map((source) => source.documentId)
            : undefined,
          limit: 10,
        });

        await updateAssistantRun({
          runId: runContext.runId,
          status: "in_progress",
          currentStage: "reranking",
          metadata: {
            ...runContext.metadata,
            sourceCount: retrieved.length,
          },
        });
        controller.enqueue(sse("stage", { stage: "reranking", sourceCount: retrieved.length }));

        if (!retrieved.length) {
          const fallback = "I could not find this in the project documents.";
          const saved = await insertAssistantMessage({
            threadId: runContext.threadId,
            companyId: runContext.companyId,
            role: "assistant",
            content: fallback,
            citations: [],
            metadata: {},
          });
          await updateAssistantRun({
            runId: runContext.runId,
            status: "completed",
            currentStage: "completed",
            metadata: {
              ...runContext.metadata,
              messageId: saved.id,
              sourceCount: 0,
            },
          });
          controller.enqueue(sse("token", { delta: fallback }));
          controller.enqueue(sse("complete", { messageId: saved.id, citations: [] }));
          close();
          return;
        }

        await updateAssistantRun({
          runId: runContext.runId,
          status: "in_progress",
          currentStage: "generating",
        });
        controller.enqueue(sse("stage", { stage: "generating" }));

        const openai = getOpenAIClient();
        const modelMessages = [
          {
            role: "system" as const,
            content:
              "You are a grounded assistant. Use only provided evidence and include [n] citations for factual claims. Prefer short headings and bullet lists.",
          },
          {
            role: "user" as const,
            content: buildPrompt({
              question: userMessage.content,
              messages: messages
                .filter((entry) => entry.role !== "system")
                .map((entry) => ({
                  role: entry.role === "assistant" ? "assistant" : "user",
                  content: entry.content,
                })),
              sources: retrieved,
            }),
          },
        ];

        let completion;
        try {
          completion = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: modelMessages,
            stream: true,
            temperature: 0.1,
          });
        } catch {
          completion = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: modelMessages,
            stream: true,
            temperature: 0.1,
          });
        }

        let answer = "";
        for await (const chunk of completion) {
          if (request.signal.aborted) {
            close();
            return;
          }
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (!delta) {
            continue;
          }
          answer += delta;
          controller.enqueue(sse("token", { delta }));
        }

        const citationIndexes = parseCitationNumbers(answer);
        const citations: AssistantCitation[] = citationIndexes.flatMap((index) => {
          const source = retrieved[index - 1];
          if (!source) {
            return [];
          }

          return [
            {
              chunkId: source.chunkId,
              sourceId: source.chunkId,
              documentId: source.documentId,
              documentName: source.documentName,
              page: source.page,
              pageNumber: source.page,
              snippet: source.snippet,
              sectionTitle: source.sectionTitle,
              score: source.score,
            } satisfies AssistantCitation,
          ];
        });

        const savedMessage = await insertAssistantMessage({
          threadId: runContext.threadId,
          companyId: runContext.companyId,
          role: "assistant",
          content: answer.trim(),
          citations,
          metadata: {},
        });

        if (runContext.requestedOutputType) {
          const outputTitle = `${runContext.requestedOutputType.toUpperCase()}: ${userMessage.content.slice(0, 72)}`;
          await createProjectOutput({
            companyId: runContext.companyId,
            projectId: String(project.id),
            threadId: runContext.threadId,
            sourceRunId: runContext.runId,
            userId: runContext.userId,
            type: runContext.requestedOutputType as "email" | "memo" | "summary" | "checklist",
            title: outputTitle,
            body: answer.trim(),
            metadata: {
              fromAssistantRun: true,
              question: userMessage.content,
              citationCount: citations.length,
            },
          });
        }

        await updateAssistantRun({
          runId: runContext.runId,
          status: "completed",
          currentStage: "completed",
          metadata: {
            ...runContext.metadata,
            sourceCount: retrieved.length,
            messageId: savedMessage.id,
          },
        });

        controller.enqueue(
          sse("complete", {
            messageId: savedMessage.id,
            citations,
          }),
        );
        close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Assistant stream failed.";
        await updateAssistantRun({
          runId: runContext.runId,
          status: "failed",
          currentStage: "failed",
          error: message,
        });
        controller.enqueue(sse("error", { message }));
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
