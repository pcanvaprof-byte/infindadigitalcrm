// Templates de prospecção por nicho — usados como fallback no
// `openWhats` quando o pack de templates da cadência não tem
// mensagem configurada para o passo atual.
//
// A detecção olha primeiro o `company` (nome fantasia contém
// palavras-chave do nicho) e cai no `segment` cadastrado.
// Todas as mensagens usam `{{primeiro_nome}}` — a variável é
// resolvida por `renderTemplate` e limpa por `sanitizeTemplateForSend`.
import { chooseVariant } from "@/lib/prospeccao/variant-telemetry";

export type NicheKey =
  | "restaurante"
  | "cafeteria"
  | "pizzaria"
  | "hamburgueria"
  | "confeitaria"
  | "acougue"
  | "mercado"
  | "farmacia"
  | "petshop"
  | "salao"
  | "barbearia"
  | "academia"
  | "materiais_construcao"
  | "moveis"
  | "roupas"
  | "autopecas"
  | "recem_aberta"
  | "generico";

export const NICHE_LABELS: Record<NicheKey, string> = {
  restaurante: "Restaurantes",
  cafeteria: "Cafeterias",
  pizzaria: "Pizzarias",
  hamburgueria: "Hamburguerias",
  confeitaria: "Confeitarias e Padarias",
  acougue: "Açougues",
  mercado: "Mercados e Hortifruti",
  farmacia: "Farmácias e Drogarias",
  petshop: "Pet Shops e Veterinárias",
  salao: "Salões de Beleza e Estética",
  barbearia: "Barbearias",
  academia: "Academias e Studios",
  materiais_construcao: "Materiais de Construção",
  moveis: "Móveis e Decoração",
  roupas: "Moda e Vestuário",
  autopecas: "Autopeças e Oficinas",
  recem_aberta: "Empresas Recém-Abertas",
  generico: "Genérico (fallback)",
};

export const NICHE_KEYS = Object.keys(NICHE_LABELS) as NicheKey[];

