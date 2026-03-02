"use client";

import { useState } from "react";

import { deleteProjectAction } from "@/app/(app)/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="secondary">
        Delete project
      </Button>
      <Modal
        description="This removes the project workspace and its related records. Proceed only if you are sure."
        onClose={() => setOpen(false)}
        open={open}
        title="Delete project?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Project: <span className="font-medium text-text">{projectName}</span>
          </p>
          <form action={deleteProjectAction}>
            <input name="projectId" type="hidden" value={projectId} />
            <div className="flex gap-3">
              <Button type="submit" variant="secondary">
                Confirm delete
              </Button>
              <Button onClick={() => setOpen(false)} type="button">
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
