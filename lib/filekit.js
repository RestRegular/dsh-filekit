/**
 * dsh-filekit — shared workspace file operations.
 *
 * Both callers use this module: the loopback HTTP route serving the browser UI
 * and the `filekit` model tool. Every path is confined to one workspace root,
 * deletes are recoverable moves into `<root>/.dsh-trash`, and every mutation
 * returns enough information for the caller to describe the change to the
 * Agent.
 *
 * @module dsh-filekit/lib/filekit
 */

import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/** Errors carry a stable code the client can localize. */
export class FileKitError extends Error {
  /**
   * @param {string} code - stable machine code (for example `outside-workspace`).
   * @param {string} message - human-readable English fallback.
   */
  constructor(code, message) {
    super(message);
    this.name = 'FileKitError';
    this.code = code;
  }
}

/** @param {string} code @param {string} message @returns {never} */
function fail(code, message) {
  throw new FileKitError(code, message);
}

/** Default trash directory name inside a workspace root. */
export const DEFAULT_TRASH_DIR = '.dsh-trash';

/** Default maximum text file size the editor will load. */
export const DEFAULT_MAX_TEXT_BYTES = 2 * 1024 * 1024;

const ENTRY_ID = /^[a-z0-9]+-[a-z0-9]+$/u;

/**
 * Normalize a workspace-relative path supplied over the wire.
 *
 * Accepts `/` or `\` separators, rejects absolute paths and `..` segments.
 * @param {unknown} value - raw input.
 * @param {{ allowRoot?: boolean }} [options] - whether the empty path is legal.
 * @returns {string} normalized relative path with `/` separators.
 */
export function normalizeRel(value, options = {}) {
  const allowRoot = options.allowRoot === true;
  let raw = typeof value === 'string' ? value : '';
  raw = raw.replace(/\\/gu, '/');
  if (raw.startsWith('/') || /^[a-zA-Z]:/u.test(raw)) fail('bad-path', 'Path must be workspace-relative.');
  const rel = raw.replace(/^\/+|\/+$/gu, '');
  if (rel === '') {
    if (allowRoot) return '';
    fail('bad-path', 'A path inside the workspace is required.');
  }
  const segments = rel.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    fail('bad-path', 'Path contains an invalid segment.');
  }
  if (rel.includes('\0')) fail('bad-path', 'Path contains a NUL character.');
  return rel;
}

/**
 * Validate a single new entry name (rename / create).
 * @param {unknown} value - proposed name.
 * @returns {string} the unchanged name.
 */
export function normalizeName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name === '' || name === '.' || name === '..') fail('bad-name', 'Name is empty or reserved.');
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
    fail('bad-name', 'Name cannot contain a path separator.');
  }
  // eslint-disable-next-line no-control-regex
  if (/[<>:"|?*\u0000-\u001f]/u.test(name)) fail('bad-name', 'Name contains characters the filesystem rejects.');
  if (name.length > 200) fail('bad-name', 'Name is too long.');
  if (/[. ]$/u.test(name)) fail('bad-name', 'Name cannot end with a dot or space.');
  const stem = name.split('.')[0]?.toUpperCase() ?? '';
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/u.test(stem)) fail('bad-name', 'Name is reserved on Windows.');
  return name;
}

