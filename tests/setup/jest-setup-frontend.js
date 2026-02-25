// jest-setup.js - 在测试环境中 mock import.meta.env
// 注意：此文件通过 setupFiles 在 jest 环境初始化时运行

// 设置 import.meta.env 的 polyfill（Vite 在测试中不可用）
if (typeof globalThis.importMetaEnv === 'undefined') {
  globalThis.importMetaEnv = {
    VITE_API_BASE_URL: 'http://localhost:3000/v1',
    MODE: 'test',
    DEV: false,
    PROD: false,
    SSR: false,
  };
}
