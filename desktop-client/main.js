const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// 检查是否为开发模式
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// 全局变量
let mainWindow = null;
let tray = null;
let isQuitting = false;

// 获取资源路径
function getAssetPath(assetPath) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, assetPath);
  }
  return path.join(__dirname, assetPath);
}

// 创建主窗口
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: '服务器监控系统',
    icon: getAssetPath('assets/icon.png'),
    backgroundColor: '#1a1a2e',
    frame: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  // 加载渲染进程页面
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 页面加载完成后显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 关闭时最小化到托盘
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (tray) {
        tray.displayBalloon({
          title: '服务器监控系统',
          content: '程序已最小化到系统托盘',
          icon: getAssetPath('assets/icon.png')
        });
      }
    }
  });

  // 窗口关闭后
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 打开开发者工具（开发模式）
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
}

// 创建系统托盘
function createTray() {
  const iconPath = getAssetPath('assets/icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  
  tray = new Tray(trayIcon);
  tray.setToolTip('服务器监控系统');

  // 托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: '刷新',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.reload();
        }
      }
    },
    {
      label: '设置',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('open-settings');
        }
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

  tray.setContextMenu(contextMenu);

  // 双击托盘图标显示/隐藏窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createMainWindow();
    }
  });

  // 单击托盘图标显示菜单
  tray.on('click', () => {
    tray.popUpContextMenu();
  });
}

// 创建应用菜单
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '刷新',
          accelerator: 'F5',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reload();
            }
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Ctrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '重新加载',
          accelerator: 'Ctrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reload();
            }
          }
        },
        {
          label: '强制重新加载',
          accelerator: 'Ctrl+Shift+R',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reloadIgnoringCache();
            }
          }
        },
        { type: 'separator' },
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: '放大',
          accelerator: 'Ctrl+=',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
            }
          }
        },
        {
          label: '缩小',
          accelerator: 'Ctrl+-',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
            }
          }
        },
        {
          label: '重置缩放',
          accelerator: 'Ctrl+0',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.setZoomLevel(0);
            }
          }
        },
        { type: 'separator' },
        {
          label: '全屏',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        }
      ]
    },
    {
      label: '窗口',
      submenu: [
        {
          label: '最小化',
          accelerator: 'Ctrl+M',
          click: () => {
            if (mainWindow) {
              mainWindow.minimize();
            }
          }
        },
        {
          label: '最大化',
          accelerator: 'Ctrl+Shift+M',
          click: () => {
            if (mainWindow) {
              if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
              } else {
                mainWindow.maximize();
              }
            }
          }
        },
        { type: 'separator' },
        {
          label: '关闭窗口',
          accelerator: 'Ctrl+W',
          click: () => {
            if (mainWindow) {
              mainWindow.close();
            }
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            const aboutWindow = new BrowserWindow({
              width: 400,
              height: 300,
              title: '关于',
              resizable: false,
              minimizable: false,
              maximizable: false,
              parent: mainWindow,
              modal: true,
              icon: getAssetPath('assets/icon.png'),
              backgroundColor: '#1a1a2e',
              webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
              }
            });

            aboutWindow.setMenuBarVisibility(false);
            aboutWindow.loadFile(path.join(__dirname, 'renderer', 'about.html'));
          }
        },
        { type: 'separator' },
        {
          label: 'GitHub 仓库',
          click: () => {
            shell.openExternal('https://github.com/5418814520666/server-monitor');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC 通信处理
function setupIpcHandlers() {
  // 获取应用版本
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // 获取应用信息
  ipcMain.handle('get-app-info', () => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      path: app.getAppPath(),
      userData: app.getPath('userData')
    };
  });

  // 最小化到托盘
  ipcMain.handle('minimize-to-tray', () => {
    if (mainWindow) {
      mainWindow.hide();
    }
  });

  // 显示主窗口
  ipcMain.handle('show-main-window', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // 退出应用
  ipcMain.handle('quit-app', () => {
    isQuitting = true;
    app.quit();
  });

  // 打开外部链接
  ipcMain.handle('open-external', (event, url) => {
    shell.openExternal(url);
  });

  // 更新托盘提示
  ipcMain.handle('update-tray-tooltip', (event, tooltip) => {
    if (tray) {
      tray.setToolTip(tooltip);
    }
  });
}

// 应用就绪
app.whenReady().then(() => {
  createMainWindow();
  createTray();
  createMenu();
  setupIpcHandlers();

  // macOS 特有：点击 Dock 图标时创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 所有窗口关闭时（Windows/Linux 退出应用）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 不退出，保持在托盘运行
    // app.quit();
  }
});

// 应用即将退出
app.on('before-quit', () => {
  isQuitting = true;
});

// 应用退出时
app.on('will-quit', () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  isQuitting = true;
  app.quit();
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时，聚焦到主窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
