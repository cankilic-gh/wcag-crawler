const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, body) {
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

function runAction(apiUrl) {
  const actionPath = path.join(__dirname, 'index.js');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [actionPath], {
      env: {
        ...process.env,
        GITHUB_ACTIONS: '',
        INPUT_API_URL: apiUrl,
        INPUT_URL: 'https://example.com',
        INPUT_MAX_PAGES: '1',
        INPUT_MAX_DEPTH: '1',
        INPUT_THRESHOLD: '0',
        INPUT_FAIL_ON_CRITICAL: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

test('uses the anonymous capability protocol without exposing the token', async t => {
  const capability = 'test-capability-secret';
  const requests = [];
  const server = http.createServer(async (request, response) => {
    requests.push({
      method: request.method,
      url: request.url,
      token: request.headers['x-scan-token'],
    });

    if (request.method === 'POST' && request.url === '/api/scans') {
      const body = await readJson(request);
      requests.at(-1).body = body;
      sendJson(response, { id: 'scan-test', status: 'pending', accessToken: capability });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/scans/scan-test') {
      sendJson(response, { id: 'scan-test', status: 'complete', total_pages: 1, scanned_pages: 1 });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/reports/scan-test') {
      sendJson(response, {
        summary: {
          score: 100,
          totalPages: 1,
          totalIssuesDeduplicated: 0,
          totalIssuesRaw: 0,
          bySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0 },
          ruleCountBySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0 },
          topRules: [],
        },
        sharedComponents: [],
        pageSpecificIssues: [],
      });
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const result = await runAction(`http://127.0.0.1:${address.port}`);

  assert.equal(result.code, 0, result.stderr || result.stdout);
  const create = requests.find(request => request.method === 'POST');
  assert.equal(create.body.capabilityProtocol, 1);

  const protectedRequests = requests.filter(request => request.method === 'GET');
  assert.equal(protectedRequests.length, 2);
  for (const request of protectedRequests) {
    assert.equal(request.token, capability);
  }

  assert.doesNotMatch(result.stdout, new RegExp(capability));
  assert.doesNotMatch(result.stderr, new RegExp(capability));
});
