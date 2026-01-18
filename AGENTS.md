# Agent Guidelines for gemini-playground

This document provides guidelines for agentic coding assistants working on this Cloudflare Workers project that proxies OpenAI-compatible APIs to Google Gemini AI.

## Development Commands

### Build and Run
- `npm run dev` or `npm run start` - Start Wrangler development server
- `npm run deploy` - Deploy to Cloudflare Workers
- `deno task start` - Run Deno server (alternative runtime)

### Testing
- `npm run test` - Run all tests with Vitest
- `npx vitest run <pattern>` - Run tests matching a pattern
  - Example: `npx vitest run test/index.spec.js` - Run single test file
  - Example: `npx vitest run -t "responds with"` - Run tests matching name pattern
- `npx vitest --reporter=verbose` - Run with detailed output

## Code Style Guidelines

### Formatting (from .editorconfig)
- Indentation: **Tabs** (not spaces)
- Line endings: **LF** (Unix)
- Charset: **UTF-8**
- Trim trailing whitespace: **Yes**
- Insert final newline: **Yes**
- YAML files: Use spaces (2-space indentation)

### Imports
- Use ES modules (`import/export`) consistently
- Node modules: `import { Buffer } from "node:buffer";`
- Local modules: Use relative paths: `import worker from '../src';`
- Cloudflare test utilities: `import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';`
- Vitest: `import { describe, it, expect } from 'vitest';`

### Naming Conventions
- **Constants**: UPPER_SNAKE_CASE (`BASE_URL`, `API_VERSION`, `DEFAULT_MODEL`)
- **Functions**: camelCase (`handleCompletions`, `transformRequest`)
- **Classes**: PascalCase (`HttpError`)
- **Variables**: camelCase (`request`, `response`, `apiKey`)
- **Async functions**: Use `async/await` for all async operations

### Types and Type Safety
- TypeScript files (deno_index.ts): Use explicit type annotations for parameters and returns
  ```typescript
  function getContentType(path: string): string { ... }
  async function handleWebSocket(req: Request): Promise<Response> { ... }
  ```
- JavaScript files: No TypeScript, use JSDoc if documentation needed
- Use optional chaining (`?.`) and nullish coalescing (`??`) operators

### Error Handling
- Create custom error classes extending `Error` with a `status` property
  ```javascript
  class HttpError extends Error {
    constructor(message, status) {
      super(message);
      this.name = this.constructor.name;
      this.status = status;
    }
  }
  ```
- Use `try/catch` for async operations that may fail
- Log errors with context: `console.error('API request error:', error);`
- Return appropriate HTTP status codes in error responses
- Extract error messages: `const errorMessage = error instanceof Error ? error.message : 'Unknown error';`

### Response Handling
- Always specify `content-type` header with charset: `'text/plain;charset=UTF-8'`
- Use `new Response(body, { status, headers })` for creating responses
- For CORS: set `Access-Control-Allow-Origin: *` for API endpoints

### Code Structure
- Export default Worker object with `fetch(request, env, ctx)` method
- Separate concerns into named functions (`handleWebSocket`, `handleAPIRequest`)
- Use const for most declarations, let only when reassignment needed
- Prefer arrow functions for callbacks and short functions
- Use object property shorthand when key matches variable name

### Logging
- Use `console.log` for normal operations (debugging WebSocket connections)
- Use `console.error` for errors and warnings
- Use `console.assert` for invariant checks
- Include timestamps in log messages when helpful for debugging

### WebSocket Handling
- Check `request.headers.get('Upgrade') === 'websocket'` to detect WebSocket
- Use `new WebSocketPair()` to create client/proxy pair
- Call `proxy.accept()` to accept the connection
- Handle events: `open`, `message`, `close`, `error`
- Queue messages when connection not ready (`pendingMessages` array)

### API Proxy Patterns
- Extract API key from Authorization header: `auth?.split(" ")[1]`
- Use switch statements with pathname matching for route handling
- Transform request/response formats between OpenAI and Gemini APIs
- Use `fetch` for external API calls with proper headers

### File Organization
- `src/index.js` - Main Cloudflare Worker entry point
- `src/api_proxy/worker.mjs` - API proxy logic (OpenAI → Gemini transformation)
- `src/deno_index.ts` - Deno runtime alternative
- `src/static/` - Static assets (HTML, CSS, JS)
- `test/index.spec.js` - Vitest tests

### Notes
- This is a bilingual project (English/Chinese comments)
- The worker proxies OpenAI-compatible API calls to Google's Generative Language API
- Supports WebSocket streaming and regular HTTP endpoints
- Runs on Cloudflare Workers with Node.js compatibility flag
