# Investigation Report: Contact CSV Exporter for Disparador

## Summary

The codebase is well-structured and already has most primitives needed for the new exporter.
Key findings:

- **Lead list variable**: `filteredOrdered` (post-filter, post-sort `Prospect[]`) is the correct source for "export all filtered". `filteredOrdered.length` drives all "N companies" counters in the UI.
- **Selection state**: `selected: Set<string>` holds IDs of checked rows. `selCount = selected.size`.
- **Prospect type**: defined in `src/lib/mock-prospects.ts` as `interface Prospect`. All needed fields (`whatsapp`, `phone`, `email`, `company`, `cnpj`, `city`, `state`, `segment`, `owner`, `id`) are present.
- **Phone sanitization helpers**: `isJunkPhone()` and `normalizePhoneKey()` already exist in `src/lib/prospect-identity.ts`. No new phone logic needed from scratch.
- **Message helpers**: `pickNicheMessage()` in `src/lib/prospeccao/niche-templates.ts`, `renderTemplate()` + `sanitizeTemplateForSend()` in `src/lib/cadencia/types.ts`. All exportable.
- **Business profile**: `useBusinessProfile()` hook in `src/hooks/useBusinessProfile.ts` → returns `{ data: bizProfile }`. The field `bizProfile.initial_message` (`string | null`) is the 1st-contact message. Already used in `ProspeccaoPage`.
- **Toolbar location**: the filter toolbar is a `<section className="mt-6 surface-card p-4">` at line ~1797. The "Limpar filtros" button is a `<Button variant="ghost">` inside `showFilters` panel (line ~1917). The new "Exportar contatos" button belongs **outside** the collapsible filters panel, in the always-visible top row of the toolbar alongside the search input and the Filtros toggle.
- **Existing export function**: there is already a generic `exportCsv()` function (~line 1353) — the new exporter must be a **separate** function with different columns, UTF-8 BOM, semicolons, and message personalization. Do not replace the existing one.
- **Build/type check command**: `npx tsc --noEmit` (uses `tsconfig.json`). Lint: `npm run lint`.

---

## Evidence

### 1. Prospect Type (`src/lib/mock-prospects.ts`, line 22)

```typescript
export interface Prospect {
  id: string;
  company: string;
  cnpj?: string;           // optional, 14 digits when present
  segment: string;
  owner: string;           // internal salesperson name (NOT the contact name)
  whatsapp: string;
  phone: string;
  email: string;
  instagram: string;
  city: string;
  state: string;
  source: string;
  potential: ProspectPotential;
  status: ProspectStatus;
  createdAt: string;
  updatedAt?: string | null;
  interactions?: Interaction[];
  cadenceStep?: number;
  cadenceStatus?: "ativo" | "pausado" | "encerrado";
  responseStatus?: "sem_resposta" | "respondeu" | "interessado" | "sem_interesse" | "cliente";
  lastContactAt?: string | null;
  nextContactAt?: string | null;
}
```

**Important**: `owner` is the *salesperson*, not the customer contact. The customer contact name comes from `cad_leads.responsavel` (fetched async in `openWhats`). For the CSV, `owner` maps to the `contato` column per the spec since `responsavel` is not available synchronously. The spec says `{contato}` → responsible. We should use `owner` as the best available sync field for `contato`.

**Missing from `Prospect`**: there is no `prospect_id` field — the identifier IS `id`. So the CSV column `prospect_id` is just `p.id`.

### 2. Filtered/Ordered List Variable (`src/routes/prospeccao.tsx`, line ~593)

```typescript
const filteredOrdered = useMemo(() => { ... }, [filtered]);
```

This is the array after all filters and the 24h-block ordering logic. It is the source of truth for the table view. `pagedItems` is the paginated slice — do NOT use it for export.

### 3. Selection State (`src/routes/prospeccao.tsx`, line ~419)

```typescript
const [selected, setSelected] = useState<Set<string>>(new Set());
```

