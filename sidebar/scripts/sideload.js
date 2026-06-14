// 将 manifest.xml 自动 sideload 到 macOS 上的 Word、Excel、PowerPoint
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const manifestSrc = path.resolve('manifest.xml');
const manifestFileName = 'office-llm-sidebar.xml';
const ownedManifestIds = [
  '438195b4-65fc-431d-936b-af3d1b4cb3c8',
  'c93ba0e2-8bdc-4724-9c6a-1a9f34f34cc2',
];

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
  const destPath = path.join(wefDir, manifestFileName);
  const legacyPath = path.join(wefDir, 'manifest.xml');

  try {
    fs.mkdirSync(wefDir, { recursive: true });
    fs.copyFileSync(manifestSrc, destPath);
    if (legacyPath !== destPath && fs.existsSync(legacyPath)) {
      const legacyContent = fs.readFileSync(legacyPath, 'utf8');
      if (ownedManifestIds.some(id => legacyContent.includes(id))) {
        fs.unlinkSync(legacyPath);
      }
    }
    console.log(`✓ ${name}: ${destPath}`);
    anySuccess = true;
  } catch (err) {
    console.warn(`⚠️  ${name} 跳过（可能未安装）: ${err.message}`);
  }
}

if (anySuccess) {
  console.log('\n✅ Sideload 完成！');
  console.log('   请重启 Word/Excel/PowerPoint，然后在「主页」→「加载项」中启用「AI 助手」。');
  console.log('   本地开发时请确保 npm run dev 正在运行（https://localhost:30030）。\n');
} else {
  console.error('\n❌ 未找到任何 Office 应用容器目录，请确认已安装 Microsoft Office for Mac。');
}
