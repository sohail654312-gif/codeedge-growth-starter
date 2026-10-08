import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const backend = readFileSync('backend/index.ts', 'utf8');
const frontend = readFileSync('src/App.tsx', 'utf8');

test('private route definitions include requireAuth middleware', () => {
  const routeLines = backend.split('\n').filter(line => /['"](?:GET|POST|PUT|PATCH|DELETE) \/api\//.test(line));
  assert.ok(routeLines.length >= 6, 'Main API routes must be declared');
  for (const line of routeLines) {
    if (line.includes('/api/_healthcheck')) continue;
    assert.match(line, /requireAuth\(\)/);
  }
});

test('database calls are owned by authenticated AppDeploy user ID', () => {
  assert.match(backend, /ctx\.user!\.userId/);
  for (const type of ['profiles', 'enquiries', 'requests', 'assets']) {
    assert.ok(backend.includes("table('" + type + "', ctx.user!.userId)"), 'Missing user table boundary: ' + type);
  }
});

test('demo claims and unconnected analytics remain visibly distinguished', () => {
  assert.match(frontend, /DEMO WORKSPACE/);
  assert.match(frontend, /read-only/);
  assert.match(frontend, /illustrative/i);
  assert.match(frontend, /not connected/i);
});

test('expected phase-1 source and appdeploy tests are present', () => {
  for (const path of ['backend/index.ts','src/App.tsx','src/index.css','tests/tests.json','appdeploy.auth-login.json']) {
    assert.ok(existsSync(path), 'Missing ' + path);
  }
});
