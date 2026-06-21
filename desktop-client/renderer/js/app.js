// 桌面客户端主逻辑

// 服务器列表数据
let servers = [];
let currentServer = null;

// DOM 元素
const serverListEl = document.getElementById('serverList');
const welcomePage = document.getElementById('welcomePage');
const monitorPage = document.getElementById('monitorPage');
const monitorFrame = document.getElementById('monitorFrame');
const addServerModal = document.getElementById('addServerModal');
const serverForm = document.getElementById('serverForm');
const currentServerNameEl = document.getElementById('currentServerName');
const currentServerStatusEl = document.getElementById('currentServerStatus');

// 初始化
function init() {
    loadServers();
    renderServerList();
    bindEvents();
    checkAutoConnect();
}

// 加载服务器列表
function loadServers() {
    try {
        const saved = localStorage.getItem('servers');
        if (saved) {
            servers = JSON.parse(saved);
        }
    } catch (e) {
        console.error('加载服务器列表失败:', e);
        servers = [];
    }
}

// 保存服务器列表
function saveServers() {
    try {
        localStorage.setItem('servers', JSON.stringify(servers));
    } catch (e) {
        console.error('保存服务器列表失败:', e);
    }
}

// 渲染服务器列表
function renderServerList() {
    if (servers.length === 0) {
        serverListEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🖥️</div>
                <div class="empty-state-text">暂无服务器</div>
            </div>
        `;
        return;
    }

    serverListEl.innerHTML = servers.map((server, index) => `
        <div class="server-item ${currentServer && currentServer.id === server.id ? 'active' : ''}" 
             data-id="${server.id}"
             onclick="connectServer('${server.id}')">
            <span class="server-item-icon">🖥️</span>
            <div class="server-item-info">
                <div class="server-item-name">${escapeHtml(server.name)}</div>
                <div class="server-item-url">${escapeHtml(server.url)}</div>
            </div>
            <div class="server-item-status" id="status-${server.id}"></div>
            <div class="server-item-actions">
                <button class="server-item-action-btn" onclick="event.stopPropagation(); editServer('${server.id}')" title="编辑">
                    ✏️
                </button>
                <button class="server-item-action-btn delete" onclick="event.stopPropagation(); deleteServer('${server.id}')" title="删除">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');

    // 更新状态
    servers.forEach(server => {
        checkServerStatus(server);
    });
}

// 检查服务器状态
function checkServerStatus(server) {
    const statusEl = document.getElementById(`status-${server.id}`);
    if (!statusEl) return;

    // 简单的健康检查
    fetch(`${server.url.replace(/\/$/, '')}/api/health`, {
        method: 'GET',
        mode: 'no-cors'
    }).then(() => {
        statusEl.className = 'server-item-status online';
    }).catch(() => {
        statusEl.className = 'server-item-status offline';
    });
}

// 连接服务器
function connectServer(id) {
    const server = servers.find(s => s.id === id);
    if (!server) return;

    currentServer = server;
    currentServerNameEl.textContent = server.name;
    currentServerStatusEl.textContent = '连接中...';
    currentServerStatusEl.className = 'server-status';

    // 构建带认证的 URL
    let monitorUrl = server.url.replace(/\/$/, '');
    
    // 切换到监控页面
    welcomePage.style.display = 'none';
    monitorPage.style.display = 'flex';

    // 加载 iframe
    monitorFrame.src = monitorUrl;

    // 更新列表高亮
    renderServerList();

    // 监听 iframe 加载
    monitorFrame.onload = () => {
        currentServerStatusEl.textContent = '已连接';
        currentServerStatusEl.className = 'server-status online';
        
        // 更新托盘提示
        if (window.electronAPI) {
            window.electronAPI.updateTrayTooltip(`服务器监控系统 - ${server.name}`);
        }
    };

    monitorFrame.onerror = () => {
        currentServerStatusEl.textContent = '连接失败';
        currentServerStatusEl.className = 'server-status';
    };
}

// 返回列表
function backToList() {
    currentServer = null;
    monitorFrame.src = '';
    welcomePage.style.display = 'flex';
    monitorPage.style.display = 'none';
    renderServerList();

    // 重置托盘提示
    if (window.electronAPI) {
        window.electronAPI.updateTrayTooltip('服务器监控系统');
    }
}

// 刷新页面
function refreshMonitor() {
    if (monitorFrame.src) {
        monitorFrame.contentWindow.location.reload();
    }
}

// 显示添加服务器弹窗
function showAddModal() {
    serverForm.reset();
    document.getElementById('serverUsername').value = 'admin';
    addServerModal.classList.add('show');
    setTimeout(() => {
        document.getElementById('serverName').focus();
    }, 100);
}

// 隐藏弹窗
function hideModal() {
    addServerModal.classList.remove('show');
}

// 保存服务器
function saveServer() {
    const name = document.getElementById('serverName').value.trim();
    const url = document.getElementById('serverUrl').value.trim();
    const username = document.getElementById('serverUsername').value.trim();
    const password = document.getElementById('serverPassword').value;
    const autoConnect = document.getElementById('autoConnect').checked;

    if (!name || !url) {
        alert('请填写服务器名称和地址');
        return;
    }

    // 规范化 URL
    let normalizedUrl = url;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'http://' + normalizedUrl;
    }

    const server = {
        id: Date.now().toString(),
        name,
        url: normalizedUrl,
        username,
        password,
        autoConnect,
        createdAt: new Date().toISOString()
    };

    servers.push(server);
    saveServers();
    renderServerList();
    hideModal();

    // 如果是第一个服务器，自动连接
    if (servers.length === 1) {
        connectServer(server.id);
    }
}

