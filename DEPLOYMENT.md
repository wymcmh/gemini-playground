# 从 Cloudflare Workers 迁移到自有服务器部署方案

## 项目概述

本项目是一个将 OpenAI 兼容 API 代理到 Google Gemini AI 的服务，支持：
- OpenAI 兼容的聊天补全、嵌入和模型列表 API
- WebSocket 多模态实时通信（音频、视频、屏幕共享）
- 静态 Web 界面用于实时交互

当前支持两种运行环境：
- **Cloudflare Workers**（原部署方式）
- **Deno**（已有实现）
- **Node.js**（本文档新增方案）

---

## 一、迁移方案对比

| 特性 | Cloudflare Workers | Deno | Node.js |
|------|-------------------|------|---------|
| **部署难度** | 简单（CLI 部署） | 简单（单文件运行） | 中等（需配置服务器） |
| **WebSocket 支持** | 原生 `WebSocketPair` | 原生 `WebSocket` | 需要 `ws` 库 |
| **静态资源** | KV 存储绑定 | 文件系统直接读取 | Express 静态中间件 |
| **性能** | 全球边缘节点 | 单节点性能好 | 可扩展性强 |
| **成本** | 免费额度限制 | VPS 成本 | VPS 成本 |
| **适用场景** | 全球低延迟需求 | 简单快速部署 | 生产环境长期运行 |

---

## 二、Node.js 部署方案

### 2.1 核心架构

```
Client (Browser)
    ↓
    │ HTTP/HTTPS
    ↓
Node.js Server (Express + ws)
    ├─→ 静态文件服务 (src/static)
    ├─→ API 代理转发 (→ api_proxy/worker.mjs → Google Gemini API)
    └─→ WebSocket 代理 (→ Google Gemini Live API)
```

### 2.2 技术栈

- **Web 服务器**: Express.js
- **WebSocket**: ws 库
- **API 转发**: 复用现有 `api_proxy/worker.mjs`
- **静态资源**: Express 内置 `express.static`

### 2.3 文件结构调整

```
gemini-playground/
├── src/
│   ├── server.js          # 新增：Node.js 服务器入口
│   ├── index.js           # 保留：Cloudflare Workers 入口
│   ├── deno_index.ts      # 保留：Deno 入口
│   ├── api_proxy/
│   │   └── worker.mjs     # 保留：API 代理逻辑（复用）
│   └── static/            # 静态资源（无需修改）
│       ├── index.html
│       ├── css/
│       └── js/
├── package.json           # 更新：添加 Node.js 依赖
├── wrangler.toml          # 保留：Cloudflare 配置
└── DEPLOYMENT.md          # 本文档
```

---

## 三、实施步骤

### 3.1 安装依赖

```bash
npm install express ws
npm install --save-dev nodemon  # 开发环境自动重启
```

### 3.2 更新 package.json

已添加以下脚本：
```json
{
  "scripts": {
    "server": "node src/server.js",
    "server:dev": "nodemon src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.16.0"
  }
}
```

### 3.3 启动服务器

**开发模式**（自动重启）：
```bash
npm run server:dev
```

**生产模式**：
```bash
npm run server
```

**自定义端口**：
```bash
PORT=8080 npm run server
```

### 3.4 访问服务

- **Web 界面**: `http://localhost:3000`
- **API 端点**:
  - `POST /v1/chat/completions` - 聊天补全
  - `POST /v1/embeddings` - 文本嵌入
  - `GET /v1/models` - 模型列表
- **WebSocket**: `ws://localhost:3000/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=YOUR_API_KEY`

---

## 四、核心代码说明

### 4.1 服务器入口 (`src/server.js`)

**关键特性**：

1. **静态文件服务**
```javascript
app.use(express.static(path.join(__dirname, 'static')));
```

2. **API 代理转发**
```javascript
// 复用现有的 worker.mjs 进行请求转换
const response = await API_WORKER(proxyRequest);
```

3. **WebSocket 代理**
```javascript
// 客户端 ↔ Node.js ↔ Google Gemini
clientWs.on('message', (event) => {
  targetWs.send(event);
});
```

### 4.2 WebSocket 连接处理

**Cloudflare Workers → Node.js 映射**：

| Cloudflare Workers | Node.js |
|-------------------|---------|
| `new WebSocketPair()` | `new WebSocket.Server()` |
| `env.__STATIC_CONTENT` | `express.static()` |
| `proxy.accept()` | `wss.on('connection')` |

---

## 五、客户端配置调整

### 5.1 API 基础 URL

