// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://example.co.ke',
  output: 'static',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      cssMinify: 'lightningcss',
    },
    // Ignore the Cloudflare functions folder during Vite build
    optimizeDeps: {
      exclude: ['functions'],
    },
  },
});