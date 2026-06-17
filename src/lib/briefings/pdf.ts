import jsPDF from "jspdf";
import { getQuestions } from "./questions";
import { SERVICO_LABEL, type Briefing } from "./types";

export function downloadBriefingPdf(b: Briefing) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  doc.setFontSize(18);
  doc.setTextColor(20, 20, 30);
  doc.text("INFINDA Digital — Briefing", margin, y);
  y += 22;

  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`Serviço: ${SERVICO_LABEL[b.servico]}`, margin, y);
  y += 14;
  doc.text(`Cliente: ${b.cliente_nome ?? "-"}`, margin, y);
  y += 14;
  doc.text(`Empresa: ${b.empresa ?? "-"}`, margin, y);
  y += 14;
  doc.text(`Telefone: ${b.telefone ?? "-"}   E-mail: ${b.email ?? "-"}`, margin, y);
  y += 14;
  doc.text(`Responsável: ${b.responsavel ?? "-"}`, margin, y);
  y += 14;
  doc.text(`Data: ${new Date(b.created_at).toLocaleString("pt-BR")}`, margin, y);
  y += 20;

  const sections = getQuestions(b.servico);
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  const ensureSpace = (h: number) => {
    if (y + h > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  for (const section of sections) {
    ensureSpace(28);
    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.text(section.title, margin, y);
    y += 16;

    for (const q of section.questions) {
      const ans = (b.respostas_json?.[`${section.id}.${q.id}`] ?? "—") as string;
      const labelLines = doc.splitTextToSize(q.label, pageW - margin * 2);
      const ansLines = doc.splitTextToSize(ans || "—", pageW - margin * 2);
      const h = labelLines.length * 12 + ansLines.length * 12 + 10;
      ensureSpace(h);
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(labelLines, margin, y);
      y += labelLines.length * 12;
      doc.setFontSize(10);
      doc.setTextColor(20);
      doc.text(ansLines, margin, y);
      y += ansLines.length * 12 + 8;
    }
    y += 8;
  }

  if (b.resumo_ia) {
    ensureSpace(40);
    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.text("Resumo Executivo (IA)", margin, y);
    y += 16;
    doc.setFontSize(10);
    doc.setTextColor(40);
    const lines = doc.splitTextToSize(b.resumo_ia, pageW - margin * 2);
    for (const line of lines) {
      ensureSpace(14);
      doc.text(line, margin, y);
      y += 12;
    }
  }

  doc.save(`briefing-${b.cliente_nome ?? b.id}.pdf`);
}