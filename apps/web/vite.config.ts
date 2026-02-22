import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 重要：Vite 只从「本目录」加载 .env，不会读仓库根目录的 .env.production
// 生产环境 API 地址请配置在 apps/web/.env.production 的 VITE_API_BASE_URL
export default defineConfig(({ mode }) => {
  const root = __dirname;
  const env = loadEnv(mode, root, '');
  return {
    plugins: [react()],
    // 明确指定 .env 文件所在目录，避免 monorepo 下从错误位置加载
    envDir: root,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3001,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://localhost:3000',
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    // 显式注入，避免构建时未读到 .env.production 时退化为 localhost
    define: env.VITE_API_BASE_URL
      ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL) }
      : {},
  };
});