/** Case-insensitive containment check on already-resolved paths. */
function within(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

/** Join a normalized relative path onto a root with native separators. */
function absOf(root, rel) {
  return rel === '' ? root : path.join(root, rel.split('/').join(path.sep));
}

/** Relative path with `/` separators. */
function relOf(root, abs) {
  const rel = path.relative(root, abs);
  return rel === '' ? '' : rel.split(path.sep).join('/');
}

/** @param {string} abs @returns {Promise<import('node:fs').Stats | undefined>} */
async function statOrNull(abs) {
  try {
    return await fs.stat(abs);
  } catch {
    return undefined;
  }
}

/** @param {string} abs @returns {Promise<import('node:fs').Stats | undefined>} */
async function lstatOrNull(abs) {
  try {
    return await fs.lstat(abs);
  } catch {
    return undefined;
  }
}

/**
 * Resolve and validate a workspace root.
 * @param {unknown} value - absolute directory path.
 * @returns {Promise<string>} canonical absolute root.
 */
export async function resolveRoot(value) {
  if (typeof value !== 'string' || value.trim() === '' || !path.isAbsolute(value)) {
    fail('bad-root', 'A workspace root absolute path is required.');
  }
  const root = path.resolve(value);
  const stat = await statOrNull(root);
  if (stat === undefined) fail('no-root', 'Workspace root does not exist.');
  if (!stat.isDirectory()) fail('bad-root', 'Workspace root is not a directory.');
  return root;
}

/**
 * Ensure an existing target really lives inside the root (symlinks included).
 * @param {string} root - canonical root.
 * @param {string} abs - target path.
 * @returns {Promise<void>} resolves when safe.
 */
async function assertExistingInside(root, abs) {
  let realRoot;
  let realTarget;
  try {
    realRoot = await fs.realpath(root);
    realTarget = await fs.realpath(abs);
  } catch {
    fail('not-found', 'Path does not exist.');
  }
  if (!within(realRoot, realTarget)) fail('outside-workspace', 'Path escapes the workspace.');
}

/**
 * Ensure a not-yet-existing target's parent really lives inside the root.
 * @param {string} root - canonical root.
 * @param {string} abs - target path (parent must exist).
 * @returns {Promise<void>} resolves when safe.
 */
async function assertParentInside(root, abs) {
  let realRoot;
  let realParent;
  try {
    realRoot = await fs.realpath(root);
    realParent = await fs.realpath(path.dirname(abs));
  } catch {
    fail('parent-missing', 'Parent directory does not exist.');
  }
  if (!within(realRoot, realParent)) fail('outside-workspace', 'Path escapes the workspace.');
}

/** Refuse to write through an existing symbolic link. */
async function assertNotSymlink(abs) {
  const stat = await lstatOrNull(abs);
  if (stat?.isSymbolicLink() === true) fail('symlink', 'Refusing to write through a symbolic link.');
}

/** Trash directory path for a root. */
export function trashPathOf(root, trashDir = DEFAULT_TRASH_DIR) {
  return path.join(root, trashDir);
}

/**
 * List one directory.
 * @param {string} root - workspace root.
 * @param {string} rel - directory path relative to root ('' for root).
 * @param {{ trashDir?: string }} [options] - conventions.
 */
export async function listDirectory(root, rel, options = {}) {
  const trashDir = options.trashDir ?? DEFAULT_TRASH_DIR;
  const safeRel = normalizeRel(rel, { allowRoot: true });
  const abs = absOf(root, safeRel);
  const stat = await statOrNull(abs);
  if (stat === undefined) fail('not-found', 'Directory does not exist.');
  if (!stat.isDirectory()) fail('not-directory', 'Not a directory.');
  await assertExistingInside(root, abs);
  const dirents = await fs.readdir(abs, { withFileTypes: true });
  /** @type {Array<Record<string, unknown>>} */
  const entries = [];
  for (const dirent of dirents) {
    if (safeRel === '' && dirent.name === trashDir) continue;
    const childAbs = path.join(abs, dirent.name);
    const childRel = relOf(root, childAbs);
    const symlink = dirent.isSymbolicLink();
    const childStat = symlink ? await lstatOrNull(childAbs) : await statOrNull(childAbs);
    const kind = dirent.isDirectory() ? 'directory' : dirent.isFile() ? 'file' : symlink ? 'symlink' : 'other';
    entries.push({
      name: dirent.name,
      path: childRel,
      kind,
      symlink,
      size: childStat !== undefined && childStat.isFile() ? childStat.size : undefined,
      mtimeMs: childStat !== undefined ? childStat.mtimeMs : undefined,
    });
  }
  entries.sort((a, b) => {
    const rank = (entry) => (entry.kind === 'directory' ? 0 : entry.kind === 'file' ? 1 : 2);
    const byKind = rank(a) - rank(b);
    if (byKind !== 0) return byKind;
    return String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase());
  });
  return { root, path: safeRel, entries };
}

/**
 * Read a text file for the editor.
 * @param {string} root - workspace root.
 * @param {string} rel - file path relative to root.
 * @param {{ maxTextBytes?: number }} [options] - size cap.
 */
