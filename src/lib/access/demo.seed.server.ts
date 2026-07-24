// Server-only: popula uma organização Demo com dados fictícios para
// experimentação. Idempotente — pode rodar múltiplas vezes sem duplicar.
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>;

const SEGMENTS = ["Estética", "Odontologia", "Advocacia", "Educação", "E-commerce"];
const CITIES = [
  ["São Paulo", "SP"],
  ["Rio de Janeiro", "RJ"],
  ["Belo Horizonte", "MG"],
  ["Curitiba", "PR"],
  ["Porto Alegre", "RS"],
  ["Salvador", "BA"],
  ["Recife", "PE"],
  ["Fortaleza", "CE"],
];
const FIRST_NAMES = [
  "Ana", "Bruno", "Camila", "Diego", "Eduarda", "Felipe", "Gabriela",
  "Henrique", "Isabela", "João", "Karina", "Lucas", "Mariana", "Nícolas",
  "Olívia", "Pedro", "Rafaela", "Sofia", "Tiago", "Vitória",
];
const LAST_NAMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Costa", "Almeida", "Ferreira",
  "Rodrigues", "Nascimento", "Cardoso", "Lima", "Ribeiro",
];
const COMPANY_PREFIX: Record<string, string[]> = {
  Estética: ["Clínica Bella", "Studio Glow", "Estética Íris", "Espaço Renove"],
  Odontologia: ["Odonto Vida", "Clínica Sorrir", "Dental Care", "OdontoMax"],
  Advocacia: ["Costa & Filhos Advogados", "Silva Advocacia", "Barros Legal", "Jus & Cia"],
  Educação: ["Colégio Norte", "Escola Futuro", "Instituto Alpha", "Curso Ápice"],
  "E-commerce": ["LojaFácil", "Comprou Chegou", "Prime Store", "Mundo Digital"],
};
const STATUS_POOL = [
  "nao_contatado",
  "nao_contatado",
  "nao_contatado",
  "primeiro_contato",
  "primeiro_contato",
  "qualificado",
  "qualificado",
  "reuniao_agendada",
  "proposta_enviada",
  "fechado_ganho",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function digits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}
function fakePhone(): string {
  return `55${digits(2)}9${digits(8)}`;
}
function fakeEmail(name: string, company: string): string {
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  return `${slug(name.split(" ")[0])}@${slug(company).slice(0, 20) || "empresa"}.demo`;
}

export interface DemoSeedContext {
  admin: AnyClient;
  organizationId: string;
  userId: string;
  fullName: string;
}

