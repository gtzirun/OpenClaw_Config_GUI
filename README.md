# OpenClaw 配置管理器 🦞

一个现代化的 Web 界面，用于可视化管理 OpenClaw AI Agent 的配置文件。

![界面预览](preview.png)

## 功能特性

- 📦 **模型提供商管理**：添加、编辑、删除 AI 模型 API 接入点
- 🤖 **Agent 设置**：配置主模型、备用模型、并发数和沙盒模式
- 📱 **渠道配置**：管理 Telegram、Discord、WhatsApp 等消息渠道
- 🌐 **网关设置**：配置本地网关端口和认证 Token
- 📝 **原始 JSON 编辑**：直接编辑配置文件，支持格式化
- 💾 **本地缓存**：自动保存配置到浏览器，支持恢复历史版本
- 🔄 **实时同步**：UI 和 JSON 编辑器双向实时同步
- 💻 **常用命令**：一键生成常用的 OpenClaw 命令
- 🌙 **深色/浅色主题**：支持主题切换

## 快速开始

### 方法一：直接打开

双击 `index.html` 文件在浏览器中打开即可使用。

> 注意：部分功能（如自动加载示例配置）需要通过 HTTP 服务器访问。

### 方法二：本地服务器（推荐）

```bash
# 使用 Python
cd openclaw-config-manager
python -m http.server 8080

# 或使用 Node.js
npx serve .
```

然后访问 http://localhost:8080

## 使用说明

1. **导入配置**：点击页面右上角「导入配置」按钮，上传你的 `openclaw.json` 文件
2. **编辑配置**：在各个版块中修改配置
3. **导出配置**：点击「导出配置」下载修改后的文件
4. **应用配置**：复制「常用命令」中的「写入配置文件」命令到终端执行

## 文件结构

```
openclaw-config-manager/
├── index.html              # 主页面
├── style.css               # 样式文件
├── app.js                  # 应用逻辑
├── openclaw-example.json   # 示例配置（脱敏）
└── README.md               # 说明文档
```

## 配置文件说明

示例配置文件 `openclaw-example.json` 中的敏感信息已替换为占位符：

| 字段 | 占位符 |
|------|--------|
| API 域名 | `--your-domain--` |
| API Key | `xxxxxxxxxx...` |
| Bot Token | `0000000000:xxx...` |
| 用户 ID | `1234567890` |

## 技术栈

- 纯原生 HTML/CSS/JavaScript
- 无需任何构建工具
- 无外部依赖

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 开源协议

MIT License
