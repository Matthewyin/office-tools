import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const distAssetsDir = path.join(distDir, 'assets');

fs.mkdirSync(distAssetsDir, { recursive: true });

fs.copyFileSync(
  path.join(rootDir, 'manifest.xml'),
  path.join(distDir, 'manifest.xml')
);

for (const name of ['icon-16.png', 'icon-32.png', 'icon-80.png']) {
  fs.copyFileSync(
    path.join(rootDir, 'assets', name),
    path.join(distAssetsDir, name)
  );
}

console.log('已复制 manifest.xml 和 Office 图标到 dist。');
