/**
 * Vitest setup: lets tests run locally (terminal or the VS Code Vitest extension) without typing
 * `$env:DATABASE_URL=...` first. The API (index.ts / worker.ts / migrate.ts) loads .env via dotenv;
 * vitest does not, so core/config's shared pool found no DATABASE_URL.
 *
 * Only DATABASE_URL is copied, and only when it is not already set (CI sets it in .gitlab-ci.yml).
 * TEST_DATABASE_URL is deliberately NOT loaded: core-platform.test.ts drops the whole schema of that database,
 * so it must stay an explicit opt-in.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));

if (!process.env.DATABASE_URL && existsSync(envFile)) {
  const url = parse(readFileSync(envFile)).DATABASE_URL;
  if (url) process.env.DATABASE_URL = url;
}
