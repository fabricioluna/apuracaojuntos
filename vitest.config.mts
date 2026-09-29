import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup-emulador.ts'],
    // O emulador do Firestore é uma instância única; rodar os arquivos de teste em paralelo
    // sobrecarrega as transações e causa timeouts por contenção, não por bug.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
