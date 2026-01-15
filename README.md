# 🎹 赛博虚拟键盘 Cyber Virtual Keyboard

一个赛博朋克风格的虚拟键盘，支持中英文拼音输入、400+词组智能匹配和机械键盘音效模拟。

![Cyber Keyboard](https://img.shields.io/badge/Style-Cyberpunk-00f3ff)
![Chinese Input](https://img.shields.io/badge/Input-中文拼音-ff0055)
![Phrases](https://img.shields.io/badge/词组库-400+-00ff88)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 🌐 在线演示

👉 [点击体验 Live Demo](https://huahai0202.github.io/virtual-keyboard/)

## ✨ 功能特性

- 🎨 **多主题切换** - 深色、亮色、樱花粉、森林绿、海洋蓝
- 🀄 **中文拼音输入** - 按 `Shift` 切换中/英文模式
- 📚 **400+ 常用词组** - 支持词组智能匹配（如 nihao → 你好）
- 🔊 **机械键盘音效** - Web Audio API 模拟机械轴声音
- 📱 **响应式布局** - 支持移动设备访问
- ⌨️ **物理键盘支持** - 可使用真实键盘输入
- 📋 **快捷操作** - Ctrl+A 全选、Ctrl+C 复制、Ctrl+V 粘贴

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
1. 输入拼音（如 `nihao`、`weixin`、`zhifubao`）
2. 候选框会显示匹配的汉字和词组
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
- **拼音字典** - 6700+ 单字 + 400+ 常用词组

## 📁 项目结构

```
├── index.html                       # 主页面
├── style.css                        # 样式文件
├── script.js                        # 逻辑脚本
├── pinyinMatch.js                   # 拼音匹配模块
├── no-tone-pinyin-hanzi-table.json  # 拼音单字字典
├── pinyin-phrases.json              # 拼音词组字典 (400+)
└── README.md                        # 说明文档
```

## 📦 词组库覆盖

| 类别 | 示例 |
|------|------|
| 日常问候 | 你好、谢谢、再见、欢迎 |
| 职场商务 | 会议、报告、项目、客户 |
| 科技互联网 | 电脑、手机、软件、网络 |
| 支付金融 | 微信、支付宝、银行卡、转账 |
| 生活出行 | 地铁、机场、酒店、餐厅 |
| 更多... | 共 400+ 常用词组 |

## 🎨 主题预览

当前支持深色、亮色、樱花粉、森林绿、海洋蓝等主题，预览图后续会补充。

## 📄 License

MIT License © 2026

---

⭐ 如果觉得这个项目有用，请给个 Star！
