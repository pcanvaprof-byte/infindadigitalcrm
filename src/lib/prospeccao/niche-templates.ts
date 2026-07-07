// Templates de prospecção por nicho — usados como fallback no
// `openWhats` quando o pack de templates da cadência não tem
// mensagem configurada para o passo atual.
//
// A detecção olha primeiro o `company` (nome fantasia contém
// palavras-chave do nicho) e cai no `segment` cadastrado.
// Todas as mensagens usam `{{primeiro_nome}}` — a variável é
// resolvida por `renderTemplate` e limpa por `sanitizeTemplateForSend`.

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
  | "generico";

export const NICHE_TEMPLATES: Record<NicheKey, string> = {
  restaurante: `Olá, {{primeiro_nome}}! Tudo bem?

Percebi que o restaurante de vocês pode se beneficiar de um catálogo digital que facilita os pedidos pelo WhatsApp, sem depender de aplicativos que cobram altas taxas.

A solução permite atualizar o cardápio em tempo real, destacar promoções e oferecer uma experiência mais prática para os clientes.

Posso te mostrar rapidamente como funciona?`,
  cafeteria: `Olá, {{primeiro_nome}}! Tudo bem?

Estou entrando em contato porque ajudamos cafeterias a oferecer um cardápio digital moderno, facilitando pedidos, divulgação de produtos e promoções sazonais.

É uma solução simples de implementar e que melhora a experiência dos clientes.

Posso te apresentar em poucos minutos?`,
  pizzaria: `Olá, {{primeiro_nome}}! Tudo bem?

Vi a pizzaria de vocês e acredito que um catálogo digital pode facilitar bastante os pedidos pelo WhatsApp, além de deixar o cardápio mais organizado e atrativo.

Os clientes conseguem visualizar sabores, adicionais e promoções de forma rápida.

Posso te mostrar como funciona?`,
  hamburgueria: `Olá, {{primeiro_nome}}! Tudo bem?

Estamos ajudando hamburguerias a modernizar os pedidos com um catálogo digital integrado ao WhatsApp.

Assim os clientes visualizam hambúrgueres, combos, adicionais e promoções de maneira muito mais prática.

Posso te apresentar a solução?`,
  confeitaria: `Olá, {{primeiro_nome}}! Tudo bem?

Vi o trabalho de vocês e acredito que um catálogo digital pode facilitar muito a apresentação dos bolos, doces e encomendas.

Além de organizar os produtos, ele ajuda os clientes a encontrarem tudo com mais facilidade.

Posso te mostrar como funciona?`,
  acougue: `Olá, {{primeiro_nome}}! Tudo bem?

Hoje muitos açougues estão utilizando catálogos digitais para divulgar cortes, kits para churrasco e promoções diretamente pelo WhatsApp.

É uma forma prática de aumentar os pedidos e manter os clientes sempre atualizados.

Posso te mostrar?`,
  mercado: `Olá, {{primeiro_nome}}! Tudo bem?

Gostaria de apresentar um catálogo digital que facilita a divulgação de ofertas, produtos e pedidos pelo WhatsApp.

A atualização é rápida e os clientes conseguem consultar tudo de forma organizada.

Posso te mostrar a plataforma?`,
  farmacia: `Olá, {{primeiro_nome}}! Tudo bem?

Estamos ajudando farmácias a organizar seus produtos em um catálogo digital, facilitando a consulta e o atendimento pelo WhatsApp.

A plataforma é simples de atualizar e melhora bastante a experiência dos clientes.

Posso te apresentar?`,
  petshop: `Olá, {{primeiro_nome}}! Tudo bem?

Vi o pet shop de vocês e acredito que um catálogo digital pode facilitar muito a divulgação de rações, acessórios, medicamentos e serviços.

Tudo pode ser consultado rapidamente pelo WhatsApp.

Posso te mostrar como funciona?`,
  salao: `Olá, {{primeiro_nome}}! Tudo bem?

Estamos ajudando salões de beleza a apresentar seus serviços, produtos e promoções em um catálogo digital moderno.

É uma forma simples de valorizar o atendimento e facilitar o contato dos clientes.

Posso te mostrar?`,
  barbearia: `Olá, {{primeiro_nome}}! Tudo bem?

Gostaria de apresentar uma ferramenta que ajuda barbearias a divulgar serviços, produtos e promoções através de um catálogo digital integrado ao WhatsApp.

É rápido de configurar e muito fácil para os clientes utilizarem.

Posso te mostrar?`,
  academia: `Olá, {{primeiro_nome}}! Tudo bem?

Estamos ajudando academias a divulgar planos, modalidades, horários e serviços através de um catálogo digital.

Isso facilita o atendimento e permite que os interessados encontrem todas as informações rapidamente.

Posso te apresentar?`,
  materiais_construcao: `Olá, {{primeiro_nome}}! Tudo bem?

Vi a empresa de vocês e acredito que um catálogo digital pode facilitar bastante a divulgação de produtos, promoções e lançamentos pelo WhatsApp.

Os clientes conseguem consultar tudo de forma organizada antes mesmo de entrar em contato.

Posso te mostrar a plataforma?`,
  moveis: `Olá, {{primeiro_nome}}! Tudo bem?

Gostaria de apresentar um catálogo digital que ajuda lojas de móveis a expor seus produtos de forma profissional e facilitar o atendimento pelo WhatsApp.

É uma solução prática para destacar lançamentos e promoções.

Posso te mostrar como funciona?`,
  roupas: `Olá, {{primeiro_nome}}! Tudo bem?

Estamos ajudando lojas de roupas a organizar coleções, novidades e promoções em um catálogo digital integrado ao WhatsApp.

Assim os clientes conseguem visualizar os produtos de maneira rápida e prática.

Posso te apresentar?`,
  autopecas: `Olá, {{primeiro_nome}}! Tudo bem?

Gostaria de apresentar uma solução que permite divulgar peças, serviços e promoções através de um catálogo digital.

Isso facilita o atendimento pelo WhatsApp e agiliza a consulta dos clientes.

Posso te mostrar como funciona?`,
  generico: `Olá, {{primeiro_nome}}! Tudo bem?

Ajudamos negócios como o de vocês a organizar produtos, serviços e promoções em um catálogo digital integrado ao WhatsApp.

É uma forma prática de facilitar o atendimento e destacar novidades para os clientes.

Posso te mostrar como funciona?`,
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
