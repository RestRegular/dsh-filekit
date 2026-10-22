/**
 * dsh-filekit — Agent change notices.
 *
 * The Agent inbox accepts complete Harness messages only. `agent.inject()` does
 * not fill in defaults: whatever object it receives is committed to the session
 * log as-is and is later serialised verbatim into the provider request. A
 * hand-rolled `{ content, source }` object therefore has no `role`, and every
 * later request in that session fails with
 * `messages[N]: missing field `role`` (422, INVALID_REQUEST) — permanently,
 * because the malformed record is already part of the session history.
 *
 * Notices are user-role messages with a stable identity: `id` keeps the inbox
 * projection's pending-message identities unique, `role` lets the history
 * serialiser emit a valid provider message.
 *
 * @module dsh-filekit/lib/notice
 */

import { randomUUID } from 'node:crypto';

/**
 * Build one immutable-looking user-role notice message for the Agent inbox.
 * @param {string} text - the short, human-readable notice.
 * @returns {{ id: string, role: 'user', content: { type: 'text', text: string }[], source: { kind: string } }}
 */
export function buildChangeNotice(text) {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: String(text) }],
    source: { kind: 'dsh-filekit' },
  };
}

/**
 * Structural check against the Harness user-message contract. Publishing a
 * malformed message permanently breaks the session, so callers verify first.
 * @param {unknown} message
 * @returns {boolean}
 */
export function isWellFormedUserMessage(message) {
  if (message === null || typeof message !== 'object') return false;
  if (typeof message.id !== 'string' || message.id === '') return false;
  if (message.role !== 'user') return false;
  if (!Array.isArray(message.content) || message.content.length === 0) return false;
  if (!message.content.every((block) => block?.type === 'text' && typeof block.text === 'string')) return false;
  return message.source?.kind === 'dsh-filekit';
}
