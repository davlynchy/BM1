"use client";

import * as React from "react";

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-panel p-6 shadow-panel">
        <button className="absolute right-6 top-5 text-sm text-muted" onClick={onClose} type="button">
            Close
        </button>
        <div className="text-center">
          <h2 className="font-heading text-2xl">{title}</h2>
          {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
