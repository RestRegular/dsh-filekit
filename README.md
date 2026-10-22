# dsh-filekit

FileKit 是 DeepSeek Harness 的**工作区文件工具**插件。它接管右侧「工作区文件」面板，加入右键菜单、拖拽移动、重命名、编辑、复制路径、引用到对话框，以及可恢复删除；同时提供一个独立的 **FileKit 文件管理页**和一个**设置页**。每次从界面发起的修改都会自动作为一条精简的变更提醒注入当前会话的 Agent。

> FileKit upgrades the DeepSeek Harness right-sidebar workspace files panel with context menus, drag-to-move, rename, edit, copy path, reference-into-composer, and recoverable deletes, plus a standalone FileKit page and a settings page. UI mutations are reported to the live Agent as a one-line change notice.

## 安装

```bash
dsh plugin --profile web add @restregular/dsh-filekit
```

安装并重新打开会话后：

- 右侧边栏的**开始页**里，「工作区文件」卡片下方多出一个 **FileKit 文件工具** 按钮：点击会在侧边栏中新开 FileKit 页（不是弹窗）；
- 打开「工作区文件」页：树里的文件/目录支持**右键菜单**和**拖拽移动**；
- 设置 → **FileKit**：显示隐藏文件、Agent 变更提醒、删除确认、自动刷新、编辑器字号；
- 预览文件时，文件预览标题栏右侧仍有**编辑 / 引用 / 更多**按钮。

## 功能

### 工作区文件树（接管原生文件页）

| 操作 | 入口 | 说明 |
| --- | --- | --- |
| 展开 / 收起目录 | 点击目录行 | 懒加载每层目录，展开状态保留 |
| 打开预览 | 点击文件行 / 右键 | 在侧边栏预览文件 |
| 右键菜单 | 文件 / 目录 / 空白处 | 新建、重命名、移动、复制、复制路径、引用、删除等 |
| 拖拽移动 | 拖动行到目录行 / 根目录 | 拖到目录上即移动；禁止把目录拖进自身 |
| 新建文件 / 文件夹 | 右键菜单 | 在当前目录或目标目录创建 |
| 重命名 | 右键菜单 | 只改名字，不改变所在目录 |
| 移动到… | 右键菜单 | 目录选择器 |
| 复制 / 剪切 | 右键菜单 | 把条目放进 FileKit 剪贴板，不立即改动磁盘 |
| 粘贴 | 目录 / 空白处右键 | 粘贴到该目录；重名时自动用 `名称 (2).扩展名`，不会覆盖 |
| 复制路径 | 右键菜单 | 相对路径与绝对路径 |
| 引用到对话框 | 右键菜单 | 插入 `@相对路径 `；输入框不可用时退回复制 |
| 删除到回收站 | 右键菜单 | 移动到 `<工作区>/.dsh-trash`，可恢复 |
| 在 FileKit 中打开 | 右键菜单 / 标题栏按钮 | 打开完整文件管理页 |

### FileKit 文件管理页

- 独立侧边栏标签页（`filekit` kind），不是浮层弹窗；
- 面包屑浏览、新建、复制/剪切/粘贴、移动、删除、回收站；
- 右键菜单与拖拽移动。

### 编辑器标签页

- 每个文件一个独立标签页（`filekit-edit` kind），和预览页可以互相切换：
  - 预览标题栏的**编辑**按钮把当前预览标签页切换成编辑页；
  - 编辑页的**保存**按钮保存后切回该文件的预览页；**放弃修改**确认后也切回预览。
- 与内置预览同一套 Shiki 高亮器、行内滚动同步、`Ctrl/Cmd+S` 保存；
- 未保存时标签页标题右侧显示橙色圆点；关闭未保存的标签页会被阻止并提示；
- 工具栏全部为图标按钮，悬停显示提示文本（复制相对路径、引用、预览、放弃修改、保存）。

### 设置页

设置 → FileKit：

| 设置 | 默认 | 作用 |
| --- | --- | --- |
| 显示隐藏文件 | 开 | 显示以 `.` 开头的条目 |
| 变更后提醒 Agent | 开 | 关闭后不注入变更提醒，节省上下文 token |
| 删除前确认 | 开 | 关闭后删除直接进入回收站 |
| 自动刷新 | 关闭 | 15 / 30 / 60 秒重新读取展开的目录 |
| 编辑器字号 | 12px | FileKit 文本编辑器字号 |

设置保存在浏览器 `localStorage`（`dsh-filekit.settings.v1`），按浏览器/设备生效。

## Agent 变更通知

从界面发起写操作（新建、保存、重命名、移动、复制、删除、恢复、清空回收站）时，Host 会向该会话的 Agent 注入一条**不唤醒 Agent** 的上下文消息，例如：

```text
[FileKit · 工作区变更] 移动 docs/a.md → docs/b.md（工作区：D:\project\demo）。需要更多操作可调用 filekit 工具。
```