When `selected.size > 0`, export selected prospects:
```typescript
filteredOrdered.filter((p) => selected.has(p.id))
```
When `selected.size === 0`, export all `filteredOrdered`.

### 4. Phone Sanitization (`src/lib/prospect-identity.ts`)

```typescript
export function isJunkPhone(raw: string | null | undefined): boolean { ... }
export function normalizePhoneKey(raw: string | null | undefined): string | null { ... }
```

`normalizePhoneKey()` returns digits-only without leading `55`, e.g. `"11987654321"`.
To get international format `55 + digits`: `"55" + normalizePhoneKey(p.whatsapp)`.

`isJunkPhone()` already handles: empty, all-same-digit, subscriber all-same-digit.

### 5. Message Helpers

**`src/lib/prospeccao/niche-templates.ts`** (line ~210):
```typescript
export function pickNicheMessage(
  company: string,
  segment: string | null | undefined,
  overrides: ReadonlyMap<string, string> | null | undefined,
  bucketKey: string,
  extra?: { prospectId?: string | null },
): string
```

**`src/lib/cadencia/types.ts`** (line ~158 and ~183):
```typescript
export function renderTemplate(corpo: string, lead: Pick<CadLead, "empresa" | "responsavel">): string
export function sanitizeTemplateForSend(text: string): string
```

`renderTemplate` understands `{{empresa}}`, `{{responsavel}}`, `{{primeiro_nome}}`, `{{empresa_curta}}`, etc.

### 6. Business Profile Hook (`src/hooks/useBusinessProfile.ts`)

```typescript
export function useBusinessProfile() {
  return useQuery({ queryKey: BUSINESS_QK, queryFn: () => fetchFn(), staleTime: 30_000 });
}
```

Already called in `ProspeccaoPage`:
```typescript
const { data: bizProfile, isLoading: bizLoading } = useBusinessProfile();
```

`bizProfile.initial_message` is the configured first-contact message (type: `string | null`).

### 7. Niche Template Overrides (`src/routes/prospeccao.tsx`, line ~354)

```typescript
const { data: nicheOverrideRows } = useQuery({
  queryKey: nicheTemplateKeys.current(),
  queryFn: listCurrentNicheTemplates,
  staleTime: 5 * 60_000,
});
const nicheOverrides = useMemo(
  () => toOverridesMap(nicheOverrideRows ?? []),
  [nicheOverrideRows],
);
```

Both `bizProfile` and `nicheOverrides` are already available in `ProspeccaoPage` scope.

### 8. Toolbar Structure (`src/routes/prospeccao.tsx`, lines ~1797–1803)

The toolbar section:
```tsx
<section className="mt-6 surface-card p-4">
  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
    <div className="relative flex-1">
      {/* Search input */}
    </div>
    <div className="flex items-center gap-2">
      {/* Tabs: Tabela / Kanban / Mapa */}
      {/* Button: Filtros */}
    </div>
  </div>
  {showFilters && (
    <div className="mt-4 ...">
      {/* Filter selects */}
      <Button variant="ghost" onClick={clearFilters}>Limpar filtros</Button>
    </div>
  )}
</section>
```

The "Limpar filtros" button is **inside** `showFilters` conditional block. The new "Exportar contatos" button should be placed in the `<div className="flex items-center gap-2">` row (alongside Tabs and Filtros button), so it is always visible.

### 9. Existing `exportCsv` Function (`src/routes/prospeccao.tsx`, ~line 1353)

