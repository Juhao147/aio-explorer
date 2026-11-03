# Changelog

Change history for Aio Explorer, English + 中文.
Aio Explorer 的更新历史，中英双语。

Each release publishes the matching section below as its release notes — this
file is the single place to edit them.
每次发版会自动把下面对应版本那一节作为 release 正文，改更新说明只用改这个文件。

## 1.1.4 - 2026-11-04

### Coloured folder icons now survive a workspace switch

- **Fixed.** Switching workspaces (for example with Workspaces Plus), or closing
  and reopening the file explorer sidebar, turned every coloured folder icon
  grey — and they stayed grey until Obsidian was restarted or the *Coloured
  folder icons* toggle was flipped off and on. A workspace switch rebuilds the
  whole sidebar, so the plugin was still watching the copy of the file list it
  had thrown away.
- **Now.** The plugin notices when the file list is rebuilt and re-applies the
  colours by itself. Nothing new runs in the background: it only reacts when the
  list has actually been replaced, so expanding folders, scrolling and startup
  behave exactly as before.
- **Bonus.** With *Coloured folder icons* on and *Subfolder colours follow the
  top level* off, folders that appear later (expanding a folder, scrolling) keep
  their colour instead of falling back to grey.

### 切换工作区后，彩色文件夹图标不再变灰

- **修复**：切换工作区（比如用 Workspaces Plus），或者关掉再打开文件浏览器侧栏，
  原本彩色的文件夹图标会全部变成灰色，而且一直灰着，除非重启 Obsidian 或者把
  「多彩文件夹图标」开关拨一下。原因是切工作区会把整个侧栏拆掉重建，插件的监听
  还挂在被丢掉的那一份文件列表上。
- **现在**：插件会察觉文件列表被重建，自己把颜色补回来。没有新增任何后台轮询或
  定时器——只有在你眼前的文件列表真的换了新的一份时才动手，展开折叠、滚动、启动
  这些日常操作和以前完全一样。
- **附带**：开着「多彩文件夹图标」、关掉「子文件夹颜色跟随一级」时，后来才出现的
  文件夹（展开某个文件夹、往下滚动）也会保持彩色，不再退回灰色。

## 1.1.3 - 2026-10-31

### The pinned view comes back as a tab, in the spot you left it

- **Fixed.** Turning the plugin off and on again used to drop the pinned view
  into a separate split pane under the file explorer. It now reopens as a
  regular tab in the same row as the file explorer, search and bookmarks.
- **It remembers its place.** The plugin saves the tab position whenever the
  layout changes, so the view returns to the slot you dragged it to. The first
  time there is nothing saved yet, it opens at the end of the row.
- **No stolen focus.** Restoring the tab in the background does not switch away
  from the note you are reading.

### 图钉视图恢复成标签，并回到你放的位置

- **修复**：关掉插件再打开，图钉视图以前会被塞成文件浏览器下方的一块单独分栏；现在它恢复成普通标签，和文件浏览器、搜索、书签排在同一排。
- **会记住位置**：布局一变就记下标签所在的格子，下次重开插件直接放回你拖到的地方。第一次没有记录时，放在这一排的最后一个。
- **不抢焦点**：后台恢复标签时，不会把你正在看的笔记切走。

## 1.1.1 - 2026-10-31

### Turning drag-and-drop off no longer blocks dragging files into a note

- **Fixed.** After switching *Drag and drop* off, a background refresh could put
  the sort markers back on the file rows with no drag engine behind them. Those
  rows then refused to start a native drag, so dragging a file from the explorer
  into the editor inserted nothing until Obsidian was restarted.
- **Now.** While the switch is off, a refresh leaves the markers off. Native
  file → editor dragging works immediately, and the 📌 pin and hidden markers
  are unaffected.

### 关闭拖拽排序后，仍能把文件拖进正文

