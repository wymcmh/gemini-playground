# Gemini Project Analysis (`GEMINI.md`)

## 1. Project Overview

This project, "Gemini Playground," is a web application designed to provide a user-friendly interface for interacting with Google's Gemini large language model. It supports multimodal inputs, including text chat, microphone audio, camera video, and screen sharing.

A key feature of this project is its API proxy capability. It translates the Gemini API into the more common OpenAI API format. This allows it to be used with a wide range of existing tools and clients that are built for the OpenAI API, such as ChatBox and the Cursor IDE.

The application is built for serverless deployment and provides two primary deployment options: Deno Deploy and Cloudflare Workers.

## 2. Tech Stack

- **Frontend:**
  - HTML
  - CSS
  - Vanilla JavaScript

- **Backend / Runtimes:**
  - **Deno:** Used for one of the serverless deployment options.
  - **Cloudflare Workers:** Used for the other serverless deployment option, powered by Node.js compatibility flags.

- **Development & Tooling:**
  - **Node.js:** Used for managing development dependencies and running scripts via `package.json`.
  - **Wrangler CLI:** The command-line tool for developing and managing Cloudflare Workers.
  - **Vitest:** A testing framework used for running project tests.

- **Deployment:**
  - Deno Deploy
  - Cloudflare Workers
  - GitHub Actions for CI/CD (as seen in `.github/workflows/cf-deploy.yml`)

## 3. Project Structure

```
/
├── src/
│   ├── deno_index.ts       # Entry point for Deno deployment.
│   ├── index.js            # Entry point for Cloudflare Workers deployment.
│   ├── api_proxy/
│   │   └── worker.mjs      # Contains API proxy logic.
│   └── static/             # All frontend assets (HTML, CSS, JS).
│       ├── index.html      # The main application page.
│       └── js/             # Contains all client-side JavaScript modules.
├── test/
│   └── index.spec.js       # Tests for the application (using Vitest).
├── deno.json               # Configuration and tasks for Deno.
├── package.json            # Defines Node.js dependencies and scripts.
├── wrangler.toml           # Configuration for Cloudflare Workers.
└── vitest.config.js        # Configuration for the Vitest testing framework.
```

## 4. Available Commands

The project's scripts are defined in both `package.json` and `deno.json`.

### Cloudflare Worker (via npm)

These commands are for developing and deploying the Cloudflare Worker version of the application.

- **Install dependencies:**
  ```bash
  npm install
  ```

- **Run in development mode:**
  ```bash
  npm run dev
  ```

- **Run tests:**
  ```bash
  npm test
  ```

- **Deploy to Cloudflare:**
  ```bash
  npm run deploy
  ```

### Deno

This command is for running the Deno version of the application locally.

- **Run the Deno server:**
  ```bash
  deno task start
  ```
  *(This is an alias for `deno run --allow-net --allow-read src/deno_index.ts`)*