export const NICHE_TEMPLATES: Record<NicheKey, string> = {
  restaurante: `Oi, {{primeiro_nome}}, tudo bem?

Passei pra falar rapidinho sobre uma ideia que tem ajudado bastante restaurantes por aqui: um cardápio digital ligado ao WhatsApp, que agiliza os pedidos e evita a taxa alta dos aplicativos.

Dá pra atualizar pratos e promoções em tempo real, e o cliente pede direto pelo chat.

Posso te mostrar rapidamente como funciona?`,
  cafeteria: `Oi, {{primeiro_nome}}, tudo bem?

Estou falando com cafeterias da região sobre uma forma simples de organizar o cardápio no WhatsApp — com os cafés, doces e novidades sempre à mão do cliente.

Ajuda a divulgar sazonais (café gelado no verão, panetone no fim do ano) sem depender de post ou stories.

Faz sentido eu te mostrar em poucos minutos?`,
  pizzaria: `Oi, {{primeiro_nome}}, tudo bem?

Vi a pizzaria e queria te mostrar rapidinho uma ideia que tem funcionado bem por aqui: um cardápio digital no WhatsApp com os sabores, borda, adicionais e combos organizados.

O cliente monta o pedido sozinho e chega prontinho pra vocês, sem ficar tirando dúvida por mensagem.

Posso te enviar um exemplo?`,
  hamburgueria: `E aí, {{primeiro_nome}}, tudo certo?

Passei pra te mostrar uma forma prática de deixar o cardápio da hamburgueria no WhatsApp — com os burgers, combos, adicionais e ponto da carne já organizados.

Diminui bastante aquela ida e volta pra fechar pedido e ajuda em dias cheios.

Faz sentido eu te mandar um exemplo rápido?`,
  confeitaria: `Oi, {{primeiro_nome}}, tudo bem?

Vi os doces de vocês e imaginei que um catálogo digital ajudaria bastante — bolos, doces finos e encomendas com foto, sabor e valor, tudo direto no WhatsApp.

Cliente escolhe com calma e vocês recebem o pedido já pronto pra confirmar.

Posso te mostrar como fica?`,
  acougue: `Oi, {{primeiro_nome}}, tudo bem?

Passei pra falar de uma ideia que tem ajudado bastante açougues aqui da região: um catálogo digital no WhatsApp com os cortes, kits de churrasco e ofertas da semana.

O cliente vê tudo antes e já fecha o pedido, sem precisar ligar pra perguntar preço.

Posso te mostrar rapidamente?`,
  mercado: `Oi, {{primeiro_nome}}, tudo bem?

Estou falando com mercados aqui da região sobre uma forma simples de organizar produtos e ofertas da semana num catálogo digital no WhatsApp.

Ajuda no tele-entrega e o cliente consegue montar a lista sem precisar ir até a loja.

Faz sentido eu te mostrar em poucos minutos?`,
  farmacia: `Oi, {{primeiro_nome}}, tudo bem?

Passei pra te mostrar uma ideia que tem ajudado bastante farmácias: um catálogo digital no WhatsApp com medicamentos, perfumaria e conveniência organizados por categoria.

Facilita a consulta de preço e o pedido de entrega, sem sobrecarregar o balconista com dúvida por telefone.

Posso te mostrar como funciona?`,
  petshop: `Oi, {{primeiro_nome}}, tudo bem?

Vi o pet shop e queria te mostrar uma ideia que tem funcionado bem: um catálogo digital com rações, acessórios, medicamentos e serviços (banho, tosa, consulta) direto no WhatsApp.

O tutor consulta sozinho, agenda ou pede a entrega sem tomar tempo do atendimento.

Posso te mandar um exemplo?`,
  salao: `Oi, {{primeiro_nome}}, tudo bem?

Passei pra falar de uma forma simples de mostrar todos os serviços do salão pelo WhatsApp — com valores, tempo de cada procedimento e produtos que vocês vendem, tudo organizado.

A cliente escolhe com calma e o agendamento fica bem mais tranquilo.

Faz sentido eu te mostrar rapidinho?`,
  barbearia: `E aí, {{primeiro_nome}}, tudo certo?

Passei pra te mostrar uma ideia que tem funcionado bem em barbearia: um catálogo no WhatsApp com os serviços, combos (corte + barba), produtos e horários, tudo direto pro cliente consultar.

Reduz aquela troca de mensagens antes de agendar.

Posso te mandar um exemplo?`,
  academia: `Oi, {{primeiro_nome}}, tudo bem?

Estou falando com academias sobre uma forma prática de apresentar planos, modalidades e horários pelo WhatsApp, num catálogo digital que o interessado consulta sozinho.

Ajuda a converter mais visitas em matrículas, porque a pessoa já chega sabendo o que quer.

Faz sentido eu te mostrar em poucos minutos?`,
  materiais_construcao: `Oi, {{primeiro_nome}}, tudo bem?

Passei pra te mostrar uma forma prática de organizar os produtos da loja num catálogo digital no WhatsApp — cimento, tinta, hidráulica, elétrica, tudo por categoria.

Agiliza bastante o orçamento e o cliente já consulta o preço antes de ir até a loja.

Posso te mostrar como fica?`,
  moveis: `Oi, {{primeiro_nome}}, tudo bem?

Vi a loja de vocês e imaginei que um catálogo digital ajudaria bastante — os móveis expostos com foto, medida e valor, direto no WhatsApp.

O cliente pesquisa em casa com calma e chega mais decidido, o que costuma encurtar bem a venda.

Faz sentido eu te mostrar rapidamente?`,
  roupas: `Oi, {{primeiro_nome}}, tudo bem?

Passei pra falar de uma forma simples de mostrar as coleções pelo WhatsApp — novidades, tamanhos disponíveis e promoções organizadas, sem depender só do Instagram.

A cliente escolhe as peças e já reserva ou fecha a compra pelo chat.

Posso te mandar um exemplo rápido?`,
  autopecas: `E aí, {{primeiro_nome}}, tudo certo?

Passei pra te mostrar uma ideia que tem ajudado bastante autopeças e oficinas: um catálogo digital no WhatsApp com peças, serviços e valores, organizado pra consulta rápida.

Ajuda a fechar orçamento mais rápido e reduz a fila de dúvidas por telefone.

Posso te mostrar como funciona?`,
  recem_aberta: `Oi, {{primeiro_nome}}, tudo bem?

Vi que a empresa foi aberta há pouco tempo — parabéns pela nova fase!

Nessa fase inicial, ter os produtos e serviços organizados num catálogo digital no WhatsApp ajuda bastante a passar mais profissionalismo e facilitar o atendimento desde o começo.

Posso te mostrar rapidamente como funciona?
---
Oi, {{primeiro_nome}}, tudo certo?

Passando pra desejar boa sorte na abertura da empresa!

Ajudamos negócios que estão começando a ter uma presença digital organizada no WhatsApp — catálogo com produtos, valores e serviços à mão do cliente desde o primeiro atendimento.

Faz sentido eu te mostrar em poucos minutos?
---
Olá, {{primeiro_nome}}, tudo bem?

Vi que a empresa é recente — momento gostoso e cheio de coisa pra organizar.

Uma das coisas que costuma facilitar bastante nessa fase é ter um catálogo digital no WhatsApp, com produtos e serviços prontos pra apresentar sempre que um cliente novo chegar.

Quer que eu te mostre como fica?
---
Oi, {{primeiro_nome}}, tudo bem?

Parabéns pela abertura da empresa! Passei pra falar rapidamente de uma ideia que ajuda bastante nesse começo: um catálogo digital simples, ligado ao WhatsApp, pra apresentar os produtos e responder cliente sem ficar mandando foto solta.

Posso te mandar um exemplo curto?
---
Oi, {{primeiro_nome}}, tudo certo?

Vi que vocês abriram há pouco — imagino o corre.

Ajudamos negócios nessa fase inicial a organizar catálogo, serviços e atendimento pelo WhatsApp de um jeito profissional, sem complicar.

Consegue 3 minutinhos pra eu te mostrar?`,
  generico: `Oi, {{primeiro_nome}}, tudo bem?

Passei pra te mostrar uma ideia que tem ajudado bastante negócios como o de vocês: um catálogo digital ligado ao WhatsApp, com produtos, serviços e promoções organizados pra consulta rápida.

Facilita o atendimento e ajuda o cliente a decidir sem depender de ficar tirando dúvida.

Faz sentido eu te mostrar em poucos minutos?`,
};

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Detecta o nicho pelo nome fantasia (mais específico) e cai no
 * segmento cadastrado. Se nada casar, devolve `"generico"`.
 */
