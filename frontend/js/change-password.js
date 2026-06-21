/**
 * 修改密码页面逻辑
 */

const SESSION_KEY = 'server_monitor_session';

// DOM 元素
const changePasswordForm = document.getElementById('changePasswordForm');
const oldPasswordInput = document.getElementById('oldPassword');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoading = submitBtn.querySelector('.btn-loading');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const forceChangeWarning = document.getElementById('forceChangeWarning');
const backLink = document.getElementById('backLink');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否是强制改密模式
    const urlParams = new URLSearchParams(window.location.search);
    const isForce = urlParams.get('force') === 'true';
    const sessionId = getSessionId();
    
    if (!sessionId) {
        // 没有会话，跳转到登录页
        window.location.href = '/login.html';
        return;
    }
    
    // 更新返回链接，添加 sessionId
    if (backLink) {
        backLink.href = 'index.html?sessionId=' + encodeURIComponent(sessionId);
    }
    
    // 强制改密模式
    if (isForce) {
        forceChangeWarning.style.display = 'block';
        document.getElementById('pageSubtitle').textContent = '为了安全，请修改默认密码';
        // 强制模式下隐藏返回链接
        if (backLink) {
            backLink.style.display = 'none';
        }
    }
    
    // 验证会话是否有效
    checkAuth();
    
    // 聚焦到第一个输入框
    oldPasswordInput.focus();
});

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
    } catch (e) {}
    
    // 从 sessionStorage 获取
    try {
        const session = sessionStorage.getItem(SESSION_KEY);
        if (session) {
            return JSON.parse(session).sessionId;
        }
    } catch (e) {}
    
    return null;
}

// 检查认证状态
function checkAuth() {
    const sessionId = getSessionId();
    if (!sessionId) {
        window.location.href = '/login.html';
        return;
    }
    
    fetch('/api/auth/check', {
        headers: {
            'X-Session-Id': sessionId
        }
    })
    .then(res => {
        if (!res.ok) {
            // 认证失败，跳转到登录页
            window.location.href = '/login.html';
        }
    })
    .catch(() => {
        // 网络错误，暂时允许继续
    });
}

// 显示错误
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
    
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 3000);
}

// 显示成功
function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
}

// 设置加载状态
function setLoading(loading) {
    submitBtn.disabled = loading;
    if (loading) {
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
    } else {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

// 表单提交
changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const oldPassword = oldPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const sessionId = getSessionId();
    
    // 验证
    if (!oldPassword) {
        showError('请输入当前密码');
        return;
    }
    
    if (!newPassword) {
        showError('请输入新密码');
        return;
    }
    
    if (newPassword.length < 6) {
        showError('新密码至少需要 6 位');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showError('两次输入的新密码不一致');
        return;
    }
    
    if (oldPassword === newPassword) {
        showError('新密码不能与当前密码相同');
        return;
    }
    
    if (!sessionId) {
        showError('会话已过期，请重新登录');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 1500);
        return;
    }
    
    setLoading(true);
    
    try {
        const response = await fetch('/api/user/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({
                oldPassword,
                newPassword
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccess('密码修改成功！正在跳转到登录页...');
            
            // 清除本地会话
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_KEY);
            
            // 2秒后跳转到登录页
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
        } else {
            showError(data.error || '密码修改失败');
        }
    } catch (error) {
        console.error('修改密码错误:', error);
        showError('网络错误，请稍后重试');
    } finally {
        setLoading(false);
    }
});

// 输入时隐藏错误
oldPasswordInput.addEventListener('input', () => {
    errorMessage.style.display = 'none';
});
newPasswordInput.addEventListener('input', () => {
    errorMessage.style.display = 'none';
});
confirmPasswordInput.addEventListener('input', () => {
    errorMessage.style.display = 'none';
});
