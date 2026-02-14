#!/bin/bash

# Electron 应用构建验证脚本

echo "========================================="
echo "Electron 应用构建验证"
echo "========================================="
echo ""

# 检查 Node.js
echo "检查 Node.js 版本..."
node --version || { echo "❌ Node.js 未安装"; exit 1; }
echo "✅ Node.js 已安装"
echo ""

# 检查 pnpm
echo "检查 pnpm..."
pnpm --version || { echo "❌ pnpm 未安装"; exit 1; }
echo "✅ pnpm 已安装"
echo ""

# 检查文件结构
echo "检查文件结构..."
files=(
  "src/main/index.ts"
  "src/main/preload.ts"
  "src/renderer/App.tsx"
  "src/renderer/main.tsx"
  "src/types/electron.d.ts"
  "src/utils/platform.ts"
  "package.json"
  "vite.config.ts"
  "tsconfig.json"
  "tsconfig.main.json"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file 不存在"
    exit 1
  fi
done
echo ""

# 编译主进程
echo "编译主进程..."
pnpm exec tsc -p tsconfig.main.json || { echo "❌ 主进程编译失败"; exit 1; }
echo "✅ 主进程编译成功"
echo ""

# 构建渲染进程
echo "构建渲染进程..."
pnpm exec vite build || { echo "❌ 渲染进程构建失败"; exit 1; }
echo "✅ 渲染进程构建成功"
echo ""

echo "========================================="
echo "✅ 所有检查通过！Electron 应用骨架完成"
echo "========================================="
echo ""
echo "下一步："
echo "  1. 运行 'pnpm dev' 启动开发服务器"
echo "  2. 运行 'pnpm build' 构建生产版本"
echo "  3. 运行 'electron-builder' 打包应用"
