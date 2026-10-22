import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChangeNotice, isWellFormedUserMessage } from '../lib/notice.js';

test('buildChangeNotice produces a complete Harness user message', () => {
  const message = buildChangeNotice('[FileKit] moved a/b to c/d');
  assert.equal(message.role, 'user');
  assert.equal(typeof message.id, 'string');
  assert.match(message.id, /^[0-9a-f-]{36}$/u);
  assert.equal(message.source.kind, 'dsh-filekit');
  assert.deepEqual(message.content, [{ type: 'text', text: '[FileKit] moved a/b to c/d' }]);
  assert.equal(isWellFormedUserMessage(message), true);
});

test('buildChangeNotice gives every notice a distinct identity', () => {
  const first = buildChangeNotice('one');
  const second = buildChangeNotice('two');
  assert.notEqual(first.id, second.id);
});

test('isWellFormedUserMessage rejects the shapes that poisoned sessions', () => {
  const good = buildChangeNotice('ok');
  assert.equal(isWellFormedUserMessage({ content: good.content, source: good.source }), false, 'missing role and id');
  assert.equal(isWellFormedUserMessage({ ...good, role: undefined }), false, 'missing role');
  assert.equal(isWellFormedUserMessage({ ...good, id: undefined }), false, 'missing id');
  assert.equal(isWellFormedUserMessage({ ...good, role: 'assistant' }), false, 'wrong role');
  assert.equal(isWellFormedUserMessage({ ...good, content: [] }), false, 'empty content');
  assert.equal(isWellFormedUserMessage({ ...good, content: [{ type: 'text' }] }), false, 'text block without text');
  assert.equal(isWellFormedUserMessage({ ...good, source: undefined }), false, 'missing source');
  assert.equal(isWellFormedUserMessage({ ...good, source: { kind: 'other' } }), false, 'foreign source');
  assert.equal(isWellFormedUserMessage(null), false);
});
