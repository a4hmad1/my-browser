const { test } = require('node:test');
const assert = require('node:assert/strict');
const { allowedPage, resolveInput } = require('../src/browser-url');
test('address input supports public and private websites and search', () => {
  assert.equal(resolveInput('example.com'), 'https://example.com/');
  assert.equal(resolveInput('localhost:3000'), 'http://localhost:3000/');
  assert.equal(resolveInput('192.168.1.1'), 'http://192.168.1.1/');
  assert.equal(resolveInput('private.internal'), 'http://private.internal/');
  assert.equal(resolveInput('example.onion'), 'http://example.onion/');
  assert.equal(resolveInput('http://example.onion/'), 'http://example.onion/');
  assert.equal(resolveInput('http://intranet.local/login'), 'http://intranet.local/login');
  assert.equal(resolveInput('find all websites'), 'https://duckduckgo.com/?q=find%20all%20websites');
  assert.equal(resolveInput('find all websites', 'brave'), 'https://search.brave.com/search?q=find%20all%20websites');
  assert.equal(resolveInput('find all websites', 'google'), 'https://duckduckgo.com/?q=find%20all%20websites');
});
test('address input refuses privileged protocols and URL credentials', () => {
  for (const input of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hi', 'https://user:pass@example.com'])
    assert.throws(() => resolveInput(input));
  assert.equal(allowedPage('http://localhost:4000/'), true);
  assert.equal(allowedPage('file:///etc/passwd'), false);
});
