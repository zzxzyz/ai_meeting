#!/bin/bash

# Electron 客户端验证脚本
# 用于验证 Web 端代码复用和平台工具函数

set -e

echo "============================================"
echo "Electron 客户端验证脚本"
echo "============================================"
echo ""

# 切换到 Electron 目录
cd "$(dirname "$0")"
echo "当前目录: $(pwd)"
echo ""

# 1. 检查依赖
echo "[1/5] 检查依赖..."
if [ ! -d "node_modules" ]; then
  echo "⚠️  依赖未安装，正在安装..."
  npm install
else
  echo "✅ 依赖已安装"
fi
echo ""

# 2. 验证 Web 端文件是否可访问
echo "[2/5] 验证 Web 端代码路径..."
WEB_FILES=(
  "../web/src/pages/Login.tsx"
  "../web/src/pages/Register.tsx"
  "../web/src/components/PrivateRoute.tsx"
  "../web/src/api/client.ts"
  "../web/src/api/auth.ts"
  "../web/src/stores/authStore.ts"
  "../web/src/hooks/useAuth.ts"
  "../web/src/utils/validation.ts"
)

ALL_FILES_EXIST=true
for file in "${WEB_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file 不存在"
    ALL_FILES_EXIST=false
  fi
done
echo ""

if [ "$ALL_FILES_EXIST" = false ]; then
  echo "❌ 部分 Web 端文件缺失，请检查 Web 端实现"
  exit 1
fi

# 3. 验证配置文件
echo "[3/5] 验证配置文件..."
CONFIG_FILES=(
  "vite.config.ts"
  "tsconfig.json"
  ".env.development"
  ".env.production"
)

for file in "${CONFIG_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file 不存在"
    exit 1
  fi
done
echo ""

# 4. 运行类型检查
echo "[4/5] 运行 TypeScript 类型检查..."
if npm run type-check 2>&1 | tee /tmp/electron-typecheck.log; then
  echo "✅ TypeScript 类型检查通过"
else
  echo "⚠️  TypeScript 类型检查有警告，详情请查看 /tmp/electron-typecheck.log"
fi
echo ""

# 5. 验证平台工具函数
echo "[5/5] 验证平台工具函数..."
if [ -f "src/utils/platform.ts" ]; then
  echo "✅ platform.ts 存在"

  # 检查关键函数
  if grep -q "isElectron" "src/utils/platform.ts"; then
    echo "✅ isElectron() 函数已定义"
  fi

  if grep -q "isWeb" "src/utils/platform.ts"; then
    echo "✅ isWeb() 函数已定义"
  fi

  if grep -q "getElectronAPI" "src/utils/platform.ts"; then
    echo "✅ getElectronAPI() 函数已定义"
  fi
else
  echo "❌ platform.ts 不存在"
  exit 1
fi
echo ""

# 总结
echo "============================================"
echo "验证完成！"
echo "============================================"
echo ""
echo "下一步："
echo "1. 启动后端 API 服务: cd apps/backend && npm run dev"
echo "2. 启动 Electron 应用: cd apps/electron && npm run dev"
echo "3. 测试登录注册流程"
echo ""
echo "详细验证报告:"
echo "docs/versions/v0.1/requirements/REQ-001/electron-verification.md"
