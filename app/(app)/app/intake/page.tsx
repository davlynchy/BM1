import { redirect } from "next/navigation";

import { completePendingScanAction } from "@/app/(app)/app/intake/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readPendingScanCookie } from "@/lib/intake/pending-scan";

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const pendingScan = await readPendingScanCookie();

  if (!pendingScan) {
    redirect("/upload?message=Upload+a+contract+to+start+your+free+scan.");
  }

  return (
    <main className="py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3">
          <h1 className="font-[var(--font-heading)] text-4xl">Name this project</h1>
          <p className="text-muted">
            Your contract is staged. Create the project workspace and generate the first
            commercial summary.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded contract</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-muted md:grid-cols-3">
            <div>
              <p className="font-medium text-text">File</p>
              <p>{pendingScan.fileName}</p>
            </div>
            <div>
              <p className="font-medium text-text">Size</p>
              <p>{formatSize(pendingScan.fileSize)}</p>
            </div>
            <div>
              <p className="font-medium text-text">Uploaded</p>
              <p>{new Date(pendingScan.uploadedAt).toLocaleString("en-AU")}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create project workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={completePendingScanAction} className="space-y-5">
              {message ? (
                <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">
                  {message}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="projectName">Project name</Label>
                <Input
                  id="projectName"
                  name="projectName"
                  placeholder="Perth Towers East"
                  required
                />
              </div>
              <Button type="submit">Create project and run free scan</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
