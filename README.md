# 🎹 赛博虚拟键盘 Cyber Keyboard

一个赛博朋克风格的虚拟键盘，支持中英文输入和机械键盘音效模拟。

![Cyber Keyboard](https://img.shields.io/badge/Style-Cyberpunk-00f3ff)
![Chinese Input](https://img.shields.io/badge/Input-中文拼音-ff0055)

## ✨ 功能特性

- 🌙 **深色/亮色主题切换** - 点击右上角按钮切换
- 🀄 **中文拼音输入** - 按 `Shift` 切换中/英文模式
- 🔊 **机械键盘音效** - Web Audio API 模拟机械轴声音
- 📱 **响应式布局** - 支持移动设备访问
- ⌨️ **物理键盘支持** - 可使用真实键盘输入

## 🚀 快速开始

### 本地运行

由于浏览器安全策略，需要通过 HTTP 服务器访问：

```bash
# 使用 npx 快速启动服务器
npx serve -l 3000

# 或使用 Python
python -m http.server 3000
```

然后访问 http://localhost:3000

## 📖 使用说明

### 中英文切换
- 按 `Shift` 键切换中文/英文模式
- 中文模式下，CN 指示灯会亮起（红色）

### 中文输入
1. 输入拼音（如 `nihao`）
2. 候选框会显示匹配的汉字
3. 按 `数字键 1-9` 选择候选字
4. 按 `空格` 选择第一个候选字
5. 按 `Enter` 直接输出拼音
6. 按 `-` 或 `[` 上翻页，`+` 或 `]` 下翻页

### 标点符号
- 中文模式下，按英文标点会自动转换为中文标点
- 如 `,` → `，`，`.` → `。`

## 🛠️ 技术栈

- **HTML5** - 页面结构
- **CSS3** - 赛博朋克风格样式、CSS 变量、响应式设计
- **JavaScript (ES6+)** - 模块化设计、Web Audio API
- **拼音字典** - 无声调拼音到汉字的映射表

## 📁 项目结构

```
├── index.html                    # 主页面
├── style.css                     # 样式文件
├── script.js                     # 逻辑脚本
├── no-tone-pinyin-hanzi-table.json  # 拼音字典
└── README.md                     # 说明文档
```

## 📄 License

MIT License
