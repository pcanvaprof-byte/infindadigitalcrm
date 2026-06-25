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
    defaultPreloadStaleTime: 0,
  });

  if (typeof window !== "undefined") {
    router.subscribe("onBeforeNavigate", (e) => {
      console.log("[nav] →", e.toLocation.pathname, { from: e.fromLocation?.pathname });
    });
    router.subscribe("onResolved", (e) => {
      console.log("[nav] ✓ resolved", e.toLocation.pathname);
    });
    router.subscribe("onBeforeLoad", (e) => {
      console.log("[nav] beforeLoad", e.toLocation.pathname);
    });
  }

  return router;
};
