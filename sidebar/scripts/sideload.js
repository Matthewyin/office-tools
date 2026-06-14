// 将 manifest.xml 自动 sideload 到 macOS 上的 Word、Excel、PowerPoint
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const manifestSrc = path.resolve('manifest.xml');

const targets = [
  { name: 'Word',        container: 'com.microsoft.Word' },
  { name: 'Excel',       container: 'com.microsoft.Excel' },
  { name: 'PowerPoint',  container: 'com.microsoft.Powerpoint' },
];

if (!fs.existsSync(manifestSrc)) {
  console.error('❌ manifest.xml 不存在，请先在项目根目录运行此脚本。');
  process.exit(1);
}

let anySuccess = false;

for (const { name, container } of targets) {
  const wefDir = path.join(
    os.homedir(),
    'Library', 'Containers', container, 'Data', 'Documents', 'wef'
  );
  const destPath = path.join(wefDir, 'manifest.xml');

  try {
    fs.mkdirSync(wefDir, { recursive: true });
    fs.copyFileSync(manifestSrc, destPath);
    console.log(`✓ ${name}: ${destPath}`);
    anySuccess = true;
  } catch (err) {
    console.warn(`⚠️  ${name} 跳过（可能未安装）: ${err.message}`);
  }
}

if (anySuccess) {
  console.log('\n✅ Sideload 完成！');
  console.log('   请重启 Word/Excel/PowerPoint，然后在「主页」→「加载项」中启用「AI 助手」。');
  console.log('   确保 npm run dev 正在运行（https://localhost:5173）。\n');
} else {
  console.error('\n❌ 未找到任何 Office 应用容器目录，请确认已安装 Microsoft Office for Mac。');
}
