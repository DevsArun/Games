import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';

/**
 * Vite configuration tuned for the CrazyGames mobile homepage budget.
 *
 * Goal: keep the INITIAL transferred payload <= 20MB (ideally < 5MB gzipped).
 * Strategy:
 *   - Aggressive Terser minification + tree-shaking.
 *   - Manual chunk splitting so Three.js / Cannon load in parallel and cache well.
 *   - Brotli + gzip pre-compression of all emitted assets.
 *   - Inline only tiny assets; everything heavy is hashed + lazy-loadable.
 */
export default defineConfig(({ mode }) => ({
  base: './', // relative paths — required for the CrazyGames iframe/CDN sandbox.

  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1200,

    // Inline assets < 4KB as base64 to cut request count; keep larger ones external.
    assetsInlineLimit: 4096,

    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: true,
        passes: 2,
      },
      format: { comments: false },
    },

    rollupOptions: {
      output: {
        // Split heavy vendors so the browser can cache them across game versions.
        manualChunks: {
          three: ['three'],
          physics: ['cannon-es'],
        },
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },

  plugins: [
    // Pre-compress so the CDN can serve .br / .gz and the transferred size stays tiny.
    viteCompression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
    viteCompression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),

    // `npm run analyze` => visual bundle treemap to police the 20MB budget.
    mode === 'analyze' &&
      visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true }),
  ].filter(Boolean),

  server: {
    host: true, // expose on LAN so you can test on a real phone.
    port: 5173,
  },

  preview: {
    host: true,
    port: 4173,
  },
}));
