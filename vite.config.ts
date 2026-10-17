import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), ...(process.env.SENTRY_AUTH_TOKEN ? [sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: process.env.RENDER_GIT_COMMIT },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
    })] : [])],
    build: { sourcemap: Boolean(process.env.SENTRY_AUTH_TOKEN) },
    define: { __SENTRY_RELEASE__: JSON.stringify(process.env.RENDER_GIT_COMMIT || '') },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
