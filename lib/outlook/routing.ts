type ProjectCandidate = {
  id: string;
  name: string;
};

export type EmailRoutingDecision = {
  projectId: string | null;
  confidence: number;
  routingStatus: "auto_assigned" | "needs_review";
  reasons: string[];
  suggestions: Array<{ projectId: string; confidence: number }>;
};

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function tokenize(value: string) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

export function decideEmailProject(params: {
  subject: string;
  sender: string;
  bodyPreview: string;
  projects: ProjectCandidate[];
}) {
  const subjectTokens = tokenize(params.subject);
  const bodyTokens = tokenize(params.bodyPreview).slice(0, 60);
  const combinedTokens = new Set([...subjectTokens, ...bodyTokens]);

  const scored = params.projects
    .map((project) => {
      const projectTokens = tokenize(project.name);
      const matches = projectTokens.filter((token) => combinedTokens.has(token));
      let score = 0.1;
      if (matches.length) {
        score += Math.min(0.75, matches.length * 0.2);
      }
      if (normalize(params.sender).includes(projectTokens[0] ?? "")) {
        score += 0.15;
      }
      return {
        projectId: project.id,
        score: Math.max(0, Math.min(0.99, score)),
        matches,
      };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const suggestions = scored.slice(0, 3).map((item) => ({
    projectId: item.projectId,
    confidence: Number(item.score.toFixed(2)),
  }));

  if (!top || top.score < 0.5) {
    return {
      projectId: null,
      confidence: top ? Number(top.score.toFixed(2)) : 0,
      routingStatus: "needs_review" as const,
      reasons: ["No strong token match to any project."],
      suggestions,
    } satisfies EmailRoutingDecision;
  }

  if (top.score >= 0.85) {
    return {
      projectId: top.projectId,
      confidence: Number(top.score.toFixed(2)),
      routingStatus: "auto_assigned" as const,
      reasons: [
        top.matches.length
          ? `Matched project terms: ${top.matches.join(", ")}`
          : "Strong heuristic confidence.",
      ],
      suggestions,
    } satisfies EmailRoutingDecision;
  }

  return {
    projectId: top.projectId,
    confidence: Number(top.score.toFixed(2)),
    routingStatus: "needs_review" as const,
    reasons: [
      top.matches.length
        ? `Partial project term match: ${top.matches.join(", ")}`
        : "Moderate confidence from heuristic routing.",
    ],
    suggestions,
  } satisfies EmailRoutingDecision;
}
