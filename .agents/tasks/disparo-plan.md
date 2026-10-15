# Plano de Implementação — Aba Disparo (DisparoWhatsApp)

## Contexto

O usuário quer uma aba **Disparo** dentro da rota `/prospeccao` para disparar
mensagens em lote via `wa.me` (sem WPPConnect/Baileys), com delay configurável,
rotação de 19 mensagens, controle de disponibilidade e registro de touchpoints.
A solução usa a infra existente (`pickNicheMessage`, `addTouchpoint`,
`updateProspect`) sem instalar dependências novas.

---

## 1 · Como adicionar a aba sem quebrar a estrutura existente

### Estrutura atual de `prospeccao.tsx`

O JSX do `ProspeccaoPage` retorna um `<AppShell>` com este conteúdo **flat**
(sem `TabsContent` de nível superior):

```
<AppShell>
  <Dialog />      ← pop-up perfil de negócio
  <section>       ← cards de estatísticas
  <section>       ← bloco conta WhatsApp
  <div>           ← botão editar templates
  <TemplateLibrary />
  <section>       ← toolbar (search + Tabs de visualização table/kanban/map + Filtros)
  {/* conteúdo principal: tabela / kanban / mapa */}
  {/* modais: detail, import preview, history, enrich, gmail, etc. */}
</AppShell>
```

O `<Tabs value={view} …>` dentro da **toolbar** controla apenas a visualização
(table/kanban/map); **não existe** `TabsContent` em nível superior.

### Estratégia de integração

Adicionar uma `<Tabs>` de **nível superior** envolvendo TODO o conteúdo do
`ProspeccaoPage`. Essa Tabs tem duas abas:

- `lista` — contém exactamente o que existe hoje (stats + toolbar + tabela/kanban/mapa + todos os modais)
- `disparo` — renderiza `<DisparoWhatsApp prospects={filtered} onDispatch={…} />`

**Implementação no JSX:**

```tsx
// Novo estado no topo da função:
const [mainTab, setMainTab] = useState<"lista" | "disparo">("lista");

// No return, dentro de <AppShell>, substituir o conteúdo existente por:
return (
  <AppShell …>
    <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "lista" | "disparo")}>
      <TabsList className="mb-4">
        <TabsTrigger value="lista">
          <Users className="mr-1.5 h-4 w-4" /> Lista
        </TabsTrigger>
        <TabsTrigger value="disparo">
          <MessageSquare className="mr-1.5 h-4 w-4" /> Disparo
        </TabsTrigger>
      </TabsList>

      <TabsContent value="lista">
        {/* TODO: mover TODO o conteúdo atual do return aqui dentro */}
      </TabsContent>

      <TabsContent value="disparo">
        <DisparoWhatsApp
          prospects={filtered}
          nicheOverrides={nicheOverrides}
          userId={user.id}
          userName={user.name}
        />
      </TabsContent>
    </Tabs>
  </AppShell>
);
```

**Regra crítica:** o `<Dialog open={showBizDialog}>` e o `<input ref={fileRef}>`
devem permanecer **dentro de `<TabsContent value="lista">`**, pois só fazem
sentido quando a lista está ativa. Todos os outros modais também ficam na aba
`lista`.

**Import adicional necessário** em `prospeccao.tsx`:
```tsx
import { TabsContent } from "@/components/ui/tabs";
// TabsList e TabsTrigger já são importados
import { DisparoWhatsApp } from "@/components/disparo/DisparoWhatsApp";
```

---

## 2 · Assinatura exata de `pickNicheMessage`

Definida em `src/lib/prospeccao/niche-templates.ts`:

```ts
export function pickNicheMessage(
  company: string,                                    // p.company ou ""
  segment: string | null | undefined,                 // p.segment
  overrides: ReadonlyMap<string, string> | null | undefined,  // nicheOverrides
  bucketKey: string,                                  // ex: "disparo:niche"
  extra?: { prospectId?: string | null },             // { prospectId: p.id }
): string
```

No `DisparoWhatsApp` chamar assim:

```ts
import { pickNicheMessage } from "@/lib/prospeccao/niche-templates";

const msg = pickNicheMessage(
  prospect.company ?? "",
  prospect.segment,
  nicheOverrides,          // ReadonlyMap<string, string> passado como prop
  "disparo:niche",
  { prospectId: prospect.id },
);
```

O retorno já contém `{{primeiro_nome}}` substituído pela variante escolhida (via
`chooseVariant`). Passar pelo `renderTemplate` antes de enviar:

```ts
import { renderTemplate, sanitizeTemplateForSend } from "@/lib/cadencia/types";

const finalMsg = sanitizeTemplateForSend(
  renderTemplate(msg, { empresa: prospect.company ?? "", responsavel: "" })
);
```

---

## 3 · Assinatura exata de `updateProspect`

Definida em `src/lib/prospects-api.ts`:

```ts
export async function updateProspect(
  id: string,
  patch: Partial<Prospect>,   // campos do type Prospect (mock-prospects.ts)
): Promise<void>
```

Usar no disparo para avançar status:

```ts
await updateProspect(prospect.id, { status: "primeiro_contato" });
```

Campos de status privado (por usuário) são gravados em `prospect_touchpoints`
internamente — **não** na tabela `prospects`. Portanto sempre usar
`updateProspect` e nunca escrever direto em Supabase.

