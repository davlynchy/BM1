import { createProjectAction } from "@/app/(app)/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateProjectForm() {
  return (
    <form action={createProjectAction} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" name="name" placeholder="Perth Towers East" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contractValue">Contract value</Label>
        <Input id="contractValue" name="contractValue" placeholder="2400000" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="siteDueDate">Due on site</Label>
        <Input id="siteDueDate" name="siteDueDate" type="date" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="claimSubmissionMethod">Claim submission method</Label>
        <Input id="claimSubmissionMethod" name="claimSubmissionMethod" placeholder="Payapps / accounts@email.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="variationProcess">Variation process</Label>
        <Textarea id="variationProcess" name="variationProcess" placeholder="Written notice within 5 business days. Formal direction before execution." />
      </div>
      <div className="md:col-span-2">
        <Button type="submit">Create project</Button>
      </div>
    </form>
  );
}