/** Popula a organização demo. Nunca lança — cada bloco é isolado. */
export async function seedDemoOrganization(ctx: DemoSeedContext): Promise<void> {
  const { admin, organizationId, userId } = ctx;

  // 1) business_profile
  try {
    await admin.from("business_profiles").upsert(
      {
        org_id: organizationId,
        user_id: userId,
        created_by: userId,
        updated_by: userId,
        description: "Empresa demo do INFINDA para experimentação da plataforma.",
        product: "Consultoria digital e gestão comercial.",
        ideal_customer: "PMEs entre 5 e 50 colaboradores.",
        region: "Brasil",
        niche: "Serviços",
        audience: "Gestores comerciais e sócios",
        language: "pt-BR",
        tone: "profissional-amigável",
        focus: "aumentar vendas recorrentes",
        pains: ["Poucos leads qualificados", "Baixa conversão", "Times desorganizados"],
        benefits: ["Pipeline claro", "Automações de cadência", "Dashboard executivo"],
        triggers: ["queda de vendas", "meta não batida"],
        approach: "consultiva",
        initial_message:
          "Olá {{nome}}! Vi que a {{empresa}} atua no setor e ajudo empresas como a sua a organizar o comercial. Posso te mostrar como em 15 minutos?",
        onboarding_status: "ready",
      },
      { onConflict: "org_id,user_id" },
    );
  } catch {
    /* noop */
  }

  // 2) prospects
  const prospectIds: string[] = [];
  try {
    const rows = Array.from({ length: 40 }, () => {
      const segment = pick(SEGMENTS);
      const company = `${pick(COMPANY_PREFIX[segment])} ${digits(3)}`;
      const owner = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      const [city, state] = pick(CITIES);
      const phone = fakePhone();
      return {
        user_id: userId,
        company,
        segment,
        owner_name: owner,
        whatsapp: phone,
        phone,
        email: fakeEmail(owner, company),
        instagram: "",
        city,
        state,
        source: "Demo",
        potential: pick(["alto", "medio", "medio", "baixo"]),
        status: pick(STATUS_POOL),
      };
    });
    const { data } = await admin.from("prospects").insert(rows).select("id");
    if (data) prospectIds.push(...data.map((r: { id: string }) => r.id));
  } catch {
    /* noop */
  }

  // 3) clients (5)
  const clientIds: string[] = [];
  try {
    const stages: Array<"ATIVO" | "IMPLANTACAO" | "PROPOSTA" | "REUNIAO_INICIAL"> = [
      "ATIVO",
      "ATIVO",
      "IMPLANTACAO",
      "PROPOSTA",
      "REUNIAO_INICIAL",
    ];
    const rows = stages.map((stage) => {
      const segment = pick(SEGMENTS);
      const company = `${pick(COMPANY_PREFIX[segment])} ${digits(3)}`;
      const owner = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      const [city, state] = pick(CITIES);
      return {
        user_id: userId,
        organization_id: organizationId,
        company,
        segment,
        contact_name: owner,
        owner_name: owner,
        whatsapp: fakePhone(),
        phone: fakePhone(),
        email: fakeEmail(owner, company),
        city,
        state,
        pipeline_stage: stage,
        tags: ["demo"],
        notes: "Cliente fictício da demonstração.",
      };
    });
    const { data } = await admin.from("clients").insert(rows).select("id");
    if (data) clientIds.push(...data.map((r: { id: string }) => r.id));
  } catch {
    /* noop */
  }

  // 4) cad_leads (12) + cad_messages
  try {
    if (prospectIds.length > 0) {
      const stages = [
        "followup_1",
        "followup_1",
        "followup_2",
        "followup_2",
        "followup_3",
        "interessado",
        "interessado",
        "reuniao_agendada",
        "reuniao_agendada",
        "proposta_enviada",
        "negociacao",
        "followup_1",
      ];
      const leadRows = stages.map((stage, i) => {
        const seg = pick(SEGMENTS);
        const company = `${pick(COMPANY_PREFIX[seg])} ${digits(3)}`;
        const owner = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
        const daysAgo = 1 + Math.floor(Math.random() * 15);
        const primeira = new Date(Date.now() - daysAgo * 86400_000).toISOString();
        const nextIn = 1 + Math.floor(Math.random() * 5);
        return {
          organization_id: organizationId,
          owner_id: userId,
          prospect_id: prospectIds[i] ?? null,
          empresa: company,
          responsavel: owner,
          telefone: fakePhone(),
          whatsapp: fakePhone(),
          email: fakeEmail(owner, company),
          stage,
          temperatura: pick(["frio", "morno", "quente"]),
          primeira_abordagem_at: primeira,
          last_contact_at: primeira,
          next_action_at: new Date(Date.now() + nextIn * 86400_000).toISOString(),
        };
      });
      const { data: leads } = await admin
        .from("cad_leads")
        .insert(leadRows)
        .select("id");
      const leadIds = (leads ?? []).map((r: { id: string }) => r.id);

      // 6 mensagens de exemplo
      if (leadIds.length > 0) {
        const msgs = leadIds.slice(0, 6).map((leadId) => ({
          organization_id: organizationId,
          lead_id: leadId,
          author_id: userId,
          tipo: "whatsapp",
          direction: "out",
          mensagem:
            "Olá! Seguindo aqui o retorno sobre nossa conversa. Consegue falar hoje à tarde?",
          status: "enviada",
        }));
        await admin.from("cad_messages").insert(msgs);
      }

      // 6 notificações pendentes
      if (leadIds.length > 0) {
        const notifs = leadIds.slice(0, 6).map((leadId) => ({
          organization_id: organizationId,
          lead_id: leadId,
          kind: "acao_hoje",
          payload: { origem: "demo" },
        }));
        // Ignora conflitos de unique index
        await admin.from("cad_notifications").insert(notifs);
      }
    }
  } catch {
    /* noop */
  }

  // 5) deals — só se conseguimos criar clients e se houver deal_stages padrão.
  try {
    if (clientIds.length > 0) {
      const { data: existingStages } = await admin
        .from("deal_stages")
        .select("id")
        .eq("organization_id", organizationId)
        .limit(1);
      const hasStages = (existingStages ?? []).length > 0;
      const stageId = hasStages ? (existingStages![0].id as string) : null;
      if (stageId) {
        const rows = clientIds.slice(0, 4).map((clientId, i) => ({
          user_id: userId,
          organization_id: organizationId,
          client_id: clientId,
          title: `Oportunidade Demo #${i + 1}`,
          value: 3000 + Math.floor(Math.random() * 12000),
          stage_id: stageId,
          owner_name: "Demo Admin",
          notes: "Oportunidade fictícia da demonstração.",
        }));
        await admin.from("deals").insert(rows);
      }
    }
  } catch {
    /* noop */
  }
}