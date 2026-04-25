---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, package.json"
alwaysApply: true
---

# proskills Agent Guide

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run`
- Use `bun test` for testing.
- Bun automatically loads .env files.
- Prefer `Bun.file` over `node:fs` for simple file operations.
