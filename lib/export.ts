import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { exportsDir, type SessionRecord } from "./sessions.js";

function safeName(record: SessionRecord) {
  const stamp = record.createdAt.replace(/[:.]/g, "-");
  const target = (record.target || "local")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 40);
  return `evron-${record.tool}-${target}-${stamp}`;
}

export function sessionToMarkdown(record: SessionRecord) {
  const lines = [
    `# EVRON — ${record.title}`,
    "",
    `- **Tool:** ${record.tool}`,
    `- **Target:** ${record.target || "n/a"}`,
    `- **When:** ${record.createdAt}`,
    `- **Summary:** ${record.summary}`,
    "",
    "## Report",
    "",
    "```",
    ...record.lines,
    "```",
    "",
  ];
  return lines.join("\n");
}

export function sessionToJson(record: SessionRecord) {
  return JSON.stringify(record, null, 2);
}

/** Minimal single-page text PDF (no external deps). */
export function sessionToPdf(record: SessionRecord) {
  const bodyLines = [
    `EVRON — ${record.title}`,
    `Tool: ${record.tool}`,
    `Target: ${record.target || "n/a"}`,
    `When: ${record.createdAt}`,
    `Summary: ${record.summary}`,
    "",
    ...record.lines,
  ].map((line) => line.replace(/[()\\]/g, "\\$&").slice(0, 95));

  const content: string[] = ["BT", "/F1 9 Tf", "50 780 Td", "12 TL"];
  for (const [index, line] of bodyLines.entries()) {
    if (index === 0) content.push(`(${line}) Tj`);
    else content.push(`T* (${line}) Tj`);
  }
  content.push("ET");
  const stream = content.join("\n");

  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj",
  );
  objects.push(
    `4 0 obj<< /Length ${Buffer.byteLength(stream, "utf8")} >>stream\n${stream}\nendstream\nendobj`,
  );
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>endobj");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  }
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xref}\n%%EOF\n`;
  return pdf;
}

export type ExportFormat = "md" | "json" | "pdf";

export function exportSession(record: SessionRecord, format: ExportFormat) {
  const base = safeName(record);
  const dir = exportsDir();
  if (format === "md") {
    const path = join(dir, `${base}.md`);
    writeFileSync(path, sessionToMarkdown(record), "utf8");
    return path;
  }
  if (format === "json") {
    const path = join(dir, `${base}.json`);
    writeFileSync(path, sessionToJson(record), "utf8");
    return path;
  }
  const path = join(dir, `${base}.pdf`);
  writeFileSync(path, sessionToPdf(record), "utf8");
  return path;
}