```typescript
const exportCsv = (rows = prospects) => {
  const headers = ["Empresa","Segmento","Responsavel","WhatsApp","Telefone","Email","Instagram","Cidade","Estado","Origem","Potencial","Status"];
  // uses comma separator, no BOM, no message column
  const csv = [headers, ...data].map((r) => r.map((c) => `"${...}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  a.download = `prospeccao-infinda-${Date.now()}.csv`;
};
```

This is generic and does NOT match the disparador spec (no `mensagem` column, comma separator, no BOM, no deduplication). The new function is additive.

### 10. `src/lib/prospeccao/` Directory

| File | Purpose |
|------|---------|
| `niche-templates.ts` | NicheKey type, NICHE_TEMPLATES map, pickNicheKey, pickNicheMessage, pickNicheTemplate |
| `niche-templates-api.ts` | Supabase CRUD for org overrides, toOverridesMap |
| `variant-telemetry.ts` | chooseVariant (round-robin variant picker) |

No existing `export-contacts.ts` — must be created.

---

## Conclusions and Recommendations

### What to build

**File 1: `src/lib/prospeccao/export-contacts.ts`** (new)

Exports a single function `exportContactsForDispatch(leads: Prospect[], bizInitialMessage: string | null, nicheOverrides: ReadonlyMap<string, string> | null)` that:

1. **Normalizes and validates WhatsApp**: use `normalizePhoneKey(p.whatsapp)` from `src/lib/prospect-identity.ts`. Produces digits-only; prepend `"55"` for international format. Skip if `null` (covers length and junk checks).
2. **Deduplicates**: maintain `Set<string>` of normalized phone digits. Skip if already seen.
3. **Builds message per lead**:
   - If `bizInitialMessage` is truthy → `renderTemplate(bizInitialMessage, { empresa: p.company, responsavel: p.owner })`.
   - Else → `pickNicheMessage(p.company, p.segment, nicheOverrides, "export:niche", { prospectId: p.id })` then `renderTemplate(...)`.
   - Always apply `sanitizeTemplateForSend(msg)`.
4. **CSV columns**: `nome;empresa;whatsapp;telefone;email;cidade;uf;nicho;cnpj;mensagem;prospect_id` — semicolons, UTF-8 BOM (`\uFEFF`), `"..."` quoting.
5. **Filename**: `contatos-disparo-YYYY-MM-DD.csv`.
6. **Returns** `{ exported: number, skipped: number }` for the toast.

**File 2: `src/routes/prospeccao.tsx`** (modify)

Add in `ProspeccaoPage`:
- A `handleExportDispatch` function that calls `exportContactsForDispatch` with the appropriate lead list.
- A "Exportar contatos (N)" `<Button>` in the toolbar's always-visible controls row (alongside tabs and Filtros button).
- Logic: if `selected.size > 0`, use `filteredOrdered.filter(p => selected.has(p.id))`, else use `filteredOrdered`.
- Count `N` = leads in the target list with a valid WhatsApp (`normalizePhoneKey(p.whatsapp) !== null`).
- Disable the button when `N === 0`.
- On completion, show toast: `"X contatos exportados com sucesso (Y duplicados/inválidos ignorados)"`.

### Key import decisions

| Import | From |
|--------|------|
| `isJunkPhone`, `normalizePhoneKey` | `@/lib/prospect-identity` |
| `pickNicheMessage` | `@/lib/prospeccao/niche-templates` |
| `renderTemplate`, `sanitizeTemplateForSend` | `@/lib/cadencia/types` |
| `Prospect` type | `@/lib/mock-prospects` |

### Column mapping clarification

The spec says `contato` = responsible. `Prospect.owner` is the *salesperson* (internal). The `responsavel` field on `cad_leads` is the customer contact name but requires an async DB lookup per lead — impractical for bulk export. **Recommendation**: use `p.owner` for `nome` (the contact person column) since it is the best synchronously available approximation. Document this in a code comment. Alternatively, use `p.company` for both `nome` and `empresa` and leave `nome` as the owner. The spec says columns are `nome, empresa` — map `nome = p.owner` (or `p.company` if `owner` is empty) and `empresa = p.company`.

### TypeScript / build verification

- Type-check command: `npx tsc --noEmit` (from workspace root)
- Lint: `npm run lint`
- No test framework targets this module; the existing `npm test` runs `node --test scripts/tests/*.test.mjs` (integration scripts, not unit tests for this path).
