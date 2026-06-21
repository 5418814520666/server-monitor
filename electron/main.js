const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();

let mainWindow = null;
let tray = null;
let settingsWindow = null;
let isQuitting = false;

// 配置文件路径
const configPath = path.join(app.getPath('userData'), 'config.json');

// 默认配置
const defaultConfig = {
  serverUrl: 'http://localhost:3000',
  autoUpdate: true,
  startMinimized: false,
  closeToTray: true
};

// 读取配置
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return { ...defaultConfig, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('加载配置失败:', e);
  }
  return { ...defaultConfig };
}

// 保存配置
function saveConfig(config) {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存配置失败:', e);
  }
}

let config = loadConfig();

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '服务器监控系统',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false,
    frame: true,
    titleBarStyle: 'default'
  });

  // 加载前端页面
  const isDev = !app.isPackaged;
  
  if (isDev) {
    // 开发模式：加载本地服务器
    mainWindow.loadURL(config.serverUrl);
  } else {
    // 生产模式：加载打包的前端文件
    const frontendPath = path.join(process.resourcesPath, 'frontend', 'index.html');
    mainWindow.loadFile(frontendPath);
  }

  // 页面加载完成后显示
  mainWindow.once('ready-to-show', () => {
    if (!config.startMinimized) {
      mainWindow.show();
    }
  });

  // 关闭事件：最小化到托盘
  mainWindow.on('close', (e) => {
    if (!isQuitting && config.closeToTray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 打开新窗口时用默认浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// 创建系统托盘
function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  
  try {
    tray = new Tray(iconPath);
  } catch (e) {
    console.error('创建托盘失败:', e);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '客户端设置',
      click: () => {
        openSettingsWindow();
      }
    },
    { type: 'separator' },
    {
      label: '检查更新',
      click: () => {
        checkForUpdates(true);
      }
    },
    {
      label: '关于',
      click: () => {
        showAboutDialog();
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('服务器监控系统');
  tray.setContextMenu(contextMenu);

  // 双击托盘显示窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// 显示关于对话框
function showAboutDialog() {
  if (!mainWindow) return;

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '关于',
    message: '服务器监控系统',
    detail: `版本: ${app.getVersion()}\n\n轻量级服务器监控系统桌面客户端\n支持实时监控CPU、内存、磁盘、网络等系统资源\n\n© 2024 Server Monitor Team`,
    buttons: ['确定']
  });
}

// 打开设置窗口
function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 650,
    minWidth: 400,
    minHeight: 500,
    title: '客户端设置',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#1a1a2e',
    resizable: true,
    modal: false,
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  settingsWindow.setMenuBarVisibility(false);
}

// 自动更新配置
function setupAutoUpdater() {
  if (!config.autoUpdate) return;

  // 更新日志
  autoUpdater.logger = {
    info: (msg) => console.log('[AutoUpdater]', msg),
    warn: (msg) => console.warn('[AutoUpdater]', msg),
    error: (msg) => console.error('[AutoUpdater]', msg),
    debug: (msg) => console.debug('[AutoUpdater]', msg)
  };

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // 检查更新事件
  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('正在检查更新...');
  });

  // 有可用更新
  autoUpdater.on('update-available', (info) => {
    sendStatusToWindow(`发现新版本 v${info.version}，正在下载...`);
    
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 v${info.version}`,
        detail: '正在后台下载更新，下载完成后会提示您安装。',
        buttons: ['确定']
      });
    }
  });

  // 没有可用更新
  autoUpdater.on('update-not-available', (info) => {
    sendStatusToWindow('当前已是最新版本');
  });

  // 更新下载完成
  autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow(`更新 v${info.version} 已下载完成`);
    
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: '更新已下载',
        message: `新版本 v${info.version} 已下载完成`,
        detail: '是否立即安装更新？\n安装后应用将自动重启。',
        buttons: ['立即安装', '稍后安装'],
        defaultId: 0
      }).then((result) => {
        if (result.response === 0) {
          isQuitting = true;
          autoUpdater.quitAndInstall();
        }
      });
    }
  });

  // 更新错误
  autoUpdater.on('error', (err) => {
    sendStatusToWindow('更新检查失败: ' + err.message);
    console.error('自动更新错误:', err);
  });

  // 下载进度
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    sendStatusToWindow(`正在下载更新... ${percent}%`);
    
    if (mainWindow) {
      mainWindow.setProgressBar(progressObj.percent / 100);
    }
  });
}

// 检查更新
function checkForUpdates(manual = false) {
  if (config.autoUpdate || manual) {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('检查更新失败:', err);
      if (manual && mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: '检查更新失败',
          message: '无法检查更新',
          detail: err.message || '请检查网络连接后重试。',
          buttons: ['确定']
        });
      }
    });
  }
}

// 发送状态到渲染进程
function sendStatusToWindow(text) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-status', text);
  }
  if (settingsWindow && settingsWindow.webContents) {
    settingsWindow.webContents.send('update-status', text);
  }
}

// IPC 通信
ipcMain.handle('get-config', () => {
  return config;
});

ipcMain.handle('save-config', (event, newConfig) => {
  config = { ...config, ...newConfig };
  saveConfig(config);
  return true;
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-updates', () => {
  checkForUpdates(true);
  return true;
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    if (config.closeToTray) {
      mainWindow.hide();
    } else {
      mainWindow.close();
    }
  }
});

// 单实例处理
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
    setupAutoUpdater();

    // 延迟检查更新
    setTimeout(() => {
      checkForUpdates(false);
    }, 3000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow) {
        mainWindow.show();
      }
    });
  });
}

// 所有窗口关闭时
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !config.closeToTray) {
    app.quit();
  }
});

// 退出前
app.on('before-quit', () => {
  isQuitting = true;
});

// 渲染进程崩溃
app.on('render-process-gone', (event, webContents, details) => {
  console.error('渲染进程崩溃:', details);
  if (mainWindow && mainWindow.webContents === webContents) {
    dialog.showErrorBox('页面崩溃', '页面发生错误，即将重新加载...');
    mainWindow.reload();
  }
});
