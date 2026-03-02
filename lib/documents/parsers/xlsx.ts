import * as XLSX from "xlsx";

import type { ParsedDocument } from "@/lib/documents/parsers/types";

export async function parseXlsx(buffer: Buffer): Promise<ParsedDocument> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const pages = workbook.SheetNames.flatMap((sheetName, sheetIndex) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    const blocks = rows
      .map((row, rowIndex) => {
        const text = row
          .map((cell) => String(cell ?? "").trim())
          .filter(Boolean)
          .join(" | ");
        return text ? `Row ${rowIndex + 1}: ${text}` : "";
      })
      .filter(Boolean);

    const content = [`Sheet: ${sheetName}`, ...blocks].join("\n");

    return [
      {
        pageNumber: sheetIndex + 1,
        content,
        metadata: {
          sourceType: "xlsx",
          parser: "xlsx",
          sheetName,
          charCount: content.length,
        },
      },
    ];
  });

  if (!pages.length) {
    throw new Error("No readable sheet data found in spreadsheet.");
  }

  return {
    pages,
    parserVersion: "xlsx@1",
  };
}
