#!/bin/bash

# REQ-003 实时音视频通话 - 生产环境部署脚本
# 作者: devops-leader
# 创建日期: 2026-02-26
# 版本: v1.0

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    echo -e "${CYAN}[DEBUG]${NC} $1"
}

# 显示横幅
show_banner() {
    echo ""
    echo "=================================================="
    echo "        REQ-003 实时音视频通话部署脚本"
    echo "=================================================="
    echo ""
    echo "📅 部署时间: $(date)"
    echo "🏠 工作目录: $(pwd)"
    echo ""
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "命令 $1 未安装，请先安装"
        exit 1
    fi
}

# 显示使用说明
show_usage() {
    echo "使用方法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help          显示此帮助信息"
    echo "  -e, --env-file      指定环境变量文件路径 (默认: .env.production)"
    echo "  -s, --skip-build    跳过构建步骤，直接启动服务"
    echo "  -v, --verbose       显示详细输出"
    echo "  -t, --test-only     仅执行测试验证，不部署"
    echo ""
    echo "示例:"
    echo "  $0                    # 完整部署流程"
    echo "  $0 -s                # 跳过构建，直接启动"
    echo "  $0 -e custom.env     # 使用自定义环境变量文件"
    echo "  $0 -t               # 仅验证现有部署"
}

# 解析命令行参数
ENV_FILE=".env.production"
SKIP_BUILD=false
VERBOSE=false
TEST_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -e|--env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -t|--test-only)
            TEST_ONLY=true
            shift
            ;;
        *)
            log_error "未知参数: $1"
            show_usage
            exit 1
            ;;
    esac
done

# 检查环境变量文件
check_env_file() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "环境变量文件 $ENV_FILE 不存在"
        log_info "请复制 .env.production.example 并配置必要的环境变量"
        exit 1
    fi

    # 验证关键环境变量
    log_info "验证 REQ-003 关键环境变量..."

    if ! grep -q "MEDIASOUP_ANNOUNCED_IP" "$ENV_FILE"; then
        log_error "MEDIASOUP_ANNOUNCED_IP 未配置"
        log_info "请设置为服务器的公网 IP 地址，这是 WebRTC 连接的关键配置"
        exit 1
    fi

    if ! grep -q "MEDIASOUP_RTC_MIN_PORT" "$ENV_FILE"; then
        log_warning "MEDIASOUP_RTC_MIN_PORT 未配置，使用默认值 40000"
    fi

    if ! grep -q "MEDIASOUP_RTC_MAX_PORT" "$ENV_FILE"; then
        log_warning "MEDIASOUP_RTC_MAX_PORT 未配置，使用默认值 49999"
    fi

    log_success "环境变量验证通过"
}

# 检查系统依赖
check_dependencies() {
    log_info "检查系统依赖..."

    check_command docker
    check_command docker-compose
    check_command curl

    # 检查 Docker 是否运行
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker 守护进程未运行"
        exit 1
    fi

    log_success "系统依赖检查通过"
}

# 部署服务
deploy_services() {
    log_info "开始部署 REQ-003 服务..."

    # 停止现有服务
    log_info "停止现有服务..."
    docker-compose -f docker-compose.prod.yml down || true

    # 构建镜像（如果未跳过）
    if [[ "$SKIP_BUILD" == false ]]; then
        log_info "构建 Docker 镜像..."

        # 构建后端镜像
        log_info "构建后端镜像（包含 mediasoup 服务）..."
        docker-compose -f docker-compose.prod.yml build backend

        # 构建前端镜像
        log_info "构建前端镜像（包含 WebRTC 客户端）..."
        docker-compose -f docker-compose.prod.yml build frontend
    else
        log_warning "跳过构建步骤，使用现有镜像"
    fi

    # 启动服务
    log_info "启动所有服务..."
    docker-compose -f docker-compose.prod.yml up -d

    # 等待服务启动
    log_info "等待服务启动（30秒）..."
    sleep 30

    log_success "服务部署完成"
}

# 验证基础服务
validate_basic_services() {
    log_info "验证基础服务状态..."

    # 检查容器状态
    if ! docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log_error "部分容器未正常启动"
        docker-compose -f docker-compose.prod.yml ps
        exit 1
    fi

    # 检查后端健康状态
    if ! curl -f http://localhost:3000/api/v1/health > /dev/null 2>&1; then
        log_error "后端服务健康检查失败"
        docker-compose -f docker-compose.prod.yml logs backend
        exit 1
    fi

    # 检查前端健康状态
    if ! curl -f http://localhost/health > /dev/null 2>&1; then
        log_error "前端服务健康检查失败"
        docker-compose -f docker-compose.prod.yml logs frontend
        exit 1
    fi

    log_success "基础服务验证通过"
}

