import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2 } from "lucide-react";
import { utils, writeFile } from "xlsx";
import jsPDF from "jspdf";

export interface ExportSection {
  title: string;
  rows: Array<Record<string, unknown>>;
}

interface Props { filename: string; sections: ExportSection[] }

function flatten(rows: Array<Record<string, unknown>>) {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      out[k] = typeof v === "object" && v !== null ? JSON.stringify(v) : v;
    }
    return out;
  });
}

export function ExportMenu({ filename, sections }: Props) {
  const [busy, setBusy] = useState(false);

  const toCSV = () => {
    setBusy(true);
    try {
      const lines: string[] = [];
      for (const s of sections) {
        lines.push(`# ${s.title}`);
        if (s.rows.length === 0) { lines.push(""); continue; }
        const headers = Object.keys(s.rows[0]);
        lines.push(headers.join(","));
        for (const r of flatten(s.rows)) {
          lines.push(headers.map((h) => JSON.stringify(r[h] ?? "")).join(","));
        }
        lines.push("");
      }
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${filename}.csv`; a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  };

  const toXLSX = () => {
    setBusy(true);
    try {
      const wb = utils.book_new();
      for (const s of sections) {
        const ws = utils.json_to_sheet(flatten(s.rows));
        utils.book_append_sheet(wb, ws, s.title.slice(0, 28) || "Sheet");
      }
      writeFile(wb, `${filename}.xlsx`);
    } finally { setBusy(false); }
  };

  const toPDF = () => {
    setBusy(true);
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      let y = 14;
      doc.setFontSize(14); doc.text(filename, 14, y); y += 8;
      doc.setFontSize(9);
      for (const s of sections) {
        if (y > 190) { doc.addPage(); y = 14; }
        doc.setFont("helvetica", "bold"); doc.text(s.title, 14, y); y += 5;
        doc.setFont("helvetica", "normal");
        if (s.rows.length === 0) { doc.text("Sem dados", 14, y); y += 8; continue; }
        const headers = Object.keys(s.rows[0]);
        const flat = flatten(s.rows);
        doc.text(headers.join(" | "), 14, y); y += 5;
        for (const r of flat.slice(0, 25)) {
          if (y > 195) { doc.addPage(); y = 14; }
          const line = headers.map((h) => String(r[h] ?? "")).join(" | ");
          doc.text(line.slice(0, 180), 14, y); y += 4;
        }
        y += 4;
      }
      doc.save(`${filename}.pdf`);
    } finally { setBusy(false); }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="ml-2">Exportar</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={toPDF}>PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={toXLSX}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={toCSV}>CSV</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}