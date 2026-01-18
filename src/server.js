const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { fileURLToPath } = require('url');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

const API_WORKER = async (request) => {
	const worker = await import('./api_proxy/worker.mjs');
	return await worker.default.fetch(request);
};

const createProxyRequest = (originalRequest, apiKey) => {
	const url = new URL(originalRequest.url, 'http://localhost');
	const headers = new Headers();

	originalRequest.headers.forEach((value, key) => {
		if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'content-length') {
			headers.set(key, value);
		}
	});

	if (apiKey) {
		headers.set('Authorization', `Bearer ${apiKey}`);
	}

	return new Request(url.toString(), {
		method: originalRequest.method,
		headers,
		body: originalRequest.body,
	});
};

app.all('/v1/chat/completions', async (req, res) => {
	try {
		const proxyRequest = createProxyRequest(req, req.headers['authorization']?.split(' ')[1]);
		const response = await API_WORKER(proxyRequest);

		res.status(response.status);
		response.headers.forEach((value, key) => {
			if (key.toLowerCase() !== 'transfer-encoding') {
				res.setHeader(key, value);
			}
		});

		const body = await response.text();
		res.send(body);
	} catch (error) {
		console.error('API proxy error:', error);
		res.status(500).json({ error: error.message });
	}
});

app.all('/v1/embeddings', async (req, res) => {
	try {
		const proxyRequest = createProxyRequest(req, req.headers['authorization']?.split(' ')[1]);
		const response = await API_WORKER(proxyRequest);

		res.status(response.status);
		response.headers.forEach((value, key) => {
			if (key.toLowerCase() !== 'transfer-encoding') {
				res.setHeader(key, value);
			}
		});

		const body = await response.text();
		res.send(body);
	} catch (error) {
		console.error('Embeddings error:', error);
		res.status(500).json({ error: error.message });
	}
});

app.get('/v1/models', async (req, res) => {
	try {
		const proxyRequest = createProxyRequest(req, req.headers['authorization']?.split(' ')[1]);
		const response = await API_WORKER(proxyRequest);

		res.status(response.status);
		response.headers.forEach((value, key) => {
			if (key.toLowerCase() !== 'transfer-encoding') {
				res.setHeader(key, value);
			}
		});

		const body = await response.text();
		res.send(body);
	} catch (error) {
		console.error('Models error:', error);
		res.status(500).json({ error: error.message });
	}
});

wss.on('connection', (clientWs, req) => {
	console.log('Client WebSocket connected');

	const url = new URL(req.url, `ws://${req.headers.host}`);
	const apiKey = url.searchParams.get('key');
	const targetUrl = `wss://generativelanguage.googleapis.com${url.pathname}${url.search}`;

	console.log('Target URL:', targetUrl);

	const pendingMessages = [];
	const targetWs = new WebSocket(targetUrl);

	targetWs.on('open', () => {
		console.log('Connected to Gemini');
		pendingMessages.forEach(msg => targetWs.send(msg));
		pendingMessages.length = 0;
	});

	clientWs.on('message', (event) => {
		console.log('Client message received');
		if (targetWs.readyState === WebSocket.OPEN) {
			targetWs.send(event);
		} else {
			pendingMessages.push(event);
		}
	});

	targetWs.on('message', (event) => {
		console.log('Gemini message received');
		if (clientWs.readyState === WebSocket.OPEN) {
			clientWs.send(event);
		}
	});

	clientWs.on('close', (event) => {
		console.log('Client connection closed');
		if (targetWs.readyState === WebSocket.OPEN) {
			targetWs.close(1000, event.reason);
		}
	});

	targetWs.on('close', (event) => {
		console.log('Gemini connection closed');
		if (clientWs.readyState === WebSocket.OPEN) {
			clientWs.close(event.code, event.reason);
		}
	});

	targetWs.on('error', (error) => {
		console.error('Gemini WebSocket error:', error);
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
