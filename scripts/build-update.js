#!/usr/bin/env node
/**
 * 增量更新包构建脚本
 * 用法: node scripts/build-update.js [上一版本号]
 * 示例: node scripts/build-update.js 1.0.0
 *
 * 生成: dist/update-v{新版本号}-from-{旧版本号}.zip
 * 包含: 变化的应用文件 + update.bat 更新脚本
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const newVersion = pkg.version;
const oldVersion = process.argv[2] || '0.0.0';

console.log(`构建增量更新包: ${oldVersion} → ${newVersion}`);

// 需要打包的文件（相对于项目根目录）
const APP_FILES = ['main.js', 'preload.js', 'db.js', 'date-util.js', 'package.json'];
const APP_DIRS = ['renderer'];
const EXCLUDE = [/\.map$/, /\.DS_Store$/, /node_modules/];

function shouldInclude(p) { return !EXCLUDE.some(re => re.test(p)); }

const filesToPack = [];

for (const file of APP_FILES) {
  const full = path.join(ROOT, file);
  if (fs.existsSync(full)) filesToPack.push({ src: full, dest: file });
}

for (const dir of APP_DIRS) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) continue;
  const walk = (d, prefix) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full, rel);
      else if (shouldInclude(rel)) filesToPack.push({ src: full, dest: `${dir}/${rel}` });
    }
  };
  walk(fullDir, '');
}

// 生成 update.bat
const batContent = `@echo off
chcp 65001 >nul
title 洋安出入库管理系统 - 增量更新 v${newVersion}
echo.
echo ========================================
echo   洋安出入库管理系统 增量更新
echo   版本: ${oldVersion} → ${newVersion}
echo ========================================
echo.

:: 查找安装目录
set "INSTALL_DIR="
if exist "%LOCALAPPDATA%\\Programs\\洋安出入库管理系统" (
  set "INSTALL_DIR=%LOCALAPPDATA%\\Programs\\洋安出入库管理系统"
) else if exist "%LOCALAPPDATA%\\in-out" (
  set "INSTALL_DIR=%LOCALAPPDATA%\\in-out"
) else (
  echo [错误] 未找到应用安装目录
  echo 请将此文件夹复制到安装目录后运行 update.bat
  pause
  exit /b 1
)

echo 安装目录: %INSTALL_DIR%
echo.

:: 关闭正在运行的应用
taskkill /f /im "洋安出入库管理系统.exe" >nul 2>&1
if %errorlevel% equ 0 (
  echo [OK] 已关闭正在运行的应用
) else (
  echo [OK] 应用未在运行
)
echo.

:: 复制更新文件
echo 正在更新文件...
set /a COUNT=0

${filesToPack.map(f => {
  const t = f.dest.replace(/\//g, '\\\\');
  return `if exist "%~dp0app\\${t}" (\n  copy /y "%~dp0app\\${t}" "%INSTALL_DIR%\\resources\\app\\${t}" >nul 2>&1\n  set /a COUNT+=1\n)`;
}).join('\n')}

echo.
echo ========================================
echo   更新完成！共替换 %COUNT% 个文件
echo   数据库已保留，无需担心数据丢失
echo ========================================
echo.
echo 按任意键启动应用...
pause >nul
start "" "%INSTALL_DIR%\\洋安出入库管理系统.exe"
`;

// 创建 zip
const zip = new JSZip();
const appFolder = zip.folder('app');

for (const file of filesToPack) {
  appFolder.file(file.dest, fs.readFileSync(file.src));
}
zip.file('update.bat', batContent);

const zipName = `update-v${newVersion}-from-${oldVersion}.zip`;
const zipPath = path.join(ROOT, 'dist', zipName);

zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }).then(content => {
  fs.writeFileSync(zipPath, content);
  const sizeMB = (content.length / 1024 / 1024).toFixed(1);
  console.log(`\n✅ 更新包已生成: dist/${zipName}`);
  console.log(`   大小: ${sizeMB} MB (完整安装包 105MB)`);
  console.log(`   文件数: ${filesToPack.length}`);
  console.log(`\n分发方式: 将 zip 发给用户，解压后双击 update.bat 即可`);
});
