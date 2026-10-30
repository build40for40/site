// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import workerDev from './worker/dev.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://build40for40.com',
  integrations: [vue(), workerDev()],
  redirects: { '/join': '/#join', '/thanks': '/' },

  fonts: [
    {
      provider: fontProviders.google(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains-mono',
      weights: [400, 500, 600, 700],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],

  vite: {
    plugins: [tailwindcss(), wasm()]
  }
});
