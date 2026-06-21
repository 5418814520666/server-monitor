/**
 * 服务器监控系统 - 前端主逻辑
 */

// 全局变量
let ws;
let cpuChart, memoryChart, networkChart;
const maxDataPoints = 60;
const SESSION_KEY = 'server_monitor_session';

// 获取会话ID
function getSessionId() {
    // 优先从 URL 参数获取
    const urlParams = new URLSearchParams(window.location.search);
    const urlSessionId = urlParams.get('sessionId');
    if (urlSessionId) {
        return urlSessionId;
    }
    
    // 从 localStorage 获取
    try {
        const session = localStorage.getItem(SESSION_KEY);
        if (session) {
            return JSON.parse(session).sessionId;
        }
    } catch (e) {
        // 忽略
    }
    
    // 从 sessionStorage 获取
    try {
        const session = sessionStorage.getItem(SESSION_KEY);
        if (session) {
            return JSON.parse(session).sessionId;
        }
    } catch (e) {
        // 忽略
    }
    
    return null;
}

// 获取用户名
function getUsername() {
    try {
        const session = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        if (session) {
            return JSON.parse(session).username;
        }
    } catch (e) {
        // 忽略
    }
    return null;
}

// 跳转到登录页
function redirectToLogin() {
    window.location.href = '/login.html';
}

// 登出
function logout() {
    const sessionId = getSessionId();
    if (sessionId) {
        fetch('/api/logout', {
            method: 'POST',
            headers: {
                'X-Session-Id': sessionId
            }
        }).catch(() => {
            // 忽略错误
        });
    }
    
    // 清除本地存储
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    
    // 跳转到登录页
    redirectToLogin();
}

// 检查登录状态
function checkAuth() {
    const sessionId = getSessionId();
    if (!sessionId) {
        redirectToLogin();
        return false;
    }
    
    return true;
}

// 初始化图表
function initCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: 'rgba(255, 255, 255, 0.7)',
                    font: {
                        size: 12
                    }
                }
            }
        },
        scales: {
            x: {
                display: true,
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)',
                    maxTicksLimit: 6
                }
            },
            y: {
                display: true,
                beginAtZero: true,
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)'
                }
            }
        },
        animation: {
            duration: 300
        }
    };

    // CPU 图表
    const cpuCtx = document.getElementById('cpuChart').getContext('2d');
    cpuChart = new Chart(cpuCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'CPU 使用率 (%)',
                data: [],
                borderColor: '#ff6b6b',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4
            }]
        },
        options: {
            ...chartOptions,
            scales: {
                ...chartOptions.scales,
                y: {
                    ...chartOptions.scales.y,
                    max: 100,
                    ticks: {
                        ...chartOptions.scales.y.ticks,
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });

    // 内存图表
    const memoryCtx = document.getElementById('memoryChart').getContext('2d');
    memoryChart = new Chart(memoryCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '内存使用率 (%)',
                data: [],
                borderColor: '#7b2cbf',
                backgroundColor: 'rgba(123, 44, 191, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4
            }]
        },
        options: {
            ...chartOptions,
            scales: {
                ...chartOptions.scales,
                y: {
                    ...chartOptions.scales.y,
                    max: 100,
                    ticks: {
                        ...chartOptions.scales.y.ticks,
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });

    // 网络图表
    const networkCtx = document.getElementById('networkChart').getContext('2d');
    networkChart = new Chart(networkCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '下载 (KB/s)',
                    data: [],
                    borderColor: '#51cf66',
                    backgroundColor: 'rgba(81, 207, 102, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: '上传 (KB/s)',
                    data: [],
                    borderColor: '#ffd43b',
                    backgroundColor: 'rgba(255, 212, 59, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }
            ]
        },
        options: {
            ...chartOptions,
            scales: {
                ...chartOptions.scales,
                y: {
                    ...chartOptions.scales.y,
                    ticks: {
                        ...chartOptions.scales.y.ticks,
                        callback: function(value) {
                            return value + ' KB/s';
                        }
                    }
                }
            }
        }
    });
}

