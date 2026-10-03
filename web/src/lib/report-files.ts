export type ReportTable = {
  title: string;
  columns: string[];
  rows: string[][];
};

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function reportToCsv(table: ReportTable) {
  const lines = [
    table.columns.map(csvCell).join(","),
    ...table.rows.map((row) => row.map(csvCell).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function reportToExcel(table: ReportTable) {
  const header = table.columns
    .map((column) => `<Cell><Data ss:Type="String">${xml(column)}</Data></Cell>`)
    .join("");
  const body = table.rows
    .map((row) => {
      const cells = table.columns
        .map((_, index) => `<Cell><Data ss:Type="String">${xml(row[index] ?? "")}</Data></Cell>`)
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${xml(table.title.slice(0, 31) || "Report")}">
<Table>
<Row>${header}</Row>
${body}
</Table>
</Worksheet>
</Workbook>`;
}

function pdfLatin(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

export function reportToPdf(table: ReportTable) {
  const lines = [
    table.title,
    table.columns.join(" | "),
    ...table.rows.map((row) => row.join(" | ")),
  ].map((line) => pdfLatin(line).slice(0, 110));
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 45) {
    pages.push(lines.slice(index, index + 45));
  }
  if (!pages.length) pages.push([pdfLatin(table.title)]);

  const objects = new Map<number, string>();
  const pageIds: number[] = [];
  let nextId = 4;
  for (const page of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    const stream = page
      .map((line, lineIndex) => `BT /F1 10 Tf 48 ${800 - lineIndex * 16} Td (${line}) Tj ET`)
      .join("\n");
    objects.set(
      contentId,
      `${contentId} 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\n`,
    );
    objects.set(
      pageId,
      `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >> endobj\n`,
    );
  }
  objects.set(1, "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");
  objects.set(
    2,
    `2 0 obj << /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >> endobj\n`,
  );
  objects.set(3, "3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n");

  const ids = [...objects.keys()].sort((left, right) => left - right);
  let pdf = "%PDF-1.4\n";
  const offsets = new Map<number, number>();
  for (const id of ids) {
    offsets.set(id, pdf.length);
    pdf += objects.get(id);
  }
  const xref = pdf.length;
  const size = Math.max(...ids) + 1;
  pdf += `xref\n0 ${size}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id < size; id += 1) {
    pdf += `${String(offsets.get(id) ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}
