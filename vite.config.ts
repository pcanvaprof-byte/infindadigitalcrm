// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    plugins: [
      {
        name: "fix-rollup-input-vite7",
        config(config) {
          const clientInput =
            (config.environments?.client?.build as any)?.rolldownOptions?.input ||
            (config.environments?.client?.build as any)?.rollupOptions?.input ||
            { index: "virtual:tanstack-start-client-entry" };

          config.build = config.build || {};
          config.build.rollupOptions = config.build.rollupOptions || {};
          if (!config.build.rollupOptions.input) {
            config.build.rollupOptions.input = clientInput;
          }
        },
        configEnvironment(name, envConfig) {
          if (name === "client") {
            const input = (envConfig.build as any)?.rolldownOptions?.input;
            if (input) {
              return {
                build: {
                  rollupOptions: {
                    input,
                  },
                },
              };
            }
          }
        },
      },
    ],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Deploy target fora do sandbox da Lovable.
  // - Dentro da Lovable: o wrapper força Cloudflare (este preset é ignorado).
  // - Em CI/Vercel: Nitro gera .vercel/output (Build Output API) automaticamente.
  //   Vercel também respeita NITRO_PRESET=vercel se você preferir setar via env.
  nitro: { preset: "vercel" },
});
