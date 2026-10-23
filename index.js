/**
 * dsh-filekit — Host half.
 *
 * Two callers share one operation set (`./lib/filekit.js`):
 *   - the same-origin loopback route `/dsh-filekit/api`, used by the browser
 *     panel registered in the right sidebar's workspace-files tab;
 *   - the `filekit` model tool, so the Agent can perform and inspect the same
 *     operations instead of maintaining a second implementation.
 *
 * UI mutations inject a short change notice into the session's live Agent
 * without waking it, so the next step the model takes already knows what the
 * user changed.
 *
 * @module dsh-filekit
 */

import { buildChangeNotice, isWellFormedUserMessage } from './lib/notice.js';
import {
  FileKitError,
  copyEntry,
  createEntry,
  DEFAULT_MAX_TEXT_BYTES,
  DEFAULT_TRASH_DIR,
  emptyTrash,
  listDirectory,
  listTrash,
  moveEntry,
  purgeTrashEntry,
  readTextFile,
  renameEntry,
  resolveRoot,
  restoreTrashEntry,
  trashEntry,
  writeTextFile,
} from './lib/filekit.js';

/** Loopback route prefix. */
const ROUTE = '/dsh-filekit';

/** Plugin version mirrored in package.json. */
const VERSION = '0.2.5';

/** Request body cap: larger than the editor's text cap, small enough to stay sane. */
const BODY_LIMIT = 16 * 1024 * 1024;

/** Operations the UI may call. */
const OPERATIONS = new Set([
  'ping',
  'workspace',
  'list',
  'read',
  'write',
  'create',
  'rename',
  'move',
  'copy',
  'delete',
  'trashList',
  'restore',
  'purge',
  'emptyTrash',
]);

// ---------------------------------------------------------------------------
// Small HTTP helpers
// ---------------------------------------------------------------------------

/** @param {import('node:http').ServerResponse} res */
function sendJson(res, payload, status = 200) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/**
 * Read and parse a JSON body.
 * @param {import('node:http').IncomingMessage} req
 * @param {number} limit
 */
function readJsonBody(req, limit = BODY_LIMIT) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limit) {
        reject(new FileKitError('too-large', 'Request body is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        const value = text === '' ? {} : JSON.parse(text);
        if (typeof value !== 'object' || value === null) throw new Error('not an object');
        resolve(value);
      } catch {
        reject(new FileKitError('bad-input', 'Request body is not a JSON object.'));
      }
    });
    req.on('error', reject);
  });
}

/** Only the same machine may drive the route. */
function isLoopback(req) {
  const address = req.socket?.remoteAddress ?? '';
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address.startsWith('::ffff:127.') ||
    address === ''
  );
}

/** Reject cross-origin form posts; the page is served from the same origin. */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || origin === '') return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Workspace validation
// ---------------------------------------------------------------------------

/** Case-insensitive path equality (Windows) with lexical normalization. */
function samePath(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const norm = (value) => {
    let out = value.replace(/[\\/]+/gu, '/').replace(/\/+$/u, '');
    if (process.platform === 'win32') out = out.toLowerCase();
    return out;
  };
  return norm(a) === norm(b);
}

/** Whether `child` is lexically inside `parent`. */
function withinPath(parent, child) {
  if (typeof parent !== 'string' || typeof child !== 'string') return false;
  let p = parent.replace(/[\\/]+/gu, '/').replace(/\/+$/u, '');
  let c = child.replace(/[\\/]+/gu, '/').replace(/\/+$/u, '');
  if (process.platform === 'win32') {
    p = p.toLowerCase();
    c = c.toLowerCase();
  }
  return c === p || c.startsWith(p + '/');
}

/**
 * Resolve the workspace root the request is allowed to touch.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Record<string, unknown>} args
 * @returns {Promise<string>}
 */
async function resolveRequestRoot(ctx, args) {
  const requested = typeof args.root === 'string' ? args.root : '';
  if (requested === '') {
    throw new FileKitError('bad-root', 'root is required.');
  }
  const root = await resolveRoot(requested);
  if (await isKnownRoot(ctx, root, args)) return root;
  throw new FileKitError('unknown-workspace', 'This directory is not a registered workspace.');
}

/**
 * A root is allowed when it is a registered workspace or the exact working
 * directory of the requesting session.
 */
