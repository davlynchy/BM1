"use client";

import { Button } from "@/components/ui/button";

const DEFAULT_PROMPTS = [
  "Show me time bar risks",
  "Summarise unfair clauses",
  "Draft negotiation points for unfair indemnities",
  "What should I push back on first?",
];

export function ReviewSuggestedPrompts({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DEFAULT_PROMPTS.map((prompt) => (
        <Button
          disabled={disabled}
          key={prompt}
          onClick={() => onSelect(prompt)}
          size="sm"
          type="button"
          variant="secondary"
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
}
