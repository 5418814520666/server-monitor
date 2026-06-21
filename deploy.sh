#!/bin/bash

# 服务器监控系统 - 一键部署脚本
# 版本: 1.0.0

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
APP_NAME="server-monitor"
APP_DIR=$(cd "$(dirname "$0")" && pwd)
BACKEND_DIR="$APP_DIR/backend"
PORT=${PORT:-3000}
USE_PM2=false
USE_SYSTEMD=false

# 打印函数
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 打印横幅
print_banner() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║          🖥️  服务器监控系统 - 一键部署脚本               ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
}

# 检查Node.js
check_node() {
    print_info "检查 Node.js 环境..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js 已安装: $NODE_VERSION"
    else
        print_error "未检测到 Node.js，请先安装 Node.js >= 14.0.0"
        print_info "安装方法:"
        echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
        echo "  CentOS/RHEL:   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - && sudo yum install -y nodejs"
        echo "  官方网站:      https://nodejs.org/"
        exit 1
    fi
    
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm 已安装: v$NPM_VERSION"
    else
        print_error "未检测到 npm"
        exit 1
    fi
}

# 安装依赖
install_dependencies() {
    print_info "安装项目依赖..."
    
    if [ -d "$BACKEND_DIR/node_modules" ]; then
        print_warning "检测到已存在的 node_modules，跳过安装"
        print_info "如需重新安装，请删除 node_modules 目录后重试"
    else
        cd "$BACKEND_DIR"
        npm install --production
        print_success "依赖安装完成"
    fi
}

# 配置PM2
setup_pm2() {
    print_info "配置 PM2 进程管理..."
    
    if command -v pm2 &> /dev/null; then
        PM2_VERSION=$(pm2 --version)
        print_success "PM2 已安装: v$PM2_VERSION"
    else
        print_warning "未检测到 PM2，正在安装..."
        npm install -g pm2
        print_success "PM2 安装完成"
    fi
    
    # 检查是否已存在同名进程
    if pm2 list | grep -q "$APP_NAME"; then
        print_warning "检测到已存在的 $APP_NAME 进程，正在停止..."
        pm2 stop "$APP_NAME" 2>/dev/null || true
        pm2 delete "$APP_NAME" 2>/dev/null || true
    fi
    
    # 使用生态文件启动
    if [ -f "$APP_DIR/ecosystem.config.js" ]; then
        cd "$APP_DIR"
        pm2 start ecosystem.config.js
    else
        cd "$BACKEND_DIR"
        pm2 start server.js --name "$APP_NAME"
    fi
    
    pm2 save
    print_success "PM2 配置完成，服务已启动"
}

# 配置systemd服务
setup_systemd() {
    print_info "配置 systemd 服务..."
    
    # 检查是否为root用户
    if [ "$EUID" -ne 0 ]; then
        print_warning "需要 root 权限配置 systemd 服务"
        print_info "请使用 sudo 运行此脚本，或手动配置 systemd 服务"
        return 1
    fi
    
    # 创建服务文件
    SERVICE_FILE="/etc/systemd/system/$APP_NAME.service"
    NODE_PATH=$(which node)
    
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Server Monitor - 服务器监控系统
After=network.target

[Service]
Type=simple
User=$(logname 2>/dev/null || echo "root")
WorkingDirectory=$BACKEND_DIR
ExecStart=$NODE_PATH server.js
Restart=always
RestartSec=10
Environment=PORT=$PORT
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable "$APP_NAME"
    systemctl restart "$APP_NAME"
    
    print_success "systemd 服务配置完成"
    print_info "服务管理命令:"
    echo "  启动: sudo systemctl start $APP_NAME"
    echo "  停止: sudo systemctl stop $APP_NAME"
    echo "  重启: sudo systemctl restart $APP_NAME"
    echo "  状态: sudo systemctl status $APP_NAME"
    echo "  日志: sudo journalctl -u $APP_NAME -f"
}

# 普通方式启动
start_normal() {
    print_info "启动服务..."
    
    cd "$BACKEND_DIR"
    
    # 检查端口是否被占用
    if command -v lsof &> /dev/null; then
        if lsof -Pi :$PORT -sTCP:LISTEN -t &> /dev/null; then
            print_warning "端口 $PORT 已被占用，正在尝试关闭..."
            lsof -Pi :$PORT -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
    fi
    
    # 后台启动
    nohup node server.js > /dev/null 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > "$APP_DIR/server.pid"
    
    sleep 2
    
    # 检查是否启动成功
    if kill -0 $SERVER_PID 2>/dev/null; then
        print_success "服务启动成功，PID: $SERVER_PID"
    else
        print_error "服务启动失败，请检查日志"
        exit 1
    fi
}

# 显示访问信息
show_access_info() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                    🎉 部署完成！                          ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    echo ""
    print_success "服务器监控系统已成功部署！"
    echo ""
    print_info "🌐 访问地址:"
    echo "   本地访问:   http://localhost:$PORT"
    echo "   局域网访问: http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo "你的服务器IP"):$PORT"
    echo ""
    print_info "📁 项目目录: $APP_DIR"
    echo ""
    
    if [ "$USE_PM2" = true ]; then
        print_info "🔧 PM2 管理命令:"
        echo "   查看状态: pm2 status"
        echo "   查看日志: pm2 logs $APP_NAME"
        echo "   重启服务: pm2 restart $APP_NAME"
        echo "   停止服务: pm2 stop $APP_NAME"
    elif [ "$USE_SYSTEMD" = true ]; then
        print_info "🔧 systemd 管理命令:"
        echo "   查看状态: sudo systemctl status $APP_NAME"
        echo "   查看日志: sudo journalctl -u $APP_NAME -f"
        echo "   重启服务: sudo systemctl restart $APP_NAME"
        echo "   停止服务: sudo systemctl stop $APP_NAME"
    else
        print_info "🔧 服务管理:"
        echo "   停止服务: kill \$(cat $APP_DIR/server.pid)"
        echo "   查看进程: ps aux | grep server.js"
    fi
    
    echo ""
    print_info "💡 提示: 生产环境建议使用 PM2 或 systemd 管理进程"
    echo ""
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
}

# 显示帮助
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --pm2        使用 PM2 进程管理器部署（推荐）"
    echo "  --systemd    使用 systemd 服务部署（需要root权限）"
    echo "  --port <端口> 指定服务端口（默认: 3000）"
    echo "  --help       显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                    # 默认方式部署"
    echo "  $0 --pm2              # 使用 PM2 部署"
    echo "  $0 --systemd          # 使用 systemd 部署（需sudo）"
    echo "  $0 --port 8080 --pm2  # 指定端口并使用 PM2 部署"
    echo ""
}

# 主函数
main() {
    print_banner
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --pm2)
                USE_PM2=true
                shift
                ;;
            --systemd)
                USE_SYSTEMD=true
                shift
                ;;
            --port)
                PORT="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    print_info "部署模式: $([ "$USE_PM2" = true ] && echo "PM2" || ([ "$USE_SYSTEMD" = true ] && echo "systemd" || echo "普通模式"))"
    print_info "服务端口: $PORT"
    echo ""
    
    # 执行部署步骤
    check_node
    echo ""
    install_dependencies
    echo ""
    
    # 启动服务
    if [ "$USE_PM2" = true ]; then
        setup_pm2
    elif [ "$USE_SYSTEMD" = true ]; then
        setup_systemd
    else
        start_normal
    fi
    
    echo ""
    show_access_info
}

# 运行主函数
main "$@"
