/**
 * 登录页面逻辑
 */

// 存储键名
const SESSION_KEY = 'server_monitor_session';

// DOM 元素
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const rememberMeCheckbox = document.getElementById('rememberMe');
const loginBtn = document.getElementById('loginBtn');
const btnText = loginBtn.querySelector('.btn-text');
const btnLoading = loginBtn.querySelector('.btn-loading');
const errorMessage = document.getElementById('errorMessage');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否已登录
    checkLoginStatus();
    
    // 加载保存的用户名
    loadSavedUsername();
});

// 检查登录状态
function checkLoginStatus() {
    const session = getSession();
    if (session && session.sessionId) {
        // 验证会话是否有效
        fetch('/api/auth/check', {
            headers: {
                'X-Session-Id': session.sessionId
            }
        })
        .then(res => {
            if (res.ok) {
                return res.json();
            }
            throw new Error('Unauthorized');
        })
        .then(data => {
            // 检查是否是默认密码
            if (data.isDefault) {
                window.location.href = '/change-password.html?sessionId=' + session.sessionId + '&force=true';
            } else {
                // 已登录，跳转到首页
                window.location.href = '/index.html?sessionId=' + session.sessionId;
            }
        })
        .catch(() => {
            // 会话无效，继续显示登录页
        });
    }
}

// 加载保存的用户名
function loadSavedUsername() {
    const savedUsername = localStorage.getItem('server_monitor_username');
    if (savedUsername) {
        usernameInput.value = savedUsername;
        rememberMeCheckbox.checked = true;
        passwordInput.focus();
    } else {
        usernameInput.focus();
    }
}

// 获取会话
function getSession() {
    try {
        const session = localStorage.getItem(SESSION_KEY);
        return session ? JSON.parse(session) : null;
    } catch (e) {
        return null;
    }
}

// 保存会话
function saveSession(session, remember) {
    if (remember) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
}

// 显示错误
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // 3秒后自动隐藏
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 3000);
}

// 隐藏错误
function hideError() {
    errorMessage.style.display = 'none';
}

// 设置加载状态
function setLoading(loading) {
    loginBtn.disabled = loading;
    if (loading) {
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
    } else {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

// 表单提交
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const rememberMe = rememberMeCheckbox.checked;
    
    if (!username || !password) {
        showError('请输入用户名和密码');
        return;
    }
    
    setLoading(true);
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // 保存会话
            saveSession({
                sessionId: data.sessionId,
                username: data.username
            }, rememberMe);
            
            // 保存用户名
            if (rememberMe) {
                localStorage.setItem('server_monitor_username', username);
            } else {
                localStorage.removeItem('server_monitor_username');
            }
            
            // 检查是否是默认密码，如果是则强制修改密码
            if (data.isDefault) {
                window.location.href = '/change-password.html?sessionId=' + data.sessionId + '&force=true';
            } else {
                // 跳转到首页
                window.location.href = '/index.html?sessionId=' + data.sessionId;
            }
        } else {
            showError(data.error || '登录失败，请检查用户名和密码');
        }
    } catch (error) {
        console.error('登录错误:', error);
        showError('网络错误，请稍后重试');
    } finally {
        setLoading(false);
    }
});

// 输入时隐藏错误
usernameInput.addEventListener('input', hideError);
passwordInput.addEventListener('input', hideError);