async function isKnownRoot(ctx, root, args) {
  const registry = ctx.get('workspaceRegistry');
  if (registry !== undefined && typeof registry.list === 'function') {
    const known = registry.list();
    if (Array.isArray(known) && known.some((workspace) => samePath(workspace?.path, root))) return true;
  }
  const sessionId = typeof args.sessionId === 'string' ? args.sessionId : '';
  if (sessionId !== '') {
    const agent = ctx.get('agents')?.get?.(sessionId);
    const cwd = agent?.session?.header?.cwd;
    if (samePath(cwd, root)) return true;
  }
  return false;
}

/**
 * Resolve a workspace for a caller that only knows a session or a file.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ sessionId?: string, file?: string }} args
 */
async function findWorkspace(ctx, args) {
  const registry = ctx.get('workspaceRegistry');
  const candidates = typeof registry?.list === 'function' ? registry.list() : [];
  const sessionId = typeof args.sessionId === 'string' ? args.sessionId : '';
  if (sessionId !== '') {
    const agent = ctx.get('agents')?.get?.(sessionId);
    const session = agent?.session;
    if (session !== undefined) {
      let cwd = session.header?.cwd;
      const workingDirectory = ctx.get('workingDirectory');
      try {
        if (workingDirectory !== undefined) cwd = workingDirectory.get(session) ?? cwd;
      } catch {
        /* fall back to the header cwd */
      }
      if (typeof cwd === 'string' && cwd !== '') {
        const resolved = await resolveRoot(cwd).catch(() => undefined);
        if (resolved !== undefined) return resolved;
      }
    }
  }
  const file = typeof args.file === 'string' ? args.file : '';
  if (file !== '' && Array.isArray(candidates)) {
    const matches = candidates
      .filter((workspace) => withinPath(workspace?.path, file))
      .sort((a, b) => String(b.path).length - String(a.path).length);
    if (matches.length > 0) return resolveRoot(matches[0].path);
  }
  throw new FileKitError('no-workspace', 'Could not resolve a workspace for this request.');
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Dispatch one operation.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {string} op
 * @param {Record<string, unknown>} args
 */
async function runOperation(ctx, op, args) {
  const maxTextBytes = DEFAULT_MAX_TEXT_BYTES;
  switch (op) {
    case 'ping':
      return { plugin: 'dsh-filekit', version: VERSION };
    case 'workspace':
      return { root: await findWorkspace(ctx, args) };
    case 'list': {
      const root = await resolveRequestRoot(ctx, args);
      return listDirectory(root, args.path, { trashDir: DEFAULT_TRASH_DIR });
    }
    case 'read': {
      const root = await resolveRequestRoot(ctx, args);
      return readTextFile(root, args.path, { maxTextBytes });
    }
    case 'write': {
      const root = await resolveRequestRoot(ctx, args);
      const result = await writeTextFile(root, args.path, args.content, {
        expectedMtimeMs: typeof args.expectedMtimeMs === 'number' ? args.expectedMtimeMs : undefined,
        maxTextBytes,
      });
      return { ...result, change: { kind: 'write', ...result } };
    }
    case 'create': {
      const root = await resolveRequestRoot(ctx, args);
      const result = await createEntry(root, args.path, args.kind === 'directory' ? 'directory' : 'file');
      return { ...result, change: { kind: 'create', path: result.path, entryKind: result.kind } };
    }
    case 'rename': {
      const root = await resolveRequestRoot(ctx, args);
      const result = await renameEntry(root, args.path, args.name);
      return { ...result, change: { kind: 'rename', ...result } };
    }
    case 'move': {
      const root = await resolveRequestRoot(ctx, args);
      const result = await moveEntry(root, args.path, args.toDir, { unique: args.unique === true });
      return { ...result, change: { kind: 'move', ...result } };
    }
    case 'copy': {
      const root = await resolveRequestRoot(ctx, args);
      const result = await copyEntry(root, args.path, args.toDir, { unique: args.unique === true });
      return { ...result, change: { kind: 'copy', ...result } };
    }
    case 'delete': {
      const root = await resolveRequestRoot(ctx, args);
      const result = await trashEntry(root, args.path, { trashDir: DEFAULT_TRASH_DIR });
      return { ...result, change: { kind: 'delete', path: result.entry.originalPath, entry: result.entry } };
    }
    case 'trashList': {
      const root = await resolveRequestRoot(ctx, args);
      return listTrash(root, { trashDir: DEFAULT_TRASH_DIR });
    }
    case 'restore': {
      const root = await resolveRequestRoot(ctx, args);
      const result = await restoreTrashEntry(root, args.id, { trashDir: DEFAULT_TRASH_DIR });
      return { ...result, change: { kind: 'restore', ...result } };
    }
    case 'purge': {
      const root = await resolveRequestRoot(ctx, args);
      const result = await purgeTrashEntry(root, args.id, { trashDir: DEFAULT_TRASH_DIR });
      return { ...result, change: { kind: 'purge', ...result } };
    }
    case 'emptyTrash': {
      const root = await resolveRequestRoot(ctx, args);
      const result = await emptyTrash(root, { trashDir: DEFAULT_TRASH_DIR });
      return { ...result, change: { kind: 'emptyTrash', ...result } };
    }
    default:
      throw new FileKitError('unknown-op', `Unknown operation "${op}".`);
  }
}

// ---------------------------------------------------------------------------
// Change context injection
// ---------------------------------------------------------------------------

/** Human-readable one-line description of one mutation. */
function describeChange(change) {
  switch (change.kind) {
    case 'write':
      return `${change.created ? '新建并写入' : '编辑'} ${change.path}（${change.lines} 行 / ${formatBytes(change.size)}）`;
    case 'create':
      return `${change.entryKind === 'directory' ? '新建目录' : '新建文件'} ${change.path}`;
    case 'rename':
      return `重命名 ${change.from} → ${change.path}`;
    case 'move':
      return `移动 ${change.from} → ${change.path}`;
    case 'copy':
      return `复制 ${change.from} → ${change.path}`;
    case 'delete':
      return `删除 ${change.path}（已移入 ${DEFAULT_TRASH_DIR}，可恢复）`;
    case 'restore':
      return `从回收站恢复 ${change.path}`;
    case 'purge':
      return `永久删除回收站条目 ${change.id}`;
    case 'emptyTrash':
      return `清空回收站（${change.count} 项）`;
    default:
      return JSON.stringify(change);
  }
}

/** Compact byte counter. */
function formatBytes(size) {
  if (typeof size !== 'number' || !Number.isFinite(size)) return '?';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Tell the requesting session's Agent what the user just changed. `inject`
 * never wakes an idle Agent: the notice waits for the next admitted step.
 * Kept to two short lines: the model only needs the fact, not a transcript.
 *
 * The inbox does not normalise its input: the object handed to `inject` is
 * committed to the session log and later serialised into the provider request,
 * so it must be a complete user message (`id` + `role` + `content` + `source`).
 * A notice without `role` poisons the whole session with a 422
 * `missing field role` on every later request.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {string} sessionId
 * @param {Record<string, unknown>} change
 * @param {string} root
 */
async function injectChange(ctx, sessionId, change, root) {
  if (typeof sessionId !== 'string' || sessionId === '') return;
  const agent = ctx.get('agents')?.get?.(sessionId);
  if (agent === undefined || typeof agent.inject !== 'function') return;
  const text = `[FileKit · 工作区变更] ${describeChange(change)}（工作区：${root}）。需要更多操作可调用 filekit 工具。`;
  const message = buildChangeNotice(text);
  if (!isWellFormedUserMessage(message)) {
    ctx.logger?.warn?.('dsh-filekit: change notice rejected: malformed user message');
    return;
  }
  try {
    agent.inject(message);
  } catch (error) {
    ctx.logger?.warn?.(`dsh-filekit: change notice failed: ${error?.message ?? error}`);
  }
}

// ---------------------------------------------------------------------------
// HTTP route
// ---------------------------------------------------------------------------

/**
 * Mount the loopback route.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
function mountRoutes(ctx) {
  const webServer = ctx.webServer ?? ctx.get('webServer');
  if (webServer === undefined) return;
  ctx.effect(
    () =>
      webServer.register({
        kind: 'prefix',
        path: ROUTE,
        async handler(req, res) {
          if (!isLoopback(req) || !sameOrigin(req)) {
            sendJson(res, { ok: false, code: 'forbidden', error: 'Forbidden.' }, 403);
            return;
          }
          try {
            if (req.method === 'GET') {
              const url = new URL(req.url ?? '/', 'http://localhost');
              if (!url.pathname.startsWith(ROUTE)) {
                sendJson(res, { ok: false, code: 'not-found', error: 'Not found.' }, 404);
                return;
              }
              const op = url.searchParams.get('op') ?? 'ping';
              if (op !== 'ping' && op !== 'workspace') {
                sendJson(res, { ok: false, code: 'method', error: 'Use POST for this operation.' }, 405);
                return;
              }
              const args = {
                sessionId: url.searchParams.get('sessionId') ?? undefined,
                file: url.searchParams.get('file') ?? undefined,
              };
              const result = await runOperation(ctx, op, args);
              sendJson(res, { ok: true, ...result });
              return;
            }
            if (req.method !== 'POST') {
              sendJson(res, { ok: false, code: 'method', error: 'Only GET and POST are supported.' }, 405);
              return;
            }
            const body = await readJsonBody(req);
            const op = String(body.op ?? '');
            if (!OPERATIONS.has(op)) {
              sendJson(res, { ok: false, code: 'unknown-op', error: `Unknown operation "${op}".` }, 404);
              return;
            }
            const result = await runOperation(ctx, op, body);
            const change = result?.change;
            if (change !== undefined && body.source === 'ui' && body.notify !== false && change.unchanged !== true) {
              const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
              const root = typeof result?.root === 'string' ? result.root : '';
              await injectChange(ctx, sessionId, change, root);
            }
            sendJson(res, { ok: true, ...result });
          } catch (error) {
            if (error instanceof FileKitError) {
              sendJson(res, { ok: false, code: error.code, error: error.message }, 400);
              return;
            }
            ctx.logger?.warn?.(`dsh-filekit: ${error?.stack ?? error}`);
            sendJson(res, { ok: false, code: 'internal', error: String(error?.message ?? error) }, 500);
          }
        },
      }),
    'dsh-filekit: loopback route',
  );
}

// ---------------------------------------------------------------------------
// Model tool
// ---------------------------------------------------------------------------

/** Tool parameter schema. */
const TOOL_PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: [
        'list',
        'read',
        'write',
        'create',
        'rename',
        'move',
        'copy',
        'delete',
        'trash',
        'restore',
        'purge',
        'emptyTrash',
      ],
      description: 'Operation to perform inside the current session workspace.',
    },
    path: {
      type: 'string',
      description: 'Workspace-relative path (use "/" separators). The workspace root itself is the empty string only for list.',
    },
    name: {
      type: 'string',
      description: 'New entry name for rename (no path separators).',
    },
    toDir: {
      type: 'string',
      description: 'Destination directory (workspace-relative) for move or copy.',
    },
    content: {
      type: 'string',
      description: 'UTF-8 text for write.',
    },
    kind: {
      type: 'string',
      enum: ['file', 'directory'],
      description: 'Entry kind for create; defaults to file.',
    },
    id: {
      type: 'string',
      description: 'Trash entry id for restore or purge.',
    },
    expectedMtimeMs: {
      type: 'number',
      description: 'Optional optimistic-concurrency guard for write: the mtimeMs returned by read.',
    },
  },
  required: ['action'],
  additionalProperties: false,
};

