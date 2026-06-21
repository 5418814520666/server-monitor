# 🎨 图标资源说明

本目录用于存放桌面客户端的图标资源文件。

## 📋 所需图标

| 文件名 | 格式 | 推荐尺寸 | 用途 |
|--------|------|----------|------|
| `icon.ico` | ICO | 256x256 (包含多种尺寸) | 应用图标、安装包图标、快捷方式图标 |
| `icon.png` | PNG | 512x512 | 系统托盘图标、关于对话框、任务栏 |

## 📐 图标尺寸规范

### ICO 文件建议包含的尺寸

ICO 文件可以包含多个尺寸的图标，Windows 会根据显示场景自动选择合适的尺寸：

- 16x16 - 小图标（任务栏、文件列表）
- 24x24 - 中等图标
- 32x32 - 大图标（桌面、桌面快捷方式）
- 48x48 - 超大图标
- 64x64 - 高 DPI 显示
- 128x128 - 高 DPI 大图标
- 256x256 - Vista+ 大图标（推荐）

### PNG 文件

- 512x512 像素
- 背景透明
- PNG 格式（支持 alpha 通道）

## 🎨 设计建议

### 风格

- 与整体 UI 风格保持一致
- 简洁、易识别
- 深色和浅色背景下都清晰可见
- 适合小尺寸显示

### 颜色

- 主色调：建议使用蓝色系（#00d4ff, #7b2cbf）
- 与应用主题色保持一致
- 避免使用过多颜色

### 元素

- 可以包含服务器、监控、图表等相关元素
- 简洁的几何图形
- 避免过于复杂的细节（小尺寸下会模糊）

## 🛠️ 制作工具

### 在线工具

- [IconFinder](https://www.iconfinder.com/) - 图标搜索
- [Flaticon](https://www.flaticon.com/) - 免费图标
- [ConvertICO](https://convertico.com/) - PNG 转 ICO
- [ICO Convert](https://icoconvert.com/) - 在线 ICO 制作

### 桌面软件

- Adobe Photoshop - 专业图像处理
- GIMP - 免费开源图像编辑器
- Figma - 在线设计工具
- IconWorkshop - 专业图标制作软件

### 命令行工具

#### ImageMagick

```bash
# 安装 ImageMagick
# Ubuntu/Debian
sudo apt install imagemagick

# macOS
brew install imagemagick

# 生成多尺寸 ICO
convert icon-16.png icon-24.png icon-32.png icon-48.png icon-64.png icon-128.png icon-256.png icon.ico
```

#### electron-icon-maker

```bash
# 安装
npm install -g electron-icon-maker

# 使用
electron-icon-maker --input=./icon.png --output=./assets
```

## 📝 制作步骤

### 方法一：从 PNG 生成 ICO

1. 设计一个 512x512 像素的 PNG 图标
2. 使用在线工具或命令行工具转换为 ICO
3. 将生成的 `icon.ico` 和 `icon.png` 放入本目录

### 方法二：使用专业工具

1. 使用 Photoshop 或其他设计软件设计图标
2. 导出为多个尺寸的 PNG 文件
3. 合并为 ICO 文件
4. 保存到本目录

### 方法三：使用现有图标

1. 从图标网站下载合适的图标
2. 确保版权允许商业使用
3. 根据需要修改颜色和样式
4. 转换为所需格式

## ⚠️ 注意事项

1. **版权问题**：确保使用的图标有合法授权，避免侵权
2. **透明背景**：图标应该有透明背景，适应不同的主题
3. **边缘清晰**：小尺寸下也要保持清晰可识别
4. **测试显示**：在不同 DPI 和不同背景下测试显示效果
5. **格式正确**：确保 ICO 文件格式正确，包含必要的尺寸
6. **命名规范**：严格使用 `icon.ico` 和 `icon.png` 作为文件名

## 🔍 验证图标

### 检查 ICO 文件

在 Windows 上：
1. 右键点击文件 → 属性
2. 查看"详细信息"选项卡
3. 确认包含多个尺寸的图标

### 在 Electron 中测试

启动应用后检查：
- 窗口标题栏图标是否显示
- 任务栏图标是否显示
- 系统托盘图标是否显示
- 不同尺寸下是否清晰

## 🆘 没有图标怎么办？

如果暂时没有图标文件：

1. **应用仍可正常运行**：Electron 会使用默认图标
2. **功能不受影响**：所有功能都可以正常使用
3. **后续添加**：随时可以添加图标文件，重新打包即可

默认图标的缺点：
- 不够专业
- 无法体现品牌形象
- 用户难以识别

建议尽快添加自定义图标。

## 📚 相关资源

- [Electron 图标指南](https://www.electronjs.org/docs/latest/api/native-image)
- [Windows 图标设计规范](https://docs.microsoft.com/zh-cn/windows/win32/uxguide/vis-icons)
- [electron-builder 图标配置](https://www.electron.build/icons)
