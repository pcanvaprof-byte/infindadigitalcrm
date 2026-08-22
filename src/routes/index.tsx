import { createFileRoute, Navigate } from "@tanstack/react-router";
// acelerar o carregamento do mapa, ou fracisonar de 100 em 100
// E os leads ja disparados nesse perfil que tiver qualquer alteração no card mudar para status principalmente os que ja tiveram qualquer clique

import { SalesPage } from "@/components/SalesPage";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "INFINDA — O sistema operacional comercial da sua empresa" },
      {
        name: "description",
        content:
          "CRM, prospecção, metas, propostas e IA em uma única plataforma. Construído para equipes que vendem todo dia.",
      },
      { property: "og:title", content: "INFINDA — CRM · IA · Automação" },
      {
        property: "og:description",
        content:
          "A plataforma comercial completa: CRM, prospecção inteligente, metas, propostas e IA para times de vendas.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { user, isReady } = useAuth();
  if (isReady && user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="flex flex-col">
      <SalesPage />
      <div className="mx-auto max-w-4xl p-8 prose prose-invert">
        Faça agora uma AUDITORIA COMPLETA DA VERSÃO MOBILE da página /mapa.

Existe um problema de layout:

Ao abrir o mapa em dispositivos móveis, principalmente quando o usuário abre/interage com a seleção de filtros, o mapa fica cortado, perde altura ou fica parcialmente escondido.

Quero que você investigue a causa real e corrija a responsividade.

NÃO faça apenas um ajuste visual superficial

Analise a estrutura completa da página /mapa, incluindo:

src/routes/mapa.tsx

componentes de filtros

container do mapa

wrappers/layouts utilizados pela página

alturas e larguras definidas

height, min-height, max-height

100vh, 100dvh, 100svh

overflow: hidden

overflow: auto

position: fixed

position: absolute

position: sticky

grid/flex utilizados na estrutura

comportamento do mapa quando o teclado virtual aparece

comportamento quando um select/dropdown de filtro é aberto

comportamento em telas pequenas

PROBLEMA PRINCIPAL

No mobile, a página deve funcionar assim:

TOPO
↓
Filtros
↓
Mapa ocupando o espaço restante disponível
↓
O mapa NÃO pode ser cortado.

Quando o usuário abrir qualquer filtro:

o dropdown deve aparecer corretamente;

não deve empurrar o mapa para fora da viewport de forma incorreta;

não deve cortar o mapa;

não deve criar uma área horizontal excedente;

não deve fazer o mapa desaparecer;

não deve quebrar o scroll da página.

IMPORTANTE SOBRE O MAPA

O mapa precisa ter uma altura responsiva real no mobile.

Não use simplesmente uma altura fixa como:

height: 600px

ou:

height: 100vh

sem considerar o restante da interface.

Considere a altura real disponível da viewport e os elementos que estão acima do mapa.

Quando necessário, utilize uma estratégia adequada com dvh/svh, flexbox ou cálculo de altura para que o mapa ocupe somente o espaço disponível.

FILTROS NO MOBILE

Audite todos os filtros:

Busca

Estados

Bairros

Nichos

Data de abertura

demais filtros existentes

Verifique principalmente:

Se os filtros estão causando overflow horizontal.

Se algum dropdown está sendo cortado pelo container pai.

Se overflow: hidden está escondendo o menu.

Se o dropdown está sendo renderizado dentro de um container com altura limitada.

Se o mapa está sendo redimensionado corretamente depois que o filtro abre/fecha.

Se existe algum z-index incorreto.

Se o mapa está ficando por cima dos dropdowns.

Se o dropdown está ficando por trás do mapa.

RESPONSIVIDADE

Não altere o layout desktop que já está funcionando.

Faça as correções utilizando breakpoints responsivos.

Desktop:

manter o comportamento atual.

Tablet:

adaptar proporcionalmente.

Mobile:

filtros organizados verticalmente;

mapa ocupando o espaço restante;

nenhum corte;

nenhum overflow horizontal;

dropdowns totalmente acessíveis.

MAPA

Depois que os filtros forem abertos/fechados, o mapa precisa recalcular seu tamanho corretamente.

Verifique se a biblioteca do mapa utilizada exige algum método de resize/invalidateSize após alterações no container.

Se for necessário, implemente isso corretamente.

TESTES

Teste mentalmente e, se possível, valide estes cenários:

Abrir /mapa no desktop.

Abrir /mapa em uma tela mobile pequena.

Abrir o filtro de Estado.

Abrir o filtro de Bairro.

Abrir o filtro de Nicho.

Abrir os filtros de data.

Fechar os filtros.

Fazer scroll.

Alternar filtros enquanto o mapa está carregando.

Verificar se o mapa continua completamente visível.

Verificar se não existe scroll horizontal.

Verificar se os dropdowns não ficam cortados.

Verificar se o primeiro lote de empresas continua carregando normalmente.

REGRA IMPORTANTE

Não altere a lógica de carregamento progressivo das empresas que acabou de ser corrigida.

Não altere:

lotes de 100;

carregamento progressivo;

filtros funcionais;

busca;

coordenadas;

marcadores;

clusters;

lógica de dados.

Apenas corrija o comportamento responsivo/layout do mapa e dos filtros.

EXECUTE A AUDITORIA E A CORREÇÃO

Não quero apenas uma lista de problemas encontrados.

Faça a análise do código, identifique a causa do corte no mobile, altere os arquivos necessários e valide o resultado.

No final informe:

Qual era a causa do mapa estar sendo cortado.

Quais arquivos foram alterados.

Qual solução responsiva foi utilizada.

Como os dropdowns dos filtros foram tratados.

Como o mapa passa a recalcular sua área disponível.

Se o desktop permaneceu inalterado.

Se TypeScript/build passaram sem erros.

NÃO responda apenas "layout mobile ajustado".

EXECUTE A ALTERAÇÃO REAL NO PROJETO E VALIDE.
      </div>
    </div>
  );
}