/** Resolve the session's effective workspace for the tool. */
async function toolRoot(ctx, exec) {
  const session = exec?.agent?.session;
  if (session === undefined) throw new FileKitError('no-session', 'No live session for this tool call.');
  let cwd = session.header?.cwd;
  const workingDirectory = ctx.get('workingDirectory');
  try {
    if (workingDirectory !== undefined) cwd = workingDirectory.get(session) ?? cwd;
  } catch {
    /* header cwd is the fallback */
  }
  if (typeof cwd !== 'string' || cwd === '') throw new FileKitError('no-workspace', 'The session has no workspace directory.');
  return resolveRoot(cwd);
}

/** Format a tool result as model-facing text. */
function formatToolResult(action, value) {
  switch (action) {
    case 'list': {
      const lines = [`Directory ${value.path === '' ? '.' : value.path} (${value.entries.length} entries):`];
      for (const entry of value.entries) {
        const suffix = entry.kind === 'directory' ? '/' : entry.size !== undefined ? ` (${formatBytes(entry.size)})` : '';
        lines.push(`- ${entry.kind === 'directory' ? '[dir]' : '[file]'} ${entry.path}${suffix}`);
      }
      if (value.entries.length === 0) lines.push('(empty)');
      return lines.join('\n');
    }
    case 'read': {
      if (value.binary === true) return `Binary file ${value.path} (${formatBytes(value.size)}); it has no text representation.`;
      const note = value.truncated === true ? `\n\n[truncated at ${formatBytes(DEFAULT_MAX_TEXT_BYTES)}; file is ${formatBytes(value.size)}]` : '';
      return `File ${value.path} (${value.lines ?? ''}${value.lines === undefined ? '' : ' lines'}; ${formatBytes(value.size)}):\n\n${value.text}${note}`;
    }
    case 'write':
      return `${value.created ? 'Created' : 'Wrote'} ${value.path} (${value.lines} lines, ${formatBytes(value.size)}).`;
    case 'create':
      return `Created ${value.kind} ${value.path}.`;
    case 'rename':
      return `Renamed ${value.from} -> ${value.path}.`;
    case 'move':
      return `Moved ${value.from} -> ${value.path}.`;
    case 'copy':
      return `Copied ${value.from} -> ${value.path}.`;
    case 'delete':
      return `Moved ${value.entry.name} to the workspace trash (entry ${value.entry.id}); restore with action "restore".`;
    case 'trash': {
      if (value.entries.length === 0) return 'The workspace trash is empty.';
      return [
        'Workspace trash (newest first):',
        ...value.entries.map((entry) => `- ${entry.id} | ${entry.name} | ${entry.originalPath} | ${entry.deletedAt}`),
      ].join('\n');
    }
    case 'restore':
      return `Restored ${value.path} from the workspace trash.`;
    case 'purge':
      return `Permanently deleted trash entry ${value.id}.`;
    case 'emptyTrash':
      return `Emptied the workspace trash (${value.count} entries).`;
    default:
      return JSON.stringify(value);
  }
}

