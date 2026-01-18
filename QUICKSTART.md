# 快速启动指南 (Node.js)

## 前置要求

- Node.js >= 18.0.0
- npm 或 yarn

## 安装依赖

```bash
npm install
```

如果遇到权限问题：
```bash
sudo chown -R $(whoami) ~/.npm
npm install
```

## 启动服务器

### 开发模式（自动重启）

```bash
npm run server:dev
```

### 生产模式

```bash
npm run server
```

### 自定义端口

```bash
PORT=8080 npm run server
```

## 访问服务

- **Web 界面**: http://localhost:3000
- **API 文档**: 参考 [README.MD](../README.MD)

## 常见问题

### 1. 端口被占用

修改端口：
```bash
PORT=3001 npm run server
```

### 2. 依赖安装失败

清理缓存重试：
```bash
npm cache clean --force
npm install
```

### 3. WebSocket 连接失败

- 检查防火墙设置
- 确保端口没有被占用

## 生产部署

参见 [DEPLOYMENT.md](DEPLOYMENT.md)