// 编辑服务器
function editServer(id) {
    const server = servers.find(s => s.id === id);
    if (!server) return;

    document.getElementById('serverName').value = server.name;
    document.getElementById('serverUrl').value = server.url;
    document.getElementById('serverUsername').value = server.username || '';
    document.getElementById('serverPassword').value = server.password || '';
    document.getElementById('autoConnect').checked = server.autoConnect || false;

    addServerModal.classList.add('show');

    // 修改保存按钮行为
    const saveBtn = document.getElementById('saveBtn');
    const originalOnclick = saveBtn.onclick;
    
    saveBtn.onclick = () => {
        const name = document.getElementById('serverName').value.trim();
        const url = document.getElementById('serverUrl').value.trim();
        const username = document.getElementById('serverUsername').value.trim();
        const password = document.getElementById('serverPassword').value;
        const autoConnect = document.getElementById('autoConnect').checked;

        if (!name || !url) {
            alert('请填写服务器名称和地址');
            return;
        }

        let normalizedUrl = url;
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = 'http://' + normalizedUrl;
        }

        server.name = name;
        server.url = normalizedUrl;
        server.username = username;
        server.password = password;
        server.autoConnect = autoConnect;

        saveServers();
        renderServerList();
        hideModal();

        // 恢复保存按钮
        saveBtn.onclick = originalOnclick;

        // 如果当前正在查看这个服务器，更新 iframe
        if (currentServer && currentServer.id === id) {
            connectServer(id);
        }
    };
}

// 删除服务器
function deleteServer(id) {
    if (!confirm('确定要删除这个服务器吗？')) return;

    const index = servers.findIndex(s => s.id === id);
    if (index > -1) {
        servers.splice(index, 1);
        saveServers();

        // 如果删除的是当前服务器，返回列表
        if (currentServer && currentServer.id === id) {
            backToList();
        } else {
            renderServerList();
        }
    }
}

// 检查自动连接
function checkAutoConnect() {
    const autoServer = servers.find(s => s.autoConnect);
    if (autoServer) {
        setTimeout(() => {
            connectServer(autoServer.id);
        }, 500);
    }
}

// 绑定事件
function bindEvents() {
    // 添加服务器按钮
    document.getElementById('addServerBtn').addEventListener('click', showAddModal);
    document.getElementById('welcomeAddBtn').addEventListener('click', showAddModal);

    // 弹窗按钮
    document.getElementById('closeModalBtn').addEventListener('click', hideModal);
    document.getElementById('cancelBtn').addEventListener('click', hideModal);
    document.getElementById('saveBtn').addEventListener('click', saveServer);

    // 点击遮罩关闭
    document.querySelector('.modal-overlay').addEventListener('click', hideModal);

    // 表单提交
    serverForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveServer();
    });

    // 返回按钮
    document.getElementById('backBtn').addEventListener('click', backToList);

    // 刷新按钮
    document.getElementById('refreshBtn').addEventListener('click', refreshMonitor);

    // ESC 关闭弹窗
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && addServerModal.classList.contains('show')) {
            hideModal();
        }
    });
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 初始化应用
init();