// 更新图表数据
function updateCharts(data) {
    const time = new Date(data.timestamp).toLocaleTimeString();

    // CPU 图表
    cpuChart.data.labels.push(time);
    cpuChart.data.datasets[0].data.push(parseFloat(data.cpu.usage));
    if (cpuChart.data.labels.length > maxDataPoints) {
        cpuChart.data.labels.shift();
        cpuChart.data.datasets[0].data.shift();
    }
    cpuChart.update('none');

    // 内存图表
    memoryChart.data.labels.push(time);
    memoryChart.data.datasets[0].data.push(parseFloat(data.memory.usagePercent));
    if (memoryChart.data.labels.length > maxDataPoints) {
        memoryChart.data.labels.shift();
        memoryChart.data.datasets[0].data.shift();
    }
    memoryChart.update('none');

    // 网络图表
    const totalRx = data.network.reduce((sum, n) => sum + parseFloat(n.rx), 0);
    const totalTx = data.network.reduce((sum, n) => sum + parseFloat(n.tx), 0);
    
    networkChart.data.labels.push(time);
    networkChart.data.datasets[0].data.push(totalRx);
    networkChart.data.datasets[1].data.push(totalTx);
    if (networkChart.data.labels.length > maxDataPoints) {
        networkChart.data.labels.shift();
        networkChart.data.datasets[0].data.shift();
        networkChart.data.datasets[1].data.shift();
    }
    networkChart.update('none');
}

// 加载历史数据
function loadHistoryData(history) {
    // CPU 历史
    if (history.cpu && history.cpu.length > 0) {
        cpuChart.data.labels = history.cpu.map(d => new Date(d.time).toLocaleTimeString());
        cpuChart.data.datasets[0].data = history.cpu.map(d => d.value);
        cpuChart.update('none');
    }

    // 内存历史
    if (history.memory && history.memory.length > 0) {
        memoryChart.data.labels = history.memory.map(d => new Date(d.time).toLocaleTimeString());
        memoryChart.data.datasets[0].data = history.memory.map(d => d.value);
        memoryChart.update('none');
    }

    // 网络历史
    if (history.network && history.network.length > 0) {
        networkChart.data.labels = history.network.map(d => new Date(d.time).toLocaleTimeString());
        networkChart.data.datasets[0].data = history.network.map(d => d.rx);
        networkChart.data.datasets[1].data = history.network.map(d => d.tx);
        networkChart.update('none');
    }
}

// 更新统计卡片
function updateStats(data) {
    // CPU
    document.getElementById('cpuUsage').textContent = data.cpu.usage + '%';
    document.getElementById('cpuModel').textContent = data.cpu.model;
    document.getElementById('cpuProgress').style.width = data.cpu.usage + '%';

    // 内存
    document.getElementById('memUsage').textContent = data.memory.usagePercent + '%';
    document.getElementById('memDetail').textContent = `${data.memory.used} / ${data.memory.total} GB`;
    document.getElementById('memProgress').style.width = data.memory.usagePercent + '%';

    // 磁盘（取第一个磁盘）
    if (data.disk.length > 0) {
        const mainDisk = data.disk[0];
        document.getElementById('diskUsage').textContent = mainDisk.usagePercent + '%';
        document.getElementById('diskDetail').textContent = `${mainDisk.used} / ${mainDisk.total} GB`;
        document.getElementById('diskProgress').style.width = mainDisk.usagePercent + '%';
    }

    // 网络
    const totalRx = data.network.reduce((sum, n) => sum + parseFloat(n.rx), 0);
    const totalTx = data.network.reduce((sum, n) => sum + parseFloat(n.tx), 0);
    const totalSpeed = totalRx + totalTx;
    
    document.getElementById('netSpeed').textContent = totalSpeed.toFixed(2) + ' KB/s';
    document.getElementById('netRx').textContent = totalRx.toFixed(2);
    document.getElementById('netTx').textContent = totalTx.toFixed(2);

    // 更新时间
    document.getElementById('lastUpdate').textContent = 
        '更新于 ' + new Date(data.timestamp).toLocaleTimeString();
}

// 更新系统信息
function updateSystemInfo(data) {
    document.getElementById('hostname').textContent = data.system.hostname;
    document.getElementById('osInfo').textContent = `${data.system.distro} ${data.system.release}`;
    document.getElementById('kernel').textContent = data.system.kernel;
    document.getElementById('arch').textContent = data.system.arch;
    document.getElementById('uptime').textContent = data.system.uptime;
    document.getElementById('cpuCores').textContent = data.cpu.cores + ' 核';
}

