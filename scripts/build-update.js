#!/usr/bin/env node
/**
 * 增量更新包构建脚本
 * 用法: node scripts/build-update.js [上一版本号]
 * 示例: node scripts/build-update.js 1.0.0
 *
 * 前置条件: 先运行 npm run build 生成 dist/win-unpacked/
 * 生成: dist/update-v{新版本号}-from-{旧版本号}.zip
 * 包含: app.asar + app.asar.unpacked/ + update.bat
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const newVersion = pkg.version;
const oldVersion = process.argv[2] || '0.0.0';

const resDir = path.join(ROOT, 'dist', 'win-unpacked', 'resources');
const asarPath = path.join(resDir, 'app.asar');
const unpackedDir = path.join(resDir, 'app.asar.unpacked');

if (!fs.existsSync(asarPath)) {
  console.error('❌ 未找到 dist/win-unpacked/resources/app.asar');
  console.error('   请先运行 npm run build 打包应用');
  process.exit(1);
}

const asarSize = fs.statSync(asarPath).size;
console.log(`构建增量更新包: ${oldVersion} → ${newVersion}`);
console.log(`app.asar: ${(asarSize / 1024 / 1024).toFixed(1)} MB`);

// 收集 app.asar.unpacked 内的文件
const unpackedFiles = [];
if (fs.existsSync(unpackedDir)) {
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, rel);
      else unpackedFiles.push({ src: full, dest: rel });
    }
  };
  walk(unpackedDir, '');
  console.log(`app.asar.unpacked: ${unpackedFiles.length} 个文件`);
}

// 生成 update.bat
const batContent = [
  '@echo off',
  'setlocal enabledelayedexpansion',
  'chcp 65001 >nul',
  `title 洋安出入库管理系统 - 增量更新 v${newVersion}`,
  'echo.',
  'echo ========================================',
  'echo   洋安出入库管理系统 增量更新',
  `echo   版本: ${oldVersion} → ${newVersion}`,
  'echo ========================================',
  'echo.',
  '',
  ':: 查找安装目录',
  'set "INSTALL_DIR="',
  'if exist "%LOCALAPPDATA%\\Programs\\洋安出入库管理系统" (',
  '  set "INSTALL_DIR=%LOCALAPPDATA%\\Programs\\洋安出入库管理系统"',
  ') else if exist "%LOCALAPPDATA%\\in-out" (',
  '  set "INSTALL_DIR=%LOCALAPPDATA%\\in-out"',
  ') else (',
  '  echo 未自动找到安装目录，请手动输入：',
  '  echo （右键应用图标 → 打开文件所在的位置，复制地址栏路径粘贴到这里）',
  '  echo.',
  '  set /p INSTALL_DIR=安装目录路径: ',
  '  if not exist "!INSTALL_DIR!\\洋安出入库管理系统.exe" (',
  '    echo [错误] 该目录下未找到洋安出入库管理系统.exe',
  '    pause',
  '    exit /b 1',
  '  )',
  ')',
  '',
  'echo 安装目录: %INSTALL_DIR%',
  'echo.',
  '',
  ':: 关闭正在运行的应用',
  'taskkill /f /im "洋安出入库管理系统.exe" >nul 2>&1',
  'if %errorlevel% equ 0 (',
  '  echo [OK] 已关闭正在运行的应用',
  ') else (',
  '  echo [OK] 应用未在运行',
  ')',
  'echo.',
  '',
  ':: 备份旧 asar',
  'if exist "%INSTALL_DIR%\\resources\\app.asar" (',
  '  copy /y "%INSTALL_DIR%\\resources\\app.asar" "%INSTALL_DIR%\\resources\\app.asar.bak" >nul 2>&1',
  '  echo [OK] 已备份原版本',
  ')',
  '',
  ':: 删除旧的 unpacked 目录',
  'if exist "%INSTALL_DIR%\\resources\\app.asar.unpacked" (',
  '  rmdir /s /q "%INSTALL_DIR%\\resources\\app.asar.unpacked" >nul 2>&1',
  ')',
  '',
  ':: 如果之前解包过 app 目录，删除它',
  'if exist "%INSTALL_DIR%\\resources\\app" (',
  '  rmdir /s /q "%INSTALL_DIR%\\resources\\app" >nul 2>&1',
  ')',
  '',
  ':: 替换 asar',
  'echo 正在更新...',
  'copy /y "%~dp0app.asar" "%INSTALL_DIR%\\resources\\app.asar" >nul 2>&1',
  'if %errorlevel% neq 0 (',
  '  echo [错误] 更新失败，文件复制出错',
  '  pause',
  '  exit /b 1',
  ')',
  '',
  ':: 复制 unpacked 文件',
  'if exist "%~dp0app.asar.unpacked" (',
  '  xcopy "%~dp0app.asar.unpacked" "%INSTALL_DIR%\\resources\\app.asar.unpacked\\" /s /e /y /q >nul 2>&1',
  '  echo [OK] 已更新附加文件',
  ')',
  '',
  'echo.',
  'echo ========================================',
  `echo   更新完成！v${oldVersion} → v${newVersion}`,
  'echo   数据库已保留，无需担心数据丢失',
  'echo ========================================',
  'echo.',
  'echo 按任意键启动应用...',
  'pause >nul',
  'start "" "%INSTALL_DIR%\\洋安出入库管理系统.exe"',
].join('\r\n');

// 创建 zip
const zip = new JSZip();
zip.file('app.asar', fs.readFileSync(asarPath));
zip.file('update.bat', batContent);

for (const file of unpackedFiles) {
  zip.file(`app.asar.unpacked/${file.dest}`, fs.readFileSync(file.src));
}

const zipName = `update-v${newVersion}-from-${oldVersion}.zip`;
const zipPath = path.join(ROOT, 'dist', zipName);

zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }).then(content => {
  fs.writeFileSync(zipPath, content);
  const sizeMB = (content.length / 1024 / 1024).toFixed(1);
  console.log(`\n✅ 更新包已生成: dist/${zipName}`);
  console.log(`   大小: ${sizeMB} MB`);
  console.log(`\n分发方式: 将 zip 发给用户，解压后双击 update.bat 即可`);
});
