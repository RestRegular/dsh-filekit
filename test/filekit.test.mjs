import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  FileKitError,
  copyEntry,
  createEntry,
  emptyTrash,
  listDirectory,
  listTrash,
  moveEntry,
  normalizeName,
  normalizeRel,
  purgeTrashEntry,
  readTextFile,
  renameEntry,
  resolveRoot,
  restoreTrashEntry,
  trashEntry,
  writeTextFile,
} from '../lib/filekit.js';

/** Create a fresh workspace root. */
async function workspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'dsh-filekit-test-'));
}

test('normalizeRel rejects escapes and absolute paths', () => {
  assert.equal(normalizeRel('src/app.ts'), 'src/app.ts');
  assert.equal(normalizeRel('src\\app.ts'), 'src/app.ts');
  assert.equal(normalizeRel('', { allowRoot: true }), '');
  assert.throws(() => normalizeRel('../secret'), FileKitError);
  assert.throws(() => normalizeRel('/etc/passwd'), FileKitError);
  assert.throws(() => normalizeRel('C:\\Windows'), FileKitError);
  assert.throws(() => normalizeRel('a//b'), FileKitError);
  assert.throws(() => normalizeRel(''), FileKitError);
});

test('normalizeName rejects separators and Windows-reserved names', () => {
  assert.equal(normalizeName('app.ts'), 'app.ts');
  assert.throws(() => normalizeName('a/b'), FileKitError);
  assert.throws(() => normalizeName('..'), FileKitError);
  assert.throws(() => normalizeName('CON'), FileKitError);
  assert.throws(() => normalizeName('trailing.'), FileKitError);
});