- **修复的问题**：关掉「拖拽排序」后，一次后台刷新会把这些行的排序标记又贴回去，可拖拽引擎已经停了。这些行于是拒绝发起原生拖拽，从文件列表往正文里拖文件没有反应，只能重启 Obsidian。
- **现在**：开关关着的时候，刷新不会再贴回标记。原生「文件 → 正文」拖拽立刻可用，📌 置顶和隐藏标记不受影响。


## 1.1.0 - 2026-10-28

### The file pin view is now a slim twin of the file explorer

- **Same look, by the same rules.** Indentation, row height, icons and folder
  colours now read straight from Obsidian's own explorer variables, so the
  pinned view and the file explorer line up pixel for pixel instead of looking
  almost the same.
- **Same order, live.** Pinning, hiding, per-folder sort mode and "show hidden"
  now repaint both views at once. Previously the pinned view could keep showing
  the old order until something else happened to refresh it.
- **Drag to reorder really works here.** The pinned view uses the same drag
  controller as the file explorer — long-press lift, ghost card, drop line,
  release — and the one *Drag and drop* switch turns it on or off for both
  views together.
- **The toolbar buttons do what they say.** *Focus mode* and *Drag and drop* in
  the pinned view now drive the same settings as the file explorer's own
  buttons.
- **Reorder the tabs by dragging the first level.** Dragging a top-level row in
  the tree moves that pinned folder and its tab together. Dragging a tab still
  only changes the tab order, so it can never move folders on disk.
- **Pin and hidden markers show up here too.** The 📌 you see in the file
  explorer now appears on the same row in the pinned view.

### 文件置顶视图改成文件树的精简版

- **外观同一套规则**：层级缩进、行高、图标、文件夹颜色全部直接取 Obsidian 原生文件树的变量，两个视图逐像素对齐，不再是"看着差不多"。
- **顺序实时同步**：置顶、隐藏、每文件夹排序方式、显示隐藏项，任何一处改动两个视图同时重画。以前置顶视图会停在旧顺序，等下一次随机刷新才对得上。
- **拖拽排序真的能用**：置顶视图挂的是文件树那台拖拽引擎——长按抬起、跟随卡片、插入线、松手落盘，同一份代码；设置里那颗「拖拽排序」开关同时管住两个视图。
- **面板上的按钮不再是装饰**：置顶视图的「专注模式」「拖拽排序」两颗图标现在和文件树顶部那两颗控制同一批设置。
- **拖第一层就能同时换标签顺序**：在树里拖动第一层的行，会把置顶文件夹和上面那排标签一起挪。单独拖标签仍然只改标签顺序，绝不会去动硬盘上的文件夹。
- **置顶 📌 与隐藏标记同步显示**：文件树里看到的图钉，在置顶视图同一行上也能看到。

## 1.0.2 - 2026-10-21

### Fixed

- The language dropdown could drift to the middle of the settings panel in some
  vaults. It is now immune to other plugins' global CSS on `.setting-item-info`.
- 修复语言下拉框在部分环境下跑到面板中间的问题（抵御其他插件对
  `.setting-item-info` 的全局 CSS 污染）。

## 1.0.1 - 2026-10-21

### The language switch now covers every surface

- Settings page, right-click menus, the live-status panel, the file pin view,
  ribbon tooltips and the command palette all follow the language you pick
  (Follow Obsidian / 中文 / English). Earlier the live-status panel and the file
  pin view could stay in Chinese after switching to English.
- Error notices are no longer hard-coded to Chinese.
- 语言切换真正覆盖所有界面：设置页、右键菜单、当前生效状态面板、文件置顶面板、
  侧栏图标提示、命令面板，全部跟随你在「通用」里选的语言（跟随 Obsidian / 中文 /
  English）。此前把语言切成英文后，状态面板和文件置顶面板仍会显示中文。
- 部分只在中文出现的报错提示，现在也按语言显示。