---

## 4 · Estrutura dos arquivos a criar/modificar

### 4.1 Novos arquivos

```
src/
└── components/
    └── disparo/
        ├── DisparoWhatsApp.tsx      ← componente principal da aba
        └── useDisparoQueue.ts       ← hook que gerencia fila, delay e estado
```

#### `DisparoWhatsApp.tsx` — responsabilidades

- Recebe `props`: `prospects: Prospect[]`, `nicheOverrides: ReadonlyMap<string,string>`, `userId: string`, `userName: string`
- **Configuração (estado local + persistido em localStorage):**
  - `delayMin` / `delayMax` (padrão: 80 / 100 segundos, configurável via inputs numéricos)
  - `selectedIds: Set<string>` — leads selecionados para disparar
  - `isRunning: boolean` — disparo em andamento
  - `canStart: boolean` — controle de disponibilidade manual (botão "Estou disponível / Pausar")
- **Lista de mensagens (19 mensagens):**
  - Estado `customMessages: string[]` (19 slots editáveis, inicializados com `pickNicheMessage` para `generico`)
  - OU simplesmente rota todo disparo pelo `pickNicheMessage` com nicho do prospect
  - Decisão: usar `pickNicheMessage` por prospect (uma mensagem por nicho) + campo "mensagem extra" opcional
- **Fluxo de disparo** (gerenciado por `useDisparoQueue`):
  1. Para cada prospect selecionado, calcula a mensagem com `pickNicheMessage` → `renderTemplate` → `sanitizeTemplateForSend`
  2. Abre `https://wa.me/55{digits}?text={encoded}` em nova aba
  3. Aguarda `delayMin..delayMax` segundos (aleatório) antes do próximo
  4. Registra touchpoint via `addTouchpoint({ prospect_id, tipo: "whatsapp", resultado: "enviado" })`
  5. Chama `updateProspect(id, { status: "primeiro_contato" })` quando status era `nao_contatado`
  6. Atualiza `localDispatchedIds` via callback `onDispatch(prospectId)`
- **UI:**
  - Tabela simplificada de prospects selecionados (empresa, whatsapp, status atual)
  - Barra de progresso: `X de Y disparados`
  - Contador de tempo até o próximo disparo
  - Botão "▶ Iniciar / ⏸ Pausar" — pausar não cancela, apenas congela até o usuário retomar
  - Botão "⏹ Parar" — cancela a fila
  - Filtro de seleção rápida: "Selecionar todos sem contato anterior" (status `nao_contatado` com whatsapp)

#### `useDisparoQueue.ts` — responsabilidades

- `start(leads: Prospect[])` — inicia a fila
- `pause()` / `resume()` — suspende/retoma sem perder posição
- `stop()` — cancela; emite resumo final
- `progress: { current, total, lastDispatched }`
- `countdown: number` — segundos restantes até o próximo disparo
- Usa `useRef` para o `setTimeout` do delay (não `useState`) para não re-renderizar a cada segundo
- Usa `useCallback` para expor `start/pause/resume/stop`

### 4.2 Arquivo modificado

```
src/routes/prospeccao.tsx
```

Mudanças:
1. Adicionar `import { TabsContent } from "@/components/ui/tabs"` (já importa `Tabs/TabsList/TabsTrigger`)
2. Adicionar `import { DisparoWhatsApp } from "@/components/disparo/DisparoWhatsApp"`
3. Adicionar `const [mainTab, setMainTab] = useState<"lista" | "disparo">("lista")`
4. No `return`: envolver tudo em `<Tabs value={mainTab} onValueChange={…}>` com dois `<TabsContent>`
5. Passar `filtered`, `nicheOverrides`, `user.id`, `user.name` como props para `<DisparoWhatsApp>`

---

## 5 · Ordem de dependência para a implementação

1. **Criar `useDisparoQueue.ts`** — lógica pura, sem JSX; testável isoladamente
2. **Criar `DisparoWhatsApp.tsx`** — usa o hook e as funções já existentes
3. **Modificar `prospeccao.tsx`** — adicionar a `<Tabs>` de nível superior e o import do novo componente

---

## 6 · Verificação

```bash
npm run build
```

Esperado: zero erros de TypeScript. A aba Disparo aparece ao lado de "Lista" na
rota `/prospeccao`. O disparo em lote respeita o delay configurado (padrão 80–100s).
O botão "Pausar" congela a contagem. O botão "Parar" cancela.

---

## 7 · Decisões de design

| Decisão | Escolha | Razão |
|---|---|---|
| Biblioteca de disparo | `wa.me` (link nativo) | Sem instalação, sem ban risk, funciona no PC do usuário |
| 19 mensagens fixas vs por nicho | Por nicho via `pickNicheMessage` | Já existe, já rotaciona variantes, já respeita overrides do banco |
| Estado da fila | `useRef` + `useState` mínimo | Evita re-render em cada tick do countdown |
| Persistência do delay | `localStorage` | Sobrevive a reload sem necessidade de banco |
| Controle de disponibilidade | Toggle manual "Estou disponível" | O usuário pediu explicitamente rodar só quando disponível |
| Tabs de nível superior | `<Tabs>` envolvendo todo o `<AppShell>` content | Não quebra a toolbar interna (table/kanban/map) pois são Tabs aninhadas com `value` independentes |
