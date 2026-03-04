import Link from "next/link";

import { Badge } from "@/components/ui/badge";

export function ProjectWorkbenchNav({
  projectId,
  projectName,
  active,
}: {
  projectId: string;
  projectName: string;
  active: "dashboard" | "assistant" | "vault";
}) {
  const links = [
    { key: "dashboard", label: "Dashboard", href: `/app/projects/${projectId}` },
    { key: "assistant", label: "AI Assistant", href: `/app/projects/${projectId}/assistant` },
    { key: "vault", label: "Vault", href: `/app/projects/${projectId}/vault` },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge variant="secondary">Project workbench</Badge>
          <h1 className="mt-3 font-heading text-4xl">{projectName}</h1>
        </div>
      </div>
      <div className="inline-flex rounded-2xl border border-border bg-panel p-1">
        {links.map((item) => (
          <Link
            className={`rounded-xl px-4 py-2 text-sm transition-colors ${
              active === item.key ? "bg-bg text-text" : "text-muted hover:text-text"
            }`}
            href={item.href}
            key={item.key}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
