import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntakeUploader } from "@/components/upload/intake-uploader";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="container py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-3 text-center">
          <h1 className="font-heading text-4xl">Run your first contract scan</h1>
          <p className="text-muted">
            Upload a subcontract to generate a structured commercial risk summary.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Upload contract</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {message ? (
                <div className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-muted">
                  {message}
                </div>
              ) : null}
              <IntakeUploader autoUpload />
              <p className="text-sm text-muted">
                Continue to save this contract to a project and run the scan.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>What the free scan includes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted">
              <p>Top commercial risks with clause-linked context.</p>
              <p>Key notice and entitlement obligations.</p>
              <p>Project workspace creation after login.</p>
              <p>Blurred sections show what unlocks in the full report.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
