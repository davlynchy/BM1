"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Folder, FolderPlus, Search, Upload, FileText, FileSpreadsheet } from "lucide-react";

import { ProjectDocumentUpload } from "@/components/documents/project-document-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VaultFileRecord } from "@/types/vault";

type FolderDraft = {
  id: string;
  name: string;
};

function formatSize(size: number | null) {
  if (!size) {
    return "Unknown";
  }
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

function displayType(name: string) {
  const extension = name.split(".").pop()?.toUpperCase();
  return extension || "FILE";
}

function fileIcon(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "xlsx" || extension === "xls") {
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  }
  if (extension === "pdf") {
    return <FileText className="h-4 w-4 text-red-600" />;
  }
  if (extension === "doc" || extension === "docx") {
    return <FileText className="h-4 w-4 text-blue-600" />;
  }
  return <FileText className="h-4 w-4 text-muted" />;
}

function folderFromPath(relativePath: string | null | undefined, fallbackName: string) {
  const normalized = (relativePath ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return null;
  }
  const parts = normalized.split("/");
  if (!parts.length) {
    return null;
  }
  if (parts.length === 1 && parts[0] === fallbackName) {
    return null;
  }
  return parts[0];
}

export function VaultPage({
  project,
  documents,
}: {
  project: { id: string; name: string };
  documents: VaultFileRecord[];
}) {
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [draggingIds, setDraggingIds] = useState<string[]>([]);
  const [folderDrafts, setFolderDrafts] = useState<FolderDraft[]>([]);
  const [documentRows, setDocumentRows] = useState(documents);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingFolders = useMemo(() => {
    const folders = new Set<string>();
    documentRows.forEach((document) => {
      const folder = folderFromPath(document.relativePath, document.name);
      if (folder) {
        folders.add(folder);
      }
    });
    return [...folders.values()].sort((a, b) => a.localeCompare(b));
  }, [documentRows]);

  const folders = useMemo(() => {
    const draftNames = folderDrafts.map((draft) => draft.name.trim()).filter(Boolean);
    const merged = new Set([...existingFolders, ...draftNames]);
    return [...merged.values()].sort((a, b) => a.localeCompare(b));
  }, [existingFolders, folderDrafts]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return documentRows.filter((document) => {
      const matchesQuery = !normalized || document.name.toLowerCase().includes(normalized);
      const folder = folderFromPath(document.relativePath, document.name);
      const matchesFolder = !selectedFolder || folder === selectedFolder;
      return matchesQuery && matchesFolder;
    });
  }, [documentRows, query, selectedFolder]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((document) => selectedIds.includes(document.id));

  function toggleAllVisible(checked: boolean) {
    if (checked) {
      const merged = new Set([...selectedIds, ...filtered.map((document) => document.id)]);
      setSelectedIds([...merged]);
      return;
    }

    setSelectedIds((current) => current.filter((id) => !filtered.some((document) => document.id === id)));
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }
      return current.filter((item) => item !== id);
    });
  }

  function addFolderRow() {
    const newDraft: FolderDraft = {
      id: crypto.randomUUID(),
      name: "Folder Name",
    };
    setFolderDrafts((current) => [newDraft, ...current]);
  }

  async function moveFilesToFolder(folderName: string, ids: string[]) {
    const cleanFolder = folderName.trim();
    if (!cleanFolder || !ids.length) {
      return;
    }
    setMoving(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}/vault/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderName: cleanFolder,
          documentIds: ids,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to move files.");
      }

      setDocumentRows((current) =>
        current.map((document) =>
          ids.includes(document.id)
            ? { ...document, relativePath: `${cleanFolder}/${document.name}` }
            : document,
        ),
      );
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDraggingIds([]);
      setSelectedFolder(cleanFolder);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Unable to move files.");
    } finally {
      setMoving(false);
    }
  }

  const folderRows = folders.map((folderName) => ({
    id: `folder-${folderName}`,
    name: folderName,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {showUpload ? (
        <div className="rounded-3xl border border-border bg-panel p-5">
          <ProjectDocumentUpload projectId={project.id} relativePathPrefix={selectedFolder} />
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="rounded-[30px] border border-border bg-panel p-6">
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            {folders.length ? (
              <select
                className="h-10 rounded-xl border border-border bg-panel px-3 text-sm text-text outline-none"
                onChange={(event) => setSelectedFolder(event.target.value || null)}
                value={selectedFolder ?? ""}
              >
                <option value="">All folders</option>
                {folders.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="relative min-w-[250px] flex-1 md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                value={query}
              />
            </div>
            <Button className="rounded-xl" onClick={addFolderRow} type="button" variant="secondary">
              <FolderPlus className="mr-2 h-4 w-4" />
              Create folder
            </Button>
            <Button className="rounded-xl" onClick={() => setShowUpload(true)} type="button" variant="secondary">
              <Upload className="mr-2 h-4 w-4" />
              Upload files
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-sm text-muted">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      aria-label="Select all files"
                      checked={allVisibleSelected}
                      onChange={(event) => toggleAllVisible(event.target.checked)}
                      type="checkbox"
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">Files</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Added</th>
                  <th className="px-3 py-2 text-right font-medium">Size</th>
                </tr>
              </thead>
              <tbody>
                {folderDrafts.map((draft) => (
                  <tr
                    className="text-sm"
                    key={draft.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void moveFilesToFolder(draft.name, draggingIds.length ? draggingIds : selectedIds);
                    }}
                  >
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3 font-medium text-text">
                        <Folder className="h-4 w-4 text-[#c9a115]" />
                        <Input
                          className="h-8 max-w-sm"
                          onChange={(event) =>
                            setFolderDrafts((current) =>
                              current.map((item) => (item.id === draft.id ? { ...item, name: event.target.value } : item)),
                            )
                          }
                          value={draft.name}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-text">Folder</td>
                    <td className="px-3 py-3 text-text">-</td>
                    <td className="px-3 py-3 text-right text-text">-</td>
                  </tr>
                ))}

                {folderRows.map((folder) => (
                  <tr
                    className="text-sm"
                    key={folder.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void moveFilesToFolder(folder.name, draggingIds.length ? draggingIds : selectedIds);
                    }}
                  >
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3 font-medium text-text">
                        <Folder className="h-4 w-4 text-[#c9a115]" />
                        <span>{folder.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-text">Folder</td>
                    <td className="px-3 py-3 text-text">-</td>
                    <td className="px-3 py-3 text-right text-text">-</td>
                  </tr>
                ))}

                {filtered.map((document) => (
                  <tr
                    className="text-sm"
                    draggable
                    key={document.id}
                    onDragStart={() => {
                      const dragIds = selectedIds.includes(document.id) ? selectedIds : [document.id];
                      setDraggingIds(dragIds);
                    }}
                  >
                    <td className="px-3 py-3">
                      <input
                        aria-label={`Select ${document.name}`}
                        checked={selectedIds.includes(document.id)}
                        onChange={(event) => toggleRow(document.id, event.target.checked)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3 font-medium text-text">
                        {fileIcon(document.name)}
                        <span>{document.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-text">{displayType(document.name)}</td>
                    <td className="px-3 py-3 text-text">{formatDate(document.createdAt)}</td>
                    <td className="px-3 py-3 text-right text-text">{formatSize(document.fileSize)}</td>
                  </tr>
                ))}
                {!filtered.length && !folderRows.length && !folderDrafts.length ? (
                  <tr>
                    <td className="px-3 py-6 text-sm text-muted" colSpan={5}>
                      No files found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {moving ? <p className="mt-3 text-sm text-muted">Moving files...</p> : null}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>
      </section>

      <div className="mx-auto max-w-4xl rounded-[30px] border border-border bg-panel p-8">
        <p className="text-3xl font-medium text-text">Ask anything about this project...</p>
        <div className="mt-6 flex items-center gap-6 text-muted">
          <span>Files</span>
          <span>Prompts</span>
        </div>
        <div className="mt-6">
          <Link
            className="inline-flex items-center rounded-xl border border-border bg-bg px-4 py-2 text-sm font-medium text-text hover:bg-white"
            href={`/app/projects/${project.id}/assistant`}
          >
            Open AI Assistant
          </Link>
        </div>
      </div>
    </div>
  );
}
