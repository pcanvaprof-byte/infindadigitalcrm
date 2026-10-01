/**
 * Taxonomia fixa de nichos principais.
 *
 * O texto bruto do segmento (ou a descrição do CNAE) continua salvo no lead —
 * aqui apenas derivamos o GRUPO principal, usado nos filtros de /prospeccao
 * e /mapa. Classificação por palavras-chave + prefixo de CNAE.
 */

export interface NicheGroup {
  id: string;
  label: string;
  keywords: string[];
  /** Prefixos de CNAE (2 dígitos ou mais) que caem neste grupo. */
  cnae?: string[];
}

export const NICHE_GROUPS: NicheGroup[] = [
  {
    id: "alimentacao",
    label: "Alimentação",
    keywords: ["restaurante", "lanchonete", "padaria", "pizzaria", "bar", "cafe", "cafeteria", "hamburgu", "acai", "sorvet", "confeitaria", "doceria", "buffet", "marmit", "food", "churrasc", "sushi", "esfiha", "pastel", "alimenta", "adega", "distribuidora de bebida"],
    cnae: ["56", "10", "11"],
  },
  {
    id: "saude",
    label: "Saúde & Bem-estar",
    keywords: ["clinica", "clínica", "medic", "odonto", "dentist", "fisioterap", "psicolog", "nutric", "laborator", "hospital", "farmac", "drogaria", "veterinar", "fonoaudi", "terapia", "academia", "pilates", "crossfit", "personal"],
    cnae: ["86", "93"],
  },
  {
    id: "beleza",
    label: "Beleza & Estética",
    keywords: ["salao", "salão", "cabelo", "barbear", "barber", "estetic", "estétic", "manicure", "unhas", "depila", "sobrancelha", "spa", "maquia", "cosmetic"],
    cnae: ["9602"],
  },
  {
    id: "construcao",
    label: "Construção & Reforma",
    keywords: ["construc", "construç", "reforma", "engenharia", "obra", "material de constru", "eletric", "hidraul", "pintura", "marmor", "granito", "vidrac", "serralher", "gesso", "drywall", "arquitet", "empreiteira", "telhado", "climatiza", "ar condicionado", "energia solar", "solar"],
    cnae: ["41", "42", "43", "71"],
  },
  {
    id: "automotivo",
    label: "Automotivo",
    keywords: ["auto", "oficina", "mecanic", "mecânic", "funilar", "pneu", "borracharia", "lava rapido", "lava-rapido", "estetica automotiva", "concession", "moto", "veicul", "peca", "peça", "acessorios automot", "guincho", "despachante"],
    cnae: ["45"],
  },
  {
    id: "varejo",
    label: "Varejo & Comércio",
    keywords: ["comercio", "comércio", "loja", "varejo", "mercado", "supermercad", "minimercad", "mercearia", "papelaria", "presente", "vestuario", "vestuário", "roupa", "moda", "calcad", "calçad", "joalh", "otica", "ótica", "movei", "móvei", "eletrodomest", "brinquedo", "livraria", "tabacaria", "floricultura", "bazar", "utilidade"],
    cnae: ["47"],
  },
  {
    id: "servicos_b2b",
    label: "Serviços B2B",
    keywords: ["consultoria", "assessoria", "marketing", "publicidade", "agencia", "agência", "grafica", "gráfica", "recrutamento", "rh ", "recursos humanos", "juridic", "jurídic", "advocacia", "advogad", "seguranca do trabalho", "segurança do trabalho", "certifica", "traducao", "tradução", "call center", "telemarketing", "terceiriza", "limpeza", "conservacao", "portaria", "seguranca patrimonial"],
    cnae: ["70", "73", "78", "80", "81", "82", "69"],
  },
  {
    id: "educacao",
    label: "Educação",
    keywords: ["escola", "colegio", "colégio", "curso", "ensino", "educac", "educaç", "faculdade", "universidade", "creche", "idioma", "ingles", "inglês", "reforco", "reforço", "treinamento", "autoescola", "auto escola", "musica", "música"],
    cnae: ["85"],
  },
  {
    id: "tecnologia",
    label: "Tecnologia",
    keywords: ["tecnolog", "software", "sistema", "ti ", " ti", "informatica", "informática", "desenvolvimento de", "web", "app", "saas", "hospedagem", "provedor", "internet", "telecom", "seguranca eletronica", "cftv", "automac", "automaç", "dados", "startup", "digital"],
    cnae: ["62", "63", "61", "26"],
  },
  {
    id: "imobiliario",
    label: "Imobiliário",
    keywords: ["imobiliar", "imobiliár", "imovei", "imóvei", "corretor de imov", "incorporad", "condomin", "condomín", "aluguel de imov", "loteamento"],
    cnae: ["68"],
  },
  {
    id: "logistica",
    label: "Logística & Transporte",
    keywords: ["transporte", "logistic", "logístic", "frete", "mudanc", "mudanç", "entrega", "motoboy", "carga", "armazen", "courier", "distribuic", "distribuiç", "locadora de veic", "taxi", "táxi", "onibus", "ônibus", "guarda-volume"],
    cnae: ["49", "50", "51", "52", "53"],
  },
  {
    id: "turismo",
    label: "Turismo & Hospedagem",
    keywords: ["hotel", "pousada", "hostel", "motel", "turismo", "agencia de viagem", "agência de viagem", "viagem", "evento", "casa de festa", "camping", "resort", "chacara para eventos"],
    cnae: ["55", "79"],
  },
  {
    id: "pet",
    label: "Pet",
    keywords: ["pet", "petshop", "pet shop", "banho e tosa", "canil", "racao", "ração", "animal", "animais", "aquarismo"],
    cnae: ["9609"],
  },
  {
    id: "financeiro",
    label: "Financeiro & Contábil",
    keywords: ["contabil", "contábil", "contador", "escritorio de contab", "financeir", "credito", "crédito", "emprestim", "empréstim", "seguro", "corretora", "consorcio", "consórcio", "cobranca", "cobrança", "banco", "investiment", "cambio", "câmbio", "fintech"],
    cnae: ["64", "65", "66", "692"],
  },
  {
    id: "industria",
    label: "Indústria",
    keywords: ["industria", "indústria", "fabrica", "fábrica", "fabricac", "fabricaç", "metalurg", "usinag", "plastic", "plástic", "textil", "têxtil", "quimic", "químic", "grafic", "embalagem", "madeira", "moveleira", "confecc", "confecç"],
    cnae: ["10", "13", "14", "15", "16", "17", "18", "20", "22", "23", "24", "25", "27", "28", "29", "31", "32", "33"],
  },
  {
    id: "agro",
    label: "Agro",
    keywords: ["agro", "agricultura", "agropecu", "pecuar", "pecuár", "fazenda", "plantio", "sementes", "insumo agric", "irrigac", "irrigaç", "pesca", "aquicultura", "silvicultura"],
    cnae: ["01", "02", "03"],
  },
];

export const OUTROS_NICHE = { id: "outros", label: "Outros" };

const norm = (v?: string | null) =>
  (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const digits = (v?: string | null) => (v ?? "").replace(/\D/g, "");

/**
 * Classifica um segmento bruto (ou descrição de CNAE) em um dos grupos
 * principais. Retorna "Outros" quando nada casar.
 */
export function nicheGroup(segment?: string | null, cnae?: string | null): string {
  const text = norm(segment);
  const code = digits(cnae);

  if (text) {
    for (const g of NICHE_GROUPS) {
      if (g.keywords.some((k) => text.includes(norm(k)))) return g.label;
    }
  }
  if (code) {
    // prefixos mais específicos primeiro
    const byLength = NICHE_GROUPS.flatMap((g) => (g.cnae ?? []).map((p) => ({ p, label: g.label })))
      .sort((a, b) => b.p.length - a.p.length);
    for (const { p, label } of byLength) {
      if (code.startsWith(p)) return label;
    }
  }
  return OUTROS_NICHE.label;
}

export const NICHE_LABELS: string[] = [
  ...NICHE_GROUPS.map((g) => g.label),
  OUTROS_NICHE.label,
];
