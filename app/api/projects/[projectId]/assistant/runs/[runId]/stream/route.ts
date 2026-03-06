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

function sanitizeCitationTags(line: string, maxCitation: number) {
  return line.replace(/\[(\d+)\]/g, (full, raw) => {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > maxCitation) {
      return "";
    }
    return full;
  });
}

function parseLineCitationNumbers(line: string, maxCitation: number) {
  const matches = line.match(/\[(\d+)\]/g) ?? [];
  const indexes: number[] = [];
  for (const match of matches) {
    const parsed = Number(match.replace(/\[|\]/g, ""));
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= maxCitation) {
      indexes.push(parsed);
    }
  }
  return indexes;
}

function isDecorativeLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }
  if (/^if you want, i can also\b/i.test(trimmed)) {
    return true;
  }
  if (/^[#\-*]\s*/.test(trimmed) && trimmed.replace(/^[#\-*]\s*/, "").length < 3) {
    return true;
  }
  return false;
}

function tokenizeForGrounding(value: string) {
  return value
    .toLowerCase()
    .replace(/\[(\d+)\]/g, " ")
    .split(/[^a-z0-9@._-]+/g)
    .filter((token) => token.length >= 4);
}

function lineAnchors(line: string) {
  const lower = line.toLowerCase();
  return lower.match(
    /\b\d{1,2}(?:st|nd|rd|th)\b|\blast day of (?:the )?month\b|\bend of (?:the )?month\b|\bfirst business day\b|\bwithin \d+ business days?\b|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g,
  ) ?? [];
}

function isLineGrounded(line: string, maxCitation: number, sources: Array<AssistantCitation & { content: string }>) {
  const citations = parseLineCitationNumbers(line, maxCitation);
  if (!citations.length) {
    return false;
  }

  const citedEvidence = citations
    .map((index) => {
      const source = sources[index - 1];
      if (!source) {
        return "";
      }
      return `${source.snippet ?? ""}\n${source.content ?? ""}`.toLowerCase();
    })
    .join("\n");

  if (!citedEvidence.trim()) {
    return false;
  }

  const anchors = lineAnchors(line);
  if (anchors.length > 0 && !anchors.some((anchor) => citedEvidence.includes(anchor))) {
    return false;
  }

  const tokens = tokenizeForGrounding(line);
  if (!tokens.length) {
    return true;
  }

  const overlap = new Set(tokens.filter((token) => citedEvidence.includes(token)));
  const minOverlap = tokens.length >= 6 ? 2 : 1;
  return overlap.size >= minOverlap;
}

function filterToGroundedAnswer(
  answer: string,
  maxCitation: number,
  sources: Array<AssistantCitation & { content: string }>,
) {
  const lines = answer.split("\n");
  const kept = lines
    .map((line) => sanitizeCitationTags(line, maxCitation))
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return true;
      }
      if (isDecorativeLine(trimmed)) {
        return true;
      }
      return isLineGrounded(trimmed, maxCitation, sources);
    });

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function firstSentence(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "";
  }
  const match = clean.match(/^(.{30,220}?[.!?])(?:\s|$)/);
  const sentence = match ? match[1] : clean.slice(0, 220);
  return sentence.trim();
}

function cleanupFilteredAnswer(answer: string) {
  const lines = answer.split("\n");
  const headingSet = new Set(["direct answer:", "contract facts:", "action steps:", "commercial risk if skipped:"]);
  const cleaned: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim().toLowerCase();
    if (!headingSet.has(trimmed)) {
      cleaned.push(line);
      continue;
    }

    let nextIndex = index + 1;
    while (nextIndex < lines.length && !lines[nextIndex].trim()) {
      nextIndex += 1;
    }
    if (nextIndex >= lines.length) {
      continue;
    }
    if (headingSet.has(lines[nextIndex].trim().toLowerCase())) {
      continue;
    }
    cleaned.push(line);
  }

  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function isThinGroundedAnswer(answer: string) {
  const trimmed = answer.trim();
  if (!trimmed || /^i could not find this in the project documents\.?$/i.test(trimmed)) {
    return true;
  }
  const citations = parseCitationNumbers(trimmed);
  if (!citations.length) {
    return true;
  }
  return trimmed.length < 180;
}

