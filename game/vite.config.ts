import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { rundotGameLibrariesPlugin, rundotMultiplayerPlugin } from "@series-inc/rundot-game-sdk/vite";
import { DEV_CHALLENGES } from './src/arena/devChallenges';

// CDN assets in cdn/ folder are automatically served in dev mode

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

// `--mode android` builds the Play Store app: no RUN plugins, the RUN SDK replaced by a stub, and '@target-platform'
// pointing at the Capacitor platform (src/platform/android.ts). Every other mode is the RUN web game.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'android' ? [] : [rundotGameLibrariesPlugin(), rundotMultiplayerPlugin({
    mockServices: { ugc: {
      get: async id => DEV_CHALLENGES.find(row => row.id === id) as unknown as Record<string, unknown> ?? null,
      recordUse: async () => {},
    } },
  })],
  resolve: {
    alias: mode === 'android'
      ? { '@target-platform': here('./src/platform/android.ts'), '@series-inc/rundot-game-sdk/api': here('./src/platform/rundotStub.ts') }
      : { '@target-platform': here('./src/platform/noTarget.ts') },
  },
  base: "./",
  server: {
    allowedHosts: true,
  },
  // Vite uses esbuild both for transforms and (in dev) dependency prebundling.
  // RUN.game SDK includes top-level await, so we must target an environment that supports it.
  esbuild: {
    target: "es2022",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2022",
    },
  },
  build: {
    target: "es2022", // Support top-level await for embedded libraries
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"],
        },
      },
    },
  },
}));
