/**
 * dsh-filekit — Client half.
 *
 * Registers:
 *   1. an extension over the shipped `files` tab kind: a workspace tree with
 *      right-click actions and drag-to-move;
 *   2. a FileKit page tab (`filekit` kind) holding the full manager: browse,
 *      text editor, recycle bin;
 *   3. a custom guide card for the workspace-files entry with a second button
 *      that opens the FileKit page in the sidebar;
 *   4. header actions on the files tab and on the document preview;
 *   5. a FileKit settings page under Settings.
 *
 * All data and mutations go through the Host's loopback route
 * `/dsh-filekit/api`; this bundle imports nothing from Harness Client packages
 * and only uses `--dsw-*` theme tokens.
 *
 * The whole file is an IIFE because client bundles share one global lexical
 * scope in the page and a re-executed bundle would otherwise throw
 * `Identifier 'MODULE_ID' has already been declared`.
 */
(() => {
  const MODULE_ID = '@restregular/dsh-filekit';
  const OWNER = 'dsh-filekit';
  const NS = 'dsh-filekit';
  const API = '/dsh-filekit/api';
  const DSH_TRASH = '.dsh-trash';

  /** Extension identity for the shipped files tab kind. */
  const FILES_ID = '@restregular/dsh-filekit/files';
  /** Identity of the FileKit page type and of its body cell. */
  const FILEKIT_ID = '@restregular/dsh-filekit';
  const FILES_KIND = 'files';
  const FILEKIT_KIND = 'filekit';
  const EDITOR_KIND = 'filekit-edit';
  /** Identity of the per-file editor tab type and its body cell. */
  const EDITOR_ID = '@restregular/dsh-filekit/editor';
  /** Resource scheme for editor tabs; the address carries the file, so it survives restarts. */
  const EDITOR_PREFIX = 'dsh-resource://filekit-edit/session/';

  const factories = window.__ModuleLoader__?.factories;
  if (factories !== undefined && typeof factories.has === 'function' && factories.has(MODULE_ID)) return;

  window.__ModuleLoader__.load({
    id: MODULE_ID,
    factory(require) {
      const React = require('react');
      const h = React.createElement;

      // Harness primitives give the editor the same Shiki highlighter the
      // built-in document preview uses. Optional: a missing module degrades to
      // a plain textarea instead of breaking the whole plugin.
      let primitives = undefined;
      try {
        primitives = require('@deepseek-ai/dsh-client-ui-primitives');
      } catch {
        primitives = undefined;
      }
      const useCodeHighlighter =
        typeof primitives?.useCodeHighlighter === 'function' ? primitives.useCodeHighlighter : () => () => undefined;
      const languageForPath =
        typeof primitives?.languageForPath === 'function' ? primitives.languageForPath : () => undefined;

      // ------------------------------------------------------------------
      // Copy
      // ------------------------------------------------------------------
      const DICT = {
        zh: {
          metaTitle: 'FileKit 文件工具',
          metaDescription: '在右侧「工作区文件」面板中右键操作、拖拽移动、编辑与可恢复删除工作区文件，并把变更自动告知 Agent。',
          filesTitle: '文件',
          filesGuideTitle: '工作区文件',
          filesGuideDescription: '浏览、右键操作与拖拽整理工作区文件',
          guideExtra: 'FileKit 文件工具',
          guideExtraHint: '编辑、回收站与完整文件管理',
          open: '更多操作',
          openTitle: '打开 FileKit 文件工具',
          openFiles: '文件面板',
          openInFileKit: '在 FileKit 中打开',
          openDirInFileKit: '在 FileKit 中浏览',
          title: 'FileKit',
          subtitle: '工作区文件管理器',
          close: '关闭',
          refresh: '刷新',
          retry: '重试',
          back: '返回',
          loading: '正在读取…',
          empty: '这个目录是空的',
          trashEmpty: '回收站是空的',
          newFile: '新建文件',
          newDir: '新建文件夹',
          newFileHere: '在此新建文件',
          newDirHere: '在此新建文件夹',
          trash: '回收站',
          openTrash: '打开回收站',
          edit: '编辑',
          openEditor: '用 FileKit 编辑',
          openPreview: '打开预览',
          rename: '重命名',
          move: '移动到…',
          copy: '复制',
          cut: '剪切',
          paste: '粘贴',
          pasteHere: '粘贴到此处',
          copyRel: '复制相对路径',
          copyAbs: '复制绝对路径',
          reference: '引用到对话框',
          delete: '删除到回收站',
          restore: '恢复',
          purge: '永久删除',
          save: '保存',
          saving: '保存中…',
          cancel: '取消',
          confirm: '确认',
          create: '创建',
          name: '名称',
          newName: '新名称',
          moveTo: '移动到',
          moveHere: '移动到这里',
          chooseDir: '选择目标文件夹',
          noSubdirs: '没有子文件夹',
          parentDir: '上一级',
          deleteTitle: '删除到回收站？',
          deleteConfirm: '删除',
          deleteHint: '条目会移动到工作区的 {trash} 目录，之后可以从回收站恢复。',
          purgeTitle: '永久删除？',
          purgeConfirm: '永久删除',
          purgeHint: '这会直接移除回收站条目，无法恢复。',
          emptyTitle: '清空回收站？',
          emptyConfirm: '清空',
          emptyHint: '回收站里的所有条目都会被永久删除，无法恢复。',
          discardTitle: '放弃未保存的修改？',
          discardConfirm: '放弃修改',
          discardHint: '放弃后该标签页会切换回文件预览。',
          editorTab: '编辑',
          editorNoFile: '这个标签页没有要编辑的文件。',
          dirty: '未保存',
          discard: '放弃修改',
          binary: '这是二进制文件，不能用文本编辑器打开。',
          truncated: '文件超过编辑器上限，已只读截断显示。',
          truncatedEntries: '条目太多，只显示了一部分。',
          noChanges: '没有需要保存的修改',
          saved: '已保存',
          created: '已创建',
          renamed: '已重命名',
          moved: '已移动',
          copied: '已复制',
          cutDone: '已剪切',
          pasted: '已粘贴',
          pastedTo: '已粘贴到 {path}',
          deleted: '已移入回收站',
          restored: '已恢复',
          purged: '已永久删除',
          emptied: '回收站已清空',
          referenced: '已插入引用',
          referencedCopied: '输入框不可用，引用已复制到剪贴板',
          copiedPath: '路径已复制',
          rootLabel: '工作区',
          lines: '行',
          bytes: '字节',
          modified: '修改于',
          conflictHint: '文件在磁盘上已被修改，请刷新后重试。',
          dragHint: '拖拽移动 · 右键操作',
          dropRoot: '移动到工作区根目录',
          moving: '正在移动…',
          saveBeforeClose: '还有未保存的修改，请先保存或放弃修改。',
          saveBeforeSwitch: '还有未保存的修改，请先保存或放弃修改。',
          settingsTitle: 'FileKit',
          settingsIntro: '这些设置只影响本机的 FileKit 界面。',
          settingsShowHidden: '显示隐藏文件',
          settingsShowHiddenHint: '在文件树和 FileKit 中显示以 . 开头的文件与目录。',
          settingsNotify: '变更后提醒 Agent',
          settingsNotifyHint: '关闭后不再向当前会话注入变更提醒，可节省上下文 token。',
          settingsConfirmDelete: '删除前确认',
          settingsConfirmDeleteHint: '关闭后「删除」会直接把条目移入工作区回收站。',
          settingsAutoRefresh: '自动刷新',
          settingsAutoRefreshHint: '定期重新读取已经展开的目录，发现外部改动。',
          settingsAutoRefreshOff: '关闭',
          settingsAutoRefresh15: '15 秒',
          settingsAutoRefresh30: '30 秒',
          settingsAutoRefresh60: '60 秒',
          settingsFontSize: '编辑器字号',
          settingsFontSizeHint: 'FileKit 内置文本编辑器的字号。',
          settingsReset: '恢复默认设置',
          settingsResetDone: '已恢复默认设置',
          settingsStorageFail: '设置无法保存到浏览器存储。',
          errorPrefix: '操作失败：',
          'error.bad-path': '路径无效。',
          'error.bad-name': '名称无效。',
          'error.bad-root': '工作区路径无效。',
          'error.no-root': '工作区目录不存在。',
          'error.unknown-workspace': '这个目录不是已注册的工作区。',
          'error.no-workspace': '无法确定工作区目录。',
          'error.no-session': '当前没有可用的会话。',
          'error.forbidden': '请求被拒绝。',
          'error.not-found': '条目不存在。',
          'error.not-directory': '这不是一个目录。',
          'error.not-file': '这不是一个文件。',
          'error.exists': '同名条目已存在。',
          'error.parent-missing': '上级目录不存在。',
          'error.outside-workspace': '路径超出了工作区范围。',
          'error.symlink': '不允许通过符号链接操作。',
          'error.protected': '这个位置受保护，不能这样操作。',
          'error.bad-move': '不能把目录移动到它自己里面。',
          'error.bad-copy': '不能把目录复制到它自己里面。',
          'error.too-large': '内容太大。',
          'error.conflict': '文件已被其他程序修改，请刷新后再保存。',
          'error.bad-entry': '回收站条目无效。',
          'error.bad-input': '请求参数无效。',
          'error.bad-action': '未知操作。',
          'error.unknown-op': '未知操作。',
          'error.internal': '内部错误。',
        },
        en: {
          metaTitle: 'FileKit file tools',
          metaDescription: 'Right-click, drag, edit, and recoverably delete workspace files from the right-sidebar workspace files panel, with changes reported to the Agent.',
          filesTitle: 'Files',
          filesGuideTitle: 'Workspace files',
          filesGuideDescription: 'Browse, right-click, and drag to organize workspace files',
          guideExtra: 'FileKit file manager',
          guideExtraHint: 'Editor, recycle bin, and full file management',
          open: 'More actions',
          openTitle: 'Open FileKit',
          openFiles: 'Files panel',
          openInFileKit: 'Open in FileKit',
          openDirInFileKit: 'Browse in FileKit',
          title: 'FileKit',
          subtitle: 'Workspace file manager',
          close: 'Close',
          refresh: 'Refresh',
          retry: 'Retry',
          back: 'Back',
          loading: 'Loading…',
          empty: 'This directory is empty',
          trashEmpty: 'The recycle bin is empty',
          newFile: 'New file',
          newDir: 'New folder',
          newFileHere: 'New file here',
          newDirHere: 'New folder here',
          trash: 'Recycle bin',
          openTrash: 'Open recycle bin',
          edit: 'Edit',
          openEditor: 'Edit in FileKit',
          openPreview: 'Open preview',
          rename: 'Rename',
          move: 'Move to…',
          copy: 'Copy',
          cut: 'Cut',
          paste: 'Paste',
          pasteHere: 'Paste here',
          copyRel: 'Copy relative path',
          copyAbs: 'Copy absolute path',
          reference: 'Reference in composer',
          delete: 'Move to recycle bin',
          restore: 'Restore',
          purge: 'Delete permanently',
          save: 'Save',
          saving: 'Saving…',
          cancel: 'Cancel',
          confirm: 'Confirm',
          create: 'Create',
          name: 'Name',
          newName: 'New name',
          moveTo: 'Move to',
          moveHere: 'Move here',
          chooseDir: 'Choose a destination folder',
          noSubdirs: 'No subfolders',
          parentDir: 'Parent',
          deleteTitle: 'Move to the recycle bin?',
          deleteConfirm: 'Move to trash',
          deleteHint: 'The entry moves into the workspace {trash} folder and can be restored from the recycle bin.',
          purgeTitle: 'Delete permanently?',
          purgeConfirm: 'Delete permanently',
          purgeHint: 'This removes the trash entry and cannot be undone.',
          emptyTitle: 'Empty the recycle bin?',
          emptyConfirm: 'Empty',
          emptyHint: 'Every entry in the recycle bin is permanently deleted; this cannot be undone.',
          discardTitle: 'Discard unsaved changes?',
          discardConfirm: 'Discard',
          discardHint: 'Discarding switches this tab back to the file preview.',
          editorTab: 'Edit',
          editorNoFile: 'This tab has no file to edit.',
          dirty: 'Unsaved',
          discard: 'Discard',
          binary: 'This is a binary file; the text editor cannot open it.',
          truncated: 'This file exceeds the editor limit and is shown read-only.',
          truncatedEntries: 'Too many entries, showing only some of them.',
          noChanges: 'Nothing to save',
          saved: 'Saved',
          created: 'Created',
          renamed: 'Renamed',
          moved: 'Moved',
          copied: 'Copied',
          cutDone: 'Cut',
          pasted: 'Pasted',
          pastedTo: 'Pasted into {path}',
          deleted: 'Moved to the recycle bin',
          restored: 'Restored',
          purged: 'Permanently deleted',
          emptied: 'Recycle bin emptied',
          referenced: 'Reference inserted',
          referencedCopied: 'Composer unavailable; reference copied to the clipboard',
          copiedPath: 'Path copied',
          rootLabel: 'Workspace',
          lines: 'lines',
          bytes: 'bytes',
          modified: 'Modified',
          conflictHint: 'The file changed on disk. Refresh and try again.',
          dragHint: 'Drag to move · Right-click for actions',
          dropRoot: 'Move to the workspace root',
          moving: 'Moving…',
          saveBeforeClose: 'Unsaved changes: save or discard them before closing.',
          saveBeforeSwitch: 'Unsaved changes: save or discard them first.',
          settingsTitle: 'FileKit',
          settingsIntro: 'These settings only affect FileKit in this browser.',
          settingsShowHidden: 'Show hidden files',
          settingsShowHiddenHint: 'Show files and folders whose names start with a dot.',
          settingsNotify: 'Tell the Agent after changes',
          settingsNotifyHint: 'Off stops injecting workspace-change notices into the current session, saving context tokens.',
          settingsConfirmDelete: 'Confirm before deleting',
          settingsConfirmDeleteHint: 'Off moves entries to the workspace recycle bin without a dialog.',
          settingsAutoRefresh: 'Auto refresh',
          settingsAutoRefreshHint: 'Periodically reread expanded directories to pick up outside changes.',
          settingsAutoRefreshOff: 'Off',
          settingsAutoRefresh15: '15 s',
          settingsAutoRefresh30: '30 s',
          settingsAutoRefresh60: '60 s',
          settingsFontSize: 'Editor font size',
          settingsFontSizeHint: 'Font size of the built-in text editor.',
          settingsReset: 'Restore defaults',
          settingsResetDone: 'Defaults restored',
          settingsStorageFail: 'The settings could not be saved in browser storage.',
          errorPrefix: 'Operation failed: ',
          'error.bad-path': 'Invalid path.',
          'error.bad-name': 'Invalid name.',
          'error.bad-root': 'Invalid workspace path.',
          'error.no-root': 'The workspace directory does not exist.',
          'error.unknown-workspace': 'This directory is not a registered workspace.',
          'error.no-workspace': 'Could not resolve a workspace directory.',
          'error.no-session': 'No live session is available.',
          'error.forbidden': 'The request was rejected.',
          'error.not-found': 'The entry does not exist.',
          'error.not-directory': 'This is not a directory.',
          'error.not-file': 'This is not a file.',
          'error.exists': 'An entry with that name already exists.',
          'error.parent-missing': 'The parent directory does not exist.',
          'error.outside-workspace': 'The path escapes the workspace.',
          'error.symlink': 'Symbolic-link operations are not allowed.',
          'error.protected': 'That location is protected.',
          'error.bad-move': 'A directory cannot be moved into itself.',
          'error.bad-copy': 'A directory cannot be copied into itself.',
          'error.too-large': 'The content is too large.',
          'error.conflict': 'The file changed on disk; refresh before saving.',
          'error.bad-entry': 'Invalid trash entry.',
          'error.bad-input': 'Invalid request.',
          'error.bad-action': 'Unknown action.',
          'error.unknown-op': 'Unknown operation.',
          'error.internal': 'Internal error.',
        },
      };

      /** Fallback translator used before the locale service binds. */
      function fallbackText(key) {
        return DICT.zh[key] ?? DICT.en[key] ?? key;
      }

      let translate = fallbackText;

      /** Translate one key, replacing `{name}` placeholders. */
      function t(key, params) {
        let text = translate(key);
        if (params !== undefined && params !== null) {
          for (const [name, value] of Object.entries(params)) {
            text = text.split('{' + name + '}').join(String(value));
          }
        }
        return text;
      }

      /** Stable, localized error text for a Host failure. */
      function errorText(error) {
        const code = error?.code;
        if (typeof code === 'string') {
          const key = 'error.' + code;
          const localized = translate(key);
          if (localized !== key) return localized;
        }
        return String(error?.message ?? error ?? translate('error.internal'));
      }

      // ------------------------------------------------------------------
      // Persistent settings
      // ------------------------------------------------------------------

      const SETTINGS_KEY = 'dsh-filekit.settings.v1';
      const DEFAULT_SETTINGS = Object.freeze({
        showHidden: true,
        notifyAgent: true,
        confirmDelete: true,
        autoRefreshSeconds: 0,
        editorFontSize: 12,
      });
      const AUTO_REFRESH_CHOICES = [0, 15, 30, 60];
      const FONT_MIN = 11;
      const FONT_MAX = 18;

      function clampFontSize(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return DEFAULT_SETTINGS.editorFontSize;
        return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(number)));
      }

      function normalizeAutoRefresh(value) {
        const number = Number(value);
        return AUTO_REFRESH_CHOICES.includes(number) ? number : DEFAULT_SETTINGS.autoRefreshSeconds;
      }

      function readSettings() {
        const next = { ...DEFAULT_SETTINGS };
        try {
          const raw = window.localStorage.getItem(SETTINGS_KEY);
          if (raw === null) return next;
          const parsed = JSON.parse(raw);
          if (typeof parsed !== 'object' || parsed === null) return next;
          if (typeof parsed.showHidden === 'boolean') next.showHidden = parsed.showHidden;
          if (typeof parsed.notifyAgent === 'boolean') next.notifyAgent = parsed.notifyAgent;
          if (typeof parsed.confirmDelete === 'boolean') next.confirmDelete = parsed.confirmDelete;
          next.autoRefreshSeconds = normalizeAutoRefresh(parsed.autoRefreshSeconds);
          next.editorFontSize = clampFontSize(parsed.editorFontSize);
        } catch {
          /* unusable storage falls back to defaults */
        }
        return next;
      }

      let settings = readSettings();
      const settingsListeners = new Set();

      function emitSettings() {
        for (const listener of settingsListeners) {
          try {
            listener();
          } catch {
            /* a broken listener must not break the others */
          }
        }
      }

      function writeSettings(next) {
        settings = next;
        try {
          window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        } catch {
          console.warn('[dsh-filekit] settings could not be persisted');
        }
        emitSettings();
      }

      function updateSettings(patch) {
        writeSettings({ ...settings, ...patch });
      }

      function resetSettings() {
        writeSettings({ ...DEFAULT_SETTINGS });
      }

      function useSettings() {
        const [snapshot, setSnapshot] = React.useState(settings);
        React.useEffect(() => {
          const update = () => setSnapshot(settings);
          settingsListeners.add(update);
          return () => settingsListeners.delete(update);
        }, []);
        return snapshot;
      }

      // ------------------------------------------------------------------
      // Host API
      // ------------------------------------------------------------------

      async function api(op, payload = {}) {
        const response = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ op, source: 'ui', notify: settings.notifyAgent, ...payload }),
        });
        const data = await response.json().catch(() => null);
        if (data === null) {
          const error = new Error(`HTTP ${response.status}`);
          error.code = 'internal';
          throw error;
        }
        if (data.ok !== true) {
          const error = new Error(typeof data.error === 'string' ? data.error : `HTTP ${response.status}`);
          error.code = typeof data.code === 'string' ? data.code : 'internal';
          throw error;
        }
        return data;
      }

      // ------------------------------------------------------------------
      // Paths and clipboard
      // ------------------------------------------------------------------

      const processPlatform = typeof navigator !== 'undefined' && /Win/iu.test(navigator.userAgent) ? 'win32' : 'other';

      function toSlashes(value) {
        return String(value).replace(/\\/gu, '/');
      }

      function trimRoot(value) {
        const text = toSlashes(value);
        return text.length > 1 ? text.replace(/\/+$/u, '') : text;
      }

      function relFromAbs(abs, root) {
        if (typeof abs !== 'string' || typeof root !== 'string') return null;
        const a = trimRoot(abs);
        const r = trimRoot(root);
        const lower = (value) => (processPlatform === 'win32' ? value.toLowerCase() : value);
        if (lower(a) === lower(r)) return '';
        if (lower(a).startsWith(lower(r) + '/')) return a.slice(r.length + 1);
        return null;
      }

      function dirOf(rel) {
        const index = rel.lastIndexOf('/');
        return index < 0 ? '' : rel.slice(0, index);
      }

      function baseOf(rel) {
        const index = rel.lastIndexOf('/');
        return index < 0 ? rel : rel.slice(index + 1);
      }

      function joinRel(dir, name) {
        return dir === '' ? name : dir + '/' + name;
      }

      function joinAbs(root, rel) {
        const clean = String(root).replace(/[\\/]+$/u, '');
        const sep = clean.includes('\\') ? '\\' : '/';
        return rel === '' ? clean : clean + sep + rel.split('/').join(sep);
      }

      function workspaceName(root) {
        const parts = toSlashes(root).split('/').filter((part) => part !== '');
        return parts.length === 0 ? toSlashes(root) : parts[parts.length - 1];
      }

      /** Address of a workspace file, as the sidebar's preview tab expects it. */
      function fileAddress(sessionId, rel) {
        const id = encodeURIComponent(String(sessionId));
        return 'dsh-resource://file/session/' + id + '/' + rel.split('/').map((part) => encodeURIComponent(part)).join('/');
      }

      /** Address of a FileKit editor tab; unique per session+file, and persisted as its contentId. */
      function editorAddress(sessionId, rel) {
        return EDITOR_PREFIX + encodeURIComponent(String(sessionId)) + '/' + rel.split('/').map((part) => encodeURIComponent(part)).join('/');
      }

      /** Read the file out of an editor tab address; `undefined` for any other resource. */
      function parseEditorAddress(address) {
        if (typeof address !== 'string' || !address.startsWith(EDITOR_PREFIX)) return undefined;
        const rest = address.slice(EDITOR_PREFIX.length);
        const slash = rest.indexOf('/');
        if (slash <= 0 || slash === rest.length - 1) return undefined;
        try {
          const sessionId = decodeURIComponent(rest.slice(0, slash));
          const rel = rest.slice(slash + 1).split('/').map((part) => decodeURIComponent(part)).join('/');
          return { sessionId, rel };
        } catch {
          return undefined;
        }
      }

      function formatBytes(size) {
        if (typeof size !== 'number' || !Number.isFinite(size)) return '';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
      }

      function isHiddenEntry(name) {
        return settings.showHidden !== true && String(name).startsWith('.');
      }

      async function copyText(text) {
        try {
          if (navigator.clipboard !== undefined) {
            await navigator.clipboard.writeText(text);
            return true;
          }
        } catch {
          /* fall through to the legacy path */
        }
        try {
          const area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.left = '-9999px';
          area.style.top = '0';
          document.body.appendChild(area);
          area.select();
          const ok = document.execCommand('copy');
          area.remove();
          return ok;
        } catch {
          return false;
        }
      }

      // ------------------------------------------------------------------
      // Toast and style ownership
      // ------------------------------------------------------------------

      let toastSpec = null;
      const toastListeners = new Set();
      let toastTimer = undefined;

      function emitToast() {
        for (const listener of toastListeners) {
          try {
            listener();
          } catch {
            /* ignore */
          }
        }
      }

      function showToast(text, kind = 'ok') {
        toastSpec = { text, kind, key: Date.now() };
        emitToast();
        if (toastTimer !== undefined) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
          toastSpec = null;
          toastTimer = undefined;
          emitToast();
        }, 4200);
      }

      function useToastSpec() {
        const [spec, setSpec] = React.useState(toastSpec);
        React.useEffect(() => {
          const listener = () => setSpec(toastSpec);
          toastListeners.add(listener);
          return () => toastListeners.delete(listener);
        }, []);
        return spec;
      }

      function ToastHost() {
        const spec = useToastSpec();
        if (spec === null) return null;
        return h('div', { className: 'dsh-fk-toast', 'data-kind': spec.kind, role: 'status' }, spec.text);
      }

      // ------------------------------------------------------------------
      // File clipboard (copy / cut → paste)
      // ------------------------------------------------------------------

      /** Shared across both panels: copy in one, paste in the other. */
      let fileClipboard = null;
      const clipboardListeners = new Set();

      function setFileClipboard(value) {
        fileClipboard = value;
        for (const listener of clipboardListeners) {
          try {
            listener();
          } catch {
            /* ignore */
          }
        }
      }

      function useFileClipboard() {
        const [value, setValue] = React.useState(fileClipboard);
        React.useEffect(() => {
          const listener = () => setValue(fileClipboard);
          clipboardListeners.add(listener);
          return () => clipboardListeners.delete(listener);
        }, []);
        return value;
      }

      /** Put one entry on the FileKit clipboard (no filesystem work yet). */
      function copyToFileClipboard(root, rel, kind, mode) {
        setFileClipboard({ mode, root, rel, kind, name: baseOf(rel) });
        showToast(mode === 'cut' ? t('cutDone') : t('copied'), 'ok');
      }

      // ------------------------------------------------------------------
      // Highlighted code editor
      // ------------------------------------------------------------------

      /** Above this size the editor skips highlighting so typing stays fluid. */
      const HIGHLIGHT_MAX_CHARS = 200_000;

      function CodeEditor({ value, onChange, rel, fontSize, readOnly = false }) {
        const inputRef = React.useRef(null);
        const preRef = React.useRef(null);
        const [composing, setComposing] = React.useState(false);
        const deferred = React.useDeferredValue(value);
        const language = React.useMemo(() => languageForPath(rel), [rel]);
        const highlight = useCodeHighlighter(language);
        const plainLines = React.useMemo(() => String(deferred).split('\n'), [deferred]);
        const lines = React.useMemo(() => {
          if (typeof highlight !== 'function' || deferred.length > HIGHLIGHT_MAX_CHARS) return undefined;
          try {
            const result = highlight(deferred);
            return Array.isArray(result) ? result : undefined;
          } catch {
            return undefined;
          }
        }, [deferred, highlight]);
        const totalLines = String(value).split('\n').length;
        const rendered = [];
        const source = lines ?? plainLines;
        for (let index = 0; index < Math.max(source.length, totalLines); index += 1) {
          const line = source[index];
          rendered.push(
            h(
              'div',
              { className: 'dsh-fk-codeeditor-line', key: index },
              Array.isArray(line)
                ? line.map((token, tokenIndex) => h('span', { key: tokenIndex, style: token.style }, token.text))
                : line ?? '',
            ),
          );
        }

        const syncScroll = (event) => {
          const pre = preRef.current;
          if (pre === null) return;
          pre.scrollTop = event.currentTarget.scrollTop;
          pre.scrollLeft = event.currentTarget.scrollLeft;
        };

        // After edits (or a highlight pass) the textarea may have scrolled under
        // the caret; keep the painted layer on the same scroll offset.
        React.useEffect(() => {
          const input = inputRef.current;
          const pre = preRef.current;
          if (input === null || pre === null) return;
          pre.scrollTop = input.scrollTop;
          pre.scrollLeft = input.scrollLeft;
        }, [value, lines]);

        return h(
          'div',
          { className: 'dsh-fk-codeeditor' },
          h(
            'pre',
            {
              className: 'dsh-fk-codeeditor-pre',
              ref: preRef,
              'aria-hidden': true,
              style: { fontSize: `${fontSize}px`, visibility: composing ? 'hidden' : 'visible' },
            },
            rendered,
          ),
          h('textarea', {
            ref: inputRef,
            className: 'dsh-fk-codeeditor-input',
            value,
            spellCheck: false,
            readOnly,
            wrap: 'off',
            autoCapitalize: 'off',
            autoCorrect: 'off',
            autoComplete: 'off',
            style: {
              fontSize: `${fontSize}px`,
              // IME composition text would be invisible through the transparent
              // layer; show it plainly while the candidate window is open.
              color: composing ? 'var(--dsw-alias-label-primary)' : 'transparent',
            },
            onChange: (event) => onChange(event.target.value),
            onScroll: syncScroll,
            onCompositionStart: () => setComposing(true),
            onCompositionEnd: () => setComposing(false),
            onKeyDown: (event) => {
              if (readOnly || event.key !== 'Tab') return;
              event.preventDefault();
              const area = event.currentTarget;
              const start = area.selectionStart;
              const end = area.selectionEnd;
              onChange(`${value.slice(0, start)}  ${value.slice(end)}`);
              window.requestAnimationFrame(() => {
                area.selectionStart = start + 2;
                area.selectionEnd = start + 2;
              });
            },
          }),
        );
      }

      /**
       * One per-file editor tab. Saving (or discarding) swaps this tab for the
       * file's preview tab, so the pair behave as one page with two modes.
       */
      function FileEditorTab(props) {
        const { useTabInfo, sessionId, inputActions } = props;
        const { tab } = useTabInfo();
        const settingsSnapshot = useSettings();
        const params = tab.navigation?.params;
        // Navigation params carry the file on first open; a restored layout only
        // has the tab's contentId, which is the editor address.
        const rel =
          typeof params?.rel === 'string' && params.rel !== '' ? params.rel : parseEditorAddress(tab.contentId)?.rel ?? '';
        const [root, setRoot] = React.useState('');
        const [error, setError] = React.useState('');
        const [editor, setEditor] = React.useState(null);
        const [draft, setDraft] = React.useState('');
        const [saving, setSaving] = React.useState(false);
        const [discardOpen, setDiscardOpen] = React.useState(false);
        const draftRef = React.useRef('');
        const savingRef = React.useRef(false);
        const saveRef = React.useRef(null);
        draftRef.current = draft;
        const dirty = editor !== null && draft !== editor.original;

        // The tab chip shows the unsaved marker through this flag.
        React.useEffect(() => {
          setTabDirty(tab.id, dirty);
          return () => setTabDirty(tab.id, false);
        }, [tab.id, dirty]);

        React.useEffect(() => {
          if (typeof sessionId !== 'string' || sessionId === '') return undefined;
          let dead = false;
          api('workspace', { sessionId })
            .then((data) => {
              if (!dead) setRoot(data.root);
            })
            .catch((failure) => {
              if (!dead) setError(errorText(failure));
            });
          return () => {
            dead = true;
          };
        }, [sessionId]);

        React.useEffect(() => {
          if (root === '' || rel === '') return undefined;
          let dead = false;
          setEditor(null);
          setDraft('');
          setError('');
          api('read', { root, path: rel, sessionId })
            .then((data) => {
              if (dead) return;
              if (data.binary === true) {
                setError(t('binary'));
                return;
              }
              setEditor({
                rel,
                original: data.text,
                mtimeMs: data.mtimeMs,
                size: data.size,
                truncated: data.truncated === true,
              });
              setDraft(data.text);
            })
            .catch((failure) => {
              if (!dead) setError(errorText(failure));
            });
          return () => {
            dead = true;
          };
        }, [root, rel, sessionId]);

        const switchToPreview = () => {
          setTabDirty(tab.id, false);
          try {
            tab.actions.openResource(fileAddress(sessionId, rel), { replaceTab: true });
          } catch (failure) {
            showToast(errorText(failure), 'error');
          }
        };

        const save = async () => {
          const current = editor;
          const text = draftRef.current;
          if (current === null || savingRef.current || current.truncated || text === current.original) return;
          savingRef.current = true;
          setSaving(true);
          try {
            await api('write', { root, path: rel, content: text, expectedMtimeMs: current.mtimeMs, sessionId });
            showToast(t('saved'));
            switchToPreview();
          } catch (failure) {
            setError(errorText(failure));
            showToast(errorText(failure), 'error');
          } finally {
            savingRef.current = false;
            setSaving(false);
          }
        };
        saveRef.current = save;

        const discard = () => {
          if (!dirty) {
            switchToPreview();
            return;
          }
          setDiscardOpen(true);
        };

        React.useEffect(() => {
          const onKeyDown = (event) => {
            if (tab.visible !== true) return;
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && editor !== null) {
              event.preventDefault();
              saveRef.current?.();
            }
          };
          window.addEventListener('keydown', onKeyDown);
          return () => window.removeEventListener('keydown', onKeyDown);
        }, [editor, tab.visible]);

        const copyRelPath = async () => {
          const ok = await copyText(rel);
          showToast(ok ? t('copiedPath') : t('error.internal'), ok ? 'ok' : 'error');
        };

        const referenceRel = async () => {
          const text = `@${rel} `;
          if (inputActions !== undefined && typeof inputActions.captureInsertion === 'function' && typeof inputActions.insertText === 'function') {
            try {
              const span = inputActions.captureInsertion();
              if (inputActions.insertText(text, span) === true) {
                inputActions.persistDraft?.();
                showToast(t('referenced'));
                return;
              }
            } catch {
              /* fall back to the clipboard */
            }
          }
          const ok = await copyText(text);
          showToast(ok ? t('referencedCopied') : t('error.internal'), ok ? 'ok' : 'error');
        };

        if (params === undefined) {
          return h('div', { className: 'dsh-fk-tabstatus' }, h('p', { className: 'dsh-fk-hint' }, t('loading')));
        }
        if (rel === '') {
          return h('div', { className: 'dsh-fk-tabstatus' }, h('p', { className: 'dsh-fk-error' }, t('editorNoFile')));
        }
        if (error !== '' && editor === null) {
          return h(
            'div',
            { className: 'dsh-fk-tabstatus' },
            h('p', { className: 'dsh-fk-error' }, error),
            h('button', { type: 'button', className: 'dsh-fk-btn', onClick: switchToPreview }, t('openPreview')),
          );
        }
        if (editor === null) {
          return h('div', { className: 'dsh-fk-tabstatus' }, h('p', { className: 'dsh-fk-hint' }, t('loading')));
        }

        return h(
          'div',
          { className: 'dsh-fk-tab' },
          h(
            'div',
            { className: 'dsh-fk-editorhead' },
            h(
              'div',
              { className: 'dsh-fk-editorpath', title: joinAbs(root, rel) },
              h(Icon, { name: 'file', size: 15 }),
              h('span', { className: 'dsh-fk-editorpathname' }, baseOf(rel)),
              h('span', { className: 'dsh-fk-editorpathdir' }, dirOf(rel)),
            ),
            h('span', { className: 'dsh-fk-spacer' }),
            dirty ? h('span', { className: 'dsh-fk-badge' }, t('dirty')) : null,
            h(
              'span',
              { className: 'dsh-fk-iconactions' },
              h(IconButton, { icon: 'copy', label: t('copyRel'), onClick: copyRelPath }),
              h(IconButton, { icon: 'link', label: t('reference'), onClick: referenceRel }),
              h(IconButton, { icon: 'file', label: t('openPreview'), onClick: switchToPreview, disabled: saving }),
              h(IconButton, {
                icon: 'close',
                label: t('discard'),
                onClick: discard,
                disabled: saving || !dirty,
              }),
              h(IconButton, {
                icon: 'check',
                label: saving ? t('saving') : t('save'),
                onClick: save,
                disabled: saving || !dirty || editor.truncated,
              }),
            ),
          ),
          h(
            'div',
            { className: 'dsh-fk-editor' },
            editor.truncated ? h('p', { className: 'dsh-fk-warn' }, h(Icon, { name: 'warning', size: 14 }), t('truncated')) : null,
            h(CodeEditor, {
              value: draft,
              onChange: setDraft,
              rel,
              fontSize: settingsSnapshot.editorFontSize,
              readOnly: editor.truncated,
            }),
            h(
              'div',
              { className: 'dsh-fk-editor-meta' },
              h('span', null, `${formatBytes(editor.size)}${dirty ? ` → ${formatBytes(new TextEncoder().encode(draft).length)}` : ''}`),
              h('span', { className: 'dsh-fk-spacer' }),
              h('span', null, t('modified')),
              h('span', null, new Date(editor.mtimeMs).toLocaleString()),
            ),
          ),
          error !== '' ? h('div', { className: 'dsh-fk-status', 'data-kind': 'error' }, error) : null,
          discardOpen
            ? h(ConfirmDialog, {
                key: 'discard',
                title: t('discardTitle'),
                text: rel,
                hint: t('discardHint'),
                danger: true,
                confirmText: t('discardConfirm'),
                onClose: () => setDiscardOpen(false),
                onConfirm: () => {
                  setTabDirty(tab.id, false);
                  switchToPreview();
                  return true;
                },
              })
            : null,
        );
      }

      function EditorTitle({ useTabInfo }) {
        const { tab } = useTabInfo();
        const dirty = useTabDirty(tab.id);
        const rel =
          typeof tab.navigation?.params?.rel === 'string' && tab.navigation.params.rel !== ''
            ? tab.navigation.params.rel
            : parseEditorAddress(tab.contentId)?.rel ?? '';
        const name = rel === '' ? t('editorTab') : baseOf(rel);
        return h(
          'span',
          { className: 'dsh-fk-tabtitle', title: rel === '' ? name : rel },
          h(Icon, { name: 'file', size: 15 }),
          h('span', { className: 'dsh-fk-tabtitle-name' }, name),
          dirty ? h('span', { className: 'dsh-fk-tabdot', title: t('dirty') }) : null,
        );
      }

      function createOwnedStyle(css) {
        const el = document.createElement('style');
        el.setAttribute('data-plugin', OWNER);
        el.textContent = css;
        document.head.appendChild(el);
        return el;
      }

      // ------------------------------------------------------------------
      // Dirty tabs (close guard + the tab title's unsaved dot)
      // ------------------------------------------------------------------

      const dirtyTabs = new Set();
      const dirtyListeners = new Set();

      function setTabDirty(tabId, dirty) {
        if (typeof tabId !== 'string' || tabId === '') return;
        const before = dirtyTabs.has(tabId);
        if (dirty) dirtyTabs.add(tabId);
        else dirtyTabs.delete(tabId);
        if (before === dirtyTabs.has(tabId)) return;
        for (const listener of dirtyListeners) {
          try {
            listener();
          } catch {
            /* ignore */
          }
        }
      }

      /** Live dirty flag for one tab, used by its title chip. */
      function useTabDirty(tabId) {
        const [dirty, setDirty] = React.useState(() => dirtyTabs.has(tabId));
        React.useEffect(() => {
          const listener = () => setDirty(dirtyTabs.has(tabId));
          dirtyListeners.add(listener);
          listener();
          return () => dirtyListeners.delete(listener);
        }, [tabId]);
        return dirty;
      }

      // ------------------------------------------------------------------
      // Per-file editor tabs
      // ------------------------------------------------------------------

      /** Find the open tab whose content is one resource address (a preview tab). */
      function tabIdForContent(sessionId, contentId) {
        const open = sidebarRightService?.tabsIn?.(sessionId) ?? [];
        return open.find((item) => item.contentId === contentId)?.id;
      }

      /**
       * Open one file's editor tab. The address carries session+file, so the
       * same file reuses its tab and a restored layout can still resolve it.
       * An optional `replaceTabId` swaps an existing tab — the preview page's
       * edit button passes its own tab.
       */
      function openEditorTab(sessionId, rel, replaceTabId) {
        if (typeof rel !== 'string' || rel === '') return;
        if (sidebarRightService === undefined || typeof sidebarRightService.openResource !== 'function') {
          showToast(t('error.internal'), 'error');
          return;
        }
        try {
          sidebarRightService.openResource(editorAddress(sessionId, rel), {
            params: { rel },
            ...(typeof replaceTabId === 'string' ? { replaceTab: replaceTabId } : {}),
          });
        } catch (failure) {
          showToast(errorText(failure), 'error');
        }
      }

      // ------------------------------------------------------------------
      // Icons — 24-grid line art; gold/orange-red accents live in CSS
      // ------------------------------------------------------------------

      function Icon({ name, size = 16, className }) {
        const common = {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.65,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
          className,
          style: { display: 'block', flex: 'none' },
        };
        switch (name) {
          case 'brand':
          case 'folderSpark':
            return h(
              'svg',
              common,
              h('path', { d: 'M3 6.8A2.3 2.3 0 0 1 5.3 4.5h3l2 2h8.4A2.3 2.3 0 0 1 21 8.8v8.4a2.3 2.3 0 0 1-2.3 2.3H5.3A2.3 2.3 0 0 1 3 17.2z' }),
              h('path', { d: 'M15.2 9.6l.75 2.05 2.05.75-2.05.75-.75 2.05-.75-2.05L12.4 12.4l2.05-.75z' }),
            );
          case 'folder':
            return h('svg', common, h('path', { d: 'M3 6.5A2.5 2.5 0 0 1 5.5 4h3.2l2 2h7.8A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z' }));
          case 'folderOpen':
            return h(
              'svg',
              common,
              h('path', { d: 'M4 8V6.5A2.5 2.5 0 0 1 6.5 4h3.2l2 2h6.8A2.5 2.5 0 0 1 21 8.5V9' }),
              h('path', { d: 'M3.6 10h17.1l-2.1 8.2a2 2 0 0 1-1.9 1.3H6.4a2 2 0 0 1-1.9-1.4z' }),
            );
          case 'folderPlus':
            return h(
              'svg',
              common,
              h('path', { d: 'M3 6.5A2.5 2.5 0 0 1 5.5 4h3.2l2 2h7.8A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z' }),
              h('path', { d: 'M12 11v6M9 14h6' }),
            );
          case 'file':
            return h('svg', common, h('path', { d: 'M6.5 3.5h7l4.5 4.5v12.5h-11.5z' }), h('path', { d: 'M13.5 3.5V8H18' }));
          case 'filePlus':
            return h(
              'svg',
              common,
              h('path', { d: 'M6.5 3.5h7l4.5 4.5v12.5h-11.5z' }),
              h('path', { d: 'M13.5 3.5V8H18M12 11.5v5M9.5 14h5' }),
            );
          case 'edit':
            return h('svg', common, h('path', { d: 'M4 20h4L19 9l-4-4L4 16z' }), h('path', { d: 'M13.5 6.5l4 4' }));
          case 'copy':
            return h('svg', common, h('rect', { x: 9, y: 9, width: 11, height: 11, rx: 2 }), h('path', { d: 'M5 15H4V4h11v1' }));
          case 'cut':
            return h(
              'svg',
              common,
              h('circle', { cx: 6.5, cy: 17.5, r: 2.5 }),
              h('circle', { cx: 17.5, cy: 17.5, r: 2.5 }),
              h('path', { d: 'M8.2 15.6L16 3M15.8 15.6L8 3' }),
            );
          case 'paste':
            return h(
              'svg',
              common,
              h('path', { d: 'M9 4.5h6v3H9z' }),
              h('path', { d: 'M9 6H6.5A1.5 1.5 0 0 0 5 7.5v12A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 17.5 6H15' }),
              h('path', { d: 'M9 12h6M9 16h6' }),
            );
          case 'link':
            return h(
              'svg',
              common,
              h('path', { d: 'M10 13.5a4 4 0 0 0 5.7 0l2.2-2.2a4 4 0 0 0-5.7-5.7l-1.2 1.2' }),
              h('path', { d: 'M14 10.5a4 4 0 0 0-5.7 0l-2.2 2.2a4 4 0 0 0 5.7 5.7l1.2-1.2' }),
            );
          case 'trash':
            return h(
              'svg',
              common,
              h('path', { d: 'M4 7h16' }),
              h('path', { d: 'M9 7V4h6v3' }),
              h('path', { d: 'M6 7l1 13h10l1-13' }),
              h('path', { d: 'M10 11v6M14 11v6' }),
            );
          case 'more':
            return h(
              'svg',
              common,
              h('circle', { cx: 5.5, cy: 12, r: 1.2, fill: 'currentColor', stroke: 'none' }),
              h('circle', { cx: 12, cy: 12, r: 1.2, fill: 'currentColor', stroke: 'none' }),
              h('circle', { cx: 18.5, cy: 12, r: 1.2, fill: 'currentColor', stroke: 'none' }),
            );
          case 'grip':
            return h(
              'svg',
              common,
              ...[
                [9, 6], [15, 6], [9, 12], [15, 12], [9, 18], [15, 18],
              ].map(([cx, cy], index) => h('circle', { key: index, cx, cy, r: 1.05, fill: 'currentColor', stroke: 'none' })),
            );
          case 'move':
            return h(
              'svg',
              common,
              h('path', { d: 'M12 3v18M3 12h18' }),
              h('path', { d: 'M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5' }),
            );
          case 'plus':
            return h('svg', common, h('path', { d: 'M12 5v14M5 12h14' }));
          case 'refresh':
            return h('svg', common, h('path', { d: 'M20 11a8 8 0 1 0-2.3 5.7' }), h('path', { d: 'M20 5v6h-6' }));
          case 'close':
            return h('svg', common, h('path', { d: 'M6 6l12 12M18 6L6 18' }));
          case 'home':
            return h('svg', common, h('path', { d: 'M4 11l8-7 8 7' }), h('path', { d: 'M6 10v10h12V10' }));
          case 'chevronLeft':
            return h('svg', common, h('path', { d: 'M15 5l-7 7 7 7' }));
          case 'chevronRight':
            return h('svg', common, h('path', { d: 'M9 5l7 7-7 7' }));
          case 'chevronDown':
            return h('svg', common, h('path', { d: 'M5 9l7 7 7-7' }));
          case 'restore':
            return h('svg', common, h('path', { d: 'M4 10a8 8 0 1 1 2.3 6.6' }), h('path', { d: 'M4 4v6h6' }));
          case 'check':
            return h('svg', common, h('path', { d: 'M5 13l4 4L19 7' }));
          case 'warning':
            return h('svg', common, h('path', { d: 'M12 3l9 17H3z' }), h('path', { d: 'M12 9v5M12 17.5v.01' }));
          case 'settings':
            return h(
              'svg',
              common,
              h('circle', { cx: 12, cy: 12, r: 3 }),
              h('path', { d: 'M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18' }),
            );
          case 'panel':
            return h(
              'svg',
              common,
              h('rect', { x: 3, y: 4.5, width: 18, height: 15, rx: 2.2 }),
              h('path', { d: 'M14.5 4.5v15' }),
            );
          case 'filesPanel':
            return h(
              'svg',
              common,
              h('rect', { x: 3, y: 4.5, width: 18, height: 15, rx: 2.2 }),
              h('path', { d: 'M14.5 4.5v15' }),
              h('path', { d: 'M6 9h5M6 12h5M6 15h5' }),
            );
          case 'spark':
            return h('svg', common, h('path', { d: 'M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z' }));
          default:
            return h('svg', common, h('circle', { cx: 12, cy: 12, r: 8 }));
        }
      }

      /** The guide's fallback artwork: a line-art folder with a spark. */
      function FilesGuideArtwork({ size = 26 }) {
        return h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': true,
          },
          h('path', { d: 'M3 6.8A2.3 2.3 0 0 1 5.3 4.5h3l2 2h8.4A2.3 2.3 0 0 1 21 8.8v8.4a2.3 2.3 0 0 1-2.3 2.3H5.3A2.3 2.3 0 0 1 3 17.2z' }),
          h('path', { d: 'M15.2 9.6l.75 2.05 2.05.75-2.05.75-.75 2.05-.75-2.05L12.4 12.4l2.05-.75z' }),
        );
      }

      // ------------------------------------------------------------------
      // Small shared UI
      // ------------------------------------------------------------------

      function MiniMenu(props) {
        const { x, y, items, onClose } = props;
        const width = 224;
        const rows = items.filter((item) => item.separator !== true).length;
        const separators = items.length - rows;
        const height = 10 + rows * 29 + separators * 9;
        const left = Math.max(8, Math.min(x, (window.innerWidth || 1024) - width - 8));
        const top = Math.max(8, Math.min(y, (window.innerHeight || 768) - height - 8));
        return h(
          React.Fragment,
          null,
          h('div', { className: 'dsh-fk-scrim', onClick: onClose, onContextMenu: (event) => { event.preventDefault(); onClose(); } }),
          h(
            'div',
            { className: 'dsh-fk-menu', role: 'menu', style: { left, top, width } },
            items.map((item, index) => {
              if (item.separator === true) return h('div', { key: `sep-${index}`, className: 'dsh-fk-menusep', role: 'separator' });
              return h(
                'button',
                {
                  key: `${index}-${item.label}`,
                  type: 'button',
                  role: 'menuitem',
                  'data-danger': item.danger === true,
                  disabled: item.disabled === true,
                  onClick: () => {
                    onClose();
                    item.onSelect();
                  },
                },
                item.icon !== undefined ? h(Icon, { name: item.icon, size: 14 }) : null,
                h('span', { className: 'dsh-fk-menulabel' }, item.label),
              );
            }),
          ),
        );
      }

      function ToolButton({ icon, label, onClick, disabled = false, primary = false }) {
        return h(
          'button',
          {
            type: 'button',
            className: primary === true ? 'dsh-fk-btn dsh-fk-btn-primary' : 'dsh-fk-btn',
            title: label,
            'aria-label': label,
            disabled,
            onClick,
          },
          icon !== undefined ? h(Icon, { name: icon, size: 14 }) : null,
          h('span', null, label),
        );
      }

      function IconButton({ icon, label, onClick, danger = false, disabled = false, onContextMenu }) {
        return h(
          'button',
          {
            type: 'button',
            className: 'dsh-fk-iconbtn',
            title: label,
            'aria-label': label,
            'data-danger': danger === true,
            disabled,
            onClick,
            onContextMenu,
          },
          h(Icon, { name: icon, size: 15 }),
        );
      }

      function Dialog({ title, children, footer, onClose, wide = false }) {
        return h(
          'div',
          {
            className: 'dsh-fk-dialogwrap',
            onMouseDown: (event) => {
              if (event.target === event.currentTarget) onClose();
            },
          },
          h(
            'div',
            { className: wide === true ? 'dsh-fk-dialog dsh-fk-dialog-wide' : 'dsh-fk-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': title },
            h('div', { className: 'dsh-fk-dialogtitle' }, title),
            h('div', { className: 'dsh-fk-dialogbody' }, children),
            h('div', { className: 'dsh-fk-dialogfoot' }, footer),
          ),
        );
      }

      function TextDialog({ title, label, initial = '', placeholder = '', confirmText, onSubmit, onClose }) {
        const [value, setValue] = React.useState(initial);
        const [busy, setBusy] = React.useState(false);
        const [error, setError] = React.useState('');
        const inputRef = React.useRef(null);
        React.useEffect(() => {
          const timer = setTimeout(() => inputRef.current?.focus?.(), 30);
          return () => clearTimeout(timer);
        }, []);
        const submit = async (event) => {
          event?.preventDefault?.();
          if (busy) return;
          const name = value.trim();
          if (name === '') {
            setError(t('error.bad-name'));
            return;
          }
          setBusy(true);
          setError('');
          try {
            const ok = await onSubmit(name);
            if (ok === true) onClose();
          } catch (failure) {
            setError(errorText(failure));
          } finally {
            setBusy(false);
          }
        };
        return h(
          Dialog,
          {
            title,
            onClose,
            footer: [
              h('button', { key: 'cancel', type: 'button', className: 'dsh-fk-btn', onClick: onClose }, t('cancel')),
              h(
                'button',
                { key: 'go', type: 'submit', form: 'dsh-fk-text-form', className: 'dsh-fk-btn dsh-fk-btn-primary', disabled: busy },
                busy ? t('saving') : confirmText,
              ),
            ],
          },
          h(
            'form',
            { id: 'dsh-fk-text-form', className: 'dsh-fk-form', onSubmit: submit },
            h('label', { className: 'dsh-fk-label' }, label),
            h('input', {
              ref: inputRef,
              className: 'dsh-fk-input',
              value,
              placeholder,
              spellCheck: false,
              onChange: (event) => setValue(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') submit(event);
              },
            }),
            error !== '' ? h('p', { className: 'dsh-fk-error' }, error) : null,
          ),
        );
      }

      function ConfirmDialog({ title, text, hint, danger = false, confirmText, onConfirm, onClose }) {
        const [busy, setBusy] = React.useState(false);
        const [error, setError] = React.useState('');
        const run = async () => {
          if (busy) return;
          setBusy(true);
          setError('');
          try {
            const ok = await onConfirm();
            if (ok === true) onClose();
          } catch (failure) {
            setError(errorText(failure));
          } finally {
            setBusy(false);
          }
        };
        return h(
          Dialog,
          {
            title,
            onClose,
            footer: [
              h('button', { key: 'cancel', type: 'button', className: 'dsh-fk-btn', onClick: onClose }, t('cancel')),
              h(
                'button',
                {
                  key: 'go',
                  type: 'button',
                  className: danger === true ? 'dsh-fk-btn dsh-fk-btn-danger' : 'dsh-fk-btn dsh-fk-btn-primary',
                  disabled: busy,
                  onClick: run,
                },
                busy ? t('saving') : confirmText,
              ),
            ],
          },
          h('p', { className: 'dsh-fk-dialogtext' }, text),
          hint !== undefined ? h('p', { className: 'dsh-fk-hint' }, hint) : null,
          error !== '' ? h('p', { className: 'dsh-fk-error' }, error) : null,
        );
      }

      // ------------------------------------------------------------------
      // Move dialog
      // ------------------------------------------------------------------

      function MoveDialog({ root, rel, sourceIsDir = false, onMove, onClose }) {
        const sourceDir = dirOf(rel);
        const [cwd, setCwd] = React.useState(sourceDir);
        const [dirs, setDirs] = React.useState([]);
        const [loading, setLoading] = React.useState(true);
        const [error, setError] = React.useState('');
        const [busy, setBusy] = React.useState(false);

        React.useEffect(() => {
          let dead = false;
          setLoading(true);
          setError('');
          api('list', { root, path: cwd })
            .then((data) => {
              if (dead) return;
              setDirs(data.entries.filter((entry) => entry.kind === 'directory' && !isHiddenEntry(entry.name)));
              setLoading(false);
            })
            .catch((failure) => {
              if (dead) return;
              setError(errorText(failure));
              setLoading(false);
            });
          return () => {
            dead = true;
          };
        }, [root, cwd]);

        const invalidTarget = cwd === sourceDir || (sourceIsDir && (cwd === rel || cwd.startsWith(rel + '/')));

        const move = async () => {
          if (busy || invalidTarget) return;
          setBusy(true);
          setError('');
          try {
            const ok = await onMove(cwd);
            if (ok === true) onClose();
          } catch (failure) {
            setError(errorText(failure));
          } finally {
            setBusy(false);
          }
        };

        const parts = cwd === '' ? [] : cwd.split('/');
        return h(
          Dialog,
          {
            title: t('moveTo'),
            onClose,
            wide: true,
            footer: [
              h('button', { key: 'cancel', type: 'button', className: 'dsh-fk-btn', onClick: onClose }, t('cancel')),
              h(
                'button',
                {
                  key: 'go',
                  type: 'button',
                  className: 'dsh-fk-btn dsh-fk-btn-primary',
                  disabled: busy || invalidTarget,
                  onClick: move,
                },
                busy ? t('saving') : t('moveHere'),
              ),
            ],
          },
          h(
            'div',
            { className: 'dsh-fk-crumbs dsh-fk-dialog-crumbs' },
            h('button', { type: 'button', className: 'dsh-fk-crumb', title: root, onClick: () => setCwd('') }, h(Icon, { name: 'home', size: 13 }), workspaceName(root)),
            parts.map((segment, index) =>
              h(
                React.Fragment,
                { key: `${index}-${segment}` },
                h(Icon, { name: 'chevronLeft', size: 11 }),
                h('button', { type: 'button', className: 'dsh-fk-crumb', onClick: () => setCwd(parts.slice(0, index + 1).join('/')) }, segment),
              ),
            ),
          ),
          h('p', { className: 'dsh-fk-hint' }, t('chooseDir')),
          h(
            'div',
            { className: 'dsh-fk-picklist' },
            cwd !== ''
              ? h(
                  'button',
                  { type: 'button', className: 'dsh-fk-pickrow', onClick: () => setCwd(dirOf(cwd)) },
                  h(Icon, { name: 'chevronLeft', size: 14 }),
                  h('span', null, t('parentDir')),
                )
              : null,
            loading ? h('p', { className: 'dsh-fk-hint' }, t('loading')) : null,
            !loading && dirs.length === 0 ? h('p', { className: 'dsh-fk-hint' }, t('noSubdirs')) : null,
            dirs.map((entry) =>
              h(
                'button',
                { key: entry.path, type: 'button', className: 'dsh-fk-pickrow', onClick: () => setCwd(entry.path) },
                h(Icon, { name: 'folder', size: 14 }),
                h('span', null, entry.name),
              ),
            ),
          ),
          error !== '' ? h('p', { className: 'dsh-fk-error' }, error) : null,
        );
      }

      // ------------------------------------------------------------------
      // Drag helpers
      // ------------------------------------------------------------------

      function canDropInto(source, toDir) {
        if (source === null) return false;
        if (toDir === source.rel) return false;
        if (source.kind === 'directory' && toDir.startsWith(source.rel + '/')) return false;
        return dirOf(source.rel) !== toDir;
      }

      // ------------------------------------------------------------------
      // FileKit manager (the `filekit` page)
      // ------------------------------------------------------------------

      function FileKitTab(props) {
        const { useTabInfo, sessionId, inputActions } = props;
        const { tab } = useTabInfo();
        const [root, setRoot] = React.useState('');
        const [rootError, setRootError] = React.useState('');
        const [attempt, setAttempt] = React.useState(0);

        React.useEffect(() => {
          if (typeof sessionId !== 'string' || sessionId === '') return undefined;
          let dead = false;
          setRoot('');
          setRootError('');
          api('workspace', { sessionId })
            .then((data) => {
              if (!dead) setRoot(data.root);
            })
            .catch((failure) => {
              if (!dead) setRootError(errorText(failure));
            });
          return () => {
            dead = true;
          };
        }, [sessionId, attempt]);

        if (root === '' && rootError === '') {
          return h('div', { className: 'dsh-fk-tabstatus' }, h('p', { className: 'dsh-fk-hint' }, t('loading')));
        }
        if (root === '') {
          return h(
            'div',
            { className: 'dsh-fk-tabstatus' },
            h('p', { className: 'dsh-fk-error' }, rootError),
            h('button', { type: 'button', className: 'dsh-fk-btn', onClick: () => setAttempt((value) => value + 1) }, t('retry')),
          );
        }
        return h(FileKitManager, { root, sessionId, inputActions, tab });
      }

      function FileKitManager({ root, sessionId, inputActions, tab }) {
        const [cwd, setCwd] = React.useState('');
        const [entries, setEntries] = React.useState([]);
        const [loading, setLoading] = React.useState(false);
        const [listError, setListError] = React.useState('');
        const [reload, setReload] = React.useState(0);
        const [view, setView] = React.useState('browse');
        const [trashEntries, setTrashEntries] = React.useState([]);
        const [trashLoading, setTrashLoading] = React.useState(false);
        const [editor, setEditor] = React.useState(null);
        const [draft, setDraft] = React.useState('');
        const [saving, setSaving] = React.useState(false);
        const [dialog, setDialog] = React.useState(null);
        const [selected, setSelected] = React.useState(null);
        const [menu, setMenu] = React.useState(null);
        const [notice, setNotice] = React.useState(null);
        const [dragging, setDragging] = React.useState(null);
        const [dropDir, setDropDir] = React.useState(null);
        const settingsSnapshot = useSettings();
        const clipboard = useFileClipboard();
        const canPaste = clipboard !== null && clipboard.root === root;
        const navigation = tab.navigation;
        const editorRef = React.useRef(null);
        const draftRef = React.useRef('');
        const savingRef = React.useRef(false);
        const saveRef = React.useRef(null);
        const draggingRef = React.useRef(null);
        const appliedRevisionRef = React.useRef(0);
        editorRef.current = editor;
        draftRef.current = draft;

        const dirty = editor !== null && draft !== editor.original;

        React.useEffect(() => {
          lastTabActions = tab.actions;
        }, [tab.actions]);

        React.useEffect(() => {
          setTabDirty(tab.id, dirty);
          return () => setTabDirty(tab.id, false);
        }, [tab.id, dirty]);

        React.useEffect(() => {
          if (notice === null) return undefined;
          const timer = setTimeout(() => setNotice(null), 5000);
          return () => clearTimeout(timer);
        }, [notice]);

        const loadEditor = React.useCallback(
          (rel) => {
            setMenu(null);
            setDialog(null);
            openEditorTab(sessionId, rel);
          },
          [sessionId],
        );

        const refresh = React.useCallback(() => setReload((value) => value + 1), []);

        React.useEffect(() => {
          if (root === '' || view !== 'browse') return undefined;
          let dead = false;
          setLoading(true);
          setListError('');
          api('list', { root, path: cwd, sessionId })
            .then((data) => {
              if (dead) return;
              setEntries(data.entries);
              setLoading(false);
            })
            .catch((failure) => {
              if (dead) return;
              setListError(errorText(failure));
              setLoading(false);
            });
          return () => {
            dead = true;
          };
        }, [root, cwd, view, reload, sessionId]);

        React.useEffect(() => {
          if (root === '' || view !== 'trash') return undefined;
          let dead = false;
          setTrashLoading(true);
          api('trashList', { root, sessionId })
            .then((data) => {
              if (dead) return;
              setTrashEntries(data.entries);
              setTrashLoading(false);
            })
            .catch((failure) => {
              if (dead) return;
              setNotice({ kind: 'error', text: errorText(failure) });
              setTrashLoading(false);
            });
          return () => {
            dead = true;
          };
        }, [root, view, reload, sessionId]);

        // Auto refresh the current folder.
        React.useEffect(() => {
          if (root === '' || view !== 'browse' || settingsSnapshot.autoRefreshSeconds <= 0) return undefined;
          const timer = setInterval(() => {
            if (document.visibilityState === 'hidden' || editorRef.current !== null) return;
            refresh();
          }, settingsSnapshot.autoRefreshSeconds * 1000);
          return () => clearInterval(timer);
        }, [root, view, settingsSnapshot.autoRefreshSeconds, refresh]);

        // Page-refresh shortcut.
        React.useEffect(() => {
          if (typeof tab.actions?.bindCommands !== 'function') return undefined;
          return tab.actions.bindCommands({ refresh: () => refresh() });
        }, [tab.actions, refresh]);

        // Apply navigation params (open editor, trash view, folder).
        React.useEffect(() => {
          if (root === '' || navigation === undefined) return;
          const revision = navigation.revision ?? 0;
          if (revision === appliedRevisionRef.current) return;
          appliedRevisionRef.current = revision;
          const params = navigation.params;
          if (params === undefined || params === null) return;
          if (dirty && typeof params.rel === 'string' && params.rel !== '') {
            showToast(t('saveBeforeSwitch'), 'error');
            return;
          }
          if (params.view === 'trash') {
            setView('trash');
            return;
          }
          setView('browse');
          if (typeof params.dir === 'string') {
            setCwd(params.dir);
          } else if (typeof params.rel === 'string' && params.rel !== '') {
            setCwd(dirOf(params.rel));
          }
          if (typeof params.rel !== 'string' || params.rel === '') return;
          const action = params.action;
          if (action === 'edit') loadEditor(params.rel);
          else if (action === 'rename') setDialog({ kind: 'rename', rel: params.rel });
          else if (action === 'move') setDialog({ kind: 'move', rel: params.rel });
          else if (action === 'delete') setDialog({ kind: 'delete', rel: params.rel });
          else setSelected(params.rel);
        }, [root, navigation, dirty, loadEditor]);

        const succeed = (text) => {
          setNotice({ kind: 'ok', text });
          refresh();
          setMenu(null);
        };

        const mutate = async (action, successText) => {
          if (root === '') return false;
          try {
            const result = await action();
            succeed(typeof successText === 'function' ? successText(result) : successText);
            return true;
          } catch (failure) {
            setNotice({ kind: 'error', text: errorText(failure) });
            return false;
          }
        };

        /** Paste the FileKit clipboard into one directory; a taken name gets " (n)". */
        const pasteInto = async (toDir) => {
          const clip = fileClipboard;
          if (clip === null || clip.root !== root) return false;
          const ok = await mutate(
            () => api(clip.mode === 'cut' ? 'move' : 'copy', { root, path: clip.rel, toDir, unique: true, sessionId }),
            (result) => t('pastedTo', { path: result.path }),
          );
          if (ok && clip.mode === 'cut') setFileClipboard(null);
          return ok;
        };

        const copyRelPath = async (rel) => {
          const ok = await copyText(rel);
          showToast(ok ? t('copiedPath') : t('error.internal'), ok ? 'ok' : 'error');
        };

        const copyAbsPath = async (rel) => {
          const ok = await copyText(joinAbs(root, rel));
          showToast(ok ? t('copiedPath') : t('error.internal'), ok ? 'ok' : 'error');
        };

        const referenceRel = async (rel) => {
          const text = `@${rel} `;
          if (inputActions !== undefined && typeof inputActions.captureInsertion === 'function' && typeof inputActions.insertText === 'function') {
            try {
              const span = inputActions.captureInsertion();
              if (inputActions.insertText(text, span) === true) {
                inputActions.persistDraft?.();
                showToast(t('referenced'));
                return;
              }
            } catch {
              /* fall back to the clipboard */
            }
          }
          const ok = await copyText(text);
          showToast(ok ? t('referencedCopied') : t('error.internal'), ok ? 'ok' : 'error');
        };

        const openPreview = (rel) => {
          if (typeof tab.actions?.openResource !== 'function') return;
          try {
            tab.actions.openResource(fileAddress(sessionId, rel));
          } catch (failure) {
            showToast(errorText(failure), 'error');
          }
        };

        const discardEditor = () => {
          setEditor(null);
          setDraft('');
        };

        const closeEditor = () => {
          if (dirty) {
            setDialog({ kind: 'discard', after: 'editor' });
            return;
          }
          discardEditor();
        };

        const saveEditor = async () => {
          const current = editorRef.current;
          const text = draftRef.current;
          if (current === null || savingRef.current || current.truncated || text === current.original) return;
          savingRef.current = true;
          setSaving(true);
          try {
            const data = await api('write', {
              root,
              path: current.rel,
              content: text,
              expectedMtimeMs: current.mtimeMs,
              sessionId,
            });
            setEditor({ ...current, original: text, mtimeMs: data.mtimeMs, size: data.size });
            setNotice({ kind: 'ok', text: t('saved') });
            refresh();
          } catch (failure) {
            setNotice({ kind: 'error', text: errorText(failure) });
          } finally {
            savingRef.current = false;
            setSaving(false);
          }
        };
        saveRef.current = saveEditor;

        React.useEffect(() => {
          const onKeyDown = (event) => {
            if (event.key === 'Escape') {
              if (menu !== null) {
                setMenu(null);
                return;
              }
              if (dialog !== null) {
                setDialog(null);
                return;
              }
              if (editorRef.current !== null) {
                if (draftRef.current !== editorRef.current.original) setDialog({ kind: 'discard', after: 'editor' });
                else discardEditor();
              }
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && editorRef.current !== null) {
              event.preventDefault();
              saveRef.current?.();
            }
          };
          window.addEventListener('keydown', onKeyDown);
          return () => window.removeEventListener('keydown', onKeyDown);
        }, [menu, dialog]);

        const nameById = (rel) => baseOf(rel);

        const openRowMenu = (event, entry) => {
          event.preventDefault();
          event.stopPropagation();
          setMenu({ x: event.clientX, y: event.clientY, rel: entry.path, kind: entry.kind, name: entry.name });
        };

        const openBlankMenu = (event) => {
          if (typeof event.target.closest === 'function' && event.target.closest('.dsh-fk-row, .dsh-fk-trow') !== null) return;
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY, rel: null, kind: 'directory' });
        };

        const startDrag = (event, entry) => {
          event.stopPropagation();
          draggingRef.current = { rel: entry.path, kind: entry.kind };
          setDragging(draggingRef.current);
          try {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', entry.path);
          } catch {
            /* some browsers refuse the drag payload; the ref still carries it */
          }
        };

        const endDrag = () => {
          draggingRef.current = null;
          setDragging(null);
          setDropDir(null);
        };

        const moveRow = async (rel, kind, toDir) => {
          if (!canDropInto({ rel, kind }, toDir)) {
            setDropDir(null);
            return;
          }
          setDropDir(null);
          await mutate(() => api('move', { root, path: rel, toDir, sessionId }), t('moved'));
        };

        // ----- dialogs ---------------------------------------------------
        const dialogNodes = [];
        if (dialog !== null) {
          if (dialog.kind === 'create-file' || dialog.kind === 'create-dir') {
            const isDir = dialog.kind === 'create-dir';
            const targetDir = typeof dialog.dir === 'string' ? dialog.dir : cwd;
            dialogNodes.push(
              h(TextDialog, {
                key: isDir ? 'create-dir' : 'create-file',
                title: isDir ? t('newDir') : t('newFile'),
                label: t('name'),
                initial: '',
                placeholder: isDir ? 'assets' : 'notes.md',
                confirmText: t('create'),
                onClose: () => setDialog(null),
                onSubmit: (name) =>
                  mutate(
                    () => api('create', { root, path: joinRel(targetDir, name), kind: isDir ? 'directory' : 'file', sessionId }),
                    t('created'),
                  ),
              }),
            );
          } else if (dialog.kind === 'rename') {
            dialogNodes.push(
              h(TextDialog, {
                key: 'rename',
                title: t('rename'),
                label: t('newName'),
                initial: nameById(dialog.rel),
                confirmText: t('rename'),
                onClose: () => setDialog(null),
                onSubmit: (name) => mutate(() => api('rename', { root, path: dialog.rel, name, sessionId }), t('renamed')),
              }),
            );
          } else if (dialog.kind === 'move') {
            dialogNodes.push(
              h(MoveDialog, {
                key: 'move',
                root,
                rel: dialog.rel,
                sourceIsDir: dialog.entryKind === 'directory',
                onClose: () => setDialog(null),
                onMove: (toDir) => mutate(() => api('move', { root, path: dialog.rel, toDir, sessionId }), t('moved')),
              }),
            );
          } else if (dialog.kind === 'delete') {
            dialogNodes.push(
              h(ConfirmDialog, {
                key: 'delete',
                title: t('deleteTitle'),
                text: dialog.rel,
                hint: t('deleteHint', { trash: DSH_TRASH }),
                danger: true,
                confirmText: t('deleteConfirm'),
                onClose: () => setDialog(null),
                onConfirm: async () => {
                  const ok = await mutate(() => api('delete', { root, path: dialog.rel, sessionId }), t('deleted'));
                  if (ok && editor !== null && editor.rel === dialog.rel) discardEditor();
                  return ok;
                },
              }),
            );
          } else if (dialog.kind === 'purge') {
            dialogNodes.push(
              h(ConfirmDialog, {
                key: 'purge',
                title: t('purgeTitle'),
                text: dialog.entry?.name ?? dialog.id,
                hint: t('purgeHint'),
                danger: true,
                confirmText: t('purgeConfirm'),
                onClose: () => setDialog(null),
                onConfirm: () => mutate(() => api('purge', { root, id: dialog.id, sessionId }), t('purged')),
              }),
            );
          } else if (dialog.kind === 'empty-trash') {
            dialogNodes.push(
              h(ConfirmDialog, {
                key: 'empty-trash',
                title: t('emptyTitle'),
                text: t('emptyHint'),
                danger: true,
                confirmText: t('emptyConfirm'),
                onClose: () => setDialog(null),
                onConfirm: () => mutate(() => api('emptyTrash', { root, sessionId }), t('emptied')),
              }),
            );
          } else if (dialog.kind === 'discard') {
            dialogNodes.push(
              h(ConfirmDialog, {
                key: 'discard',
                title: t('discardTitle'),
                text: t('dirty'),
                danger: true,
                confirmText: t('discardConfirm'),
                onClose: () => setDialog(null),
                onConfirm: () => {
                  discardEditor();
                  return true;
                },
              }),
            );
          }
        }

        // ----- recycle bin view -----------------------------------------
        const trashView = h(
          React.Fragment,
          null,
          h(
            'div',
            { className: 'dsh-fk-toolbar' },
            h(
              'div',
              { className: 'dsh-fk-crumbs' },
              h(
                'button',
                { type: 'button', className: 'dsh-fk-crumb', onClick: () => setView('browse'), title: t('trash') },
                h(Icon, { name: 'chevronLeft', size: 13 }),
                t('rootLabel'),
              ),
              h('span', { className: 'dsh-fk-crumb-sep' }, '/'),
              h('span', { className: 'dsh-fk-crumb dsh-fk-crumb-current' }, t('trash')),
            ),
            h(
              'div',
              { className: 'dsh-fk-toolbar-actions' },
              h(ToolButton, {
                icon: 'trash',
                label: t('purge'),
                disabled: trashEntries.length === 0,
                onClick: () => setDialog({ kind: 'empty-trash' }),
              }),
              h(ToolButton, { icon: 'refresh', label: t('refresh'), onClick: refresh }),
            ),
          ),
          h(
            'div',
            { className: 'dsh-fk-body' },
            trashLoading ? h('p', { className: 'dsh-fk-hint dsh-fk-center' }, t('loading')) : null,
            !trashLoading && trashEntries.length === 0 ? h('p', { className: 'dsh-fk-hint dsh-fk-center' }, t('trashEmpty')) : null,
            trashEntries.map((entry) =>
              h(
                'div',
                { key: entry.id, className: 'dsh-fk-row dsh-fk-row-static' },
                h('span', { className: 'dsh-fk-rowicon' }, h(Icon, { name: 'trash', size: 15 })),
                h(
                  'span',
                  { className: 'dsh-fk-rowmain' },
                  h('span', { className: 'dsh-fk-rowname' }, entry.name ?? entry.id),
                  h('span', { className: 'dsh-fk-rowpath', title: entry.originalPath }, entry.originalPath),
                ),
                h('span', { className: 'dsh-fk-rowmeta' }, entry.deletedAt ? new Date(entry.deletedAt).toLocaleString() : ''),
                h(IconButton, {
                  icon: 'restore',
                  label: t('restore'),
                  onClick: async () => {
                    const ok = await mutate(() => api('restore', { root, id: entry.id, sessionId }), t('restored'));
                    if (ok) setView('browse');
                  },
                }),
                h(IconButton, {
                  icon: 'trash',
                  label: t('purge'),
                  danger: true,
                  onClick: () => setDialog({ kind: 'purge', id: entry.id, entry }),
                }),
              ),
            ),
          ),
        );

        // ----- editor view ----------------------------------------------
        const editorView =
          editor !== null
            ? h(
                React.Fragment,
                null,
                h(
                  'div',
                  { className: 'dsh-fk-toolbar' },
                  h(
                    'div',
                    { className: 'dsh-fk-crumbs' },
                    h(
                      'button',
                      { type: 'button', className: 'dsh-fk-crumb', onClick: closeEditor, title: t('back') },
                      h(Icon, { name: 'chevronLeft', size: 13 }),
                      t('back'),
                    ),
                    h('span', { className: 'dsh-fk-crumb-sep' }, '/'),
                    h('span', { className: 'dsh-fk-crumb dsh-fk-crumb-current', title: joinAbs(root, editor.rel) }, editor.rel),
                    dirty ? h('span', { className: 'dsh-fk-badge' }, t('dirty')) : null,
                  ),
                  h(
                    'div',
                    { className: 'dsh-fk-toolbar-actions' },
                    h(ToolButton, { icon: 'copy', label: t('copyRel'), onClick: () => copyRelPath(editor.rel) }),
                    h(ToolButton, { icon: 'link', label: t('reference'), onClick: () => referenceRel(editor.rel) }),
                    dirty
                      ? h(ToolButton, {
                          icon: 'close',
                          label: t('discard'),
                          onClick: () => setDialog({ kind: 'discard', after: 'editor' }),
                        })
                      : null,
                    h(ToolButton, {
                      icon: 'check',
                      label: saving ? t('saving') : t('save'),
                      primary: true,
                      disabled: saving || !dirty || editor.truncated,
                      onClick: saveEditor,
                    }),
                  ),
                ),
                h(
                  'div',
                  { className: 'dsh-fk-editor' },
                  editor.truncated ? h('p', { className: 'dsh-fk-warn' }, h(Icon, { name: 'warning', size: 14 }), t('truncated')) : null,
                  h(CodeEditor, {
                    value: draft,
                    onChange: setDraft,
                    rel: editor.rel,
                    fontSize: settingsSnapshot.editorFontSize,
                    readOnly: editor.truncated,
                  }),
                  h(
                    'div',
                    { className: 'dsh-fk-editor-meta' },
                    h('span', null, `${formatBytes(editor.size)}${dirty ? ` → ${formatBytes(new TextEncoder().encode(draft).length)}` : ''}`),
                    h('span', { className: 'dsh-fk-spacer' }),
                    h('span', null, t('modified')),
                    h('span', null, new Date(editor.mtimeMs).toLocaleString()),
                  ),
                ),
              )
            : null;

        // ----- browse view ----------------------------------------------
        const parts = cwd === '' ? [] : cwd.split('/');
        const rows = entries
          .filter((entry) => !isHiddenEntry(entry.name))
          .map((entry) =>
            h(
              'div',
              {
                key: entry.path,
                className: 'dsh-fk-row',
                'data-kind': entry.kind,
                'data-menu': menu !== null && menu.rel === entry.path,
                'data-drop': dropDir === entry.path,
                tabIndex: 0,
                draggable: true,
                onDragStart: (event) => startDrag(event, entry),
                onDragEnd: endDrag,
                onDragOver:
                  entry.kind === 'directory'
                    ? (event) => {
                        if (!canDropInto(draggingRef.current, entry.path)) return;
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = 'move';
                        setDropDir(entry.path);
                      }
                    : undefined,
                onDragLeave:
                  entry.kind === 'directory'
                    ? (event) => {
                        if (event.currentTarget.contains(event.relatedTarget)) return;
                        if (dropDir === entry.path) setDropDir(null);
                      }
                    : undefined,
                onDrop:
                  entry.kind === 'directory'
                    ? (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const source = draggingRef.current;
                        endDrag();
                        if (canDropInto(source, entry.path)) void moveRow(source.rel, source.kind, entry.path);
                      }
                    : undefined,
                onClick: () => {
                  if (entry.kind === 'directory') {
                    setCwd(entry.path);
                    setMenu(null);
                  } else {
                    loadEditor(entry.path);
                  }
                },
                onContextMenu: (event) => openRowMenu(event, entry),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (entry.kind === 'directory') setCwd(entry.path);
                    else loadEditor(entry.path);
                  }
                },
                title: entry.path,
              },
              h('span', { className: 'dsh-fk-rowicon', 'data-kind': entry.kind }, h(Icon, { name: entry.kind === 'directory' ? 'folder' : 'file', size: 15 })),
              h('span', { className: 'dsh-fk-rowname' }, entry.name),
              h('span', { className: 'dsh-fk-rowmeta' }, entry.kind === 'file' ? formatBytes(entry.size) : ''),
              h(
                'span',
                { className: 'dsh-fk-rowactions' },
                h(IconButton, {
                  icon: 'link',
                  label: t('reference'),
                  onClick: (event) => {
                    event.stopPropagation();
                    referenceRel(entry.path);
                  },
                }),
                h(IconButton, {
                  icon: 'more',
                  label: t('open'),
                  onClick: (event) => openRowMenu(event, entry),
                }),
              ),
            ),
          );

        const browseView = h(
          React.Fragment,
          null,
          h(
            'div',
            { className: 'dsh-fk-toolbar' },
            h(
              'div',
              { className: 'dsh-fk-crumbs' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-fk-crumb',
                  title: root,
                  onClick: () => setCwd(''),
                  onDragOver: (event) => {
                    if (!canDropInto(draggingRef.current, '')) return;
                    event.preventDefault();
                    setDropDir('');
                  },
                  onDrop: (event) => {
                    event.preventDefault();
                    const source = draggingRef.current;
                    endDrag();
                    if (canDropInto(source, '')) void moveRow(source.rel, source.kind, '');
                  },
                  'data-drop': dropDir === '',
                },
                h(Icon, { name: 'home', size: 13 }),
                workspaceName(root),
              ),
              parts.map((segment, index) =>
                h(
                  React.Fragment,
                  { key: `${index}-${segment}` },
                  h(Icon, { name: 'chevronLeft', size: 11 }),
                  h(
                    'button',
                    { type: 'button', className: 'dsh-fk-crumb', onClick: () => setCwd(parts.slice(0, index + 1).join('/')) },
                    segment,
                  ),
                ),
              ),
            ),
            h(
              'div',
              { className: 'dsh-fk-toolbar-actions' },
              h(ToolButton, { icon: 'filePlus', label: t('newFile'), onClick: () => setDialog({ kind: 'create-file' }) }),
              h(ToolButton, { icon: 'folderPlus', label: t('newDir'), onClick: () => setDialog({ kind: 'create-dir' }) }),
              h(ToolButton, { icon: 'trash', label: t('trash'), onClick: () => setView('trash') }),
              h(ToolButton, { icon: 'refresh', label: t('refresh'), onClick: refresh }),
            ),
          ),
          h(
            'div',
            {
              className: 'dsh-fk-body',
              onContextMenu: openBlankMenu,
              onDragOver: (event) => {
                if (typeof event.target.closest === 'function' && event.target.closest('.dsh-fk-row') !== null) return;
                if (!canDropInto(draggingRef.current, cwd)) return;
                event.preventDefault();
                setDropDir(cwd);
              },
              onDragLeave: (event) => {
                if (event.currentTarget.contains(event.relatedTarget)) return;
                if (dropDir === cwd) setDropDir(null);
              },
              onDrop: (event) => {
                if (typeof event.target.closest === 'function' && event.target.closest('.dsh-fk-row') !== null) return;
                event.preventDefault();
                const source = draggingRef.current;
                endDrag();
                if (canDropInto(source, cwd)) void moveRow(source.rel, source.kind, cwd);
              },
            },
            loading ? h('p', { className: 'dsh-fk-hint dsh-fk-center' }, t('loading')) : null,
            !loading && listError !== '' ? h('p', { className: 'dsh-fk-error dsh-fk-center' }, listError) : null,
            !loading && listError === '' && rows.length === 0 ? h('p', { className: 'dsh-fk-hint dsh-fk-center' }, t('empty')) : null,
            rows,
          ),
        );

        // ----- row menu content -----------------------------------------
        let menuItems = [];
        if (menu !== null) {
          if (menu.rel === null) {
            menuItems = [
              ...(canPaste ? [{ label: t('paste'), icon: 'paste', onSelect: () => pasteInto(cwd) }] : []),
              { label: t('newFile'), onSelect: () => setDialog({ kind: 'create-file' }) },
              { label: t('newDir'), onSelect: () => setDialog({ kind: 'create-dir' }) },
              { separator: true },
              { label: t('refresh'), onSelect: refresh },
            ];
          } else {
            menuItems = [
              ...(menu.kind === 'file' ? [{ label: t('edit'), icon: 'edit', onSelect: () => loadEditor(menu.rel) }] : []),
              ...(menu.kind === 'file' ? [{ label: t('openPreview'), icon: 'file', onSelect: () => openPreview(menu.rel) }] : []),
              ...(menu.kind === 'directory' ? [{ label: t('newFileHere'), icon: 'filePlus', onSelect: () => setDialog({ kind: 'create-file', dir: menu.rel }) }] : []),
              ...(menu.kind === 'directory' ? [{ label: t('newDirHere'), icon: 'folderPlus', onSelect: () => setDialog({ kind: 'create-dir', dir: menu.rel }) }] : []),
              ...(menu.kind === 'directory' ? [{ separator: true }] : []),
              ...(menu.kind === 'directory'
                ? [{ label: t('pasteHere'), icon: 'paste', disabled: !canPaste, onSelect: () => pasteInto(menu.rel) }]
                : []),
              { separator: true },
              { label: t('rename'), icon: 'edit', onSelect: () => setDialog({ kind: 'rename', rel: menu.rel }) },
              { label: t('move'), icon: 'folder', onSelect: () => setDialog({ kind: 'move', rel: menu.rel, entryKind: menu.kind }) },
              { label: t('copy'), icon: 'copy', onSelect: () => copyToFileClipboard(root, menu.rel, menu.kind, 'copy') },
              { label: t('cut'), icon: 'cut', onSelect: () => copyToFileClipboard(root, menu.rel, menu.kind, 'cut') },
              { separator: true },
              { label: t('copyRel'), icon: 'copy', onSelect: () => copyRelPath(menu.rel) },
              { label: t('copyAbs'), icon: 'copy', onSelect: () => copyAbsPath(menu.rel) },
              { label: t('reference'), icon: 'link', onSelect: () => referenceRel(menu.rel) },
              { separator: true },
              {
                label: t('delete'),
                icon: 'trash',
                danger: true,
                onSelect: () => {
                  if (settingsSnapshot.confirmDelete) setDialog({ kind: 'delete', rel: menu.rel });
                  else mutate(() => api('delete', { root, path: menu.rel, sessionId }), t('deleted'));
                },
              },
            ];
          }
        }

        const menuNode = menu !== null ? h(MiniMenu, { x: menu.x, y: menu.y, items: menuItems, onClose: () => setMenu(null) }) : null;

        return h(
          'div',
          { className: 'dsh-fk-tab' },
          h(
            'div',
            { className: 'dsh-fk-managerhead' },
            h('span', { className: 'dsh-fk-brandmark' }, h(Icon, { name: 'brand', size: 17 })),
            h(
              'span',
              { className: 'dsh-fk-managertext' },
              h('strong', { className: 'dsh-fk-title' }, t('title')),
              h('span', { className: 'dsh-fk-sub', title: root }, root),
            ),
            h('span', { className: 'dsh-fk-spacer' }),
            h(IconButton, {
              icon: 'filesPanel',
              label: t('openFiles'),
              onClick: () => {
                try {
                  tab.actions.openTab(FILES_KIND, { replaceTab: true });
                } catch (failure) {
                  showToast(errorText(failure), 'error');
                }
              },
            }),
            h(IconButton, { icon: 'refresh', label: t('refresh'), onClick: refresh }),
          ),
          editorView !== null ? editorView : view === 'trash' ? trashView : browseView,
          dragging !== null ? h('div', { className: 'dsh-fk-dragbar' }, h(Icon, { name: 'grip', size: 13 }), t('dragHint')) : null,
          notice !== null ? h('div', { className: 'dsh-fk-status', 'data-kind': notice.kind }, notice.text) : null,
          dialogNodes,
          menuNode,
        );
      }

      // ------------------------------------------------------------------
      // Workspace files tree (the `files` extension)
      // ------------------------------------------------------------------

      function FilesBody(props) {
        const { useTabInfo, sessionId, inputActions, useSessions } = props;
        const { tab } = useTabInfo();
        const settingsSnapshot = useSettings();
        const clipboard = useFileClipboard();
        const [root, setRoot] = React.useState('');
        const [rootError, setRootError] = React.useState('');
        const [levels, setLevels] = React.useState({});
        const [expanded, setExpanded] = React.useState(['']);
        const [selected, setSelected] = React.useState(null);
        const [menu, setMenu] = React.useState(null);
        const [dialog, setDialog] = React.useState(null);
        const [notice, setNotice] = React.useState(null);
        const [dragging, setDragging] = React.useState(null);
        const [dropDir, setDropDir] = React.useState(null);
        const loadingRef = React.useRef(new Set());
        const draggingRef = React.useRef(null);
        const expandedRef = React.useRef(expanded);
        const levelsRef = React.useRef(levels);
        const rootGenerationRef = React.useRef(0);
        expandedRef.current = expanded;
        levelsRef.current = levels;

        React.useEffect(() => {
          lastTabActions = tab.actions;
        }, [tab.actions]);

        // Prefer the Session's own cwd (a synchronous value); fall back to the Host.
        const sessionCwd = useSessions((sessions) => sessions.byId[sessionId]?.cwd);

        React.useEffect(() => {
          rootGenerationRef.current += 1;
          setLevels({});
          setExpanded(['']);
          setSelected(null);
          setMenu(null);
          setDialog(null);
        }, [root]);

        React.useEffect(() => {
          let dead = false;
          setRootError('');
          if (typeof sessionCwd === 'string' && sessionCwd !== '') {
            setRoot(sessionCwd);
            return undefined;
          }
          if (typeof sessionId !== 'string' || sessionId === '') return undefined;
          api('workspace', { sessionId })
            .then((data) => {
              if (!dead) setRoot(data.root);
            })
            .catch((failure) => {
              if (!dead) setRootError(errorText(failure));
            });
          return () => {
            dead = true;
          };
        }, [sessionCwd, sessionId]);

        React.useEffect(() => {
          if (notice === null) return undefined;
          const timer = setTimeout(() => setNotice(null), 4500);
          return () => clearTimeout(timer);
        }, [notice]);

        const loadLevel = React.useCallback(
          async (dir) => {
            if (root === '') return;
            const generation = rootGenerationRef.current;
            const loadingKey = `${generation}|${dir}`;
            if (loadingRef.current.has(loadingKey)) return;
            loadingRef.current.add(loadingKey);
            setLevels((previous) => ({
              ...previous,
              [dir]: { ...(previous[dir] ?? { entries: [] }), loading: true, error: '' },
            }));
            try {
              const data = await api('list', { root, path: dir, sessionId });
              if (rootGenerationRef.current !== generation) return;
              setLevels((previous) => ({
                ...previous,
                [dir]: { loading: false, entries: data.entries, truncated: data.truncated === true },
              }));
            } catch (failure) {
              if (rootGenerationRef.current !== generation) return;
              setLevels((previous) => ({
                ...previous,
                [dir]: { loading: false, entries: previous[dir]?.entries ?? [], error: errorText(failure) },
              }));
            } finally {
              loadingRef.current.delete(loadingKey);
            }
          },
          [root, sessionId],
        );

        // Seed the root level.
        React.useEffect(() => {
          if (root === '') return;
          void loadLevel('');
        }, [root, loadLevel]);

        // Load every expanded level that has never been fetched.
        React.useEffect(() => {
          if (root === '') return;
          for (const dir of expanded) {
            if (levelsRef.current[dir] === undefined) void loadLevel(dir);
          }
        }, [root, expanded, loadLevel]);

        const reload = React.useCallback(() => {
          const dirs = new Set(['', ...expandedRef.current]);
          for (const dir of dirs) void loadLevel(dir);
        }, [loadLevel]);

        // Page-refresh shortcut.
        React.useEffect(() => {
          if (typeof tab.actions?.bindCommands !== 'function') return undefined;
          return tab.actions.bindCommands({ refresh: reload });
        }, [tab.actions, reload]);

        // Auto refresh expanded levels.
        React.useEffect(() => {
          if (root === '' || settingsSnapshot.autoRefreshSeconds <= 0) return undefined;
          const timer = setInterval(() => {
            if (document.visibilityState === 'hidden') return;
            const dirs = new Set(['', ...expandedRef.current]);
            for (const dir of dirs) void loadLevel(dir);
          }, settingsSnapshot.autoRefreshSeconds * 1000);
          return () => clearInterval(timer);
        }, [root, loadLevel, settingsSnapshot.autoRefreshSeconds]);

        const toggleDir = (dir) => {
          setExpanded((previous) => (previous.includes(dir) ? previous.filter((value) => value !== dir) : [...previous, dir]));
        };

        const forgetSubtree = (rel) => {
          setExpanded((previous) => previous.filter((value) => value !== rel && !value.startsWith(rel + '/')));
          setLevels((previous) =>
            Object.fromEntries(Object.entries(previous).filter(([key]) => key !== rel && !key.startsWith(rel + '/'))),
          );
        };

        const refreshDirs = async (dirs) => {
          const unique = new Set(dirs.filter((dir) => typeof dir === 'string'));
          await Promise.all([...unique].map((dir) => loadLevel(dir)));
        };

        const mutate = async (op, payload, successText, dirs, cleanup) => {
          if (root === '') return false;
          try {
            await api(op, { root, sessionId, ...payload });
            setNotice({ kind: 'ok', text: successText });
            if (cleanup !== undefined) cleanup();
            if (Array.isArray(dirs)) await refreshDirs(dirs);
            return true;
          } catch (failure) {
            setNotice({ kind: 'error', text: errorText(failure) });
            return false;
          }
        };

        const renameEntry = (rel, kind, name) =>
          mutate('rename', { path: rel, name }, t('renamed'), [dirOf(rel)], () => {
            if (kind === 'directory') forgetSubtree(rel);
            if (selected === rel) setSelected(null);
          });

        const moveEntry = async (rel, kind, toDir) => {
          if (rel === '' || toDir === rel) return false;
          if (kind === 'directory' && toDir.startsWith(rel + '/')) {
            setNotice({ kind: 'error', text: t('error.bad-move') });
            return false;
          }
          if (dirOf(rel) === toDir) return true;
          return mutate('move', { path: rel, toDir }, t('moved'), [dirOf(rel), toDir], () => {
            if (kind === 'directory') forgetSubtree(rel);
            setSelected(joinRel(toDir, baseOf(rel)));
          });
        };

        const deleteEntry = (rel, kind) =>
          mutate('delete', { path: rel }, t('deleted'), [dirOf(rel)], () => {
            if (kind === 'directory') forgetSubtree(rel);
            if (selected === rel) setSelected(null);
          });

        const createEntry = (dir, name, kind) => {
          const rel = joinRel(dir, name);
          return mutate('create', { path: rel, kind }, t('created'), [dir], () => {
            setSelected(rel);
            setExpanded((previous) => (dir === '' || previous.includes(dir) ? previous : [...previous, dir]));
          });
        };

        /** Paste the shared clipboard into one directory of this workspace. */
        const pasteInto = (toDir) => {
          const clip = fileClipboard;
          if (clip === null || clip.root !== root) return Promise.resolve(false);
          return mutate(
            clip.mode === 'cut' ? 'move' : 'copy',
            { path: clip.rel, toDir, unique: true },
            t('pasted'),
            [dirOf(clip.rel), toDir],
            clip.mode === 'cut' ? () => setFileClipboard(null) : undefined,
          );
        };

        const canPaste = clipboard !== null && clipboard.root === root;

        const copyRelPath = async (rel) => {
          const ok = await copyText(rel);
          showToast(ok ? t('copiedPath') : t('error.internal'), ok ? 'ok' : 'error');
        };

        const copyAbsPath = async (rel) => {
          const ok = await copyText(joinAbs(root, rel));
          showToast(ok ? t('copiedPath') : t('error.internal'), ok ? 'ok' : 'error');
        };

        const referenceRel = async (rel) => {
          const text = `@${rel} `;
          if (inputActions !== undefined && typeof inputActions.captureInsertion === 'function' && typeof inputActions.insertText === 'function') {
            try {
              const span = inputActions.captureInsertion();
              if (inputActions.insertText(text, span) === true) {
                inputActions.persistDraft?.();
                showToast(t('referenced'));
                return;
              }
            } catch {
              /* fall back to the clipboard */
            }
          }
          const ok = await copyText(text);
          showToast(ok ? t('referencedCopied') : t('error.internal'), ok ? 'ok' : 'error');
        };

        const openPreview = (rel) => {
          if (typeof tab.actions?.openResource !== 'function') return;
          try {
            tab.actions.openResource(fileAddress(sessionId, rel));
          } catch (failure) {
            showToast(errorText(failure), 'error');
          }
        };

        const openFileKit = (params) => {
          if (typeof tab.actions?.openTab !== 'function') return;
          try {
            tab.actions.openTab(FILEKIT_KIND, { params });
          } catch (failure) {
            showToast(errorText(failure), 'error');
          }
        };

        const startDrag = (event, entry) => {
          event.stopPropagation();
          draggingRef.current = { rel: entry.path, kind: entry.kind };
          setDragging(draggingRef.current);
          try {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', entry.path);
          } catch {
            /* the ref carries the payload */
          }
        };

        const endDrag = () => {
          draggingRef.current = null;
          setDragging(null);
          setDropDir(null);
        };

        const dropInto = (toDir) => {
          const source = draggingRef.current;
          endDrag();
          if (!canDropInto(source, toDir)) return;
          void moveEntry(source.rel, source.kind, toDir);
        };

        const openEntryMenu = (event, entry) => {
          event.preventDefault();
          event.stopPropagation();
          // The menu target is highlighted through `data-menu`; closing the menu
          // must not leave a selection behind (the row was never "selected").
          setMenu({ x: event.clientX, y: event.clientY, rel: entry.path, kind: entry.kind, name: entry.name });
        };

        const openBlankMenu = (event) => {
          if (typeof event.target.closest === 'function' && event.target.closest('.dsh-fk-row, .dsh-fk-trow') !== null) return;
          event.preventDefault();
          setSelected(null);
          setMenu({ x: event.clientX, y: event.clientY, rel: null, kind: 'directory' });
        };

        const menuItems = [];
        if (menu !== null) {
          if (menu.rel === null) {
            if (canPaste) menuItems.push({ label: t('paste'), icon: 'paste', onSelect: () => void pasteInto('') });
            menuItems.push(
              { label: t('newFile'), icon: 'filePlus', onSelect: () => setDialog({ kind: 'create-file', dir: '' }) },
              { label: t('newDir'), icon: 'folderPlus', onSelect: () => setDialog({ kind: 'create-dir', dir: '' }) },
              { separator: true },
              { label: t('openInFileKit'), icon: 'brand', onSelect: () => openFileKit({ dir: '' }) },
              { label: t('openTrash'), icon: 'trash', onSelect: () => openFileKit({ view: 'trash' }) },
              { separator: true },
              { label: t('refresh'), icon: 'refresh', onSelect: reload },
            );
          } else {
            const isDir = menu.kind === 'directory';
            if (isDir) menuItems.push({ label: t('openDirInFileKit'), icon: 'brand', onSelect: () => openFileKit({ dir: menu.rel }) });
            else menuItems.push({ label: t('openPreview'), icon: 'file', onSelect: () => openPreview(menu.rel) });
            if (!isDir) menuItems.push({ label: t('openEditor'), icon: 'edit', onSelect: () => openEditorTab(sessionId, menu.rel) });
            menuItems.push({ separator: true });
            if (isDir) {
              menuItems.push({ label: t('newFileHere'), icon: 'filePlus', onSelect: () => setDialog({ kind: 'create-file', dir: menu.rel }) });
              menuItems.push({ label: t('newDirHere'), icon: 'folderPlus', onSelect: () => setDialog({ kind: 'create-dir', dir: menu.rel }) });
              menuItems.push({ label: t('pasteHere'), icon: 'paste', disabled: !canPaste, onSelect: () => void pasteInto(menu.rel) });
              menuItems.push({ separator: true });
            }
            menuItems.push(
              { label: t('rename'), icon: 'edit', onSelect: () => setDialog({ kind: 'rename', rel: menu.rel, entryKind: menu.kind }) },
              { label: t('move'), icon: 'folder', onSelect: () => setDialog({ kind: 'move', rel: menu.rel, entryKind: menu.kind }) },
              { label: t('copy'), icon: 'copy', onSelect: () => copyToFileClipboard(root, menu.rel, menu.kind, 'copy') },
              { label: t('cut'), icon: 'cut', onSelect: () => copyToFileClipboard(root, menu.rel, menu.kind, 'cut') },
              { separator: true },
              { label: t('copyRel'), icon: 'copy', onSelect: () => void copyRelPath(menu.rel) },
              { label: t('copyAbs'), icon: 'copy', onSelect: () => void copyAbsPath(menu.rel) },
              { label: t('reference'), icon: 'link', onSelect: () => void referenceRel(menu.rel) },
              { separator: true },
              {
                label: t('delete'),
                icon: 'trash',
                danger: true,
                onSelect: () => {
                  if (settingsSnapshot.confirmDelete) setDialog({ kind: 'delete', rel: menu.rel, entryKind: menu.kind });
                  else void deleteEntry(menu.rel, menu.kind);
                },
              },
            );
          }
        }

        const dialogNodes = [];
        if (dialog !== null) {
          if (dialog.kind === 'create-file' || dialog.kind === 'create-dir') {
            const isDir = dialog.kind === 'create-dir';
            dialogNodes.push(
              h(TextDialog, {
                key: isDir ? 'create-dir' : 'create-file',
                title: isDir ? t('newDir') : t('newFile'),
                label: t('name'),
                initial: '',
                placeholder: isDir ? 'assets' : 'notes.md',
                confirmText: t('create'),
                onClose: () => setDialog(null),
                onSubmit: (name) => createEntry(dialog.dir ?? '', name, isDir ? 'directory' : 'file'),
              }),
            );
          } else if (dialog.kind === 'rename') {
            dialogNodes.push(
              h(TextDialog, {
                key: 'rename',
                title: t('rename'),
                label: t('newName'),
                initial: baseOf(dialog.rel),
                confirmText: t('rename'),
                onClose: () => setDialog(null),
                onSubmit: (name) => renameEntry(dialog.rel, dialog.entryKind, name),
              }),
            );
          } else if (dialog.kind === 'move') {
            dialogNodes.push(
              h(MoveDialog, {
                key: 'move',
                root,
                rel: dialog.rel,
                sourceIsDir: dialog.entryKind === 'directory',
                onClose: () => setDialog(null),
                onMove: (toDir) => moveEntry(dialog.rel, dialog.entryKind, toDir),
              }),
            );
          } else if (dialog.kind === 'delete') {
            dialogNodes.push(
              h(ConfirmDialog, {
                key: 'delete',
                title: t('deleteTitle'),
                text: dialog.rel,
                hint: t('deleteHint', { trash: DSH_TRASH }),
                danger: true,
                confirmText: t('deleteConfirm'),
                onClose: () => setDialog(null),
                onConfirm: () => deleteEntry(dialog.rel, dialog.entryKind),
              }),
            );
          }
        }

        const visibleEntries = (level) => (level?.entries ?? []).filter((entry) => !isHiddenEntry(entry.name));

        const renderLevel = (dir, depth) => {
          const level = levels[dir];
          const rows = [];
          if (level === undefined || (level.loading === true && (level.entries ?? []).length === 0)) {
            rows.push(h('p', { key: 'loading', className: 'dsh-fk-hint dsh-fk-treeline' }, t('loading')));
          } else {
            if (level.error) rows.push(h('p', { key: 'error', className: 'dsh-fk-error dsh-fk-treeline' }, level.error));
            const list = visibleEntries(level);
            if (list.length === 0 && !level.error) rows.push(h('p', { key: 'empty', className: 'dsh-fk-hint dsh-fk-treeline' }, t('empty')));
            for (const entry of list) {
              const isDir = entry.kind === 'directory';
              const open = isDir && expanded.includes(entry.path);
              rows.push(
                h(
                  'div',
                  {
                    key: entry.path,
                    className: 'dsh-fk-trow',
                    'data-kind': entry.kind,
                    'data-menu': menu !== null && menu.rel === entry.path,
                    'data-drop': dropDir === entry.path,
                    role: 'treeitem',
                    'aria-expanded': isDir ? open : undefined,
                    'aria-level': depth + 1,
                    tabIndex: 0,
                    style: { paddingLeft: 5 + depth * 14 },
                    draggable: true,
                    title: entry.path,
                    onClick: () => {
                      if (isDir) toggleDir(entry.path);
                      else openPreview(entry.path);
                    },
                    onKeyDown: (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (isDir) toggleDir(entry.path);
                        else openPreview(entry.path);
                      }
                    },
                    onContextMenu: (event) => openEntryMenu(event, entry),
                    onDragStart: (event) => startDrag(event, entry),
                    onDragEnd: endDrag,
                    onDragOver: isDir
                      ? (event) => {
                          if (!canDropInto(draggingRef.current, entry.path)) return;
                          event.preventDefault();
                          event.stopPropagation();
                          event.dataTransfer.dropEffect = 'move';
                          if (dropDir !== entry.path) setDropDir(entry.path);
                        }
                      : undefined,
                    onDragLeave: isDir
                      ? (event) => {
                          if (event.currentTarget.contains(event.relatedTarget)) return;
                          if (dropDir === entry.path) setDropDir(null);
                        }
                      : undefined,
                    onDrop: isDir
                      ? (event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          dropInto(entry.path);
                        }
                      : undefined,
                  },
                  h('span', { className: 'dsh-fk-tchev' }, isDir ? h(Icon, { name: open ? 'chevronDown' : 'chevronRight', size: 12 }) : null),
                  h('span', { className: 'dsh-fk-trowicon', 'data-kind': entry.kind }, h(Icon, { name: isDir ? (open ? 'folderOpen' : 'folder') : 'file', size: 15 })),
                  h('span', { className: 'dsh-fk-trowname' }, entry.name),
                  h('span', { className: 'dsh-fk-trowmeta' }, entry.kind === 'file' ? formatBytes(entry.size) : ''),
                ),
              );
              if (open) rows.push(renderLevel(entry.path, depth + 1));
            }
            if (level.truncated === true) rows.push(h('p', { key: 'truncated', className: 'dsh-fk-hint dsh-fk-treeline' }, t('truncatedEntries')));
          }
          return h('div', { key: 'level:' + (dir === '' ? 'root' : dir), className: 'dsh-fk-tlevel' }, rows);
        };

        const body = h(
          'div',
          { className: 'dsh-fk-tab dsh-fk-filestab' },
          h(
            'div',
            { className: 'dsh-fk-treehead' },
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-fk-rootpath',
                title: root,
                onClick: () => setSelected(null),
                onDragOver: (event) => {
                  if (!canDropInto(draggingRef.current, '')) return;
                  event.preventDefault();
                  setDropDir('');
                },
                onDragLeave: () => {
                  if (dropDir === '') setDropDir(null);
                },
                onDrop: (event) => {
                  event.preventDefault();
                  dropInto('');
                },
                'data-drop': dropDir === '',
              },
              h(Icon, { name: 'home', size: 13 }),
              h('span', { className: 'dsh-fk-rootpathtext' }, root === '' ? t('loading') : root),
            ),
            h('span', { className: 'dsh-fk-spacer' }),
            h(IconButton, { icon: 'refresh', label: t('refresh'), onClick: reload }),
            h(IconButton, { icon: 'brand', label: t('openTitle'), onClick: () => openFileKitTab({ dir: '' }) }),
          ),
          h(
            'div',
            {
              className: 'dsh-fk-treebody',
              role: 'tree',
              'aria-label': t('filesGuideTitle'),
              onContextMenu: openBlankMenu,
              onDragOver: (event) => {
                if (typeof event.target.closest === 'function' && event.target.closest('.dsh-fk-trow') !== null) return;
                if (!canDropInto(draggingRef.current, '')) return;
                event.preventDefault();
                setDropDir('');
              },
              onDragLeave: (event) => {
                if (event.currentTarget.contains(event.relatedTarget)) return;
                if (dropDir === '') setDropDir(null);
              },
              onDrop: (event) => {
                if (typeof event.target.closest === 'function' && event.target.closest('.dsh-fk-trow') !== null) return;
                event.preventDefault();
                dropInto('');
              },
            },
            rootError !== '' ? h('p', { className: 'dsh-fk-error dsh-fk-center' }, rootError) : null,
            root === '' && rootError === '' ? h('p', { className: 'dsh-fk-hint dsh-fk-center' }, t('loading')) : null,
            root !== '' ? renderLevel('', 0) : null,
            dragging !== null
              ? h(
                  'div',
                  {
                    className: 'dsh-fk-rootdrop',
                    'data-over': dropDir === '',
                    onDragOver: (event) => {
                      if (!canDropInto(draggingRef.current, '')) return;
                      event.preventDefault();
                      event.stopPropagation();
                      setDropDir('');
                    },
                    onDrop: (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      dropInto('');
                    },
                  },
                  h(Icon, { name: 'move', size: 14 }),
                  t('dropRoot'),
                )
              : null,
          ),
          h(
            'div',
            { className: 'dsh-fk-treefoot' },
            h(Icon, { name: 'grip', size: 12 }),
            h('span', null, t('dragHint')),
            h('span', { className: 'dsh-fk-spacer' }),
            notice !== null ? h('span', { className: 'dsh-fk-footnotice', 'data-kind': notice.kind }, notice.text) : null,
          ),
          dialogNodes,
          menu !== null ? h(MiniMenu, { x: menu.x, y: menu.y, items: menuItems, onClose: () => setMenu(null) }) : null,
        );
        return body;
      }

      // ------------------------------------------------------------------
      // Titles
      // ------------------------------------------------------------------

      function FilesTitle({ useTabInfo }) {
        const { tab } = useTabInfo();
        return h('span', { className: 'dsh-fk-tabtitle' }, h(Icon, { name: 'folder', size: 15 }), tab.title);
      }

      function FileKitTitle({ useTabInfo }) {
        const { tab } = useTabInfo();
        return h('span', { className: 'dsh-fk-tabtitle' }, h(Icon, { name: 'brand', size: 15 }), tab.title);
      }

      // ------------------------------------------------------------------
      // Guide card for the workspace-files entry
      // ------------------------------------------------------------------

      function FilesGuideCard(props) {
        const { useTabInfo, kind, title, description } = props;
        const { tab } = useTabInfo();
        const openFiles = () => {
          try {
            tab.actions.openTab(kind, { replaceTab: true });
          } catch (failure) {
            showToast(errorText(failure), 'error');
          }
        };
        const openFileKit = () => {
          try {
            tab.actions.openTab(FILEKIT_KIND, { replaceTab: true });
          } catch (failure) {
            showToast(errorText(failure), 'error');
          }
        };
        return h(
          'div',
          { className: 'dsh-fk-guide', 'data-filekit-guide': true },
          h(
            'button',
            { type: 'button', className: 'dsh-fk-guidecard', onClick: openFiles, 'data-sidebar-right-guide-entry': kind },
            h('span', { className: 'dsh-fk-guideicon' }, h(Icon, { name: 'folder', size: 26 })),
            h(
              'span',
              { className: 'dsh-fk-guidetext' },
              h('span', { className: 'dsh-fk-guidetitle' }, title),
              description !== undefined ? h('span', { className: 'dsh-fk-guidedesc' }, description) : null,
            ),
            h(Icon, { name: 'chevronRight', size: 14 }),
          ),
          h('div', { className: 'dsh-fk-guidesep', role: 'none' }),
          h(
            'button',
            { type: 'button', className: 'dsh-fk-guideextra', onClick: openFileKit, title: t('openTitle'), 'data-filekit-open': true },
            h('span', { className: 'dsh-fk-guideextraicon' }, h(Icon, { name: 'brand', size: 15 })),
            h(
              'span',
              { className: 'dsh-fk-guidetext' },
              h('span', { className: 'dsh-fk-guidetitle' }, t('guideExtra')),
              h('span', { className: 'dsh-fk-guidedesc' }, t('guideExtraHint')),
            ),
            h(Icon, { name: 'chevronRight', size: 14 }),
          ),
        );
      }

      // ------------------------------------------------------------------
      // Files/documents header actions
      // ------------------------------------------------------------------

      let sidebarRightService = undefined;
      let lastTabActions = undefined;

      function openFileKitTab(params) {
        const options = params === undefined ? {} : { params };
        const actions = lastTabActions;
        try {
          if (sidebarRightService !== undefined && typeof sidebarRightService.openTab === 'function') {
            sidebarRightService.openTab(FILEKIT_KIND, options);
            return;
          }
          if (actions !== undefined && typeof actions.openTab === 'function') {
            actions.openTab(FILEKIT_KIND, options);
            return;
          }
        } catch (failure) {
          showToast(errorText(failure), 'error');
          return;
        }
        showToast(t('error.internal'), 'error');
      }

      async function insertReference(abs, sessionId, inputActions) {
        const workspace = await api('workspace', { sessionId, file: abs });
        const rel = relFromAbs(abs, workspace.root);
        if (rel === null) throw Object.assign(new Error('outside'), { code: 'outside-workspace' });
        const text = `@${rel} `;
        if (inputActions !== undefined && typeof inputActions.captureInsertion === 'function' && typeof inputActions.insertText === 'function') {
          try {
            const span = inputActions.captureInsertion();
            if (inputActions.insertText(text, span) === true) {
              inputActions.persistDraft?.();
              showToast(t('referenced'));
              return;
            }
          } catch {
            /* fall back to the clipboard */
          }
        }
        if (await copyText(text)) showToast(t('referencedCopied'));
        else showToast(t('error.internal'), 'error');
      }

      async function openFileInKit(abs, sessionId, inputActions, action) {
        const workspace = await api('workspace', { sessionId, file: abs });
        const rel = relFromAbs(abs, workspace.root);
        if (rel === null) throw Object.assign(new Error('outside'), { code: 'outside-workspace' });
        openFileKitTab({ rel, action });
      }

      function DocumentActions(props) {
        const abs = typeof props.absolutePath === 'string' ? props.absolutePath : '';
        const sessionId = props.sessionId;
        const inputActions = props.inputActions;
        const [menu, setMenu] = React.useState(null);
        if (abs === '') return null;

        /** Swap this preview tab for the file's editor tab. */
        const startEditing = async (target, session) => {
          const workspace = await api('workspace', { sessionId: session, file: target });
          const rel = relFromAbs(target, workspace.root);
          if (rel === null) throw Object.assign(new Error('outside'), { code: 'outside-workspace' });
          openEditorTab(session, rel, tabIdForContent(session, fileAddress(session, rel)));
        };

        const run = async (label, fn) => {
          try {
            await fn();
          } catch (error) {
            showToast(`${label}${translate('errorPrefix')}${errorText(error)}`, 'error');
          }
        };

        const openMenu = (event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setMenu({ x: rect.right - 224, y: rect.bottom + 4 });
        };

        const items = [
          { label: t('openEditor'), icon: 'edit', onSelect: () => run(t('openEditor'), () => startEditing(abs, sessionId)) },
          { label: t('rename'), icon: 'edit', onSelect: () => run(t('rename'), () => openFileInKit(abs, sessionId, inputActions, 'rename')) },
          { label: t('move'), icon: 'folder', onSelect: () => run(t('move'), () => openFileInKit(abs, sessionId, inputActions, 'move')) },
          { label: t('copyAbs'), icon: 'copy', onSelect: () => run(t('copyAbs'), async () => {
            if (await copyText(abs)) showToast(t('copiedPath'));
            else showToast(t('error.internal'), 'error');
          }) },
          { label: t('copyRel'), icon: 'copy', onSelect: () => run(t('copyRel'), async () => {
            const workspace = await api('workspace', { sessionId, file: abs });
            const rel = relFromAbs(abs, workspace.root);
            if (rel === null) throw Object.assign(new Error('outside'), { code: 'outside-workspace' });
            if (await copyText(rel)) showToast(t('copiedPath'));
            else showToast(t('error.internal'), 'error');
          }) },
          { label: t('reference'), icon: 'link', onSelect: () => run(t('reference'), () => insertReference(abs, sessionId, inputActions)) },
          { separator: true },
          { label: t('delete'), icon: 'trash', danger: true, onSelect: () => run(t('delete'), () => openFileInKit(abs, sessionId, inputActions, 'delete')) },
        ];

        return h(
          'span',
          { className: 'dsh-fk-doc-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-fk-tool',
              title: t('openEditor'),
              'aria-label': t('openEditor'),
              onClick: () => run(t('openEditor'), () => startEditing(abs, sessionId)),
            },
            h(Icon, { name: 'edit', size: 15 }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-fk-tool',
              title: t('reference'),
              'aria-label': t('reference'),
              onClick: () => run(t('reference'), () => insertReference(abs, sessionId, inputActions)),
            },
            h(Icon, { name: 'link', size: 15 }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-fk-tool',
              title: t('open'),
              'aria-label': t('open'),
              'aria-haspopup': 'menu',
              onClick: openMenu,
            },
            h(Icon, { name: 'more', size: 15 }),
          ),
          menu !== null ? h(MiniMenu, { x: menu.x, y: menu.y, items, onClose: () => setMenu(null) }) : null,
        );
      }

      // ------------------------------------------------------------------
      // Settings page
      // ------------------------------------------------------------------

      function ToggleRow({ title, hint, checked, onChange }) {
        return h(
          'div',
          { className: 'dsh-fk-setrow' },
          h(
            'div',
            { className: 'dsh-fk-settext' },
            h('span', { className: 'dsh-fk-settitle' }, title),
            hint !== undefined ? h('span', { className: 'dsh-fk-sethint' }, hint) : null,
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-fk-switch',
              role: 'switch',
              'aria-checked': checked,
              'data-on': checked,
              onClick: () => onChange(!checked),
            },
            h('span', { className: 'dsh-fk-switchknob' }),
          ),
        );
      }

      function FileKitSettings() {
        const snapshot = useSettings();
        const [flash, setFlash] = React.useState('');
        React.useEffect(() => {
          if (flash === '') return undefined;
          const timer = setTimeout(() => setFlash(''), 2600);
          return () => clearTimeout(timer);
        }, [flash]);
        const reset = () => {
          resetSettings();
          setFlash(t('settingsResetDone'));
        };
        return h(
          'div',
          { className: 'dsh-fk-settings' },
          h(
            'div',
            { className: 'dsh-fk-sethead' },
            h('span', { className: 'dsh-fk-setbrand' }, h(Icon, { name: 'brand', size: 22 })),
            h(
              'span',
              { className: 'dsh-fk-setheadtext' },
              h('strong', { className: 'dsh-fk-settitle-main' }, t('settingsTitle')),
              h('span', { className: 'dsh-fk-sethint' }, t('settingsIntro')),
            ),
          ),
          h(ToggleRow, {
            title: t('settingsShowHidden'),
            hint: t('settingsShowHiddenHint'),
            checked: snapshot.showHidden,
            onChange: (value) => updateSettings({ showHidden: value }),
          }),
          h(ToggleRow, {
            title: t('settingsNotify'),
            hint: t('settingsNotifyHint'),
            checked: snapshot.notifyAgent,
            onChange: (value) => updateSettings({ notifyAgent: value }),
          }),
          h(ToggleRow, {
            title: t('settingsConfirmDelete'),
            hint: t('settingsConfirmDeleteHint'),
            checked: snapshot.confirmDelete,
            onChange: (value) => updateSettings({ confirmDelete: value }),
          }),
          h(
            'div',
            { className: 'dsh-fk-setrow' },
            h(
              'div',
              { className: 'dsh-fk-settext' },
              h('span', { className: 'dsh-fk-settitle' }, t('settingsAutoRefresh')),
              h('span', { className: 'dsh-fk-sethint' }, t('settingsAutoRefreshHint')),
            ),
            h(
              'div',
              { className: 'dsh-fk-segmented', role: 'group' },
              AUTO_REFRESH_CHOICES.map((seconds) =>
                h(
                  'button',
                  {
                    key: seconds,
                    type: 'button',
                    className: 'dsh-fk-segment',
                    'data-on': snapshot.autoRefreshSeconds === seconds,
                    onClick: () => updateSettings({ autoRefreshSeconds: seconds }),
                  },
                  seconds === 0
                    ? t('settingsAutoRefreshOff')
                    : seconds === 15
                      ? t('settingsAutoRefresh15')
                      : seconds === 30
                        ? t('settingsAutoRefresh30')
                        : t('settingsAutoRefresh60'),
                ),
              ),
            ),
          ),
          h(
            'div',
            { className: 'dsh-fk-setrow' },
            h(
              'div',
              { className: 'dsh-fk-settext' },
              h('span', { className: 'dsh-fk-settitle' }, t('settingsFontSize')),
              h('span', { className: 'dsh-fk-sethint' }, t('settingsFontSizeHint')),
            ),
            h(
              'div',
              { className: 'dsh-fk-fontpicker' },
              h('input', {
                className: 'dsh-fk-range',
                type: 'range',
                min: FONT_MIN,
                max: FONT_MAX,
                step: 1,
                value: snapshot.editorFontSize,
                onChange: (event) => updateSettings({ editorFontSize: clampFontSize(event.target.value) }),
                'aria-label': t('settingsFontSize'),
              }),
              h('span', { className: 'dsh-fk-fontvalue' }, `${snapshot.editorFontSize}px`),
            ),
          ),
          h(
            'div',
            { className: 'dsh-fk-setfoot' },
            h('button', { type: 'button', className: 'dsh-fk-btn', onClick: reset }, h(Icon, { name: 'restore', size: 14 }), h('span', null, t('settingsReset'))),
            flash !== '' ? h('span', { className: 'dsh-fk-setflash' }, flash) : null,
          ),
        );
      }

      // ------------------------------------------------------------------
      // Styles — gold → orange-red brand accents
      // ------------------------------------------------------------------

      const CSS = `
:root{--dsh-fk-gold:#f5b83d;--dsh-fk-orange:#f4511e;--dsh-fk-grad:linear-gradient(135deg,#f7c948 0%,#f4932a 52%,#f4511e 100%);--dsh-fk-dir:#c47a12;--dsh-fk-soft:rgb(244 81 30/.12);--dsh-fk-hover:var(--dsw-alias-interactive-bg-hover,rgb(0 0 0/.055));--dsh-fk-active:var(--dsw-alias-interactive-bg-active,rgb(0 0 0/.09));--dsh-fk-editor-font:12px}
body[data-ds-dark-theme]{--dsh-fk-dir:#f3bf4d;--dsh-fk-soft:rgb(247 201 72/.14)}
.dsh-fk-tool{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none}
.dsh-fk-tool:hover{background:var(--dsh-fk-hover);color:var(--dsh-fk-orange)}
.dsh-fk-doc-actions{display:inline-flex;align-items:center;gap:1px;flex:none}
.dsh-fk-tab{position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;overflow:hidden;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5;background:var(--dsw-alias-bg-base)}
.dsh-fk-tabstatus{display:flex;flex-direction:column;gap:12px;align-items:flex-start;justify-content:center;height:100%;padding:24px}
.dsh-fk-managerhead{display:flex;align-items:center;gap:9px;padding:9px 10px 9px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.dsh-fk-brandmark{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:var(--dsh-fk-grad);color:#fff;flex:none;box-shadow:0 2px 8px rgb(244 81 30/.28)}
.dsh-fk-managertext{display:flex;flex-direction:column;min-width:0;gap:1px}
.dsh-fk-title{font-size:14px;font-weight:650;line-height:18px}
.dsh-fk-sub{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(360px,52vw)}
.dsh-fk-spacer{flex:1}
.dsh-fk-toolbar{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;flex-wrap:wrap}
.dsh-fk-crumbs{display:flex;align-items:center;gap:1px;min-width:0;flex:1;overflow:hidden;color:var(--dsw-alias-label-secondary);font-size:12px}
.dsh-fk-crumb{display:inline-flex;align-items:center;gap:4px;max-width:220px;padding:3px 7px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-fk-crumb:hover{background:var(--dsh-fk-hover);color:var(--dsw-alias-label-primary)}
.dsh-fk-crumb[data-drop=true]{background:var(--dsh-fk-soft);box-shadow:inset 0 0 0 1px var(--dsh-fk-orange);color:var(--dsh-fk-orange)}
.dsh-fk-crumb-current{color:var(--dsw-alias-label-primary);font-weight:500;cursor:default}
.dsh-fk-crumb-sep{opacity:.5}
.dsh-fk-toolbar-actions{display:flex;align-items:center;gap:4px;flex:none}
.dsh-fk-btn{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.dsh-fk-btn:hover{background:var(--dsh-fk-hover)}
.dsh-fk-btn:disabled{opacity:.45;cursor:default}
.dsh-fk-btn-primary{background:var(--dsh-fk-grad);border-color:transparent;color:#fff;box-shadow:0 1px 6px rgb(244 81 30/.25)}
.dsh-fk-btn-primary:hover{filter:brightness(1.05);background:var(--dsh-fk-grad)}
.dsh-fk-btn-danger{background:var(--dsw-alias-state-error-primary);border-color:transparent;color:#fff}
.dsh-fk-btn-danger:hover{filter:brightness(1.06);background:var(--dsw-alias-state-error-primary)}
.dsh-fk-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none}
.dsh-fk-iconbtn:hover{background:var(--dsh-fk-hover);color:var(--dsh-fk-orange)}
.dsh-fk-iconbtn:disabled{opacity:.4;cursor:default}
.dsh-fk-iconbtn[data-danger=true]:hover{color:var(--dsw-alias-state-error-primary)}
.dsh-fk-body{flex:1;min-height:0;overflow:auto;padding:4px 6px 10px}
.dsh-fk-row{display:flex;align-items:center;gap:8px;min-height:32px;padding:3px 6px;border-radius:7px;cursor:pointer;outline:none}
.dsh-fk-row:hover{background:var(--dsh-fk-hover)}
.dsh-fk-row[data-menu=true]{background:var(--dsh-fk-hover)}
.dsh-fk-row:focus-visible{outline:1.5px solid var(--dsh-fk-orange);outline-offset:-2px}
.dsh-fk-row[data-drop=true]{outline:1.5px dashed var(--dsh-fk-orange);outline-offset:-2px;background:var(--dsh-fk-soft)}
.dsh-fk-row-static{cursor:default}
.dsh-fk-rowicon{display:flex;color:var(--dsw-alias-label-secondary);flex:none}
.dsh-fk-rowicon[data-kind=directory]{color:var(--dsh-fk-dir)}
.dsh-fk-rowname{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);flex:0 1 auto}
.dsh-fk-rowmain{display:flex;flex-direction:column;min-width:0;flex:1;gap:0}
.dsh-fk-rowpath{font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-fk-rowmeta{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;flex:none}
.dsh-fk-rowactions{display:flex;align-items:center;gap:2px;flex:none;opacity:0;transition:opacity .12s}
.dsh-fk-row:hover .dsh-fk-rowactions,.dsh-fk-row:focus-within .dsh-fk-rowactions{opacity:1}
@media (hover:none){.dsh-fk-rowactions{opacity:1}}
.dsh-fk-editor{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:10px 12px 12px}
.dsh-fk-editorhead{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.dsh-fk-editorpath{display:flex;align-items:center;gap:6px;min-width:0;color:var(--dsw-alias-label-primary);font-size:12.5px}
.dsh-fk-editorpath svg{color:var(--dsh-fk-dir)}
.dsh-fk-editorpathname{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-fk-editorpathdir{color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-fk-iconactions{display:flex;align-items:center;gap:2px;flex:none}
.dsh-fk-codeeditor{position:relative;flex:1;min-height:160px;overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base)}
.dsh-fk-codeeditor:focus-within{border-color:var(--dsh-fk-orange)}
.dsh-fk-codeeditor-pre{position:absolute;inset:0;margin:0;padding:10px 12px;overflow:hidden;pointer-events:none;font:var(--dsh-fk-editor-font)/1.62 var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);white-space:pre;tab-size:2;color:var(--dsw-alias-label-primary)}
.dsh-fk-codeeditor-line{min-height:1.62em;white-space:pre}
.dsh-fk-codeeditor-input{position:absolute;inset:0;box-sizing:border-box;width:100%;height:100%;margin:0;padding:10px 12px;border:0;resize:none;background:transparent;color:transparent;caret-color:var(--dsw-alias-label-primary);font:var(--dsh-fk-editor-font)/1.62 var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);white-space:pre;overflow:auto;tab-size:2;outline:none}
.dsh-fk-codeeditor-input::selection{background:rgb(244 81 30/.24)}
.dsh-fk-editor-meta{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dsw-alias-label-secondary);flex:none}
.dsh-fk-badge{display:inline-flex;align-items:center;height:18px;padding:0 7px;margin-left:6px;border-radius:9px;background:var(--dsh-fk-grad);color:#fff;font-size:10px;font-weight:600}
.dsh-fk-warn{display:flex;align-items:center;gap:6px;margin:0;padding:7px 10px;border-radius:7px;background:var(--dsh-fk-soft);color:var(--dsw-alias-state-warn-primary);font-size:12px}
.dsh-fk-status{padding:7px 14px;border-top:1px solid var(--dsw-alias-border-l2);font-size:12px;flex:none;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-fk-status[data-kind=error]{color:var(--dsw-alias-state-error-primary)}
.dsh-fk-status[data-kind=ok]{color:var(--dsw-alias-state-success-primary)}
.dsh-fk-hint{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px}
.dsh-fk-center{text-align:center;padding:26px 12px}
.dsh-fk-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px;white-space:pre-wrap}
.dsh-fk-dialogwrap{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:20px;background:rgb(0 0 0/.32)}
.dsh-fk-dialog{display:flex;flex-direction:column;gap:12px;width:min(420px,100%);max-height:calc(100% - 20px);padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 16px 48px rgb(0 0 0/.30);color:var(--dsw-alias-label-primary);overflow:auto}
.dsh-fk-dialog-wide{width:min(560px,100%)}
.dsh-fk-dialogtitle{font-size:14px;font-weight:600}
.dsh-fk-dialogbody{display:flex;flex-direction:column;gap:8px;min-height:0}
.dsh-fk-dialogfoot{display:flex;justify-content:flex-end;gap:8px;flex:none}
.dsh-fk-dialogtext{margin:0;font-size:13px;word-break:break-word}
.dsh-fk-form{display:flex;flex-direction:column;gap:7px}
.dsh-fk-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dsh-fk-input{box-sizing:border-box;width:100%;height:32px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
.dsh-fk-input:focus{border-color:var(--dsh-fk-orange)}
.dsh-fk-dialog-crumbs{flex:none;border-bottom:1px solid var(--dsw-alias-border-l2);padding-bottom:6px}
.dsh-fk-picklist{display:flex;flex-direction:column;gap:2px;max-height:260px;overflow:auto;padding:2px}
.dsh-fk-pickrow{display:flex;align-items:center;gap:8px;min-height:32px;padding:4px 8px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}
.dsh-fk-pickrow:hover{background:var(--dsh-fk-hover)}
.dsh-fk-scrim{position:fixed;inset:0;z-index:1300}
.dsh-fk-menu{position:fixed;z-index:1301;display:flex;flex-direction:column;gap:1px;padding:5px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-overlay);box-shadow:0 14px 40px rgb(0 0 0/.26)}
.dsh-fk-menu button{display:flex;align-items:center;gap:8px;width:100%;padding:6px 9px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-fk-menu button:hover{background:var(--dsh-fk-hover)}
.dsh-fk-menu button:disabled{opacity:.45;cursor:default}
.dsh-fk-menu button[data-danger=true]{color:var(--dsw-alias-state-error-primary)}
.dsh-fk-menulabel{overflow:hidden;text-overflow:ellipsis}
.dsh-fk-menusep{height:1px;margin:3px 5px;background:var(--dsw-alias-border-l2);flex:none}
.dsh-fk-toast{position:fixed;left:50%;bottom:28px;z-index:1500;transform:translateX(-50%);max-width:min(620px,calc(100vw - 32px));padding:8px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-overlay);box-shadow:0 10px 30px rgb(0 0 0/.24);color:var(--dsw-alias-label-primary);font-size:12px;pointer-events:none}
.dsh-fk-toast[data-kind=error]{color:var(--dsw-alias-state-error-primary)}
.dsh-fk-tabtitle{display:inline-flex;align-items:center;gap:5px;min-width:0}
.dsh-fk-tabtitle svg{color:var(--dsh-fk-dir)}
.dsh-fk-tabtitle-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-fk-tabdot{width:7px;height:7px;border-radius:50%;background:var(--dsh-fk-orange);flex:none;margin-left:2px;box-shadow:0 0 0 2px rgb(244 81 30/.18)}
.dsh-fk-filestab{background:transparent}
.dsh-fk-treehead{display:flex;align-items:center;gap:6px;padding:7px 8px 7px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.dsh-fk-rootpath{display:flex;align-items:center;gap:6px;min-width:0;max-width:100%;padding:4px 7px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.dsh-fk-rootpath:hover{background:var(--dsh-fk-hover);color:var(--dsw-alias-label-primary)}
.dsh-fk-rootpath[data-drop=true]{background:var(--dsh-fk-soft);box-shadow:inset 0 0 0 1px var(--dsh-fk-orange);color:var(--dsh-fk-orange)}
.dsh-fk-rootpathtext{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-fk-treebody{position:relative;flex:1;min-height:0;overflow:auto;padding:4px 5px 22px}
.dsh-fk-tlevel{display:flex;flex-direction:column;gap:0}
.dsh-fk-trow{display:flex;align-items:center;gap:5px;min-height:26px;padding:2px 6px 2px 5px;border-radius:6px;cursor:pointer;outline:none;user-select:none}
.dsh-fk-trow:hover{background:var(--dsh-fk-hover)}
.dsh-fk-trow[data-menu=true]{background:var(--dsh-fk-hover)}
.dsh-fk-trow:focus-visible{outline:1.5px solid var(--dsh-fk-orange);outline-offset:-2px}
.dsh-fk-trow[data-drop=true]{outline:1.5px dashed var(--dsh-fk-orange);outline-offset:-2px;background:var(--dsh-fk-soft)}
.dsh-fk-trow[data-kind=directory] .dsh-fk-trowname{font-weight:500}
.dsh-fk-tchev{display:flex;align-items:center;justify-content:center;width:13px;flex:none;color:var(--dsw-alias-label-tertiary,#8b8b8b)}
.dsh-fk-trowicon{display:flex;align-items:center;flex:none;color:var(--dsw-alias-label-secondary)}
.dsh-fk-trowicon[data-kind=directory]{color:var(--dsh-fk-dir)}
.dsh-fk-trowname{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-fk-trowmeta{flex:none;font-size:10.5px;color:var(--dsw-alias-label-secondary);opacity:.85}
.dsh-fk-treeline{margin:2px 0 2px 22px;padding:2px 0;font-size:11px}
.dsh-fk-treefoot{display:flex;align-items:center;gap:5px;padding:5px 10px;border-top:1px solid var(--dsw-alias-border-l2);font-size:10.5px;color:var(--dsw-alias-label-secondary);flex:none;min-height:24px}
.dsh-fk-footnotice{padding:1px 6px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:62%}
.dsh-fk-footnotice[data-kind=error]{color:var(--dsw-alias-state-error-primary)}
.dsh-fk-footnotice[data-kind=ok]{color:var(--dsw-alias-state-success-primary)}
.dsh-fk-rootdrop{position:absolute;left:8px;right:8px;bottom:8px;display:flex;align-items:center;justify-content:center;gap:6px;height:32px;border:1.5px dashed var(--dsh-fk-orange);border-radius:8px;background:var(--dsh-fk-soft);color:var(--dsh-fk-orange);font-size:12px;pointer-events:auto}
.dsh-fk-rootdrop[data-over=true]{background:var(--dsh-fk-grad);color:#fff;border-color:transparent}
.dsh-fk-dragbar{display:flex;align-items:center;gap:5px;padding:4px 10px;border-top:1px solid var(--dsw-alias-border-l2);font-size:10.5px;color:var(--dsh-fk-orange);flex:none}
.dsh-fk-guide{display:flex;flex-direction:column;width:100%;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-xl,16px);background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.dsh-fk-guidecard,.dsh-fk-guideextra{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:12px 16px;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}
.dsh-fk-guidecard{padding-bottom:10px}
.dsh-fk-guideextra{padding-top:10px;padding-bottom:11px}
.dsh-fk-guidecard:hover,.dsh-fk-guideextra:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}
.dsh-fk-guideicon{display:flex;align-items:center;justify-content:center;width:26px;height:26px;flex:none;color:var(--dsh-fk-dir)}
.dsh-fk-guideextraicon{display:flex;align-items:center;justify-content:center;width:26px;height:26px;flex:none;border-radius:7px;background:var(--dsh-fk-grad);color:#fff;box-shadow:0 2px 6px rgb(244 81 30/.25)}
.dsh-fk-guidetext{display:flex;flex-direction:column;flex:1;min-width:0;gap:2px}
.dsh-fk-guidetitle{font-size:13.5px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-fk-guidedesc{font-size:10.5px;line-height:1.35;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-fk-guidesep{height:1px;margin:0 14px;background:var(--dsw-alias-border-l3)}
.dsh-fk-guidecard>svg,.dsh-fk-guideextra>svg{color:var(--dsw-alias-label-tertiary);flex:none}
.dsh-fk-settings{display:flex;flex-direction:column;gap:16px;max-width:680px;padding:4px 0 24px}
.dsh-fk-sethead{display:flex;align-items:center;gap:12px;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dsh-fk-setbrand{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:var(--dsh-fk-grad);color:#fff;flex:none;box-shadow:0 2px 10px rgb(244 81 30/.28)}
.dsh-fk-setheadtext{display:flex;flex-direction:column;gap:2px}
.dsh-fk-settitle-main{font-size:15px;font-weight:650}
.dsh-fk-setrow{display:flex;align-items:center;gap:18px;justify-content:space-between;padding:10px 2px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.dsh-fk-settext{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.dsh-fk-settitle{font-size:13px;font-weight:550}
.dsh-fk-sethint{font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
.dsh-fk-switch{position:relative;width:38px;height:22px;padding:0;border:0;border-radius:11px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;flex:none;transition:background .15s}
.dsh-fk-switch[data-on=true]{background:var(--dsh-fk-grad)}
.dsh-fk-switchknob{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgb(0 0 0/.25);transition:left .15s}
.dsh-fk-switch[data-on=true] .dsh-fk-switchknob{left:19px}
.dsh-fk-segmented{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;flex:none}
.dsh-fk-segment{padding:4px 9px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;white-space:nowrap}
.dsh-fk-segment:hover{background:var(--dsh-fk-hover)}
.dsh-fk-segment[data-on=true]{background:var(--dsh-fk-grad);color:#fff}
.dsh-fk-fontpicker{display:flex;align-items:center;gap:10px;flex:none}
.dsh-fk-range{width:130px;accent-color:var(--dsh-fk-orange)}
.dsh-fk-fontvalue{font-size:12px;color:var(--dsw-alias-label-secondary);min-width:34px;text-align:right}
.dsh-fk-setfoot{display:flex;align-items:center;gap:10px}
.dsh-fk-setflash{font-size:12px;color:var(--dsw-alias-state-success-primary)}
@media (max-width:420px){.dsh-fk-setrow{flex-direction:column;align-items:flex-start;gap:8px}.dsh-fk-fontpicker{width:100%}.dsh-fk-range{flex:1}}
`;

      // ------------------------------------------------------------------
      // Plugin body
      // ------------------------------------------------------------------

      function apply(ctx) {
        const slots = ctx.get('slots');
        if (slots === undefined) {
          console.error('[dsh-filekit] slots service missing; client half disabled');
          return;
        }

        sidebarRightService = ctx.get('sidebarRight');

        ctx.effect(() => {
          const locale = ctx.get('locale');
          if (locale === undefined) return undefined;
          let dispose;
          try {
            dispose = locale.register(NS, { zh: DICT.zh, en: DICT.en });
            translate = locale.bind(NS);
          } catch (error) {
            console.warn('[dsh-filekit] locale registration failed:', error?.message ?? error);
            return undefined;
          }
          return () => {
            translate = fallbackText;
            try {
              dispose?.();
            } catch {
              /* removing a dictionary must not break unload */
            }
          };
        }, 'dsh-filekit: dictionaries');

        ctx.effect(() => {
          const style = createOwnedStyle(CSS);
          return () => style.remove();
        }, 'dsh-filekit: styles');

        // Tab types: take over the workspace files page as an extension, and
        // add the FileKit page as a page type of its own.
        const tabs = ctx.get('sidebarRightTabs');
        if (tabs !== undefined && typeof tabs.register === 'function') {
          ctx.effect(
            () =>
              tabs.register({
                id: FILES_ID,
                kind: FILES_KIND,
                priority: 'extension',
                keepMounted: true,
                title: () => t('filesTitle'),
                guide: [
                  {
                    id: 'workspace',
                    order: 10,
                    title: () => t('filesGuideTitle'),
                    description: () => t('filesGuideDescription'),
                    icon: FilesGuideArtwork,
                  },
                ],
              }),
            'dsh-filekit: files type',
          );
          ctx.effect(
            () =>
              tabs.register({
                id: FILEKIT_ID,
                kind: FILEKIT_KIND,
                priority: 'extension',
                keepMounted: true,
                title: () => t('title'),
              }),
            'dsh-filekit: filekit type',
          );
          ctx.effect(
            () =>
              tabs.register({
                id: EDITOR_ID,
                kind: EDITOR_KIND,
                priority: 'extension',
                keepMounted: true,
                patterns: ['dsh-resource://filekit-edit/[\\s\\S]+'],
                title: () => t('editorTab'),
              }),
            'dsh-filekit: editor type',
          );
        } else {
          console.warn('[dsh-filekit] sidebarRightTabs service missing; tabs not registered');
        }

        if (sidebarRightService !== undefined && typeof sidebarRightService.registerCloseHandler === 'function') {
          ctx.effect(() => {
            const releases = [];
            for (const kind of [FILEKIT_KIND, EDITOR_KIND]) {
              try {
                releases.push(
                  sidebarRightService.registerCloseHandler(kind, (sessionId, tab) => {
                    if (dirtyTabs.has(tab.id)) {
                      showToast(t('saveBeforeClose'), 'error');
                      throw new Error('dsh-filekit: unsaved changes');
                    }
                  }),
                );
              } catch (error) {
                console.warn(`[dsh-filekit] close guard for ${kind} not registered:`, error?.message ?? error);
              }
            }
            return () => {
              for (const release of releases) {
                try {
                  release?.();
                } catch {
                  /* ignore */
                }
              }
            };
          }, 'dsh-filekit: close guards');
        }

        const registerList = (slot, options, Component) => {
          try {
            ctx.effect(
              () => slots.inject(slot, () => slots.register({ name: slot, ...options }, Component)),
              `dsh-filekit: ${slot}/${options.id ?? ''}`,
            );
          } catch (error) {
            console.warn(`[dsh-filekit] could not register ${slot}:`, error?.message ?? error);
          }
        };

        const registerKeyed = (slot, options, Component) => {
          try {
            ctx.effect(
              () => slots.inject(slot, () => slots.register({ name: slot, ...options }, Component)),
              `dsh-filekit: ${slot}/${options.key ?? ''}`,
            );
          } catch (error) {
            console.warn(`[dsh-filekit] could not register ${slot}:`, error?.message ?? error);
          }
        };

        // The two page bodies and their chip titles.
        registerKeyed(
          'sidebar.right.pane.tab',
          {
            key: FILES_ID,
            locale: NS,
          },
          FilesBody,
        );
        registerKeyed('sidebar.right.pane.tab', { key: FILEKIT_ID, locale: NS }, FileKitTab);
        registerKeyed('sidebar.right.pane.tab', { key: EDITOR_ID, locale: NS }, FileEditorTab);
        registerKeyed('sidebar.right.pane.tab.title', { key: FILES_ID }, FilesTitle);
        registerKeyed('sidebar.right.pane.tab.title', { key: FILEKIT_ID }, FileKitTitle);
        registerKeyed('sidebar.right.pane.tab.title', { key: EDITOR_ID }, EditorTitle);

        // The workspace-files guide card gains a FileKit button underneath.
        registerKeyed('sidebar.right.tab.guide.entry', { key: FILES_ID, locale: NS }, FilesGuideCard);

        // Header actions.
        registerList('sidebar.right.tab.document.actions', { id: 'filekit-document', order: 20 }, DocumentActions);

        // Settings page.
        registerList(
          'settings.section',
          { id: 'dsh-filekit', order: 22, label: () => t('settingsTitle') },
          FileKitSettings,
        );

        // Transient feedback.
        registerList('shell.overlay', { id: 'filekit-toast', order: 90 }, ToastHost);
      }

      return {
        inject: ['slots'],
        apply,
      };
    },
  });
})();
