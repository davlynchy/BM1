import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export default async function CompanyVaultPage() {
  const supabase = await createClient();
  const workspace = await getActiveWorkspace();
  const companyId = workspace?.company?.id;

  const { data: companyDocuments } = companyId
    ? await supabase
        .from("documents")
        .select("id, name, document_type, parse_status, created_at")
        .eq("company_id", companyId)
        .is("project_id", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { count: projectCount } = companyId
    ? await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
    : { count: 0 };

  return (
    <main className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Company Vault</CardTitle>
            <p className="mt-2 text-sm text-muted">
              Shared commercial intelligence and reusable company documents.
            </p>
          </div>
          <Badge variant="secondary">{projectCount ?? 0} projects</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted md:grid-cols-3">
          <div>
            <p className="font-medium text-text">Company</p>
            <p>{workspace?.company?.name ?? "Workspace"}</p>
          </div>
          <div>
            <p className="font-medium text-text">Shared documents</p>
            <p>{companyDocuments?.length ?? 0}</p>
          </div>
          <div>
            <p className="font-medium text-text">Use case</p>
            <p>Rates, terms, quotes, and reusable notices.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shared documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted">
          {companyDocuments?.length ? (
            companyDocuments.map((document) => (
              <div className="rounded-xl border border-border bg-bg px-4 py-3" key={document.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-text">{document.name}</p>
                  <Badge variant="secondary">{document.parse_status}</Badge>
                </div>
                <p className="mt-2 text-xs uppercase tracking-wide text-muted">
                  {document.document_type}
                </p>
              </div>
            ))
          ) : (
            <p>
              No company-level documents yet. Stage 7 can extend the Stage 4 upload pipeline
              to support shared vault uploads here.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