function buildGroundedFallback(sources: Array<AssistantCitation & { content: string }>) {
  const top = sources.slice(0, 4);
  if (!top.length) {
    return "I could not find this in the project documents.";
  }

  const factBullets = top.map((source, index) => {
    const summary = firstSentence(source.snippet || source.content) || "See cited contract clause.";
    return `- ${summary} [${index + 1}]`;
  });

  const actionCount = Math.min(3, top.length);
  const actionSteps = [
    `1. Confirm this work is outside your original subcontract scope using the cited clauses and drawings [1].`,
    actionCount >= 2
      ? `2. Issue a formal variation notice that references the contract requirement and affected scope [2].`
      : "2. Issue a formal variation notice that references the affected scope [1].",
    actionCount >= 3
      ? `3. Submit a priced variation with supporting documents and request written approval before proceeding [3].`
      : "3. Submit a priced variation with supporting documents and request written approval before proceeding [1].",
  ];

  return [
    "Direct answer:",
    "Follow the formal variation process in your subcontract and obtain written approval before doing additional work. [1]",
    "",
    "Contract facts:",
    ...factBullets,
    "",
    "Action steps:",
    ...actionSteps,
    "",
    "Commercial risk if skipped:",
    "- Unapproved work may be disputed or unpaid under the subcontract process [1].",
  ].join("\n");
}

function renumberCitations(answer: string, indexes: number[]) {
  const ordered = [...indexes].sort((a, b) => a - b);
  const mapping = new Map<number, number>();
  ordered.forEach((original, idx) => {
    mapping.set(original, idx + 1);
  });

  const rewritten = answer.replace(/\[(\d+)\]/g, (full, raw) => {
    const oldValue = Number(raw);
    if (!Number.isInteger(oldValue)) {
      return full;
    }
    const mapped = mapping.get(oldValue);
    return mapped ? `[${mapped}]` : "";
  });

  return {
    answer: rewritten,
    mapping,
  };
}

function ensureNextStepSuggestion(answer: string) {
  const trimmed = answer.trim();
  if (!trimmed || /^i could not find this in the project documents\.?$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^if you want, i can also\b/im.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}\n\nIf you want, I can also draft the exact email and variation template you can send today.`;
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
    "Do not invent clauses, dates, parties, or process steps.",
    "Prefer exact contract process from evidence over generic advice.",
    "Use short plain-English lines and practical steps.",
    "Always include:",
    "1) Direct answer",
    "2) Contract facts as bullets",
    "3) Action steps as numbered steps",
    "4) Commercial risk if skipped",
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

        const bestScore = Number(retrieved[0]?.score ?? 0);
        if (bestScore < 15) {
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
              sourceCount: retrieved.length,
              groundingFallbackReason: "low_confidence_retrieval",
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
              "You are a grounded assistant. Use only provided evidence. Do not hallucinate. Every factual statement must carry [n] citations.",
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

        const groundedAnswer = filterToGroundedAnswer(answer.trim(), retrieved.length, retrieved);
        const cleanedAnswer = cleanupFilteredAnswer(groundedAnswer);
        const filteredAnswer = isThinGroundedAnswer(cleanedAnswer) ? buildGroundedFallback(retrieved) : cleanedAnswer;
        const rawCitationIndexes = parseCitationNumbers(filteredAnswer);
        const { answer: finalAnswer, mapping } = renumberCitations(filteredAnswer, rawCitationIndexes);
        const polishedAnswer = ensureNextStepSuggestion(finalAnswer);
        const citations: AssistantCitation[] = rawCitationIndexes.flatMap((originalIndex) => {
          const source = retrieved[originalIndex - 1];
          if (!source) {
            return [];
          }
          const citationOrder = mapping.get(originalIndex);
          if (!citationOrder) {
            return [];
          }

          return [
            {
              chunkId: source.chunkId,
              sourceId: source.chunkId,
              citationOrder,
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
          content: polishedAnswer,
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
            body: polishedAnswer,
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
