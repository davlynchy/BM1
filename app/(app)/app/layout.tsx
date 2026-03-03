import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { Building2, FolderOpen, LayoutDashboard, Settings } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

const navItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/projects", label: "Projects", icon: FolderOpen },
  { href: "/app/company", label: "Company Vault", icon: Building2 },
  { href: "/app/settings", label: "Settings", icon: Settings },
] satisfies Array<{ href: Route; label: string; icon: typeof LayoutDashboard }>;

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const workspace = await getActiveWorkspace();

  if (!workspace?.company) {
    redirect("/signup?message=Finish+setting+up+your+workspace.");
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="container grid gap-6 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="panel h-fit p-4">
          <div className="border-b border-border pb-4">
            <p className="font-heading text-2xl">Bidmetric</p>
            <p className="mt-2 text-sm text-muted">{workspace.company.name}</p>
            <Badge className="mt-3" variant="secondary">
              {workspace.profile?.email ?? "Workspace"}
            </Badge>
          </div>

          <nav className="mt-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-bg hover:text-text"
                  href={item.href}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <form action={signOutAction} className="mt-6">
            <Button className="w-full" variant="secondary">
              Sign out
            </Button>
          </form>
        </aside>

        <div>{children}</div>
      </div>
    </div>
  );
}
