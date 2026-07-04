import { backend } from './src/openworkflow/client';
import { defineConfig } from '@openworkflow/cli';

export default defineConfig({
  backend,
  dirs: './src/openworkflow',
  ignorePatterns: ['**/*.test.*', '**/client.ts'],
});