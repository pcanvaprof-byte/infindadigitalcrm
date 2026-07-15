// Tabelas referenciadas pelo BI que NÃO existem neste projeto.
// Mantido em um único lugar para que todos os `safeSelect`/`safeCount`
// possam pular a chamada de rede antes que ela vire 400/404 no console.
//
// Se alguma dessas tabelas passar a existir, remova-a daqui.
export const BI_GHOST_TABLES: ReadonlySet<string> = new Set([
  "contracts",
  "op_contracts",
  "op_proposals",
]);

export function isGhostTable(table: string): boolean {
  return BI_GHOST_TABLES.has(table);
}