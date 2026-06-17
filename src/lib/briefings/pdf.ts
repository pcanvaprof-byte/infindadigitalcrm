import jsPDF from "jspdf";
import { getQuestions } from "./questions";
import { SERVICO_LABEL, TIPO_LABEL, type Briefing } from "./types";

const BRAND = { r: 16, g: 24, b: 40 };
const ACCENT = { r: 99, g: 102, b: 241 };

const COMERCIAL_SECTIONS = [
  ["Resumo Executivo", /^(1[\.\)]|resumo executivo)/i],
  ["Objetivos Identificados", /^(2[\.\)]|objetivo)/i],
  ["Público-Alvo", /^(3[\.\)]|p[úu]blico)/i],
  ["Principais Dores", /^(4[\.\)]|dores|principais dores)/i],
  ["Oportunidades Detectadas", /^(5[\.\)]|oportunidades)/i],
  ["Escopo Recomendado", /^(6[\.\)]|escopo)/i],
  ["Serviços Recomendados", /^(7[\.\)]|servi[çc]os)/i],
  ["Próximos Passos", /^(8[\.\)]|pr[óo]ximos)/i],
] as const;

export function downloadBriefingPdf(b: Briefing) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  const isKickoff = b.tipo === "kickoff_producao";

  // Cabeçalho com "logo" tipográfica
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(margin, 22, 26, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("I", margin + 13, 41, { align: "center" });
  doc.setFontSize(15);
  doc.text("INFINDA Digital", margin + 38, 36);
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 220);
  doc.text("CRM · IA · Automação", margin + 38, 50);
  doc.setFontSize(10);
  doc.text(
    isKickoff ? "Resumo Operacional" : "Diagnóstico Estratégico",
    pageW - margin, 36, { align: "right" },
  );
  doc.text(new Date().toLocaleDateString("pt-BR"), pageW - margin, 50, { align: "right" });
  y = 90;

  // Bloco de dados do cliente
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFontSize(13);
  doc.text(TIPO_LABEL[b.tipo], margin, y);
  y += 18;

  doc.setFontSize(11);
  doc.setTextColor(70);
  const dados: [string, string][] = [
    ["Empresa", b.empresa ?? "—"],
    ["Contato", b.cliente_nome ?? "—"],
    ["Serviço contratado", SERVICO_LABEL[b.servico]],
    ["Telefone", b.telefone ?? "—"],
    ["E-mail", b.email ?? "—"],
    ["Responsável INFINDA", b.responsavel ?? "—"],
    ["Data de geração", new Date().toLocaleString("pt-BR")],
  ];
  for (const [k, v] of dados) {
    doc.setTextColor(120);
    doc.text(`${k}:`, margin, y);
    doc.setTextColor(30);
    doc.text(v, margin + 130, y);
    y += 14;
  }
  y += 6;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  const ensureSpace = (h: number) => {
    if (y + h > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const heading = (title: string) => {
    ensureSpace(30);
    doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.rect(margin, y - 10, 3, 14, "F");
    doc.setFontSize(12);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(title, margin + 10, y);
    y += 16;
  };

  // === SEÇÃO IA (em destaque, antes das perguntas) ===
  if (b.resumo_ia) {
    const parsed = splitResumoSections(b.resumo_ia);
    if (parsed.size) {
      for (const [title, rx] of COMERCIAL_SECTIONS) {
        const body = pickSection(parsed, rx);
        if (!body) continue;
        heading(title);
        const lines = doc.splitTextToSize(body, pageW - margin * 2);
        doc.setFontSize(10);
        doc.setTextColor(40);
        for (const line of lines) {
          ensureSpace(14);
          doc.text(line, margin, y);
          y += 12;
        }
        y += 8;
      }
    } else {
      heading(isKickoff ? "Resumo Operacional (IA)" : "Diagnóstico Estratégico (IA)");
      doc.setFontSize(10);
      doc.setTextColor(40);
      const lines = doc.splitTextToSize(b.resumo_ia, pageW - margin * 2);
      for (const line of lines) {
        ensureSpace(14);
        doc.text(line, margin, y);
        y += 12;
      }
      y += 10;
    }
  }

  // === Perguntas e respostas do briefing ===
  heading("Perguntas e Respostas do Briefing");
  const sections = getQuestions(b.tipo, b.servico);
  for (const section of sections) {
    ensureSpace(28);
    doc.setFontSize(11);
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(section.title, margin, y);
    y += 16;

    for (const q of section.questions) {
      const ans = (b.respostas_json?.[`${section.id}.${q.id}`] ?? "—") as string;
      const labelLines = doc.splitTextToSize(q.label, pageW - margin * 2);
      const ansLines = doc.splitTextToSize(ans || "—", pageW - margin * 2);
      const h = labelLines.length * 12 + ansLines.length * 12 + 10;
      ensureSpace(h);
      doc.setFontSize(10);
      doc.setTextColor(110);
      doc.text(labelLines, margin, y);
      y += labelLines.length * 12;
      doc.setFontSize(10);
      doc.setTextColor(30);
      doc.text(ansLines, margin, y);
      y += ansLines.length * 12 + 8;
    }
    y += 8;
  }

  // Rodapé
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160);
    doc.text(
      `INFINDA Digital — ${TIPO_LABEL[b.tipo]} — gerado em ${new Date().toLocaleString("pt-BR")}`,
      margin, doc.internal.pageSize.getHeight() - 18,
    );
    doc.text(`${i}/${pages}`, pageW - margin, doc.internal.pageSize.getHeight() - 18, { align: "right" });
  }

  doc.save(`${isKickoff ? "kickoff" : "briefing"}-${b.cliente_nome ?? b.id}.pdf`);
}

function splitResumoSections(text: string): Map<number, string> {
  // Quebra o resumo IA em blocos pelos marcadores "1.", "2.", etc.
  const map = new Map<number, string>();
  const lines = text.split(/\r?\n/);
  let current = 0;
  let buf: string[] = [];
  const flush = () => {
    if (current && buf.length) map.set(current, buf.join("\n").trim());
    buf = [];
  };
  for (const ln of lines) {
    const m = ln.match(/^\s*(\d+)[\.\)]\s+(.*)$/);
    if (m) { flush(); current = Number(m[1]); buf.push(m[2]); }
    else buf.push(ln);
  }
  flush();
  return map;
}

function pickSection(map: Map<number, string>, rx: RegExp): string | null {
  for (const [idx, body] of map.entries()) {
    if (rx.test(`${idx}. ${body.split("\n")[0] ?? ""}`)) return body;
  }
  return null;
}