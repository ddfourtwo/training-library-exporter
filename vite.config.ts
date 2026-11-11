import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { readFileSync } from 'node:fs';
import rawManifest from './public/manifest.json';
import path from 'path';

// MIT requires upstream's copyright and permission notice to travel with every
// copy, including the packaged extension. The repo's LICENSE stays untouched;
// this copies it into the build output (and so into the release zip).
function emitLicense(): Plugin {
  return {
    name: 'emit-license',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'LICENSE',
        source: readFileSync(path.resolve(import.meta.dirname, 'LICENSE')),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), crx({ manifest: rawManifest }), emitLicense()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
      },
    },
  },
});