### Drag and drop no longer breaks in folders that are not sorted manually

- In a folder sorted by time or name, the plugin's own drag (long-press lift,
  handle, position picker) is now used instead of falling back to the system
  drag. Moving an item to another folder always works; rearranging inside such
  a folder is refused with a clear explanation. New setting: *Switch to custom
  order when dropping in* (off by default) — turn it on and dropping into a
  time-sorted folder switches that folder to Custom order so the position you
  picked is kept.
- 修掉「非自定义排序文件夹里拖拽失灵」：按创建/修改时间、按名称排序的文件夹，
  现在也用插件自己的拖拽（长按抬起、右侧手柄、位置选择器），不再掉回系统原生拖拽。
  把条目拖到别的文件夹始终可用；在同一个按规则排序的文件夹里换顺序会被明确拒绝并说明
  原因。新增设置「拖入时切换为自定义排序」（默认关）：打开后，把文件拖进按规则排序的
  文件夹会自动把该文件夹切成 Custom order，你选的位置算数。

### Colorful folder icons no longer look shuffled

- The seven-color cycle now follows the exact order folders appear on screen —
  per-folder sort modes, custom manual order, pins and hidden items all count.
  Previously colors were assigned along a different ordering rule, so folder
  names mixing digits, Latin letters and CJK characters ended up out of
  sequence. Move, rename, pin, hide or delete a folder and the colors re-flow
  with it, keeping the red → orange → yellow → green → cyan → blue → purple
  cycle intact.
- 修掉「多彩文件夹颜色看着乱」：七色循环（红→橙→黄→绿→青→蓝→紫）现在严格按文件夹
  在屏幕上的实际顺序发色号——每文件夹的排序模式、自定义手动顺序、置顶、隐藏全都算数。
  此前颜色按另一套排序规则编号，名字里数字、英文、中文混用时会整体错位。现在拖动、
  改名、置顶、隐藏、删除文件夹，颜色都会跟着位置顺移，循环始终完整。

### Bold folder names are now adjustable

- What used to be an on/off switch that jumped straight to `bold` (700) is now
  a five-step slider: 400 off, 500 subtle, 600 medium, 700 bold, 800 extra bold.
  600 is Obsidian's own standard emphasis weight and the recommended value, so
  folder names stand out without the list feeling heavy. Existing settings are
  migrated automatically (the old "on" becomes 700, exactly as before).
- 「文件夹字体加粗」从开关改成五档滑块：原来一开就是写死的加粗（700），比 Obsidian
  自己的标准强调（600）还重一档。现在可以拖：400 不加粗、500 轻微、600 适中（推荐）、
  700 加粗、800 特粗。旧设置自动迁移（原来的"开"= 700，视觉不变）。

### Cleaner first run for new users

- Two defaults that used to leak the author's own vault into a fresh install are
  gone: the excluded-directories list no longer starts pre-filled with the
  vault's attachment folder (add it any time with the *Add current attachment
  directory* button), and the startup notice is off by default, so a newly
  installed plugin no longer pops a card in the corner on the next restart. Both
  switches remain, with their previous saved values untouched.
- 新用户首次安装更干净：修掉两个"把作者自己的库带进新装插件"的默认值——
  ①「排除的目录」不再预填当前库的附件文件夹（想加随时点「加入当前附件目录」按钮）；
  ② 启动通知默认关闭，新用户装好插件重启后不再弹右上角提示卡片。两个开关都保留，
  已存档的值不受影响。

## 1.0.0 - 2026-10-21

- First release: per-folder drag-and-drop sorting, focus mode, file counts,
  empty-file cleanup, note pinning, colorful folder icons, and adjustable title
  size (separate desktop / mobile values, synced together).
- 首个版本：文件夹拖拽排序、专注模式、文件计数、空白文件清理、笔记置顶、
  多彩文件夹图标、标题字号调整（电脑/手机端独立设置，自动同步）。
