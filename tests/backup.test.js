const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBackup, parseBackup } = require('../src/backup');

test('browser backup restores bookmarks and search choice', () => {
  const raw = createBackup({
    bookmarks: [{ title: 'Example', url: 'https://example.com/' }, { title: 'Example again', url: 'https://example.com/' }],
    searchEngine: 'brave',
  });
  assert.deepEqual(parseBackup(raw), {
    bookmarks: [{ title: 'Example', url: 'https://example.com/' }],
    searchEngine: 'brave',
  });
});

test('browser backup rejects unsafe and unrelated files', () => {
  assert.throws(() => parseBackup('{"format":"other","bookmarks":[],"searchEngine":"brave"}'));
  assert.throws(() => createBackup({ bookmarks: [{ title: 'Local file', url: 'file:///etc/passwd' }], searchEngine: 'brave' }));
  assert.throws(() => createBackup({ bookmarks: [], searchEngine: 'google' }));
});
