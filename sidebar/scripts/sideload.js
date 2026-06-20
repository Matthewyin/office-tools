// 将独立 manifest 自动 sideload 到 macOS 上的 Word、Excel、PowerPoint
import fs from 'fs';
import path from 'path';
import os from 'os';

const appArg = String(process.argv[2] || 'all').toLowerCase();
const ownedManifestIds = [
  '438195b4-65fc-431d-936b-af3d1b4cb3c8',
  'c93ba0e2-8bdc-4724-9c6a-1a9f34f34cc2',
  '0bbf9b09-f6a4-4db1-b047-c62fe68ed0a1',
  '5b31ab91-8740-4a2f-a7db-806a12ea8ea7',
  '4513a524-4a90-4d5b-83bb-3d74e42ffc01',
];

const targets = [
  {
    key: 'word',
    name: 'Word',
    container: 'com.microsoft.Word',
    manifest: 'word-manifest.xml',
    destName: 'office-llm-sidebar.xml',
  },
  {
    key: 'excel',
    name: 'Excel',
    container: 'com.microsoft.Excel',
    manifest: 'excel-manifest.xml',
    destName: 'office-llm-sidebar.xml',
  },
  {
    key: 'ppt',
    name: 'PowerPoint',
    container: 'com.microsoft.Powerpoint',
    manifest: 'ppt-manifest.xml',
    destName: 'office-llm-sidebar.xml',
  },
];

const selectedTargets = appArg === 'all'
  ? targets
  : targets.filter(target => target.key === appArg);

if (!selectedTargets.length) {
  console.error('❌ 参数错误。可用参数：word、excel、ppt，或不传参数加载全部。');
  process.exit(1);
}

let anySuccess = false;

for (const { name, container, manifest, destName } of selectedTargets) {
  const manifestSrc = path.resolve(manifest);
  if (!fs.existsSync(manifestSrc)) {
    console.warn(`⚠️  ${name} 跳过：${manifest} 不存在。`);
    continue;
  }

  const wefDir = path.join(
    os.homedir(),
    'Library', 'Containers', container, 'Data', 'Documents', 'wef'
  );
  const destPath = path.join(wefDir, destName);

  try {
    fs.mkdirSync(wefDir, { recursive: true });
    cleanOwnedManifests(wefDir, destPath);
    fs.copyFileSync(manifestSrc, destPath);
    console.log(`✓ ${name}: ${destPath}`);
    anySuccess = true;
  } catch (err) {
    console.warn(`⚠️  ${name} 跳过（可能未安装）: ${err.message}`);
  }
}

if (anySuccess) {
  console.log('\n✅ Sideload 完成！');
  console.log('   请重启对应的 Office 应用，然后在「主页」→「加载项」下拉菜单中直接选择对应助手。');
  console.log('   注意：不要进入「更多加载项」里的「我的加载项」页，本地 sideload 加载项通常不显示在那里。');
  console.log('   本地开发时请在项目根目录运行 npm run local。\n');
} else {
  console.error('\n❌ 未找到任何 Office 应用容器目录，请确认已安装 Microsoft Office for Mac。');
}

function cleanOwnedManifests(wefDir, destPath) {
  const files = fs.readdirSync(wefDir);
  for (const file of files) {
    const fullPath = path.join(wefDir, file);
    if (fullPath === destPath || path.extname(file) !== '.xml') continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    if (ownedManifestIds.some(id => content.includes(id))) {
      fs.unlinkSync(fullPath);
    }
  }
}
