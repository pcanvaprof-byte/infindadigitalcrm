/**
 * Feature flags globais da plataforma INFINDA.
 *
 * MULTI_USER_MODE controla a visibilidade de funcionalidades multiusuário/equipes
 * (filtros por vendedor/equipe, ranking, alertas, badges de papel, metas individuais).
 *
 * Mantemos todo o código, migrations e RPCs intactos — apenas ocultamos a UI
 * enquanto o modo estiver desativado. Para reativar, basta alterar para `true`
 * (ou no futuro consumir `organization.settings.multi_user`).
 */
export const MULTI_USER_MODE = false as boolean;

export const features = {
  multiUser: MULTI_USER_MODE,
} as const;