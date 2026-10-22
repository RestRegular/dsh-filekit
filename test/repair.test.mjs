import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { zstdCompressSync } from 'node:zlib';

import { decompressAll, repairFile } from '../scripts/repair-session-log.mjs';

const HEADER = {
  type: 'session',
  version: 4,
  id: 'session-test-repair',
  createdAt: 1,
  cwd: 'D:\\workspace',
};

/** Serialise events into a two-frame Zstandard container, like the real writer. */
function writeLog(events) {
  const lines = events.map((event) => JSON.stringify(event));
  return Buffer.concat([
    zstdCompressSync(Buffer.from(`${lines[0]}\n`)),
    zstdCompressSync(Buffer.from(`${lines.slice(1).join('\n')}\n`)),
  ]);
}

/** A filekit notice shaped like the broken 0.2.0 injection. */
const BROKEN_NOTICE = {
  type: 'user/message',
  seq: 2,
  time: 2,
  data: {
    content: [{ type: 'text', text: '[FileKit · 工作区变更] 移动 a → b' }],
    source: { kind: 'dsh-filekit' },
  },
  surfaceOp: 'append',
};

test('repairFile adds role and id to a role-less filekit notice', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-filekit-repair-'));
  const file = path.join(dir, 'session.v4.jsonl.zstd');
  const healthy = {
    type: 'user/message',
    seq: 3,
    time: 3,
    data: { content: [{ type: 'text', text: '继续' }], source: { kind: 'user' }, role: 'user', id: 'u-1' },
    surfaceOp: 'append',
  };
  await fs.writeFile(file, writeLog([HEADER, BROKEN_NOTICE, healthy]));

  const result = repairFile(file);
  assert.equal(result.changed, true);
  assert.equal(result.repaired, 1);
  assert.equal(result.frames, 2);
  assert.ok(result.backup !== undefined);
  assert.equal((await fs.stat(result.backup)).isFile(), true);

  const { text } = decompressAll(await fs.readFile(file));
  const events = text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert.equal(events.length, 3);
  assert.equal(events[1].data.role, 'user');
  assert.equal(typeof events[1].data.id, 'string');
  assert.notEqual(events[1].data.id, '');
  assert.equal(events[1].seq, 2, 'seq is preserved');
  assert.deepEqual(events[2], healthy, 'healthy events stay untouched');

  // Idempotent: a second run finds nothing to do and writes no new files.
  const again = repairFile(file);
  assert.equal(again.changed, false);
  assert.equal(again.repaired, 0);
});

test('repairFile leaves a healthy log byte-identical and writes nothing', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-filekit-repair-'));
  const file = path.join(dir, 'session.v4.jsonl.zstd');
  const healthy = {
    type: 'user/message',
    seq: 2,
    time: 2,
    data: { content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' }, role: 'user', id: 'u-1' },
    surfaceOp: 'append',
  };
  const original = writeLog([HEADER, healthy]);
  await fs.writeFile(file, original);

  const result = repairFile(file);
  assert.equal(result.changed, false);
  assert.deepEqual(await fs.readFile(file), original);
  assert.deepEqual(await fs.readdir(dir), ['session.v4.jsonl.zstd']);
});

test('repairFile ignores role-less messages from other sources and warns', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-filekit-repair-'));
  const file = path.join(dir, 'session.v4.jsonl.zstd');
  const foreign = {
    type: 'user/message',
    seq: 2,
    time: 2,
    data: { content: [{ type: 'text', text: 'foreign' }], source: { kind: 'other-plugin' } },
    surfaceOp: 'append',
  };
  await fs.writeFile(file, writeLog([HEADER, foreign]));

  const result = repairFile(file);
  assert.equal(result.changed, false);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /other-plugin/u);
});

test('repairFile dry-run reports damage without writing', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-filekit-repair-'));
  const file = path.join(dir, 'session.v4.jsonl.zstd');
  const original = writeLog([HEADER, BROKEN_NOTICE]);
  await fs.writeFile(file, original);

  const result = repairFile(file, { dryRun: true });
  assert.equal(result.changed, true);
  assert.equal(result.dryRun, true);
  assert.deepEqual(await fs.readFile(file), original);
  assert.deepEqual(await fs.readdir(dir), ['session.v4.jsonl.zstd']);
});
