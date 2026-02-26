#!/bin/bash

# Docker Compose 管理脚本
# 用于管理 ai_meeting 项目的 Docker 容器

COMPOSE_FILE="docker-compose.prod.yml"

function show_usage() {
    echo "用法: ./docker-manage.sh [命令]"
    echo ""
    echo "可用命令:"
    echo "  start           - 启动所有容器"
    echo "  stop            - 停止所有容器"
    echo "  restart         - 重启所有容器"
    echo "  build [service] - 构建镜像（无缓存）"
    echo "                    不指定service则构建所有"
    echo "                    可选: frontend, backend, postgres, redis"
    echo "  logs [service]  - 实时滚动查看容器日志"
    echo "                    不指定service则查看后端日志"
    echo "                    可选: frontend, backend, postgres, redis, all"
    echo "                    按 Ctrl+C 退出"
    echo "  exec [service]  - 进入容器 shell"
    echo "                    不指定service则进入后端容器"
    echo "                    可选: frontend, backend, postgres, redis"
    echo "  status          - 查看容器状态"
    echo "  clean           - 停止并删除所有容器、网络和卷"
    echo "  help            - 显示此帮助信息"
    echo ""
}

function start_containers() {
    echo "正在启动容器..."
    docker compose -f $COMPOSE_FILE up -d
}

function stop_containers() {
    echo "正在停止容器..."
    docker compose -f $COMPOSE_FILE down
}

function restart_containers() {
    echo "正在重启容器..."
    docker compose -f $COMPOSE_FILE restart
}

function build_images() {
    local service=$1
    if [ -z "$service" ]; then
        echo "正在构建所有镜像（无缓存）..."
        docker compose -f $COMPOSE_FILE build --no-cache
    else
        echo "正在构建 $service 镜像（无缓存）..."
        docker compose -f $COMPOSE_FILE build $service --no-cache
    fi
}

function show_logs() {
    local service=${1:-backend}
    
    if [ "$service" == "all" ]; then
        echo "实时查看所有容器日志（按 Ctrl+C 退出）..."
        docker compose -f $COMPOSE_FILE logs -f
    else
        local container_name=""
        case "$service" in
            frontend)
                container_name="ai-meeting-frontend"
                ;;
            backend)
                container_name="ai-meeting-backend"
                ;;
            postgres)
                container_name="ai-meeting-postgres"
                ;;
            redis)
                container_name="ai-meeting-redis"
                ;;
            *)
                echo "错误: 未知的服务 '$service'"
                echo "可用服务: frontend, backend, postgres, redis, all"
                exit 1
                ;;
        esac
        echo "实时查看 $service 日志（按 Ctrl+C 退出）..."
        docker logs $container_name -f
    fi
}

function show_status() {
    echo "容器状态:"
    docker compose -f $COMPOSE_FILE ps
}

function exec_container() {
    local service=${1:-backend}
    local container_name=""
    local shell_cmd=""
    
    case "$service" in
        frontend)
            container_name="ai-meeting-frontend"
            shell_cmd="/bin/sh"  # Alpine Linux 使用 sh
            ;;
        backend)
            container_name="ai-meeting-backend"
            shell_cmd="/bin/bash"  # Node 镜像通常有 bash
            ;;
        postgres)
            container_name="ai-meeting-postgres"
            shell_cmd="/bin/bash"
            ;;
        redis)
            container_name="ai-meeting-redis"
            shell_cmd="/bin/sh"  # Redis Alpine 使用 sh
            ;;
        *)
            echo "错误: 未知的服务 '$service'"
            echo "可用服务: frontend, backend, postgres, redis"
            exit 1
            ;;
    esac
    
    echo "进入 $service 容器 shell..."
    docker exec -it $container_name $shell_cmd
}

function clean_all() {
    echo "警告: 这将停止并删除所有容器、网络和卷！"
    read -p "确认继续？(y/N): " confirm
    if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
        docker compose -f $COMPOSE_FILE down -v
        echo "清理完成"
    else
        echo "操作已取消"
    fi
}

# 主逻辑
case "${1:-help}" in
    start)
        start_containers
        ;;
    stop)
        stop_containers
        ;;
    restart)
        restart_containers
        ;;
    build)
        build_images "$2"
        ;;
    logs)
        show_logs "$2"
        ;;
    exec)
        exec_container "$2"
        ;;
    status)
        show_status
        ;;
    clean)
        clean_all
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        echo "错误: 未知命令 '$1'"
        echo ""
        show_usage
        exit 1
        ;;
esac
