import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [
            react(),
            // Uploads source maps to Sentry so production stack traces show real
            // file/line instead of minified code. Only runs when SENTRY_AUTH_TOKEN
            // is set (e.g. in CI or a release build) — silently skipped otherwise.
            env.SENTRY_AUTH_TOKEN &&
                sentryVitePlugin({
                    org: env.SENTRY_ORG,
                    project: env.SENTRY_PROJECT,
                    authToken: env.SENTRY_AUTH_TOKEN,
                    release: { name: `pos-desktop@${pkg.version}` },
                    sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
                }),
        ].filter(Boolean),
        // Electron loads dist over file:// and needs relative paths. The web build
        // (`vite build --mode web`) uses BrowserRouter, so deep links like
        // /customers/123 need absolute asset paths.
        base: mode === 'web' ? '/' : './',
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            // Only when uploading to Sentry (the plugin deletes the .map files after
            // upload). Without a token, a .map would ship publicly with the web build
            // and expose the full source.
            sourcemap: !!env.SENTRY_AUTH_TOKEN,
        },
        server: {
            port: 5177,
            strictPort: true,
        },
    };
});
