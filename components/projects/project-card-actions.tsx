"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { deleteProjectAction, updateProjectCardAction } from "@/app/(app)/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

export function ProjectCardActions({
  projectId,
  currentStatus,
  projectName,
  siteDueDate,
}: {
  projectId: string;
  currentStatus: string | null;
  projectName: string;
  siteDueDate: string | null;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <details className="relative z-20">
        <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-muted hover:bg-bg hover:text-text">
          <MoreHorizontal className="h-4 w-4" />
        </summary>
        <div className="absolute right-0 top-8 w-52 rounded-[28px] border border-border bg-panel p-3 shadow-panel">
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-text hover:bg-bg"
            onClick={() => setEditOpen(true)}
            type="button"
          >
            Edit
          </button>
          <form action={deleteProjectAction}>
            <input name="projectId" type="hidden" value={projectId} />
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-bg" type="submit">
              Delete
            </button>
          </form>
        </div>
      </details>

      <Modal
        description="Update the project details."
        onClose={() => setEditOpen(false)}
        open={editOpen}
        title="Edit project"
      >
        <form action={updateProjectCardAction} className="space-y-4">
          <input name="projectId" type="hidden" value={projectId} />
          <div className="space-y-2">
            <Label htmlFor={`edit-project-name-${projectId}`}>Project Name</Label>
            <Input
              defaultValue={projectName}
              id={`edit-project-name-${projectId}`}
              name="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-project-status-${projectId}`}>Status</Label>
            <select
              className="flex h-11 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text outline-none"
              defaultValue={currentStatus ?? "tender"}
              id={`edit-project-status-${projectId}`}
              name="status"
            >
              <option value="tender">Tender</option>
              <option value="pre-construction">Pre-Construction</option>
              <option value="construction">Construction</option>
              <option value="post-construction">Post-Construction</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-project-tender-due-${projectId}`}>Tender Due</Label>
            <Input
              defaultValue={siteDueDate ?? ""}
              id={`edit-project-tender-due-${projectId}`}
              name="siteDueDate"
              type="date"
            />
          </div>
          <Button type="submit">Save</Button>
        </form>
      </Modal>
    </>
  );
}
