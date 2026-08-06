import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      tests: path.resolve(__dirname, './tests'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/lib/__tests__/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: [
      'node_modules',
      '.next',
      'src/lib/generated',
      'playwright-tests',
      'playwright-tests/**',
      '**/playwright-tests/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/app/api/**/*.ts',
        'src/components/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/lib/**/*.{ts,tsx}',
        'src/server/**/*.ts',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/__tests__/**',
        'src/app/api/auth/**',
        'src/app/api/trpc/**',
        'src/lib/generated/**',
        'src/lib/ow-workflows.ts',
        'src/openworkflow/**',
        'src/server/trpc.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 45,
        statements: 60,
        branches: 50,
      },
    },
  },
});
