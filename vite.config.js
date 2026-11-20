import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base './' so the same build works on Vercel and inside a preview sub-path
export default defineConfig({ plugins: [react()], base: './' });
