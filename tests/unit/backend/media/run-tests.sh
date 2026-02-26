#!/bin/bash

# REQ-003 后端单元测试运行脚本
# 运行 mediasoup 相关服务的单元测试

echo "=== REQ-003 后端单元测试 ==="
echo "测试目录: $(pwd)"
echo ""

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 安装依赖（如果需要）
echo "1. 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    pnpm install
fi

# 构建项目
echo ""
echo "2. 构建项目..."
pnpm build

# 运行 mediasoup 相关测试
echo ""
echo "3. 运行 MediasoupService 测试..."
npx jest tests/unit/backend/media/mediasoup.service.spec.ts --config=tests/unit/backend/media/jest.config.js --verbose

# 运行 RoomService 测试
echo ""
echo "4. 运行 RoomService 测试..."
npx jest tests/unit/backend/media/room.service.spec.ts --config=tests/unit/backend/media/jest.config.js --verbose

# 运行 MeetingGateway 测试
echo ""
echo "5. 运行 MeetingGateway 测试..."
npx jest tests/unit/backend/media/meeting.gateway.spec.ts --config=tests/unit/backend/media/jest.config.js --verbose

# 运行所有媒体相关测试
echo ""
echo "6. 运行所有媒体相关测试..."
npx jest tests/unit/backend/media/ --config=tests/unit/backend/media/jest.config.js --verbose

echo ""
echo "=== 测试完成 ==="
echo "查看测试报告: coverage/lcov-report/index.html"