// 更新磁盘列表
function updateDiskList(disks) {
    const diskList = document.getElementById('diskList');
    diskList.innerHTML = '';

    disks.forEach(disk => {
        const diskItem = document.createElement('div');
        diskItem.className = 'disk-item';
        diskItem.innerHTML = `
            <div class="disk-header">
                <span class="disk-name">${disk.filesystem}</span>
                <span class="disk-mount">${disk.mount}</span>
            </div>
            <div class="disk-usage">${disk.used} / ${disk.total} GB (${disk.usagePercent}%)</div>
            <div class="disk-progress">
                <div class="disk-progress-fill" style="width: ${disk.usagePercent}%"></div>
            </div>
        `;
        diskList.appendChild(diskItem);
    });
}

// 更新网络接口列表
function updateNetworkList(networks) {
    const networkList = document.getElementById('networkList');
    networkList.innerHTML = '';

    networks.forEach(net => {
        const networkItem = document.createElement('div');
        networkItem.className = 'network-item';
        networkItem.innerHTML = `
            <div class="network-item-header">
                <span class="network-interface">${net.interface}</span>
            </div>
            <div class="network-stats">
                <div class="network-stat">
                    <span class="network-stat-label">当前下载</span>
                    <span class="network-stat-value rx">${net.rx} KB/s</span>
                </div>
                <div class="network-stat">
                    <span class="network-stat-label">当前上传</span>
                    <span class="network-stat-value tx">${net.tx} KB/s</span>
                </div>
                <div class="network-stat">
                    <span class="network-stat-label">总下载量</span>
                    <span class="network-stat-value rx">${net.rxTotal} MB</span>
                </div>
                <div class="network-stat">
                    <span class="network-stat-label">总上传量</span>
                    <span class="network-stat-value tx">${net.txTotal} MB</span>
                </div>
            </div>
        `;
        networkList.appendChild(networkItem);
    });
}

// 设置连接状态
function setConnectionStatus(connected) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (connected) {
        statusDot.classList.add('connected');
        statusText.textContent = '已连接';
    } else {
        statusDot.classList.remove('connected');
        statusText.textContent = '连接断开';
    }
}

// 连接 WebSocket
function connectWebSocket() {
    const sessionId = getSessionId();
    if (!sessionId) {
        redirectToLogin();
        return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?sessionId=${encodeURIComponent(sessionId)}`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = function() {
        console.log('WebSocket 连接成功');
        setConnectionStatus(true);
    };

    ws.onmessage = function(event) {
        const message = JSON.parse(event.data);
        
        if (message.type === 'info') {
            const data = message.data;
            updateStats(data);
            updateSystemInfo(data);
            updateDiskList(data.disk);
            updateNetworkList(data.network);
            updateCharts(data);
        } else if (message.type === 'history') {
            loadHistoryData(message.data);
        }
    };

    ws.onclose = function(event) {
        console.log('WebSocket 连接断开，代码:', event.code);
        setConnectionStatus(false);
        
        // 如果是 401 或认证失败，跳转到登录页
        if (event.code === 1008 || event.code === 1011) {
            redirectToLogin();
            return;
        }
        
        // 否则尝试重连
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = function(error) {
        console.error('WebSocket 错误:', error);
        setConnectionStatus(false);
    };
}

// 更新导航链接，添加 sessionId
function updateNavLinks() {
    const sessionId = getSessionId();
    if (!sessionId) return;
    
    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.includes('sessionId')) {
            link.setAttribute('href', href + '?sessionId=' + encodeURIComponent(sessionId));
        }
    });
}

// 初始化用户信息
function initUserInfo() {
    const username = getUsername();
    if (username) {
        document.getElementById('username').textContent = username;
    }
    
    // 绑定登出按钮
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查认证
    if (!checkAuth()) {
        return;
    }
    
    // 初始化用户信息
    initUserInfo();
    
    // 更新导航链接
    updateNavLinks();
    
    // 初始化图表
    initCharts();
    
    // 连接 WebSocket
    connectWebSocket();
});
