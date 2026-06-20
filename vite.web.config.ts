import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Browser-only preview of the renderer (no Electron). Uses src/renderer/devMock.ts for a fake hub.
// Absolute root so it works regardless of the cwd the dev server is launched from.
const root = fileURLToPath(new URL('./src/renderer', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  server: { port: 5199 },
});
