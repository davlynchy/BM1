import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectPageShell } from "@/components/projects/project-page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectTodoPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: todos }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle(),
    supabase
      .from("project_todos")
      .select("id, title, priority, status, source_type, due_date")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);

  if (!project) {
    notFound();
  }

  const openTodos = (todos ?? []).filter((todo) => todo.status !== "done" && todo.status !== "dismissed");
  const completeTodos = (todos ?? []).filter((todo) => todo.status === "done" || todo.status === "dismissed");

  return (
    <ProjectPageShell title="To-Do">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {openTodos.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-border text-sm text-muted">
                    <tr>
                      <th className="px-3 py-2">Task</th>
                      <th className="px-3 py-2">Created from</th>
                      <th className="px-3 py-2">Due</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openTodos.map((todo) => (
                      <tr className="border-b border-border/60 text-sm" key={todo.id}>
                        <td className="px-3 py-3 font-medium text-text">{todo.title}</td>
                        <td className="px-3 py-3 text-muted">{todo.source_type}</td>
                        <td className="px-3 py-3 text-muted">{todo.due_date ?? "Not set"}</td>
                        <td className="px-3 py-3 text-muted">{todo.priority}</td>
                        <td className="px-3 py-3">
                          <Link
                            className="underline"
                            href={`/app/projects/${projectId}/assistant?prompt=${encodeURIComponent(
                              `Help me action this task:\n${todo.title}`,
                            )}`}
                          >
                            Open in Assistant
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted">No outstanding tasks.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Complete</CardTitle>
          </CardHeader>
          <CardContent>
            {completeTodos.length ? (
              <ul className="space-y-2 text-sm text-muted">
                {completeTodos.map((todo) => (
                  <li className="line-through" key={todo.id}>
                    {todo.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No completed tasks yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </ProjectPageShell>
  );
}
