/**
 * SSH 终端前端逻辑
 */

// 全局变量
let term = null;
let fitAddon = null;
let ws = null;
let currentConfig = null;
let isConnected = false;

// DOM 元素
const connectPanel = document.getElementById('connectPanel');
const terminalContainer = document.getElementById('terminalContainer');
const sshForm = document.getElementById('sshForm');
const connectionStatus = document.getElementById('connectionStatus');
const statusDot = connectionStatus.querySelector('.status-dot');
const statusText = connectionStatus.querySelector('.status-text');
const terminalTitle = document.getElementById('terminalTitle');
const usePrivateKeyCheckbox = document.getElementById('usePrivateKey');
const privateKeyGroup = document.getElementById('privateKeyGroup');

// 按钮元素
const disconnectBtn = document.getElementById('disconnectBtn');
const reconnectBtn = document.getElementById('reconnectBtn');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initTerminal();
    loadQuickConnect();
    bindEvents();
});

// 初始化终端
function initTerminal() {
    term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Monaco, Menlo, "Courier New", monospace',
        theme: {
            background: '#1a1a2e',
            foreground: '#e0e0e0',
            cursor: '#64b5f6',
            cursorAccent: '#1a1a2e',
            selectionBackground: 'rgba(100, 181, 246, 0.3)',
            black: '#000000',
            red: '#e06c75',
            green: '#98c379',
            yellow: '#d19a66',
            blue: '#61afef',
            magenta: '#c678dd',
            cyan: '#56b6c2',
            white: '#abb2bf',
            brightBlack: '#5c6370',
            brightRed: '#e06c75',
            brightGreen: '#98c379',
            brightYellow: '#d19a66',
            brightBlue: '#61afef',
            brightMagenta: '#c678dd',
            brightCyan: '#56b6c2',
            brightWhite: '#ffffff'
        },
        scrollback: 5000,
        convertEol: true
    });

    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    // 终端输入事件
    term.onData((data) => {
        if (ws && ws.readyState === WebSocket.OPEN && isConnected) {
            ws.send(JSON.stringify({
                type: 'input',
                data: data
            }));
        }
    });

    // 窗口大小变化
    window.addEventListener('resize', () => {
        if (fitAddon) {
            fitAddon.fit();
            sendResize();
        }
    });
}

// 发送终端大小调整
function sendResize() {
    if (ws && ws.readyState === WebSocket.OPEN && isConnected && term) {
        ws.send(JSON.stringify({
            type: 'resize',
            data: {
                cols: term.cols,
                rows: term.rows
            }
        }));
    }
}

// 绑定事件
function bindEvents() {
    // 表单提交
    sshForm.addEventListener('submit', (e) => {
        e.preventDefault();
        connectSSH();
    });

    // 私钥切换
    usePrivateKeyCheckbox.addEventListener('change', () => {
        if (usePrivateKeyCheckbox.checked) {
            privateKeyGroup.style.display = 'block';
        } else {
            privateKeyGroup.style.display = 'none';
        }
    });

    // 断开按钮
    disconnectBtn.addEventListener('click', disconnectSSH);

    // 重连按钮
    reconnectBtn.addEventListener('click', reconnectSSH);

    // 复制按钮
    copyBtn.addEventListener('click', copySelection);

    // 清屏按钮
    clearBtn.addEventListener('click', clearTerminal);
}

// 连接 SSH
function connectSSH() {
    const host = document.getElementById('host').value.trim();
    const port = parseInt(document.getElementById('port').value) || 22;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const usePrivateKey = usePrivateKeyCheckbox.checked;
    const privateKey = document.getElementById('privateKey').value.trim();
    const passphrase = document.getElementById('passphrase').value;

    if (!host || !username) {
        alert('请填写主机地址和用户名');
        return;
    }

    if (!usePrivateKey && !password) {
        alert('请填写密码或选择私钥认证');
        return;
    }

    if (usePrivateKey && !privateKey) {
        alert('请粘贴私钥内容');
        return;
    }

    currentConfig = { host, port, username, usePrivateKey };

    // 显示连接中状态
    setStatus('connecting', '连接中...');

    // 保存到快速连接
    saveQuickConnect({ host, port, username });

    // 连接 WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ssh`;

    try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('SSH WebSocket 已连接');
            
            // 发送连接配置
            const connectData = {
                type: 'connect',
                data: {
                    host,
                    port,
                    username,
                    password: usePrivateKey ? undefined : password,
                    privateKey: usePrivateKey ? privateKey : undefined,
                    passphrase: usePrivateKey ? passphrase : undefined
                }
            };
            
            ws.send(JSON.stringify(connectData));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleMessage(msg);
            } catch (err) {
                console.error('消息解析错误:', err);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket 错误:', error);
            setStatus('disconnected', '连接错误');
            term.writeln('\r\n\x1b[31mWebSocket 连接错误\x1b[0m');
        };

        ws.onclose = () => {
            console.log('SSH WebSocket 已断开');
            isConnected = false;
            setStatus('disconnected', '已断开');
            term.writeln('\r\n\x1b[33m连接已断开\x1b[0m');
        };

    } catch (err) {
        console.error('创建 WebSocket 失败:', err);
        setStatus('disconnected', '连接失败');
        alert('连接失败: ' + err.message);
    }
}