**前端无需修改** - WebSocket 客户端已使用相对路径：
```javascript
// src/static/js/core/websocket-client.js:24
this.baseUrl = `${wsProtocol}//${window.location.host}/ws/...`;
```

### 5.2 环境变量（可选）

如需配置 API Key 等环境变量：
```bash
# .env 文件
PORT=3000
NODE_ENV=production
```

---

## 六、生产环境部署

### 6.1 反向代理配置（Nginx）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6.2 HTTPS 配置（Let's Encrypt）

```bash
sudo certbot --nginx -d your-domain.com
```

### 6.3 进程管理（PM2）

安装 PM2：
```bash
npm install -g pm2
```

启动服务：
```bash
pm2 start src/server.js --name gemini-server
pm2 save
pm2 startup
```

监控日志：
```bash
pm2 logs gemini-server
pm2 monit
```

### 6.4 Docker 部署（可选）

创建 `Dockerfile`：
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

构建和运行：
```bash
docker build -t gemini-server .
docker run -p 3000:3000 gemini-server
```

---

## 七、性能优化建议

### 7.1 静态资源缓存

```javascript
app.use(express.static(path.join(__dirname, 'static'), {
  maxAge: '1y',
  etag: true
}));
```

### 7.2 启用 gzip 压缩

```bash
npm install compression
```

```javascript
const compression = require('compression');
app.use(compression());
```

### 7.3 连接池优化

```javascript
const server = http.createServer(app);
server.timeout = 120000; // 2 分钟超时
server.keepAliveTimeout = 65000;
```

---

## 八、故障排查

### 8.1 WebSocket 连接失败

**症状**: 客户端无法建立 WebSocket 连接

**解决方案**:
1. 检查防火墙设置
2. 确认 Nginx 反向代理配置了 `Upgrade` 头
3. 查看服务器日志：`pm2 logs gemini-server`

### 8.2 API 代理超时

**症状**: API 请求超时或响应慢

**解决方案**:
1. 增加 Node.js `timeout` 配置
2. 检查网络连接到 Google API 的延迟
3. 考虑使用 CDN 或代理服务

### 8.3 静态资源 404

**症状**: CSS/JS 文件无法加载

**解决方案**:
1. 确认 `src/static` 目录路径正确
2. 检查 `express.static` 中间件配置
3. 查看文件权限

---

## 九、安全建议

### 9.1 CORS 配置

```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
```

### 9.2 API Key 安全

- **前端**: API Key 由用户输入，存储在 `localStorage`
- **后端**: 不存储 API Key，直接透传到 Google API
- **生产环境**: 建议添加速率限制和 IP 白名单

### 9.3 日志管理

```javascript
// 避免记录敏感信息
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

---

## 十、监控和日志

### 10.1 健康检查端点

```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
```

### 10.2 结构化日志

```bash
npm install pino
```

```javascript
const pino = require('pino');
const logger = pino({ level: 'info' });
logger.info('Server started');
```

---

## 十一、成本估算

### 11.1 Cloudflare Workers（原有）

- **免费额度**: 100,000 请求/天
- **超出**: $0.50/百万请求
- **Worker KV 存储**: $0.50/GB/月

### 11.2 自有服务器（VPS）

- **低配 VPS**: $5/月（1GB RAM, 1 CPU）
- **中配 VPS**: $20/月（4GB RAM, 2 CPU）
- **流量成本**: 根据服务商而定

---

## 十二、总结

### 推荐方案选择

| 场景 | 推荐方案 |
|------|----------|
| 个人开发/测试 | Node.js 本地运行 |
| 小规模生产 | Node.js + PM2 |
| 全球低延迟需求 | Cloudflare Workers |
| 简单快速部署 | Deno |

### 迁移检查清单

- [ ] 安装 Node.js 依赖
- [ ] 创建 `src/server.js`
- [ ] 更新 `package.json`
- [ ] 测试本地运行
- [ ] 配置生产环境（Nginx + PM2）
- [ ] 设置 HTTPS
- [ ] 配置日志和监控
- [ ] 性能测试
- [ ] 备份和回滚计划

---

## 附录

### A. 相关文件参考

- `src/index.js` - Cloudflare Workers 入口
- `src/deno_index.ts` - Deno 入口
- `src/server.js` - Node.js 入口（新增）
- `src/api_proxy/worker.mjs` - API 代理逻辑

### B. 支持和反馈

如有问题或建议，请提交 Issue 或 Pull Request。

### C. 许可证

MIT License - 详见项目根目录 LICENSE 文件。
