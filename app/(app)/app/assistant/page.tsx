import { redirect } from "next/navigation";
import Link from "next/link";

import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentProjectForUser } from "@/lib/projects/workbench";

export default async function AssistantRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const project = await getRecentProjectForUser();

  if (project) {
    redirect(`/app/projects/${project.id}/assistant`);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 pt-6">
      <header className="text-center">
        <h1 className="font-heading text-6xl">AI Assistant</h1>
        <p className="mt-3 text-sm text-muted">Start by uploading documents or creating your first vault project.</p>
      </header>

      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>Get started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? (
            <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">{message}</div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <CreateProjectModal triggerLabel="Create vault project" />
            <Button asChild variant="secondary">
              <Link href="/upload">Add document</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/app/projects">View projects</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
