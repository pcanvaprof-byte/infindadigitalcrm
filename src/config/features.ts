/**
 * Feature flags globais da plataforma INFINDA.
 *
 * Enquanto cada flag estiver `false`, NENHUMA RPC, componente, hook, query ou
 * import dinâmico relacionado à área correspondente pode ser executado ou
 * influenciar o Dashboard estável (v6). Todo o código permanece preservado
 * para reativação futura — basta alternar a flag.
 *
 *   dashboardManagerial → v7 (filtros, metas, KPIs gerenciais, gráficos)
 *   multiUser           → v8 (equipes, vendedores, alertas, ranking, badge)
 *   businessIntelligence → módulo /bi + IA
 */
export const FEATURES = {
  dashboardManagerial: false,
  multiUser: false,
  businessIntelligence: false,
} as const;

/** Alias retro-compat — mantenha sincronizado com FEATURES.multiUser. */
export const MULTI_USER_MODE: boolean = FEATURES.multiUser;

/** Alias antigo. */
export const features = FEATURES;