// 处理消息
function handleMessage(msg) {
    switch (msg.type) {
        case 'status':
            if (msg.data.connected) {
                isConnected = true;
                setStatus('connected', '已连接');
                showTerminal();
                terminalTitle.textContent = `${currentConfig.username}@${currentConfig.host}`;
                
                // 发送终端大小
                setTimeout(() => {
                    fitAddon.fit();
                    sendResize();
                }, 100);
            } else {
                isConnected = false;
                setStatus('disconnected', msg.data.message || '已断开');
            }
            break;

        case 'output':
            if (term) {
                term.write(msg.data);
            }
            break;

        case 'error':
            console.error('SSH 错误:', msg.data.message);
            term.writeln(`\r\n\x1b[31m错误: ${msg.data.message}\x1b[0m`);
            setStatus('disconnected', '连接错误');
            break;

        default:
            break;
    }
}

// 断开 SSH
function disconnectSSH() {
    if (ws) {
        ws.send(JSON.stringify({
            type: 'disconnect'
        }));
        ws.close();
    }
    isConnected = false;
    setStatus('disconnected', '已断开');
}

// 重连 SSH
function reconnectSSH() {
    if (currentConfig) {
        // 清空终端
        term.clear();
        
        // 重新连接
        connectSSH();
    }
}

// 复制选中内容
function copySelection() {
    const selection = term.getSelection();
    if (selection) {
        navigator.clipboard.writeText(selection).then(() => {
            // 显示提示
            term.writeln('\r\n\x1b[32m已复制到剪贴板\x1b[0m');
            setTimeout(() => {
                // 清除提示行
                term.write('\x1b[1A\x1b[2K');
            }, 1000);
        });
    }
}

// 清屏
function clearTerminal() {
    if (term) {
        term.clear();
    }
}

// 显示终端
function showTerminal() {
    connectPanel.style.display = 'none';
    terminalContainer.style.display = 'block';
    
    // 延迟调整终端大小
    setTimeout(() => {
        if (fitAddon) {
            fitAddon.fit();
        }
    }, 100);
}

// 设置连接状态
function setStatus(status, text) {
    statusDot.className = 'status-dot ' + status;
    statusText.textContent = text;
}

// 保存快速连接
function saveQuickConnect(config) {
    let history = JSON.parse(localStorage.getItem('sshQuickConnect') || '[]');
    
    // 移除重复项
    history = history.filter(item => 
        !(item.host === config.host && item.username === config.username)
    );
    
    // 添加到开头
    history.unshift(config);
    
    // 只保留最近 5 条
    if (history.length > 5) {
        history = history.slice(0, 5);
    }
    
    localStorage.setItem('sshQuickConnect', JSON.stringify(history));
    loadQuickConnect();
}

// 加载快速连接
function loadQuickConnect() {
    const history = JSON.parse(localStorage.getItem('sshQuickConnect') || '[]');
    const quickList = document.getElementById('quickList');
    
    if (history.length === 0) {
        quickList.innerHTML = '<p class="no-history">暂无历史连接</p>';
        return;
    }
    
    quickList.innerHTML = '';
    
    history.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'quick-item';
        div.innerHTML = `
            <div class="quick-item-info">
                <span class="quick-item-host">${item.host}:${item.port || 22}</span>
                <span class="quick-item-user">${item.username}</span>
            </div>
            <span class="quick-item-delete" data-index="${index}">×</span>
        `;
        
        // 点击连接
        div.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-item-delete')) {
                return;
            }
            document.getElementById('host').value = item.host;
            document.getElementById('port').value = item.port || 22;
            document.getElementById('username').value = item.username;
        });
        
        // 删除按钮
        const deleteBtn = div.querySelector('.quick-item-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteQuickConnect(index);
        });
        
        quickList.appendChild(div);
    });
}

// 删除快速连接
function deleteQuickConnect(index) {
    let history = JSON.parse(localStorage.getItem('sshQuickConnect') || '[]');
    history.splice(index, 1);
    localStorage.setItem('sshQuickConnect', JSON.stringify(history));
    loadQuickConnect();
}