test('list, write, read, and optimistic concurrency', async () => {
  const root = await workspace();
  try {
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'src', 'app.ts'), 'const a = 1;\n');
    await fs.mkdir(path.join(root, '.dsh-trash'));
    const listing = await listDirectory(root, '');
    assert.deepEqual(listing.entries.map((entry) => entry.name), ['src']);
    assert.equal(listing.entries[0].kind, 'directory');

    const nested = await listDirectory(root, 'src');
    assert.deepEqual(nested.entries.map((entry) => entry.name), ['app.ts']);

    const read = await readTextFile(root, 'src/app.ts');
    assert.equal(read.text, 'const a = 1;\n');
    assert.equal(read.binary, false);
    assert.equal(read.truncated, false);

    const written = await writeTextFile(root, 'src/app.ts', 'const a = 2;\n', {
      expectedMtimeMs: read.mtimeMs,
    });
    assert.equal(written.created, false);
    assert.equal((await readTextFile(root, 'src/app.ts')).text, 'const a = 2;\n');

    await fs.writeFile(path.join(root, 'src', 'app.ts'), 'outside\n');
    await assert.rejects(
      writeTextFile(root, 'src/app.ts', 'lost update\n', { expectedMtimeMs: read.mtimeMs }),
      (error) => error instanceof FileKitError && error.code === 'conflict',
    );
    assert.equal((await readTextFile(root, 'src/app.ts')).text, 'outside\n');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('binary detection and truncation', async () => {
  const root = await workspace();
  try {
    await fs.writeFile(path.join(root, 'image.bin'), Buffer.from([0, 1, 2, 3]));
    const binary = await readTextFile(root, 'image.bin');
    assert.equal(binary.binary, true);
    assert.equal(binary.text, '');

    await fs.writeFile(path.join(root, 'big.txt'), 'x'.repeat(20));
    const truncated = await readTextFile(root, 'big.txt', { maxTextBytes: 10 });
    assert.equal(truncated.truncated, true);
    assert.equal(truncated.text.length, 10);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('create, rename, move, and copy stay inside the workspace', async () => {
  const root = await workspace();
  try {
    await createEntry(root, 'docs', 'directory');
    await createEntry(root, 'docs/a.md', 'file');
    await assert.rejects(createEntry(root, 'docs/a.md', 'file'), (error) => error.code === 'exists');

    const renamed = await renameEntry(root, 'docs/a.md', 'b.md');
    assert.equal(renamed.path, 'docs/b.md');

    await createEntry(root, 'archive', 'directory');
    const moved = await moveEntry(root, 'docs/b.md', 'archive');
    assert.equal(moved.path, 'archive/b.md');
    assert.equal((await listDirectory(root, 'docs')).entries.length, 0);

    const copied = await copyEntry(root, 'archive/b.md', 'docs');
    assert.equal(copied.path, 'docs/b.md');
    assert.equal((await listDirectory(root, 'archive')).entries.length, 1);

    await assert.rejects(moveEntry(root, 'archive', 'archive'), (error) => error.code === 'bad-move');
    await assert.rejects(copyEntry(root, 'archive', 'archive'), (error) => error.code === 'bad-copy');

    // Pasting into a directory that already holds the name picks a free one.
    const pasted = await copyEntry(root, 'docs/b.md', 'docs', { unique: true });
    assert.equal(pasted.path, 'docs/b (2).md');
    const pastedAgain = await copyEntry(root, 'docs/b.md', 'docs', { unique: true });
    assert.equal(pastedAgain.path, 'docs/b (3).md');
    await assert.rejects(copyEntry(root, 'docs/b.md', 'docs'), (error) => error.code === 'exists');

    // Cut + paste (move) uses the same free-name rule.
    const cut = await moveEntry(root, 'docs/b.md', 'archive', { unique: true });
    assert.equal(cut.path, 'archive/b (2).md');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('trash, restore, purge, and empty', async () => {
  const root = await workspace();
  try {
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'src', 'old.ts'), 'old\n');
    const deleted = await trashEntry(root, 'src/old.ts');
    assert.equal(deleted.entry.originalPath, 'src/old.ts');
    await assert.rejects(fs.stat(path.join(root, 'src', 'old.ts')));

    const list = await listTrash(root);
    assert.equal(list.entries.length, 1);
    assert.equal(list.entries[0].id, deleted.entry.id);

    const restored = await restoreTrashEntry(root, deleted.entry.id);
    assert.equal(restored.path, 'src/old.ts');
    assert.equal((await fs.readFile(path.join(root, 'src', 'old.ts'), 'utf8')), 'old\n');
    assert.equal((await listTrash(root)).entries.length, 0);

    await trashEntry(root, 'src/old.ts');
    const [entry] = (await listTrash(root)).entries;
    await purgeTrashEntry(root, entry.id);
    assert.equal((await listTrash(root)).entries.length, 0);

    await fs.writeFile(path.join(root, 'src', 'old.ts'), 'again\n');
    await trashEntry(root, 'src/old.ts');
    await fs.writeFile(path.join(root, 'src', 'old.ts'), 'occupied\n');
    await assert.rejects(restoreTrashEntry(root, (await listTrash(root)).entries[0].id), (error) => error.code === 'exists');

    const emptied = await emptyTrash(root);
    assert.equal(emptied.count, 1);
    assert.equal((await listTrash(root)).entries.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('workspace root cannot be deleted or escaped through a symlink', async () => {
  const root = await workspace();
  const outside = await workspace();
  try {
    await assert.rejects(trashEntry(root, ''), (error) => error.code === 'bad-path' || error.code === 'protected');
    await fs.writeFile(path.join(outside, 'secret.txt'), 'secret\n');
    try {
      await fs.symlink(outside, path.join(root, 'link'), 'junction');
    } catch {
      return; // symlink creation needs privileges on some Windows setups
    }
    await assert.rejects(readTextFile(root, 'link/secret.txt'), (error) => error.code === 'outside-workspace');
    await assert.rejects(listDirectory(root, 'link'), (error) => error.code === 'outside-workspace');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});

test('resolveRoot rejects relative and missing roots', async () => {
  await assert.rejects(resolveRoot('relative/dir'), (error) => error.code === 'bad-root');
  await assert.rejects(resolveRoot(path.join(os.tmpdir(), 'dsh-filekit-missing-root')), (error) => error.code === 'no-root');
});
