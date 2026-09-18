import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'next/navigation': path.resolve(__dirname, './src/compat/next-navigation.ts'),
      'next/link': path.resolve(__dirname, './src/compat/next-link.tsx'),
      'next/image': path.resolve(__dirname, './src/compat/next-image.tsx'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  define: {
    'process.env.NEXT_PUBLIC_API_URL': JSON.stringify(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'),
    'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY': JSON.stringify(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_dWx0aW1hdGUtbWFrby03OTAwLmNsZXJrLmFjY291bnRzLmRldiQ'),
    'process.env.NEXT_PUBLIC_MSG91_WIDGET_ID': JSON.stringify(process.env.NEXT_PUBLIC_MSG91_WIDGET_ID || '366879656b6c353737353730'),
    'process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH': JSON.stringify(process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH || '564051TtkFUIGiVFW6a8c85c3P1'),
    'process.env': JSON.stringify({
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_dWx0aW1hdGUtbWFrby03OTAwLmNsZXJrLmFjY291bnRzLmRldiQ',
      NEXT_PUBLIC_MSG91_WIDGET_ID: process.env.NEXT_PUBLIC_MSG91_WIDGET_ID || '366879656b6c353737353730',
      NEXT_PUBLIC_MSG91_TOKEN_AUTH: process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH || '564051TtkFUIGiVFW6a8c85c3P1',
    }),
  },
});
