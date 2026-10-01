import { QueryClient, keepPreviousData } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Defaults UX-focused: dados anteriores ficam visíveis durante refetch
  // (sem flicker), refetch silencioso e cache longo. Mutações invalidam
  // explicitamente quando precisam.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        placeholderData: keepPreviousData,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Pré-carrega o código da rota assim que o usuário passa o mouse/toca
    // no link do menu — a aba abre praticamente instantânea.
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    // Evita flash de "carregando" em navegações rápidas.
    defaultPendingMs: 300,
    defaultPendingMinMs: 200,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
