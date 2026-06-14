import { defineConfig } from 'vite';
import fs from 'fs';
import os from 'os';
import path from 'path';

// office-addin-dev-certs 生成的证书默认路径
const certDir = path.join(os.homedir(), '.office-addin-dev-certs');
const keyPath = path.join(certDir, 'localhost.key');
const certPath = path.join(certDir, 'localhost.crt');

const httpsConfig = fs.existsSync(keyPath) && fs.existsSync(certPath)
  ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
  : true; // 退回到自签名证书

export default defineConfig({
  server: {
    port: 30030,
    https: httpsConfig,
  },
  build: {
    rollupOptions: {
      input: {
        taskpane: 'taskpane.html',
        commands: 'commands.html',
      },
    },
  },
});
