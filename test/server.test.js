const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

let server;

test.before(async () => {
  server = spawn('node', ['server.js'], {
    env: { ...process.env, PORT: '3100' },
    stdio: 'ignore'
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
});

test.after(() => {
  if (server) server.kill();
});

test('liefert state inkl. pods', async () => {
  const response = await fetch('http://127.0.0.1:3100/api/state');
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.ok(Array.isArray(json.pods));
});

test('erstellt einen pod', async () => {
  const response = await fetch('http://127.0.0.1:3100/api/pods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Neu', workspace: 'privat' })
  });

  assert.equal(response.status, 201);
  const json = await response.json();
  assert.equal(json.name, 'Neu');
});
