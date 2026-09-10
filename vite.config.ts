/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  base: '/clutch/',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
