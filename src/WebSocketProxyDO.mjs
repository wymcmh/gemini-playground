// WebSocketProxyDO.mjs
export class WebSocketProxyDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clientSocket = null;
    this.targetSocket = null;
    this.pendingMessages = [];
  }

  async fetch(request) {
    // 处理 WebSocket 升级请求
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    // 创建一对 WebSocket
    const [client, server] = new WebSocketPair();
    this.clientSocket = server;
    this.clientSocket.accept();

    // 连接到 Gemini 目标服务器
    const url = new URL(request.url);
    const targetUrl = `wss://generativelanguage.googleapis.com${url.pathname}${url.search}`;
    await this.connectToTarget(targetUrl);

    // 立即返回响应，连接交由 Durable Object 维持
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async connectToTarget(targetUrl) {
    this.targetSocket = new WebSocket(targetUrl);
    
    this.targetSocket.addEventListener('open', () => {
      // 发送积压的消息
      for (const msg of this.pendingMessages) {
        this.targetSocket.send(msg);
      }
      this.pendingMessages = [];
    });

    this.targetSocket.addEventListener('message', (event) => {
      if (this.clientSocket && this.clientSocket.readyState === WebSocket.OPEN) {
        this.clientSocket.send(event.data);
      }
    });

    this.clientSocket.addEventListener('message', (event) => {
      if (this.targetSocket && this.targetSocket.readyState === WebSocket.OPEN) {
        this.targetSocket.send(event.data);
      } else {
        this.pendingMessages.push(event.data);
      }
    });

    // 处理关闭和错误事件...
  }
}
