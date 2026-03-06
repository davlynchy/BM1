"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

type TextBox = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
  highlighted: boolean;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNeedleCandidates(searchPhrase: string) {
  const normalized = normalize(searchPhrase);
  if (!normalized) {
    return [];
  }
  const tokens = normalized.split(" ").filter((token) => token.length >= 3);
  const longNeedle = tokens.slice(0, 24).join(" ").trim();
  const mediumNeedle = tokens.slice(0, 14).join(" ").trim();
  const shortNeedle = tokens.slice(0, 8).join(" ").trim();
  return [longNeedle, mediumNeedle, shortNeedle].filter((value, index, arr) => value.length >= 16 && arr.indexOf(value) === index);
}

export function PdfCitationViewer({
  src,
  pageNumber,
  searchPhrase,
  title,
}: {
  src: string;
  pageNumber: number;
  searchPhrase: string;
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const runIdRef = useRef(0);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const needleCandidates = useMemo(() => buildNeedleCandidates(searchPhrase), [searchPhrase]);

  useEffect(() => {
    let cancelled = false;
    runIdRef.current += 1;
    const runId = runIdRef.current;

    setLoading(true);
    setError(null);
    setTextBoxes([]);

    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;
    loadingTaskRef.current?.destroy();
    loadingTaskRef.current = null;

    async function render() {
      try {
        const response = await fetch(src, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to load document.");
        }
        const bytes = await response.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: bytes, disableWorker: true } as unknown as Parameters<typeof pdfjsLib.getDocument>[0]);
        loadingTaskRef.current = loadingTask;
        const pdf = await loadingTask.promise;
        if (cancelled || runId !== runIdRef.current) {
          return;
        }

        const safePage = Math.max(1, Math.min(pageNumber, pdf.numPages));
        const page = await pdf.getPage(safePage);
        if (cancelled || runId !== runIdRef.current) {
          return;
        }

        const viewport = page.getViewport({ scale: 1.6, rotation: 0 });
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }

        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Unable to render document.");
        }

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const renderTask = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;
        if (cancelled || runId !== runIdRef.current) {
          return;
        }

        const textContent = await page.getTextContent();
        if (cancelled || runId !== runIdRef.current) {
          return;
        }

        const rawItems: TextBox[] = [];
        textContent.items.forEach((item, index) => {
          if (!("str" in item) || !item.str) {
            return;
          }
          const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const x = transform[4];
          const y = transform[5];
          const height = Math.hypot(transform[2], transform[3]) || 10;
          const width = Math.max(1, (item.width ?? 0) * viewport.scale);
          const top = viewport.height - y - height;

          rawItems.push({
            id: `t-${index}`,
            left: x,
            top,
            width,
            height,
            text: String(item.str),
            highlighted: false,
          });
        });

        const itemOffsets: Array<{ index: number; start: number; end: number }> = [];
        let cursor = 0;
        const combinedText = rawItems
          .map((item, index) => {
            const value = normalize(item.text);
            const start = cursor;
            const end = start + value.length;
            itemOffsets.push({ index, start, end });
            cursor = end + 1;
            return value;
          })
          .join(" ");

        const highlightedIndexes = new Set<number>();
        for (const needle of needleCandidates) {
          const startAt = combinedText.indexOf(needle);
          if (startAt < 0) {
            continue;
          }
          const endAt = startAt + needle.length;
          for (const entry of itemOffsets) {
            if (entry.end < startAt || entry.start > endAt) {
              continue;
            }
            highlightedIndexes.add(entry.index);
          }
          if (highlightedIndexes.size > 0) {
            break;
          }
        }

        const boxes = rawItems.map((item, index) => ({
          ...item,
          highlighted: highlightedIndexes.has(index),
        }));
        setTextBoxes(boxes);
        setLoading(false);

        const firstHighlight = boxes.find((box) => box.highlighted);
        if (firstHighlight && containerRef.current) {
          containerRef.current.scrollTo({
            left: Math.max(firstHighlight.left - 120, 0),
            top: Math.max(firstHighlight.top - 120, 0),
          });
        } else if (containerRef.current) {
          containerRef.current.scrollTo({ left: 0, top: 0 });
        }
      } catch (renderError) {
        if (cancelled || runId !== runIdRef.current) {
          return;
        }
        const message = renderError instanceof Error ? renderError.message : "Unable to render document.";
        if (message.includes("RenderingCancelledException")) {
          return;
        }
        setLoading(false);
        setError(message);
      }
    }

    void render();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
    };
  }, [needleCandidates, pageNumber, src]);

  return (
    <div className="relative h-[820px] w-full overflow-auto rounded-lg border border-border bg-[#f7f7f7]" ref={containerRef}>
      {loading ? <p className="p-3 text-sm text-muted">Loading document...</p> : null}
      {error ? <p className="p-3 text-sm text-red-600">{error}</p> : null}
      <div className="relative w-max p-3">
        <canvas aria-label={title} ref={canvasRef} />
        {textBoxes.map((box) =>
          box.highlighted ? (
            <div
              className="pointer-events-none absolute rounded-sm border border-lime-600 bg-lime-300/35"
              key={box.id}
              style={{
                left: `${box.left + 12}px`,
                top: `${box.top + 12}px`,
                width: `${box.width}px`,
                height: `${Math.max(12, box.height)}px`,
              }}
              title={box.text}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}
