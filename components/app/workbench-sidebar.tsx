"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { FolderOpen, Mail, MessageSquare, Settings, CheckSquare, LifeBuoy, PanelLeftClose, PanelLeftOpen, ChevronDown, BriefcaseBusiness } from "lucide-react";

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
  const [collapsed, setCollapsed] = useState(false);
  const projectId = pathname.match(/\/app\/projects\/([^/]+)/)?.[1] ?? null;
  const activeProject = projects.find((project) => project.id === projectId) ?? null;

  const projectNavItems = activeProject
    ? [
        { href: "/app/projects", label: "Projects", icon: BriefcaseBusiness },
        { href: `/app/projects/${activeProject.id}/assistant`, label: "AI Assistant", icon: MessageSquare },
        { href: `/app/projects/${activeProject.id}/vault`, label: "Vault", icon: FolderOpen },
        { href: `/app/projects/${activeProject.id}/email`, label: "Email", icon: Mail },
        { href: `/app/projects/${activeProject.id}/todo`, label: "To-Do", icon: CheckSquare },
      ]
    : [];

  const isProjectRoute = pathname.startsWith("/app/projects/");
  const brandLabel = activeProject?.name || "Bidmetric";

  useEffect(() => {
    function handleRailToggle(event: Event) {
      const customEvent = event as CustomEvent<{ forceCollapsed?: boolean }>;
      if (typeof customEvent.detail?.forceCollapsed === "boolean") {
        setCollapsed(customEvent.detail.forceCollapsed);
      }
    }

    window.addEventListener("assistant-rail-toggle", handleRailToggle as EventListener);
    return () => {
      window.removeEventListener("assistant-rail-toggle", handleRailToggle as EventListener);
    };
  }, []);

  return (
    <aside className={`flex h-full flex-col rounded-[28px] border border-border bg-panel ${collapsed ? "w-[76px] p-3" : "w-[228px] p-4"}`}>
      <div className={collapsed ? "flex flex-col items-center gap-3" : "flex items-start justify-between gap-2"}>
        {collapsed ? (
          <div className="flex h-12 w-9 items-center justify-center rounded-[10px] bg-black text-2xl font-semibold text-white" title="Bidmetric">
            B
          </div>
        ) : activeProject ? (
          <details className="group min-w-0">
            <summary className="flex cursor-pointer list-none items-start gap-1">
              <span className="line-clamp-2 break-words font-heading text-[24px] leading-[1] tracking-tight text-text">{activeProject.name}</span>
              <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
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
            </div>
          </details>
        ) : (
          <p className="line-clamp-2 pt-1 font-heading text-[28px] leading-[1] tracking-tight text-text">{brandLabel}</p>
        )}
        <div className="flex items-center gap-2 text-muted">
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-md p-1 hover:bg-bg hover:text-text"
            onClick={() => setCollapsed((current) => !current)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            type="button"
          >
            {collapsed ? <PanelLeftOpen className="h-[17px] w-[17px]" /> : <PanelLeftClose className="h-[17px] w-[17px]" />}
          </button>
        </div>
      </div>

      {activeProject && !collapsed ? (
        <div className="mt-4 space-y-2">
          <div className="inline-flex rounded-full bg-[#5f976f] px-3 py-1 text-xs font-medium text-white">
            {activeProject.status ?? "Project"}
          </div>
        </div>
      ) : null}

      {isProjectRoute ? (
        <nav className={`mt-8 space-y-1.5 ${collapsed ? "px-0.5" : ""}`}>
          {projectNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                className={`flex items-center ${collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"} rounded-xl text-base ${
                  active ? "bg-bg text-text" : "text-muted hover:bg-bg hover:text-text"
                }`}
                href={item.href as Route}
                key={item.href}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5" />
                {collapsed ? null : item.label}
              </Link>
            );
          })}
        </nav>
      ) : (
        <nav className={`mt-8 space-y-1.5 ${collapsed ? "px-0.5" : ""}`}>
          {pathname !== "/app/projects" ? (
            <Link
              className={`flex items-center rounded-xl text-base ${
                pathname === "/app/assistant" ? "bg-bg text-text" : "text-muted hover:bg-bg hover:text-text"
              } ${collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"}`}
              href="/app/assistant"
              title={collapsed ? "AI Assistant" : undefined}
            >
              <MessageSquare className="h-5 w-5" />
              {collapsed ? null : "AI Assistant"}
            </Link>
          ) : null}
          <Link
            className={`flex items-center rounded-xl text-base ${
              pathname === "/app/projects" ? "bg-bg text-text" : "text-muted hover:bg-bg hover:text-text"
            } ${collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"}`}
            href="/app/projects"
            title={collapsed ? "Projects" : undefined}
          >
            <FolderOpen className="h-5 w-5" />
            {collapsed ? null : "Projects"}
          </Link>
        </nav>
      )}

      <div className="mt-auto pt-8">
        <div className={`space-y-1.5 ${collapsed ? "px-0.5" : ""}`}>
          <Link
            className={`flex items-center rounded-xl text-base text-muted hover:bg-bg hover:text-text ${collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"}`}
            href="/app/support"
            title={collapsed ? "Support" : undefined}
          >
            <LifeBuoy className="h-5 w-5" />
            {collapsed ? null : "Support"}
          </Link>
          <Link
            className={`flex items-center rounded-xl text-base text-muted hover:bg-bg hover:text-text ${collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"}`}
            href="/app/settings"
            title={collapsed ? "Settings" : undefined}
          >
            <Settings className="h-5 w-5" />
            {collapsed ? null : "Settings"}
          </Link>
        </div>
        <div className="relative mt-3">
          <button
            className={`flex w-full items-center rounded-xl text-left hover:bg-bg ${collapsed ? "justify-center px-0 py-2" : "gap-3 px-1 py-2"}`}
            onClick={() => setMenuOpen((current) => !current)}
            title={companyName}
            type="button"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5f976f] text-lg font-semibold text-white">
              {initials(userDisplayName)}
            </div>
            {collapsed ? null : <p className="truncate text-base text-text">{userDisplayName}</p>}
          </button>
          {menuOpen ? (
            <div className={`absolute bottom-full mb-2 rounded-xl border border-border bg-panel p-2 shadow-panel ${collapsed ? "left-1/2 w-28 -translate-x-1/2" : "left-0 right-0"}`}>
              <form action={signOutAction}>
                <button
                  className={`w-full rounded-lg px-3 py-2 text-sm font-medium text-text hover:bg-bg ${collapsed ? "text-center whitespace-nowrap" : "text-left"}`}
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
