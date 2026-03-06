"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useState } from "react";
import { FolderOpen, Mail, MessageSquare, Settings, CheckSquare, LifeBuoy, Search, PanelLeft } from "lucide-react";

import { CreateProjectModal } from "@/components/projects/create-project-modal";

type SidebarProject = {
  id: string;
  name: string;
  status: string | null;
};

function initials(value: string) {
  const parts = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return parts.join("") || "B";
}

export function WorkbenchSidebar({
  projects,
  companyName,
  userDisplayName,
  signOutAction,
}: {
  projects: SidebarProject[];
  companyName: string;
  userDisplayName: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const projectId = pathname.match(/\/app\/projects\/([^/]+)/)?.[1] ?? null;
  const activeProject = projects.find((project) => project.id === projectId) ?? null;

  const projectNavItems = activeProject
    ? [
        { href: `/app/projects/${activeProject.id}/assistant`, label: "AI Assistant", icon: MessageSquare },
        { href: `/app/projects/${activeProject.id}/vault`, label: "Project Vault", icon: FolderOpen },
        { href: `/app/projects/${activeProject.id}/email`, label: "Email", icon: Mail },
        { href: `/app/projects/${activeProject.id}/todo`, label: "To-Do", icon: CheckSquare },
      ]
    : [];

  const isProjectRoute = pathname.startsWith("/app/projects/");

  return (
    <aside className="flex h-full w-full flex-col rounded-[28px] border border-border bg-panel p-4">
      <div className="flex items-start justify-between gap-2">
        {activeProject ? <div /> : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-lg font-semibold text-white">
            {initials("Bidmetric")}
          </div>
        )}
        <div className="flex items-center gap-3 pr-2 text-muted">
          <Search className="h-4 w-4" />
          <PanelLeft className="h-4 w-4" />
        </div>
      </div>

      {activeProject ? (
        <div className="mt-4 space-y-2">
          <div className="inline-flex rounded-full bg-[#5f976f] px-3 py-1 text-xs font-medium text-white">
            {activeProject.status ?? "Project"}
          </div>
          <details className="group">
            <summary className="cursor-pointer list-none text-[35px] font-semibold leading-[1.1] tracking-tight text-text">
              {activeProject.name}
            </summary>
            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto rounded-xl border border-border bg-bg p-2">
              {projects
                .filter((project) => project.id !== activeProject.id)
                .map((project) => (
                  <Link
                    className="block rounded-lg px-3 py-2 text-sm hover:bg-panel"
                    href={`/app/projects/${project.id}/assistant`}
                    key={project.id}
                  >
                    {project.name}
                  </Link>
                ))}
              <div className="border-t border-border pt-2">
                <CreateProjectModal
                  triggerClassName="w-full justify-start rounded-lg border-0 bg-transparent px-3 py-2 text-sm font-medium text-text hover:bg-panel"
                  triggerLabel="Create new project"
                  triggerVariant="ghost"
                />
              </div>
            </div>
          </details>
        </div>
      ) : null}

      {isProjectRoute ? (
        <nav className="mt-8 space-y-1.5">
          {projectNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-base ${
                  active ? "bg-bg text-text" : "text-muted hover:bg-bg hover:text-text"
                }`}
                href={item.href as Route}
                key={item.href}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : (
        <nav className="mt-8 space-y-1.5">
          <Link
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-base ${
              pathname === "/app" ? "bg-bg text-text" : "text-muted hover:bg-bg hover:text-text"
            }`}
            href="/app"
          >
            <FolderOpen className="h-5 w-5" />
            Projects
          </Link>
        </nav>
      )}

      <div className="mt-auto pt-8">
        <div className="space-y-1.5">
          <Link className="flex items-center gap-3 rounded-xl px-3 py-2 text-base text-muted hover:bg-bg hover:text-text" href="/app/support">
            <LifeBuoy className="h-5 w-5" />
            Support
          </Link>
          <Link className="flex items-center gap-3 rounded-xl px-3 py-2 text-base text-muted hover:bg-bg hover:text-text" href="/app/settings">
            <Settings className="h-5 w-5" />
            Settings
          </Link>
        </div>
        <div className="relative mt-3">
          <button
            className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-bg"
            onClick={() => setMenuOpen((current) => !current)}
            title={companyName}
            type="button"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5f976f] text-lg font-semibold text-white">
              {initials(userDisplayName)}
            </div>
            <p className="truncate text-base text-text">{userDisplayName}</p>
          </button>
          {menuOpen ? (
            <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-border bg-panel p-2 shadow-panel">
              <form action={signOutAction}>
                <button
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-text hover:bg-bg"
                  type="submit"
                >
                  Log out
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
