import { deleteProjectAction, updateProjectAction } from "@/app/(app)/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function EditProjectForm({
  project,
}: {
  project: {
    id: string;
    name: string;
    status: string;
    contract_value: number | null;
    site_due_date: string | null;
    claim_submission_method: string | null;
    variation_process: string | null;
  };
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <form action={updateProjectAction} className="grid gap-4 md:grid-cols-2">
        <input name="projectId" type="hidden" value={project.id} />
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name">Project name</Label>
          <Input defaultValue={project.name} id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            className="flex h-11 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text outline-none"
            defaultValue={project.status}
            id="status"
            name="status"
          >
            <option value="tender">Tender</option>
            <option value="pre-construction">Pre-construction</option>
            <option value="construction">Construction</option>
            <option value="post-construction">Post-construction</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contractValue">Contract value</Label>
          <Input defaultValue={project.contract_value ?? ""} id="contractValue" name="contractValue" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="siteDueDate">Due on site</Label>
          <Input defaultValue={project.site_due_date ?? ""} id="siteDueDate" name="siteDueDate" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="claimSubmissionMethod">Claim submission method</Label>
          <Input
            defaultValue={project.claim_submission_method ?? ""}
            id="claimSubmissionMethod"
            name="claimSubmissionMethod"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="variationProcess">Variation process</Label>
          <Textarea
            defaultValue={project.variation_process ?? ""}
            id="variationProcess"
            name="variationProcess"
          />
        </div>
        <div className="md:col-span-2">
          <Button type="submit">Save project</Button>
        </div>
      </form>

      <form action={deleteProjectAction} className="flex items-start">
        <input name="projectId" type="hidden" value={project.id} />
        <Button type="submit" variant="secondary">
          Delete project
        </Button>
      </form>
    </div>
  );
}