export function pickNicheKey(company: string, segment?: string | null): NicheKey {
  const c = norm(company);
  const rules: Array<[NicheKey, RegExp]> = [
    ["recem_aberta", /\b(recem\s?aberta|recem\s?criada|nova\s?empresa|startup|inaugura(cao|ndo)?)\b/],
    ["pizzaria", /\bpizza(ria)?\b/],
    ["hamburgueria", /\b(hamburgu?er|burger|burguer|smash)\b/],
    ["cafeteria", /\b(cafe|cafeteria|coffee|espresso)\b/],
    ["confeitaria", /\b(confeitaria|doceria|bolos|patisserie|padaria)\b/],
    ["acougue", /\b(acougue|casa de carnes|carnes)\b/],
    ["mercado", /\b(mercado|mercearia|hortifruti|super|supermercado|minimercado|empori)\b/],
    ["farmacia", /\b(farmacia|drogaria|manipulacao)\b/],
    ["petshop", /\b(pet\s?shop|petshop|pet\b|agropet|veterinari)\b/],
    ["salao", /\b(salao|beleza|estetica|cabeleireir|manicure|spa)\b/],
    ["barbearia", /\b(barbearia|barber)\b/],
    ["academia", /\b(academia|crossfit|studio|pilates|box)\b/],
    ["materiais_construcao", /\b(construcao|materiais|ferragens|deposito)\b/],
    ["moveis", /\b(moveis|movelaria|marcenaria|decoracao)\b/],
    ["roupas", /\b(moda|boutique|roupas|confeccoes|store|modas|jeans)\b/],
    ["autopecas", /\b(autopecas|auto pecas|oficina|mecanica|automotiv)\b/],
    ["restaurante", /\b(restaurante|churrascaria|bistro|marmit|self.?service)\b/],
  ];
  for (const [key, re] of rules) if (re.test(c)) return key;

  const s = norm(segment ?? "");
  const bySegment: Record<string, NicheKey> = {
    recem_aberta: "recem_aberta",
    nova: "recem_aberta",
    startup: "recem_aberta",
    alimentacao: "restaurante",
    beleza: "salao",
    saude: "farmacia",
    fitness: "academia",
    pet: "petshop",
    automotivo: "autopecas",
    varejo: "roupas",
  };
  return bySegment[s] ?? "generico";
}

/** Devolve o template do nicho detectado (com `{{primeiro_nome}}` cru). */
export function pickNicheTemplate(company: string, segment?: string | null): string {
  return NICHE_TEMPLATES[pickNicheKey(company, segment)];
}

/**
 * Igual ao `pickNicheTemplate`, mas prioriza um override vindo do banco
 * (edição da tela "Templates por nicho"). Se a chave detectada não tem
 * override cadastrado para a organização, cai no texto padrão do código.
 */
export function pickNicheTemplateWithOverrides(
  company: string,
  segment: string | null | undefined,
  overrides?: ReadonlyMap<string, string> | null,
): string {
  const key = pickNicheKey(company, segment);
  const custom = overrides?.get(key);
  return custom && custom.trim() ? custom : NICHE_TEMPLATES[key];
}

/**
 * Igual ao anterior, mas quando o corpo tiver múltiplas variantes
 * separadas por linhas com `---`, rotaciona entre elas via
 * `pickVariantIndex` (round-robin persistido em localStorage por
 * `bucketKey`, ex.: "prospeccao:niche"). Sem separador, devolve o
 * corpo inteiro.
 */
export function pickNicheMessage(
  company: string,
  segment: string | null | undefined,
  overrides: ReadonlyMap<string, string> | null | undefined,
  bucketKey: string,
  extra?: { prospectId?: string | null },
): string {
  const key = pickNicheKey(company, segment);
  const corpo = pickNicheTemplateWithOverrides(company, segment, overrides);
  const pick = chooseVariant(corpo, {
    scope: "niche",
    bucketKey: `${bucketKey}:${key}`,
    niche: key,
    company: company || null,
    prospectId: extra?.prospectId ?? null,
  });
  return pick.text;
}