- `inject()` 只把通知放进下一个已准入的步骤，空闲时不会叫醒 Agent；
- 通知是一条**完整的用户消息**（`id` + `role: "user"` + `content` + `source`）。`inject()` 不会补默认字段，缺字段的对象会被原样写进会话历史，之后每次请求都会失败；
- 读取、展开目录、刷新、复制路径不会产生通知；
- 原地移动/重命名（`unchanged`）不会产生通知；
- 设置里关闭「变更后提醒 Agent」后，界面请求会带 `notify: false`，Host 直接跳过注入。

## `filekit` 模型工具

Host 同时注册 `filekit` 工具，和界面共用同一套操作实现：

```
action: list | read | write | create | rename | move | copy | delete
        trash | restore | purge | emptyTrash
```

- `path` / `toDir` 都是工作区相对路径，使用 `/` 分隔；
- `delete` 是移动到回收站，不是永久删除；
- `trash` 列出回收站，`restore` / `purge` / `emptyTrash` 管理回收站；
- `write` 支持 `expectedMtimeMs` 做乐观并发保护，冲突时返回 `conflict`。

## 回收站布局

```text
<workspace>/
  .dsh-trash/
    <时间戳>-<随机串>/
      meta.json     # name / originalPath / kind / deletedAt / size
      item          # 被移动的文件或目录
```

恢复会把 `item` 移回 `originalPath`；原路径已被占用时恢复失败，避免覆盖。`.dsh-trash` 在文件树和 FileKit 中隐藏。

## 安全与边界

- Host 只接受来自回环地址、且 `Origin` 与 `Host` 一致的请求（防 CSRF）。
- 每个请求都必须给出一个**已注册工作区**根目录，或与请求会话的工作目录完全一致；否则返回 `unknown-workspace`。
- 写文件是原子写入（同目录临时文件 + rename），并通过 `expectedMtimeMs` 检测外部修改。
- 文本读取上限 2 MiB；二进制文件（前 8 KiB 含 NUL）只显示元信息，不能用编辑器修改。
- 不跟随符号链接写文件；指向工作区外的符号链接读取也会被拒绝。
- 目录移动/复制会检查目标不是自身或其子目录。

## 已知限制

- 文件树只能操作当前会话的工作区根目录。
- 回收站恢复要求原父目录仍然存在；父目录被改名或删除时需要先手动恢复目录。
- Host 路由只监听本机回环地址；如果通过 Pocket/公网隧道在另一台设备上打开页面，界面数据请求会被拒绝（有意的安全边界）。
- 编辑器按 UTF-8 读写，不做编码转换；超限文件以只读截断方式展示。
- 文件剪贴板是页面内存状态（不是系统剪贴板），刷新页面或重启 DSH 后清空。
- 接管文件页后，宿主「在系统中打开目录」按钮不再出现在该页标题栏（宿主把该按钮挂在文件页的子槽位里，接管页不使用该子槽位）。

## 故障排查

### 会话报 `messages[N]: missing field role`（422）

0.2.0 及更早版本的变更通知没有带 `role` / `id`。只要从界面操作过文件，该会话的历史里就会留下一条不合法的 `user/message`，之后每次请求都会被 DeepSeek 以 422 `INVALID_REQUEST` 拒绝（重启也不会恢复，因为坏记录已经落盘）。0.2.1 起通知按完整用户消息构造，并在注入前做结构校验。

已经写坏的会话用仓库里的脚本修复（先关闭该会话，或退出 DSH；宿主在会话打开期间持有写锁）：

```bash
node scripts/repair-session-log.mjs --dry-run          # 只检查，不写盘
node scripts/repair-session-log.mjs <session-id>       # 修复指定会话
node scripts/repair-session-log.mjs                    # 扫描 ~/.dsh/sessions 下全部会话
```

脚本只补 `dsh-filekit` 来源的缺失 `role` / `id`，其余记录保持字节不变；原日志备份为 `session.v4.jsonl.zstd.bak-<时间戳>`，修复后重新打开会话即可继续。

### 变更提醒没有生效

通知依赖插件 Host 半边加载。修改 `index.js` 后需要重启 DSH（或重新加载插件），客户端 `client.js` 的热更新不会加载 Host 代码。

## 开发

```bash
node --check index.js
node --check client.js
node --check scripts/repair-session-log.mjs
node --test test/*.test.mjs
```

Host 入口 `index.js` 负责 `filekit` 工具与 `/dsh-filekit/api` 回环路由；共享操作在 `lib/filekit.js`；浏览器半边 `client.js` 注册：

- `sidebarRightTabs`：`files` 扩展类型（接管工作区文件页）与 `filekit` 页面类型；
- `sidebar.right.pane.tab`：两个页面主体；
- `sidebar.right.pane.tab.title`：两个标签页标题；
- `sidebar.right.tab.guide.entry`：开始页「工作区文件」卡片（下方带 FileKit 按钮）；
- `sidebar.right.tab.document.actions`：文件预览头的编辑/引用/更多；
- `settings.section`：FileKit 设置页；
- `shell.overlay`：toast。

## License

MIT © 2026 RestRegular
