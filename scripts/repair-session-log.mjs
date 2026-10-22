#!/usr/bin/env node
/**
 * Repair session logs damaged by dsh-filekit change notices that were injected
 * without `role`.
 *
 * dsh-filekit < 0.2.1 called `agent.inject({ content, source })`. The inbox does
 * not fill in defaults, so the record was committed as a `user/message` event
 * with no `role`. Every provider request rebuilt from that log then failed
 * forever with:
 *
 *   Failed to deserialize the JSON body into the target type:
 *   messages[N]: missing field `role` ... (422, INVALID_REQUEST)
 *
 * This tool adds the missing `role: "user"` (and a fresh `id`, because the
 * message identity was also missing) to those records. It rewrites the
 * `.jsonl.zstd` container as one Zstandard frame, which the JSONL persistence
 * backend reads like the original concatenated frames. The original file is
 * kept next to the repaired one as `.bak-<timestamp>`.
 *
 * The Harness holds a per-session write lock while a session is open. Close the
 * session (or quit DSH) before repairing; otherwise the running host keeps the
 * damaged events in memory and may append over the repaired file.
 *
 * Usage:
 *   node scripts/repair-session-log.mjs --dry-run
 *   node scripts/repair-session-log.mjs c04b0966 e2a65110
 *   node scripts/repair-session-log.mjs --root "/path/to/.dsh/sessions"
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib';

const FRAME_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const FILE_NAME = 'session.v4.jsonl.zstd';
const NOTICE_SOURCE = 'dsh-filekit';

/**
 * Split a concatenated Zstandard container into its frame buffers and decode
 * every frame. A frame that fails to decode aborts the repair: silently
 * dropping records would turn a recoverable session into a truncated one.
 * @param {Buffer} buffer
 * @returns {{ text: string, frames: number }}
 */
function decompressAll(buffer) {
  const starts = [];
  for (let at = buffer.indexOf(FRAME_MAGIC); at !== -1; at = buffer.indexOf(FRAME_MAGIC, at + 4)) {
    starts.push(at);
  }
  if (starts.length === 0) throw new Error('not a Zstandard session log (no frame magic found)');
  const chunks = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = starts[index + 1] ?? buffer.length;
    try {
      chunks.push(zstdDecompressSync(buffer.subarray(start, end)));
    } catch (error) {
      throw new Error(`corrupt Zstandard frame #${index} at byte ${start}: ${error?.message ?? error}`, { cause: error });
    }
  }
  return { text: Buffer.concat(chunks).toString('utf8'), frames: starts.length };
}

/**
 * Patch one parsed log line in place. Returns true when the event was repaired.
 * @param {any} event
 * @param {(message: string) => void} warn
 */
function repairEvent(event, warn) {
  if (event?.type !== 'user/message') return false;
  const data = event.data;
  if (data === null || typeof data !== 'object') return false;
  if (typeof data.role === 'string' && data.role !== '') return false;
  const sourceKind = data.source?.kind;
  if (sourceKind !== NOTICE_SOURCE) {
    warn(`seq ${event.seq}: skipped role-less user/message from unexpected source ${JSON.stringify(sourceKind)}`);
    return false;
  }
  data.role = 'user';
  if (typeof data.id !== 'string' || data.id === '') data.id = randomUUID();
  return true;
}

/**
 * Repair one session artifact. Returns a summary; `changed` is false when the
 * log is already healthy.
 * @param {string} file
 * @param {{ dryRun?: boolean }} [options]
 */
function repairFile(file, options = {}) {
  const original = fs.readFileSync(file);
  const { text, frames } = decompressAll(original);
  const trailingNewline = text.endsWith('\n');
  const lines = text.split('\n');
  if (trailingNewline) lines.pop();

  const warnings = [];
  const warn = (message) => warnings.push(message);
  let repaired = 0;
  const output = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === '') {
      output.push(line);
      continue;
    }
    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      throw new Error(`${file}: line ${index + 1} is not JSON: ${error?.message ?? error}`);
    }
    // Untouched lines keep their original bytes; only repaired events are re-serialised.
    output.push(repairEvent(event, warn) ? JSON.stringify(event) : line);
    if (output[index] !== line) repaired += 1;
  }
  if (repaired === 0) return { file, changed: false, repaired, frames, warnings };

  const repairedText = output.join('\n') + (trailingNewline ? '\n' : '');
  const compressed = zstdCompressSync(Buffer.from(repairedText, 'utf8'));

  // Round-trip verification before touching the original.
  const verify = decompressAll(compressed);
  if (verify.text !== repairedText) throw new Error(`${file}: repair verification failed (payload mismatch)`);
  const eventCount = lines.filter((line) => line !== '').length;
  if (verify.text.split('\n').filter((line) => line !== '').length !== eventCount) {
    throw new Error(`${file}: repair verification failed (event count changed)`);
  }

  if (options.dryRun === true) {
    return { file, changed: true, repaired, frames, warnings, dryRun: true };
  }
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const backup = `${file}.bak-${stamp}`;
  fs.copyFileSync(file, backup);
  fs.writeFileSync(`${file}.tmp`, compressed);
  fs.renameSync(`${file}.tmp`, file);
  return { file, changed: true, repaired, frames, warnings, backup };
}

/** Find every session artifact under the sessions root. */
function listSessionFiles(root) {
  const files = [];
  for (const project of fs.readdirSync(root, { withFileTypes: true })) {
    if (!project.isDirectory()) continue;
    const projectDir = path.join(root, project.name);
    for (const session of fs.readdirSync(projectDir, { withFileTypes: true })) {
      if (!session.isDirectory()) continue;
      const file = path.join(projectDir, session.name, FILE_NAME);
      if (fs.existsSync(file)) files.push(file);
    }
  }
  return files;
}

function parseArgs(argv) {
  const options = { root: path.join(os.homedir(), '.dsh', 'sessions'), dryRun: false, ids: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--root') {
      index += 1;
      if (argv[index] === undefined) throw new Error('--root requires a directory');
      options.root = argv[index];
    } else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
    else options.ids.push(arg);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/repair-session-log.mjs [--dry-run] [--root <dir>] [session-id-substring ...]');
    return;
  }
  const files = listSessionFiles(options.root).filter((file) =>
    options.ids.length === 0 ? true : options.ids.some((id) => file.includes(id)),
  );
  if (files.length === 0) {
    console.log(`no session logs found under ${options.root}`);
    return;
  }
  let damaged = 0;
  for (const file of files) {
    const result = repairFile(file, { dryRun: options.dryRun });
    for (const warning of result.warnings) console.warn(`[warn] ${warning}`);
    if (!result.changed) continue;
    damaged += 1;
    console.log(
      `${options.dryRun ? '[dry-run] ' : ''}repaired ${result.repaired} message(s) in ${file}` +
        (result.backup ? ` (backup: ${path.basename(result.backup)})` : ''),
    );
  }
  console.log(
    damaged === 0
      ? 'no role-less filekit notices found; nothing to repair'
      : `${damaged} session(s) ${options.dryRun ? 'need repair' : 'repaired'}`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

export { decompressAll, listSessionFiles, repairEvent, repairFile };

