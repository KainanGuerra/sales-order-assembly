import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Plain Node tests for the logic that does not need a browser: formatting, the
// order store, the session store and the error mapping.
export default defineConfig({
  resolve: { alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) } },
  test: { include: ['test/**/*.spec.ts'], environment: 'node' },
});
