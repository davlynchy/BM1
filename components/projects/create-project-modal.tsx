"use client";

import { useState } from "react";

import { createProjectAction } from "@/app/(app)/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

const PROJECT_STATUS_OPTIONS = [
  { value: "tender", label: "Tender" },
  { value: "pre-construction", label: "Pre-Construction" },
  { value: "construction", label: "Construction" },
  { value: "post-construction", label: "Post-Construction" },
];

export function CreateProjectModal({
  triggerLabel = "Create project",
  triggerClassName,
  triggerVariant = "default",
}: {
  triggerLabel?: string;
  triggerClassName?: string;
  triggerVariant?: "default" | "secondary" | "ghost";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className={triggerClassName}
        onClick={() => setOpen(true)}
        type="button"
        variant={triggerVariant}
      >
        {triggerLabel}
      </Button>

      <Modal
        description="Add the project basics now. You can edit more details later."
        onClose={() => setOpen(false)}
        open={open}
        title="Create project"
      >
        <form action={createProjectAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-project-name">Project Name</Label>
            <Input
              id="create-project-name"
              name="name"
              placeholder="Mercedes College"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-project-status">Status</Label>
            <select
              className="flex h-11 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text outline-none"
              defaultValue="tender"
              id="create-project-status"
              name="status"
            >
              {PROJECT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-project-tender-due">Tender Due</Label>
            <Input
              id="create-project-tender-due"
              name="siteDueDate"
              type="date"
            />
          </div>

          <Button className="mx-auto block" type="submit">Create project</Button>
        </form>
      </Modal>
    </>
  );
}