export async function readTextFile(root, rel, options = {}) {
  const maxTextBytes = options.maxTextBytes ?? DEFAULT_MAX_TEXT_BYTES;
  const safeRel = normalizeRel(rel);
  const abs = absOf(root, safeRel);
  const stat = await statOrNull(abs);
  if (stat === undefined) fail('not-found', 'File does not exist.');
  if (!stat.isFile()) fail('not-file', 'Not a regular file.');
  await assertExistingInside(root, abs);
  const readBytes = Math.min(stat.size, maxTextBytes);
  const handle = await fs.open(abs, 'r');
  let bytes;
  try {
    bytes = Buffer.alloc(readBytes);
    const { bytesRead } = await handle.read(bytes, 0, readBytes, 0);
    bytes = bytes.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
  const probe = bytes.subarray(0, Math.min(bytes.length, 8192));
  const binary = probe.includes(0);
  return {
    root,
    path: safeRel,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    truncated: stat.size > maxTextBytes,
    binary,
    text: binary ? '' : bytes.toString('utf8'),
  };
}

/**
 * Write UTF-8 text atomically.
 * @param {string} root - workspace root.
 * @param {string} rel - file path relative to root.
 * @param {string} text - new contents.
 * @param {{ expectedMtimeMs?: number, maxTextBytes?: number }} [options] - conflict guard and cap.
 */
export async function writeTextFile(root, rel, text, options = {}) {
  if (typeof text !== 'string') fail('bad-input', 'Text content is required.');
  if (Buffer.byteLength(text, 'utf8') > (options.maxTextBytes ?? DEFAULT_MAX_TEXT_BYTES) * 4) {
    fail('too-large', 'File is too large for the editor.');
  }
  const safeRel = normalizeRel(rel);
  const abs = absOf(root, safeRel);
  const stat = await statOrNull(abs);
  if (stat !== undefined) {
    if (!stat.isFile()) fail('not-file', 'Not a regular file.');
    await assertExistingInside(root, abs);
    await assertNotSymlink(abs);
    if (
      typeof options.expectedMtimeMs === 'number' &&
      Number.isFinite(options.expectedMtimeMs) &&
      Math.abs(stat.mtimeMs - options.expectedMtimeMs) > 2
    ) {
      fail('conflict', 'File changed on disk since it was opened.');
    }
  } else {
    await assertParentInside(root, abs);
  }
  const dir = path.dirname(abs);
  const tmp = path.join(dir, `.dsh-filekit-${randomUUID()}.tmp`);
  await fs.writeFile(tmp, text, 'utf8');
  try {
    await fs.rename(tmp, abs);
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
  const next = await fs.stat(abs);
  return {
    root,
    path: safeRel,
    size: next.size,
    mtimeMs: next.mtimeMs,
    lines: text === '' ? 0 : text.split(/\r\n|\r|\n/u).length,
    created: stat === undefined,
  };
}

/**
 * Create one file or directory (non-recursive).
 * @param {string} root - workspace root.
 * @param {string} rel - new entry path.
 * @param {'file' | 'directory'} kind - entry kind.
 */
export async function createEntry(root, rel, kind) {
  if (kind !== 'file' && kind !== 'directory') fail('bad-input', 'kind must be file or directory.');
  const safeRel = normalizeRel(rel);
  const abs = absOf(root, safeRel);
  if ((await lstatOrNull(abs)) !== undefined) fail('exists', 'An entry with that name already exists.');
  await assertParentInside(root, abs);
  if (kind === 'directory') await fs.mkdir(abs);
  else await fs.writeFile(abs, '', { flag: 'wx' });
  return { root, path: safeRel, kind };
}

/**
 * Rename one entry in place.
 * @param {string} root - workspace root.
 * @param {string} rel - existing entry path.
 * @param {string} name - new entry name.
 */
export async function renameEntry(root, rel, name) {
  const safeRel = normalizeRel(rel);
  const newName = normalizeName(name);
  const abs = absOf(root, safeRel);
  if (safeRel === '') fail('protected', 'The workspace root cannot be renamed.');
  const stat = await lstatOrNull(abs);
  if (stat === undefined) fail('not-found', 'Entry does not exist.');
  await assertExistingInside(root, abs);
  const target = path.join(path.dirname(abs), newName);
  if (path.resolve(target) === path.resolve(abs)) return { root, path: safeRel, from: safeRel, unchanged: true };
  if ((await lstatOrNull(target)) !== undefined) fail('exists', 'An entry with that name already exists.');
  await assertParentInside(root, target);
  await fs.rename(abs, target);
  return { root, path: relOf(root, target), from: safeRel };
}

/**
 * Move one entry into another directory.
 * @param {string} root - workspace root.
 * @param {string} rel - existing entry path.
 * @param {string} toDirRel - destination directory.
 * @param {{ unique?: boolean }} [options] - `unique` picks a free "name (n)" when the name is taken.
 */
export async function moveEntry(root, rel, toDirRel, options = {}) {
  const safeRel = normalizeRel(rel);
  const toDir = normalizeRel(toDirRel, { allowRoot: true });
  if (safeRel === '') fail('protected', 'The workspace root cannot be moved.');
  const abs = absOf(root, safeRel);
  if ((await lstatOrNull(abs)) === undefined) fail('not-found', 'Entry does not exist.');
  await assertExistingInside(root, abs);
  const dirAbs = absOf(root, toDir);
  const dirStat = await statOrNull(dirAbs);
  if (dirStat === undefined) fail('not-found', 'Destination directory does not exist.');
  if (!dirStat.isDirectory()) fail('not-directory', 'Destination is not a directory.');
  await assertExistingInside(root, dirAbs);
  if (path.dirname(abs) === dirAbs) return { root, path: safeRel, from: safeRel, unchanged: true };
  if (within(abs, dirAbs)) fail('bad-move', 'Cannot move a directory into itself.');
  const name = path.basename(abs);
  const target =
    (await lstatOrNull(path.join(dirAbs, name))) === undefined || options.unique !== true
      ? path.join(dirAbs, name)
      : path.join(dirAbs, await uniqueTargetName(dirAbs, name));
  if ((await lstatOrNull(target)) !== undefined) fail('exists', 'Destination already has an entry with that name.');
  await fs.rename(abs, target);
  return { root, path: relOf(root, target), from: safeRel };
}

/**
 * Copy one entry into another directory.
 * @param {string} root - workspace root.
 * @param {string} rel - source entry path.
 * @param {string} toDirRel - destination directory.
 * @param {{ unique?: boolean }} [options] - `unique` picks a free "name (n)" when the name is taken.
 */
export async function copyEntry(root, rel, toDirRel, options = {}) {
  const safeRel = normalizeRel(rel);
  const toDir = normalizeRel(toDirRel, { allowRoot: true });
  const abs = absOf(root, safeRel);
  const source = await lstatOrNull(abs);
  if (source === undefined) fail('not-found', 'Entry does not exist.');
  await assertExistingInside(root, abs);
  if (source.isSymbolicLink()) fail('symlink', 'Copying symbolic links is not supported.');
  const dirAbs = absOf(root, toDir);
  const dirStat = await statOrNull(dirAbs);
  if (dirStat === undefined) fail('not-found', 'Destination directory does not exist.');
  if (!dirStat.isDirectory()) fail('not-directory', 'Destination is not a directory.');
  await assertExistingInside(root, dirAbs);
  if (within(abs, dirAbs)) fail('bad-copy', 'Cannot copy a directory into itself.');
  const name = path.basename(abs);
  const target =
    (await lstatOrNull(path.join(dirAbs, name))) === undefined || options.unique !== true
      ? path.join(dirAbs, name)
      : path.join(dirAbs, await uniqueTargetName(dirAbs, name));
  if ((await lstatOrNull(target)) !== undefined) fail('exists', 'Destination already has an entry with that name.');
  if (source.isDirectory()) {
    await fs.cp(abs, target, { recursive: true, force: false, errorOnExist: true, preserveTimestamps: true });
  } else {
    await fs.copyFile(abs, target, fs.constants.COPYFILE_EXCL);
  }
  return { root, path: relOf(root, target), from: safeRel };
}

/**
 * First free `stem (n).ext` (or `name (n)` for directories) in one directory.
 * @param {string} dirAbs - destination directory (absolute).
 * @param {string} name - original entry name.
 * @returns {Promise<string>} a name no entry currently uses.
 */
async function uniqueTargetName(dirAbs, name) {
  const ext = path.extname(name);
  const stem = ext === '' ? name : name.slice(0, -ext.length);
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${stem} (${index})${ext}`;
    if ((await lstatOrNull(path.join(dirAbs, candidate))) === undefined) return candidate;
  }
  fail('exists', 'Could not find a free name for the pasted entry.');
}

/**
 * Ensure the trash directory exists.
 * @param {string} root - workspace root.
 * @param {string} trashDir - trash directory name.
 */
async function ensureTrash(root, trashDir) {
  const dir = trashPathOf(root, trashDir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Read one trash entry's metadata.
 * @param {string} entryDir - entry directory.
 * @returns {Promise<Record<string, unknown> | undefined>}
 */
async function readTrashMeta(entryDir) {
  try {
    const raw = await fs.readFile(path.join(entryDir, 'meta.json'), 'utf8');
    const meta = JSON.parse(raw);
    return typeof meta === 'object' && meta !== null ? meta : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Move one entry into the workspace trash.
 * @param {string} root - workspace root.
 * @param {string} rel - entry path.
 * @param {{ trashDir?: string }} [options] - conventions.
 */
export async function trashEntry(root, rel, options = {}) {
  const trashDir = options.trashDir ?? DEFAULT_TRASH_DIR;
  const safeRel = normalizeRel(rel);
  if (safeRel === '') fail('protected', 'The workspace root cannot be deleted.');
  if (safeRel === trashDir || safeRel.startsWith(trashDir + '/')) {
    fail('protected', 'The trash directory is managed from the recycle bin view.');
  }
  const abs = absOf(root, safeRel);
  const stat = await lstatOrNull(abs);
  if (stat === undefined) fail('not-found', 'Entry does not exist.');
  await assertExistingInside(root, abs);
  const dir = await ensureTrash(root, trashDir);
  const id = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
  const entryDir = path.join(dir, id);
  await fs.mkdir(entryDir);
  const meta = {
    id,
    name: path.basename(abs),
    originalPath: safeRel,
    kind: stat.isDirectory() ? 'directory' : 'file',
    deletedAt: new Date().toISOString(),
    size: stat.isFile() ? stat.size : undefined,
    mtimeMs: stat.mtimeMs,
  };
  await fs.writeFile(path.join(entryDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  try {
    await fs.rename(abs, path.join(entryDir, 'item'));
  } catch (error) {
    await fs.rm(entryDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
  return { root, entry: meta };
}

/**
 * List trash entries, newest first.
 * @param {string} root - workspace root.
 * @param {{ trashDir?: string }} [options] - conventions.
 */
export async function listTrash(root, options = {}) {
  const trashDir = options.trashDir ?? DEFAULT_TRASH_DIR;
  const dir = trashPathOf(root, trashDir);
  const stat = await statOrNull(dir);
  if (stat === undefined || !stat.isDirectory()) return { root, entries: [] };
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  /** @type {Array<Record<string, unknown>>} */
  const entries = [];
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    const entryDir = path.join(dir, dirent.name);
    const meta = await readTrashMeta(entryDir);
    if (meta === undefined) continue;
    entries.push({ ...meta, id: dirent.name });
  }
  entries.sort((a, b) => String(b.deletedAt ?? '').localeCompare(String(a.deletedAt ?? '')));
  return { root, entries };
}

/**
 * Restore one trash entry to its original path.
 * @param {string} root - workspace root.
 * @param {string} id - trash entry id.
 * @param {{ trashDir?: string }} [options] - conventions.
 */
export async function restoreTrashEntry(root, id, options = {}) {
  const trashDir = options.trashDir ?? DEFAULT_TRASH_DIR;
  const safeId = String(id ?? '');
  if (!ENTRY_ID.test(safeId)) fail('bad-entry', 'Invalid trash entry id.');
  const entryDir = path.join(trashPathOf(root, trashDir), safeId);
  const meta = await readTrashMeta(entryDir);
  if (meta === undefined) fail('not-found', 'Trash entry does not exist.');
  const item = path.join(entryDir, 'item');
  if ((await lstatOrNull(item)) === undefined) fail('not-found', 'Trash entry payload is missing.');
  const original = typeof meta.originalPath === 'string' ? meta.originalPath : '';
  const safeRel = normalizeRel(original);
  if (safeRel === trashDir || safeRel.startsWith(trashDir + '/')) fail('protected', 'Cannot restore into the trash directory.');
  const target = absOf(root, safeRel);
  await assertParentInside(root, target);
  if ((await lstatOrNull(target)) !== undefined) fail('exists', 'The original path is occupied; move that entry first.');
  await fs.rename(item, target);
  await fs.rm(entryDir, { recursive: true, force: true });
  return { root, path: safeRel, id: safeId };
}

/**
 * Permanently remove one trash entry.
 * @param {string} root - workspace root.
 * @param {string} id - trash entry id.
 * @param {{ trashDir?: string }} [options] - conventions.
 */
export async function purgeTrashEntry(root, id, options = {}) {
  const trashDir = options.trashDir ?? DEFAULT_TRASH_DIR;
  const safeId = String(id ?? '');
  if (!ENTRY_ID.test(safeId)) fail('bad-entry', 'Invalid trash entry id.');
  const entryDir = path.join(trashPathOf(root, trashDir), safeId);
  if ((await lstatOrNull(entryDir)) === undefined) fail('not-found', 'Trash entry does not exist.');
  await fs.rm(entryDir, { recursive: true, force: true });
  return { root, id: safeId };
}

/**
 * Permanently remove every trash entry.
 * @param {string} root - workspace root.
 * @param {{ trashDir?: string }} [options] - conventions.
 */
export async function emptyTrash(root, options = {}) {
  const trashDir = options.trashDir ?? DEFAULT_TRASH_DIR;
  const dir = trashPathOf(root, trashDir);
  const stat = await statOrNull(dir);
  if (stat === undefined || !stat.isDirectory()) return { root, count: 0 };
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  let count = 0;
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    await fs.rm(path.join(dir, dirent.name), { recursive: true, force: true });
    count += 1;
  }
  return { root, count };
}