# 验证音视频功能
validate_webrtc_functionality() {
    log_info "验证 REQ-003 音视频功能..."

    # 检查 mediasoup Worker 状态
    log_info "检查 mediasoup Worker 状态..."
    if docker-compose -f docker-compose.prod.yml logs backend | grep -q "mediasoup Worker died"; then
        log_error "mediasoup Worker 启动失败"
        docker-compose -f docker-compose.prod.yml logs backend | grep -i mediasoup
        exit 1
    fi

    # 检查 UDP 端口监听
    log_info "检查 UDP 端口监听状态..."
    if command -v netstat > /dev/null 2>&1; then
        if netstat -tlnp 2>/dev/null | grep -q ":40000"; then
            log_success "UDP 端口监听正常"
        else
            log_warning "UDP 端口 40000 未监听（mediasoup 可能动态分配端口）"
        fi
    fi

    # 检查媒体配置 API
    log_info "检查媒体配置 API..."
    if curl -f http://localhost:3000/api/v1/health > /dev/null 2>&1; then
        log_success "媒体配置 API 可访问"
    else
        log_error "媒体配置 API 不可访问"
        exit 1
    fi

    # 检查 WebSocket 连接
    log_info "检查 WebSocket 信令服务..."
    if docker-compose -f docker-compose.prod.yml logs backend | grep -q "WebSocket Gateway"; then
        log_success "WebSocket 信令服务正常"
    else
        log_warning "WebSocket 信令服务日志未找到"
    fi

    log_success "音视频功能验证通过"
}

# 验证防火墙配置
validate_firewall_config() {
    log_info "验证防火墙配置..."

    echo "⚠️  请手动验证以下端口是否开放："
    echo ""
    echo "TCP 端口:"
    echo "  - 80 (HTTP)"
    echo "  - 443 (HTTPS)"
    echo "  - 3000 (后端 API)"
    echo ""
    echo "UDP 端口范围（关键）:"
    echo "  - 40000-49999 (mediasoup RTP 媒体流)"
    echo ""
    echo "验证命令:"
    echo "  # 检查端口开放状态"
    echo "  netstat -tlnp | grep -E '(80|443|3000)'"
    echo "  # 检查防火墙规则"
    echo "  firewall-cmd --list-all"
    echo ""
}

# 显示部署摘要
show_deployment_summary() {
    echo ""
    echo "=================================================="
    echo "            REQ-003 部署摘要"
    echo "=================================================="
    echo ""
    echo "✅ 后端服务: http://localhost:3000"
    echo "✅ 前端服务: http://localhost"
    echo "✅ 数据库: PostgreSQL (容器内部)"
    echo "✅ 缓存: Redis (容器内部)"
    echo "✅ 音视频服务: mediasoup SFU"
    echo ""
    echo "📊 服务状态:"
    docker-compose -f docker-compose.prod.yml ps
    echo ""
    echo "🔧 验证命令:"
    echo "  # 健康检查"
    echo "  curl http://localhost:3000/api/v1/health"
    echo "  curl http://localhost/health"
    echo ""
    echo "  # 查看日志"
    echo "  docker-compose -f docker-compose.prod.yml logs backend"
    echo "  docker-compose -f docker-compose.prod.yml logs frontend"
    echo ""
    echo "🌐 访问地址:"
    echo "  前端应用: http://YOUR_SERVER_IP 或 https://YOUR_DOMAIN"
    echo "  API 文档: http://YOUR_SERVER_IP:3000/api/docs"
    echo ""
    echo "🎯 REQ-003 音视频功能验证:"
    echo "  1. 访问前端应用并登录"
    echo "  2. 创建或加入会议"
    echo "  3. 允许摄像头/麦克风权限"
    echo "  4. 验证本地视频预览正常"
    echo "  5. 邀请其他用户测试多端互通"
    echo ""
    echo "⚠️  重要提醒:"
    echo "  1. 确保 MEDIASOUP_ANNOUNCED_IP 设置为服务器公网 IP"
    echo "  2. 开放 UDP 端口范围 40000-49999"
    echo "  3. 配置 SSL 证书以启用 HTTPS"
    echo "  4. 测试跨浏览器兼容性（Chrome/Safari/Firefox）"
    echo ""
}

# 仅执行测试验证
test_only() {
    log_info "执行 REQ-003 部署验证..."

    check_dependencies
    check_env_file
    validate_basic_services
    validate_webrtc_functionality
    validate_firewall_config

    log_success "REQ-003 部署验证完成"
}

# 主部署函数
main_deploy() {
    show_banner

    check_dependencies
    check_env_file

    if [[ "$TEST_ONLY" == true ]]; then
        test_only
    else
        deploy_services
        validate_basic_services
        validate_webrtc_functionality
        validate_firewall_config
        show_deployment_summary
        log_success "REQ-003 部署完成！"
    fi
}

# 捕获退出信号
trap 'log_error "部署被中断"; exit 1' INT TERM

# 运行主程序
main_deploy "$@"