/** Build the `filekit` tool definition. */
function filekitTool(ctx) {
  return {
    name: 'filekit',
    description:
      'Manage files in the current session workspace through one shared operation set: list, read, write, create, rename, move, copy, delete, trash, restore, purge, and emptyTrash. Paths are workspace-relative and cannot escape the workspace root. Deletes are recoverable: they move the entry into <workspace>/.dsh-trash, and "trash"/"restore"/"purge"/"emptyTrash" manage that recycle bin. Use this tool when the user asks to reorganize, edit, or recover workspace files; it performs the same operations as the right-sidebar file panel.',
    parameters: TOOL_PARAMETERS,
    output: {
      schema: { type: 'string' },
      render(_args, value) {
        return [{ type: 'text', text: String(value) }];
      },
    },
    async execute(args, exec) {
      const root = await toolRoot(ctx, exec);
      const action = String(args.action ?? '');
      switch (action) {
        case 'list':
          return formatToolResult(action, await listDirectory(root, args.path ?? '', { trashDir: DEFAULT_TRASH_DIR }));
        case 'read': {
          const value = await readTextFile(root, args.path, { maxTextBytes: DEFAULT_MAX_TEXT_BYTES });
          if (value.binary === true) return formatToolResult(action, value);
          return formatToolResult(action, { ...value, lines: value.text === '' ? 0 : value.text.split(/\r\n|\r|\n/u).length });
        }
        case 'write': {
          const value = await writeTextFile(root, args.path, args.content, {
            expectedMtimeMs: typeof args.expectedMtimeMs === 'number' ? args.expectedMtimeMs : undefined,
            maxTextBytes: DEFAULT_MAX_TEXT_BYTES,
          });
          return formatToolResult(action, value);
        }
        case 'create':
          return formatToolResult(action, await createEntry(root, args.path, args.kind === 'directory' ? 'directory' : 'file'));
        case 'rename':
          return formatToolResult(action, await renameEntry(root, args.path, args.name));
        case 'move':
          return formatToolResult(action, await moveEntry(root, args.path, args.toDir));
        case 'copy':
          return formatToolResult(action, await copyEntry(root, args.path, args.toDir));
        case 'delete':
          return formatToolResult(action, await trashEntry(root, args.path, { trashDir: DEFAULT_TRASH_DIR }));
        case 'trash':
          return formatToolResult(action, await listTrash(root, { trashDir: DEFAULT_TRASH_DIR }));
        case 'restore':
          return formatToolResult(action, await restoreTrashEntry(root, args.id, { trashDir: DEFAULT_TRASH_DIR }));
        case 'purge':
          return formatToolResult(action, await purgeTrashEntry(root, args.id, { trashDir: DEFAULT_TRASH_DIR }));
        case 'emptyTrash':
          return formatToolResult(action, await emptyTrash(root, { trashDir: DEFAULT_TRASH_DIR }));
        default:
          throw new FileKitError('bad-action', `Unknown filekit action "${action}".`);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Plugin body
// ---------------------------------------------------------------------------

/** Loader identity of the Host half. */
export const name = 'dsh-filekit';

/**
 * Mount the model tool and the browser route. Both halves degrade
 * independently: without `webServer` the tool still works, and without `tools`
 * the panel still works.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.inject(['tools'], (scoped) => {
    scoped.effect(() => scoped.tools.register(filekitTool(scoped)), 'dsh-filekit: filekit tool');
  });
  ctx.inject(['webServer'], (scoped) => mountRoutes(scoped));
}
