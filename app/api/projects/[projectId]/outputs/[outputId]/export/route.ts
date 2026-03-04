import { NextResponse } from "next/server";

import { getProjectOutput } from "@/lib/outputs/store";
import { requireProjectAccess } from "@/lib/projects/access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; outputId: string }> },
) {
  try {
    const { projectId, outputId } = await params;
    await requireProjectAccess(projectId);
    const output = await getProjectOutput(outputId, projectId);

    if (!output) {
      return NextResponse.json({ error: "Output not found." }, { status: 404 });
    }

    const url = new URL(request.url);
    const format = (url.searchParams.get("format") || "txt").toLowerCase();
    const baseName = output.title.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "output";

    if (format === "docx") {
      const { Document, Packer, Paragraph } = await import("docx");
      const paragraphs = output.body.split(/\r?\n/).map((line) => new Paragraph(line || " "));
      const doc = new Document({
        sections: [{ properties: {}, children: paragraphs }],
      });
      const buffer = await Packer.toBuffer(doc);
      const arrayBuffer = Uint8Array.from(buffer).buffer as ArrayBuffer;

      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${baseName}.docx"`,
        },
      });
    }

    if (format === "pdf") {
      const { PDFDocument, StandardFonts } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      let page = pdf.addPage([612, 792]);
      const fontSize = 11;
      const lineHeight = 16;
      const marginX = 50;
      let y = page.getHeight() - 50;
      const maxWidth = page.getWidth() - marginX * 2;

      const rawLines = output.body.split(/\r?\n/);
      const lines: string[] = [];

      rawLines.forEach((rawLine) => {
        const words = rawLine.split(/\s+/).filter(Boolean);

        if (!words.length) {
          lines.push("");
          return;
        }

        let current = words[0];
        for (let index = 1; index < words.length; index += 1) {
          const candidate = `${current} ${words[index]}`;
          if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
            current = candidate;
          } else {
            lines.push(current);
            current = words[index];
          }
        }
        lines.push(current);
      });

      lines.forEach((line) => {
        if (y <= 50) {
          page = pdf.addPage([612, 792]);
          y = page.getHeight() - 50;
        }
        page.drawText(line, {
          x: marginX,
          y,
          size: fontSize,
          font,
        });
        y -= lineHeight;
      });

      const bytes = await pdf.save();
      const arrayBuffer = Uint8Array.from(bytes).buffer as ArrayBuffer;
      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
        },
      });
    }

    return new NextResponse(output.body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.txt"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export output.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
