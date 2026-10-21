"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => QuietTree000Plugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/native.ts
var import_obsidian = require("obsidian");

// lib/explorer-model.ts
function childrenOf(tree, parentId) {
  return parentId === null ? tree.roots : tree.nodes[parentId]?.children ?? [];
}
function isInSubtree(tree, id, ancestor) {
  let current = id;
  while (current !== null && tree.nodes[current]) {
    if (current === ancestor) return true;
    current = tree.nodes[current].parentId;
  }
  return false;
}
function flattenTree(tree, expanded) {
  const rows = [];
  function visit(ids, depth) {
    for (const id of ids) {
      rows.push({ id, depth });
      if (expanded.has(id)) visit(tree.nodes[id].children, depth + 1);
    }
  }
  visit(tree.roots, 0);
  return rows;
}
function validateMove(tree, id, target) {
  if (!tree.nodes[id]) return "\u627E\u4E0D\u5230\u8FD9\u4E2A\u6587\u4EF6";
  if (target.parentId !== null && tree.nodes[target.parentId]?.kind !== "folder")
    return "\u76EE\u6807\u4E0D\u662F\u6587\u4EF6\u5939";
  if (isInSubtree(tree, target.parentId, id)) return "\u4E0D\u80FD\u653E\u5165\u81EA\u8EAB\u6216\u81EA\u5DF1\u7684\u5B50\u76EE\u5F55";
  if (target.beforeId !== null && !childrenOf(tree, target.parentId).includes(target.beforeId))
    return "\u63D2\u5165\u4F4D\u7F6E\u5DF2\u53D8\u5316";
  return null;
}
function isNoopMove(tree, id, target) {
  const node = tree.nodes[id];
  if (!node || node.parentId !== target.parentId) return false;
  const siblings = childrenOf(tree, node.parentId);
  return target.beforeId === id || target.beforeId === (siblings[siblings.indexOf(id) + 1] ?? null);
}
function gapTargets(tree, rows, gap, draggedId) {
  if (gap < 0 || gap > rows.length) return [];
  if (gap === 0)
    return [
      {
        parentId: null,
        beforeId: tree.roots[0] ?? null,
        depth: 0,
        kind: "insert"
      }
    ];
  const previous = rows[gap - 1];
  const next = rows[gap];
  const targets = [];
  if (next && next.depth > previous.depth) {
    targets.push({
      parentId: previous.id,
      beforeId: next.id,
      depth: next.depth,
      kind: "insert"
    });
  } else {
    let current = previous.id;
    let depth = previous.depth;
    while (current !== null && (!next || next.depth <= depth)) {
      const n = tree.nodes[current];
      const siblings = childrenOf(tree, n.parentId);
      targets.push({
        parentId: n.parentId,
        beforeId: siblings[siblings.indexOf(current) + 1] ?? null,
        depth,
        kind: "insert"
      });
      current = n.parentId;
      depth -= 1;
    }
  }
  return targets.filter((t) => !validateMove(tree, draggedId, t));
}
function insideTarget(tree, id, depth) {
  return { parentId: id, beforeId: null, depth: depth + 1, kind: "inside" };
}
function targetKey(t) {
  return `${t.parentId ?? "$root"}:${t.beforeId ?? "$end"}:${t.kind}`;
}

// src/order.ts
var parentPath = (path) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/";
var baseName = (path) => path.slice(path.lastIndexOf("/") + 1);
var childPath = (parent, name) => parent === "/" ? name : `${parent}/${name}`;
/**
 * Obsidian 不可见项判定：以「.」开头的名字是 Obsidian 自身的内部文件
 * （如 Android 的 .nomedia），侧栏不显示它们。
 * 这些项不能进data.json 的排序记录：写进去会让下次加载的校验抛异常。
 */
var isInternalName = (name) => typeof name === "string" && name.startsWith(".");
var hasControlCharacter = (value) => Array.from(value).some((character) => character.charCodeAt(0) < 32);
function relativePath(raw) {
  const value = raw.trim().replace(/\\/g, "/");
  if (!value || value.startsWith("/") || value.includes(":") || hasControlCharacter(value) || value.split("/").some((p) => !p || p === "." || p === ".."))
    throw new Error("invalidPath");
  return value;
}
function parseOrder(text) {
  const value = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalidJson");
  const result = /* @__PURE__ */ Object.create(null);
  for (const [path, names] of Object.entries(value)) {
    if (path !== "/" && relativePath(path) !== path) throw new Error("invalidJson");
    if (!Array.isArray(names)) throw new Error("invalidJson");
    const entries = names;
    if (!entries.every(
      (name) => typeof name === "string" && name.length > 0 && name !== "." && name !== ".." && !name.includes("/") && !name.includes("\\") && !hasControlCharacter(name)
    ) || new Set(entries).size !== entries.length)
      throw new Error("invalidJson");
    result[path] = entries;
  }
  return result;
}
function excluded(path, rules) {
  return rules.some((rule) => path === rule || path.startsWith(rule + "/"));
}
function renameExclusions(rules, oldPath, newPath) {
  return rules.map(
    (rule) => rule === oldPath || rule.startsWith(oldPath + "/") ? newPath + rule.slice(oldPath.length) : rule
  );
}
function parseExclusions(text) {
  return [
    ...new Set(
      text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map(relativePath)
    )
  ];
}
function attachmentExclusion(config) {
  if (!config || config === "/" || config === "." || config.startsWith("./")) return [];
  try {
    return [relativePath(config)];
  } catch {
    return [];
  }
}
function withoutExcluded(order, rules) {
  return Object.assign(
    /* @__PURE__ */ Object.create(null),
    Object.fromEntries(Object.entries(order).filter(([path]) => !excluded(path, rules)))
  );
}
function sortItems(items, names, getName) {
  if (!names?.length) return items;
  const rank = new Map(names.map((name, i) => [name, i]));
  return items.map((item, index) => ({
    item,
    index,
    rank: rank.get(getName(item)) ?? Infinity
  })).sort((a, b) => a.rank - b.rank || a.index - b.index).map((entry) => entry.item);
}
// ===== aio-explorer 追加：每文件夹排序模式 / 隐藏 / 置顶 =====
var SORT_MODES = [
  "custom",
  "name-asc",
  "name-desc",
  "created-new",
  "created-old",
  "modified-new",
  "modified-old",
  "native"
];
// ===== aio-explorer 追加：专注模式 =====
var FOCUS_LEVELS = ["file", "parent", "grandparent", "greatgrandparent", "custom"];
/**
 * 专注模式：只保留「目标本身 + 它的祖先 + 它的后代」，其余条目隐藏。
 * 实现在本插件的排序管线里，不额外劫持原生 prototype
 * （避免与其他插件双重劫持）。
 */
function applyFocus(items, focusedPath) {
  if (!focusedPath) return items;
  const prefix = focusedPath + "/";
  return items.filter((item) => {
    const p = item.file.path;
    return p === focusedPath || p.startsWith(prefix) || focusedPath.startsWith(p + "/");
  });
}
/** 始终隐藏的目录（在专注过滤之前生效，优先级最高）。
 *  语义：命中的目录本身、其所有后代、其所有祖先都不可见
 *  —— 因为祖先不显示的话，目录根本进不去。 */
function applyAutoHide(items, autoHidePaths) {
  if (!autoHidePaths?.length) return items;
  const set = new Set(autoHidePaths);
  const isUnder = (p) => {
    for (const base of set) if (p === base || p.startsWith(base + "/")) return true;
    return false;
  };
  return items.filter((item) => {
    const p = item.file.path;
    if (isUnder(p)) return false;
    for (const base of set) if (base.startsWith(p + "/")) return false;
    return true;
  });
}

/* =======================================================================
   文件清理（融合 File Cleaner Redux 的全部功能）
   -----------------------------------------------------------------------
   清理规则（与原插件一致）：
   1) 空 Markdown：文件大小 0 / 内容 trim 后为空 / 只有 frontmatter
      且所有字段都在忽略列表里；
   2) 没被任何笔记引用的附件（非 md 文件）；
      引用来源包括普通链接、canvas 卡片、Admonition / ink 插件、
      以及用户指定的代码块类型；
   3) 空文件夹（含「删掉子文件夹后父文件夹也空」的连锁判断）；
   4) 文件夹与附件扩展名都支持「包含 / 排除」两种模式 + .* 通配；
   5) 全部规则都可加「文件年龄阈值」，只清理超过 N 天的。
   ======================================================================= */

// 「包含还是排除」的两种模式（布尔枚举）
const CLEAN_EXCLUDE = false;
const CLEAN_INCLUDE = true;

/** 取文件列表里的「在用附件」——被其他文件引用、且不是 markdown 本身。 */
function collectUsedAttachments(app) {
  const used = [];
  for (const links of Object.values(app.metadataCache.resolvedLinks ?? {}))
    for (const target of Object.keys(links))
      if (!target.endsWith(".md")) used.push(target);
  return used;
}

/** 解析 canvas 文件里被引用的附件（卡片文本里的 [[wiki]] 与 markdown 链接）。 */
function collectCanvasAttachments(app) {
  const out = [];
  for (const file of app.vault.getFiles()) {
    if (file.extension !== "canvas") continue;
    // canvas 是 json；读取失败就跳过，不影响整体清理
    const raw = readCanvasSafely(app, file);
    if (!raw) continue;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      continue;
    }
    for (const node of data.nodes ?? []) {
      const text = String(node?.text ?? "");
      for (const match of text.matchAll(/[!]?\[\[(.*?)\]\]/g)) {
        const path = match[1].split("|")[0];
        const dest = app.metadataCache.getFirstLinkpathDest?.(path, file.path);
        if (dest) out.push(dest.path);
      }
      for (const match of text.matchAll(/[!]\[.*?\]\((.*)\)/g)) {
        // markdown 链接里空格是 %20 编码的
        const path = match[1].replace(/%20/gi, " ");
        const dest = app.metadataCache.getFirstLinkpathDest?.(path, file.path);
        if (dest) out.push(dest.path);
      }
    }
  }
  return out;
}

/** 读 canvas 内容；文件为空或读不到都返回 null。 */
function readCanvasSafely(app, file) {
  try {
    if ((file.stat?.size ?? 0) === 0) return null;
  } catch (error) {
    return null;
  }
  return app.__cleanReadSync?.(file) ?? null;
}

/** Admonition 插件的附件：它把文件放在 data-tf 属性里。 */
function collectAdmonitionAttachments(app) {
  const out = [];
  for (const file of app.vault.getFiles()) {
    if (file.extension !== "md") continue;
    const text = app.__cleanReadSync?.(file);
    if (!text) continue;
    for (const match of text.matchAll(/data-tf="([^"]+)"/g)) {
      const dest = app.metadataCache.getFirstLinkpathDest?.(match[1], file.path);
      if (dest) out.push(dest.path);
    }
  }
  return out;
}

/** ink 插件的附件：drawing / writing 两种扩展名。 */
function collectInkAttachments(app) {
  const out = [];
  for (const file of app.vault.getFiles()) {
    if (file.extension !== "ink") continue;
    out.push(file.path);
  }
  return out;
}

/**
 * 指定代码块类型里引用的附件。
 * codeblockTypes 形如["ad-summary", "ad-.*", "tabs"]，支持正则。
 */
function collectCodeblockAttachments(app, codeblockTypes) {
  if (!codeblockTypes.length) return [];
  let pattern;
  try {
    pattern = new RegExp(codeblockTypes.join("|"));
  } catch (error) {
    return [];
  }
  const out = [];
  for (const file of app.vault.getFiles()) {
    if (file.extension !== "md") continue;
    const text = app.__cleanReadSync?.(file);
    if (!text) continue;
    for (const match of text.matchAll(/```([A-Za-z0-9_-]*)[\s\S]*?```/g)) {
      if (!pattern.test(match[1])) continue;
      for (const link of match[0].matchAll(/!?\[\[([^\]|]+)/g)) {
        const dest = app.metadataCache.getFirstLinkpathDest?.(link[1], file.path);
        if (dest) out.push(dest.path);
      }
    }
  }
  return out;
}

/**
 * 判断一个 markdown 文件是否「空」。
 * 判定顺序：扩展名 → 开关 → 反向链接 → 大小 → 内容 → frontmatter。
 */
function isEmptyMarkdown(file, ctx) {
  const { settings, backlinksOf, cacheOf, contentOf } = ctx;
  if (file.extension !== "md") return false;
  if (!settings.cleanDeleteEmptyMarkdown) return false;
  const links = backlinksOf(file);
  if (links > 0 && !settings.cleanDeleteEmptyWithBacklinks) return false;
  if ((file.stat?.size ?? 0) === 0) return true;
  const content = contentOf(file);
  if (content == null) return false;
  if (content.trim().length === 0) return true;
  const cache = cacheOf(file);
  if (cache?.sections?.length === 1 && cache.frontmatter) {
    if (settings.cleanIgnoreAllFrontmatter) return true;
    const keys = Object.keys(cache.frontmatter);
    return keys.every((key) => settings.cleanIgnoredFrontmatter.includes(key));
  }
  return false;
}

/** canvas 里没有被任何节点引用的卡片文件。 */
function isOrphanCanvas(file, app) {
  if (file.extension !== "canvas") return false;
  const raw = readCanvasSafely(app, file);
  if (!raw) return false;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return false;
  }
  const files = (data.files ?? []).map((f) => f?.file).filter(Boolean);
  return files.length === 0;
}

/**
 * 判断某个文件是否该被清理。
 * @param kind "md" | "canvas" | "attachment"
 */
function shouldCleanFile(file, ctx) {
  const { settings, isOrphanCanvasFn } = ctx;
  const now = ctx.now;
  const ageMs = (settings.cleanFileAgeThreshold ?? 0) * 24 * 60 * 60 * 1e3;
  if (ageMs > 0 && (file.stat?.mtime ?? 0) > now - ageMs) return false;

  if (file.extension === "md") {
    if (ctx.hasExcalidraw?.() && ctx.isExcalidrawEmpty?.(file)) return true;
    return isEmptyMarkdown(file, ctx);
  }
  if (file.extension === "canvas") return isOrphanCanvasFn(file);

  // 其余按扩展名筛选（附件）
  // 复制一份再改：黑名单且列表为空时要临时补 .*，直接 push 会污染调用方
  const list = [...(ctx.filteredExtensions ?? [])];
  if (settings.cleanAttachmentMode === CLEAN_EXCLUDE && list.length === 0) list.push(".*");
  let regex;
  try {
    regex = new RegExp(`^(${["md", ...list].join("|")})$`);
  } catch (error) {
    return false;
  }
  const hit = Boolean(file.extension?.match(regex));
  return settings.cleanAttachmentMode === CLEAN_INCLUDE ? hit : !hit;
}

/** 文件夹是否被排除（黑名单模式）。 */
function isFolderExcluded(folder, settings) {
  return settings.cleanFolderMode === CLEAN_EXCLUDE
    && settings.cleanFolders.some((f) => safeMatch(f, folder.path));
}
/** 文件夹是否被包含（白名单模式）。 */
function isFolderIncluded(folder, settings) {
  return settings.cleanFolderMode === CLEAN_INCLUDE
    ? settings.cleanFolders.some((f) => safeMatch(f, folder.path))
    : !settings.cleanFolders.some((f) => safeMatch(f, folder.path));
}
/** 路径匹配；用户写的正则非法时按普通字符串处理，不抛错。 */
function safeMatch(pattern, path) {
  try {
    return Boolean(path.match(new RegExp(`^${pattern}`)));
  } catch (error) {
    return path.startsWith(pattern);
  }
}

/** 扩展名列表归一：去掉 "*"、把 .* 还原成通配。 */
function cleanExtensions(list) {
  const out = list.filter((e) => e !== "*");
  if (list.includes("*")) out.push(".*");
  return out;
}

/* =======================================================================
   笔记计数（融合 File Explorer Note Count 的全部功能）
   -----------------------------------------------------------------------
   1) 递归统计每个文件夹下（含所有子文件夹）的笔记数，写进行元素的
      data-count 属性，由 CSS 用 ::after 显示；
   2) 「折叠时也显示」—— 原插件用 body.oz-show-all-num 全局类控制，
      这里沿用同样的机制，避免另起一套样式；
   3) 扩展名白名单 / 黑名单筛选；
   4) 在导航栏插入一行「库名」伪文件夹，显示全库总数；
   5) 增量更新—— 只重算受影响的目录及其祖先，不全量重扫。
   ======================================================================= */

// aio-explorer：文件计数用的 class 名
// aio-explorer：设备类型（Platform 的三个互斥标志）。
// 用于「在哪种设备上启用某功能」—— 手机 / 平板 / 电脑分别可控。
const DEVICE_KEYS = ["desktop", "tablet", "phone"];

function currentDeviceKey() {
  const platform = (0, import_obsidian4.Platform);
  if (!platform) return "desktop";
  if (platform.isPhone) return "phone";
  if (platform.isTablet) return "tablet";
  //兜底：isPhone / isTablet 是移动端按「屏幕宽高是否都 ≥ 600px」算出来的，
  // 桌面端是另一条启动路径直接置为 desktop，两个标志都恒为 false。
  // 万一移动端上这两个标志都没置上就走到了这里，再按屏幕尺寸自己判一次，
  // 免得手机被当成电脑、用错「电脑」那一份开关。
  if (platform.isMobile) {
    const w = window.innerWidth || 0;
    const h = window.innerHeight || 0;
    return w >= 600 && h >= 600 ? "tablet" : "phone";
  }
  return "desktop";
}

const NOTE_COUNT_SUBFOLDER_CLASS = "oz-with-subfolder";
const NOTE_COUNT_SHOW_ALL_CLASS = "oz-show-all-num";
// aio-explorer：开关【关闭】时，用这个类标记「已展开的目录要隐藏数字」，
// 打在 nav-files 容器上（而不是 body 全局类），不依赖 onLayoutReady 的时序。
const NOTE_COUNT_HIDE_EXPANDED_CLASS = "qt-hide-expanded-count";

// aio-explorer：文件图标 —— 多彩文件夹图标。
// 用插件自己的类名，与主题的 .colorful-folder 完全独立：
// 主题怎么改都不影响我们，我们在设置里开关也不碰主题。
// 真正的颜色规则在 styles.css 末尾（.qt-colorful-folder 段）。
const COLORFUL_FOLDER_CLASS = "qt-colorful-folder";
// aio-explorer：文件图标 —— 文件夹字体加粗。
// 走 --nav-item-weight 系列变量，由 Obsidian 核心消费，换任何主题都有效。
const FOLDER_BOLD_CLASS = "qt-folder-bold";
// aio-explorer：文件图标 —— 自定义图标。
// 开=显示整套图标（文件夹形状 + 按扩展名区分的文件图标），
// 关=不显示，回归主题/软件原生状态。规则在 styles.css 的 .qt-custom-icons 段。
const CUSTOM_ICONS_CLASS = "qt-custom-icons";
// aio-explorer：标题换行。
// 核心默认给标题 white-space: pre + 省略号截断；本类把它改成 normal，
// 文件名过长时自动换行成多行，不再截断。规则在 styles.css 的 .qt-title-wrap 段。
const TITLE_WRAP_CLASS = "qt-title-wrap";
// 子文件夹图标颜色跟随一级文件夹（用插件自己的类，不依赖主题）
const SUBFOLDER_INHERIT_CLASS = "qt-subfolder-inherit";
// aio-explorer：一级文件夹（库根的直接子级）标记类。
// 为什么要用 JS 打而不用 CSS 选择器：
//   CSS 里唯一能表达「.nav-folder-children 的直接子级里，属于库根那一层」的写法是
//   `.nav-folder:has(> .nav-folder-title.mod-root) > ...`，但 :has() 需要 Chromium 105+，
//   在部分 Obsidian 版本上不生效 → 选择器命中 0 → 颜色变量无人赋值 →
//   图标退回 currentColor 变成灰色（加了兜底后至少不再消失）。
//   改成 JS 遍历：库根 = .nav-folder-title 上带 .mod-root 的那一行，
//   它的 .nav-folder-children 的直接子元素就是一级文件夹。纯 DOM 判断，不依赖 CSS 特性支持。
const FIRST_LEVEL_CLASS = "qt-first";
// 「多彩文件夹图标」用的颜色序号类：qt-fc1 ~ qt-fc7（7 色循环）
const FOLDER_COLOR_CLASS = "qt-fc";
// ★ 2026-10-21：等文件树视图出现的最长时间（毫秒）。
//   插件 onload 时 Obsidian 还没创建文件树，那时注册不上 observer、也打不出标记，
//   导致「重启后多彩文件夹图标彻底消失」。这个常量限制我们最多等这么久，
//   免得占着资源不放。
const QT_FILE_TREE_WAIT_MS = 30000;
// 「标题字体大小调整」的滑块范围（像素）。核心把文件列表字号写成
// --nav-item-size（app.css:2488 定义、10740 消费），所以只改这一个变量，
// 不会碰到笔记正文字号 —— 与 Obsidian 自带的「外观 → 字体 → 字体大小」互不干扰。
const TITLE_FONT_SIZE_MIN = 11;
const TITLE_FONT_SIZE_MAX = 22;
const TITLE_FONT_SIZE_DEFAULT = 13;
// 手机端单独的字号默认值：手机屏幕小、DPI 不同，同样的 px 在手机上偏小，
// 所以手机端（body 带 is-mobile 类时）自动用这个值，两个值存在同一份 data.json 里一起同步。
const TITLE_FONT_SIZE_MOBILE_DEFAULT = 16;
// 「文件夹字体加粗」的粗细档位（2026-10-22 从开关改成滑块）。
// 原来是布尔开关，一开就是写死的 bold（=700），比 Obsidian 自己的标准强调
// （--font-semibold = 600）还重一档，不少用户觉得"太粗"。
// 现在给 5 档，和 Obsidian 内置字重体系对齐：
//   400 = 不加粗（等同关闭）、500 轻微、600 适中、700 加粗、800 特粗。
// 存进 data.json 的约定：0 或 400 都表示"关闭"（读入时归一成 0），
// 500/600/700/800 是真实字重值；滑块limits 用 400..800，step 100。
const FOLDER_BOLD_STEPS = [400, 500, 600, 700, 800];
const FOLDER_BOLD_MIN = 400;
const FOLDER_BOLD_MAX = 800;
const FOLDER_BOLD_STEP = 100;
// 新用户第一次拖动滑块时给的档位：Obsidian 标准强调（--font-semibold）
const FOLDER_BOLD_DEFAULT = 600;
// 老数据 iconFolderBold:true 迁到这里，保持原视觉（就是写死的 bold）
const FOLDER_BOLD_LEGACY_ON = 700;
// 写进 body inline style 的 CSS 变量名，styles.css 里的 qt-folder-bold 规则消费它
const FOLDER_BOLD_WEIGHT_VAR = "--qt-folder-bold-weight";

// —— 即时生效改造（2026-10-21）——
// 以前这两个模块只往 body 打类，样式全靠 Obsidian 在「加载插件时」把 styles.css
// 读进内存。一旦 styles.css 被浏览器缓存、或我改了文件但 Obsidian 没重启，
// 类名打上了也看不到效果，只能靠重启碰运气。
// 现在把样式也交给插件自己管：内置一份兜底 CSS，onload 时注入 <style>，
// 每次开关变化还会用 vault adapter 重读磁盘上的 styles.css 热更新，
// 于是「改样式文件 → 拨一下开关 → 立刻生效」，永远不用重启 Obsidian。
const QT_LIVE_STYLE_ID = "qt-live-style";
const QT_LIVE_CSS_FALLBACK = ".qt-explorer[data-qt-trigger=\"handle\"] .tree-item-self.qt-sortable {\n  position: relative;\n  padding-inline-end: 28px;\n}\n.qt-handle {\n  position: absolute;\n  inset-inline-end: 2px;\n  top: 50%;\n  transform: translateY(-50%);\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 24px;\n  height: 24px;\n  border-radius: 4px;\n  color: var(--text-faint);\n  opacity: 0;\n  cursor: grab;\n}\n.qt-handle svg {\n  width: 15px;\n  height: 15px;\n}\n.qt-explorer[data-qt-trigger=\"row\"] .qt-sortable,\n.qt-explorer[data-qt-trigger=\"row\"] .qt-sortable *,\n.qt-explorer[data-qt-trigger=\"handle\"] .qt-handle,\n.qt-explorer[data-qt-trigger=\"handle\"] .qt-handle * {\n  -webkit-touch-callout: none;\n  -webkit-user-drag: none;\n}\n.qt-explorer.qt-dragging .tree-item-self:not(.qt-inside) {\n  background: transparent;\n  background-image: none;\n  box-shadow: none;\n  outline: none;\n  color: var(--nav-item-color, var(--text-muted));\n}\n.qt-explorer.qt-dragging\n  .tree-item-self:is(.is-active, .is-selected, .has-focus):not(.qt-inside)::before,\n.qt-explorer.qt-dragging\n  .tree-item-self:is(.is-active, .is-selected, .has-focus):not(.qt-inside)::after {\n  opacity: 0;\n}\n.qt-explorer.qt-dragging .qt-handle {\n  visibility: hidden;\n  pointer-events: none;\n}\n.qt-drag-surface {\n  position: fixed;\n  z-index: 9998;\n  background: transparent;\n  /* aio-explorer：必须让鼠标事件穿透，否则会挡住原生 HTML5 拖拽的启动\n     （浏览器无法在被覆盖的元素上发起 dragstart，导致拖到正文无法插入链接）。\n     它存在的唯一目的是阻止文本选中，已由 .qt-explorer.qt-dragging 的\n     user-select:none 实现，故设为 pointer-events:none。*/\n  pointer-events: none;\n}\n.qt-ghost-label[hidden] {\n  display: none;\n}\n.qt-settings .qt-section {\n  margin: 0 0 26px;\n}\n.qt-settings .qt-section-header {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  margin: 0 0 10px;\n}\n.qt-settings .qt-section-header .setting-item-heading {\n  padding: 0;\n  border: 0;\n  background: transparent;\n  flex: 0 1 auto;\n  margin: 0;\n}\n.qt-settings .qt-section-header .setting-item-info {\n  margin: 0;\n}\n.qt-settings .qt-section-header .setting-item-control {\n  display: none;\n}\n.qt-settings .qt-section-header .setting-item-name {\n  margin: 0;\n  font-size: var(--font-ui-small);\n  font-weight: 600;\n}\n.qt-settings .qt-help-toggle {\n  padding: 4px;\n  color: var(--text-faint);\n}\n.qt-settings .qt-help-toggle svg {\n  width: 14px;\n  height: 14px;\n}\n.qt-settings .qt-help {\n  font-size: var(--font-ui-small);\n  color: var(--text-muted);\n  padding: 10px 12px 10px 30px;\n  margin: 0 0 12px;\n  background: var(--background-secondary);\n  border-radius: var(--radius-s, 4px);\n  line-height: 1.6;\n}\n.qt-settings .qt-help[hidden] {\n  display: none;\n}\n.qt-settings .qt-help {\n  list-style: disc;\n  white-space: normal;\n}\n.qt-settings .qt-help li {\n  margin: 4px 0;\n}\n.qt-settings .qt-exclusions-field {\n  flex-direction: column;\n  align-items: stretch;\n  gap: 12px;\n}\n.qt-settings .setting-item.qt-language-field {\n  flex-direction: row;\n  flex-wrap: nowrap;\n  align-items: center;\n}\n.qt-settings .qt-language-field > .setting-item-info {\n  flex: 1;\n  min-width: 0;\n}\n.qt-settings .qt-language-field > .setting-item-control {\n  flex: 0 0 auto;\n  width: auto;\n}\n.qt-settings .qt-exclusions-field > .setting-item-control {\n  display: block;\n  width: 100%;\n}\n.qt-settings .qt-delay-value {\n  white-space: nowrap;\n  min-width: 56px;\n  font-variant-numeric: tabular-nums;\n}\n.qt-settings .qt-add-directory {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n.qt-settings .qt-add-directory input {\n  flex: 1;\n  min-width: 0;\n  width: 100%;\n}\n.qt-settings .qt-exclusion-list {\n  margin-bottom: 10px;\n}\n.qt-settings .qt-exclusion-row {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  min-height: 38px;\n  padding: 4px 8px;\n  border-bottom: 1px solid var(--background-modifier-border);\n}\n.qt-settings .qt-folder-icon {\n  display: flex;\n  color: var(--text-faint);\n}\n.qt-settings .qt-folder-icon svg {\n  width: 16px;\n  height: 16px;\n}\n.qt-settings .qt-folder-path {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: var(--font-ui-small);\n}\n.qt-settings .qt-empty {\n  font-size: var(--font-ui-small);\n  color: var(--text-faint);\n  margin: 0 0 12px;\n}\n.qt-settings .qt-text-button {\n  margin-top: 10px;\n  padding: 0;\n  background: transparent;\n  box-shadow: none;\n  border: 0;\n  color: var(--text-muted);\n  font-size: var(--font-ui-smaller);\n}\n.qt-settings .qt-text-button:hover {\n  color: var(--text-accent);\n}\n.qt-explorer[data-qt-trigger=\"handle\"] .qt-handle,\n.qt-handle:focus-visible {\n  opacity: 0.8;\n}\n.qt-handle:focus-visible {\n  outline: 2px solid var(--interactive-accent);\n}\n\n.qt-explorer .qt-source {\n  opacity: 0.38;\n  background: var(--background-modifier-hover);\n}\n.qt-explorer .qt-inside {\n  box-shadow: inset 0 0 0 2px var(--interactive-accent);\n  background: var(--background-modifier-hover);\n  border-radius: 5px;\n}\n.qt-explorer.qt-dragging,\n.qt-explorer.qt-dragging *,\n.qt-drag-surface {\n  cursor: grabbing;\n  user-select: none;\n  -webkit-user-select: none;\n}\n.qt-ghost {\n  position: fixed;\n  left: 0;\n  top: 0;\n  z-index: 10000;\n  pointer-events: none;\n  max-width: calc(100vw - 16px);\n  padding: 0;\n  color: var(--text-normal);\n  will-change: transform;\n}\n.qt-ghost-card {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  min-height: 36px;\n  padding: 7px 10px;\n  box-sizing: border-box;\n  border: 1px solid var(--interactive-accent);\n  border-radius: 6px;\n  background: color-mix(in srgb, var(--interactive-accent) 16%, var(--background-primary));\n  box-shadow:\n    0 8px 20px #0003,\n    0 2px 5px #0002;\n  animation: qt-pickup 170ms cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n.qt-ghost-cancel {\n  display: flex;\n  align-items: center;\n  justify-content: flex-start;\n  padding-inline-start: 44px;\n  gap: 4px;\n  color: var(--text-muted);\n  font-size: var(--font-ui-smaller);\n  line-height: 1.4;\n}\n.qt-ghost-cancel kbd {\n  font: inherit;\n  padding: 0 4px;\n  border: 1px solid var(--background-modifier-border);\n  border-radius: 3px;\n  background: var(--background-primary);\n  box-shadow: 0 1px 0 var(--background-modifier-border);\n}\n.qt-cancel-zone {\n  position: fixed;\n  z-index: 10002;\n  left: 16px;\n  right: 16px;\n  bottom: calc(12px + env(safe-area-inset-bottom, 0px));\n  max-width: 360px;\n  margin: 0 auto;\n  min-height: 64px;\n  box-sizing: border-box;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n  padding: 12px 16px;\n  border: 1px solid var(--background-modifier-border);\n  border-radius: 14px;\n  background: var(--background-primary);\n  color: var(--text-muted);\n  font-size: var(--font-ui-small);\n  box-shadow: 0 4px 24px #0003;\n  pointer-events: none;\n}\n.qt-cancel-zone > span:first-child {\n  display: flex;\n}\n.qt-cancel-zone svg {\n  width: 18px;\n  height: 18px;\n}\n.qt-cancel-zone.is-active {\n  border: 2px solid var(--text-error);\n  color: var(--text-error);\n  background: color-mix(in srgb, var(--text-error) 12%, var(--background-primary));\n}\n.qt-ghost-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n.qt-ghost-grip,\n.qt-ghost-icon {\n  display: flex;\n  flex-shrink: 0;\n}\n.qt-ghost-grip {\n  color: var(--text-muted);\n}\n.qt-ghost-grip svg {\n  width: 12px;\n  height: 16px;\n}\n.qt-ghost-icon svg {\n  width: 16px;\n  height: 16px;\n}\n.qt-ghost-badge {\n  flex-shrink: 0;\n  font-size: 10px;\n  line-height: 16px;\n  padding: 0 4px;\n  border: 1px solid color-mix(in srgb, var(--interactive-accent) 40%, transparent);\n  border-radius: 3px;\n  color: var(--text-muted);\n}\n@keyframes qt-pickup {\n  from {\n    opacity: 0.55;\n    transform: translateY(3px) scale(0.96);\n    box-shadow: none;\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0) scale(1);\n  }\n}\n.qt-ghost strong,\n.qt-ghost-label {\n  display: block;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.qt-ghost strong {\n  flex: 1;\n  min-width: 0;\n  font-size: var(--font-ui-small);\n  font-weight: 600;\n}\n.qt-ghost-label {\n  margin-top: 4px;\n  font-size: var(--font-ui-smaller);\n  color: var(--text-muted);\n}\n.qt-drop-line {\n  position: fixed;\n  left: 0;\n  top: 0;\n  height: 2px;\n  z-index: 9999;\n  pointer-events: none;\n  background: var(--interactive-accent);\n  border-radius: 2px;\n  transition: width 100ms ease-out;\n}\n.qt-drop-line::before {\n  content: \"\";\n  position: absolute;\n  left: -3px;\n  top: -3px;\n  width: 8px;\n  height: 8px;\n  box-sizing: border-box;\n  border: 2px solid var(--interactive-accent);\n  border-radius: 50%;\n  background: var(--background-primary);\n}\n.qt-picker {\n  position: fixed;\n  z-index: 10001;\n  pointer-events: none;\n  border: 1px solid var(--background-modifier-border);\n  border-radius: 9px;\n  background: var(--background-primary);\n  color: var(--text-normal);\n  box-shadow: 0 10px 30px #0003;\n  overflow: hidden;\n  animation: qt-lift 120ms ease-out;\n}\n.qt-picker-heading {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  height: 30px;\n  padding: 6px 10px;\n  font-size: var(--font-ui-smaller);\n  color: var(--text-muted);\n  box-sizing: border-box;\n}\n.qt-picker-heading > span:first-child {\n  display: flex;\n}\n.qt-picker-heading svg {\n  width: 13px;\n  height: 13px;\n}\n.qt-picker-heading small {\n  margin-left: auto;\n  font-size: 9px;\n  color: var(--text-faint);\n  white-space: nowrap;\n}\n.qt-picker-option {\n  gap: 8px;\n  height: 46px;\n  box-sizing: border-box;\n  padding: 6px 10px;\n  display: flex;\n  align-items: center;\n  font-size: var(--font-ui-small);\n  line-height: 1.3;\n  border-top: 1px solid var(--background-modifier-border);\n  overflow: hidden;\n  overflow-wrap: anywhere;\n}\n.qt-picker-icon,\n.qt-picker-check {\n  display: flex;\n  flex-shrink: 0;\n}\n.qt-picker-icon svg,\n.qt-picker-check svg {\n  width: 14px;\n  height: 14px;\n}\n.qt-picker-text {\n  flex: 1;\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n}\n.qt-picker-text strong {\n  font-size: var(--font-ui-small);\n  font-weight: 500;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.qt-picker-text > span {\n  font-size: var(--font-ui-smaller);\n  color: var(--text-muted);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.qt-picker-check {\n  visibility: hidden;\n}\n.qt-picker-option.is-selected .qt-picker-check {\n  visibility: visible;\n}\n.qt-picker-option.is-selected {\n  background: color-mix(in srgb, var(--interactive-accent) 16%, var(--background-primary));\n  color: var(--text-accent);\n}\n.qt-ghost[hidden],\n.qt-picker[hidden],\n.qt-drop-line[hidden] {\n  display: none;\n}\n.qt-settings .qt-error {\n  color: var(--text-error);\n}\n@keyframes qt-lift {\n  from {\n    opacity: 0;\n  }\n  to {\n    opacity: 1;\n  }\n}\n@media (hover: none) {\n  .qt-handle {\n    opacity: 0.65;\n    min-width: 32px;\n    min-height: 28px;\n  }\n}\n@media (max-width: 600px) {\n  .qt-settings .setting-item {\n    flex-wrap: wrap;\n  }\n  .qt-settings .setting-item-control {\n    width: 100%;\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  .qt-ghost,\n  .qt-ghost-card,\n  .qt-picker {\n    animation: none;\n  }\n  .qt-drop-line {\n    transition: none;\n  }\n}\n\n/* ===== aio-explorer 追加：置顶 / 隐藏 视觉标记 ===== */\n.tree-item-self.qt-pinned-item > .tree-item-inner::after {\n  content: \"📌\";\n  margin-inline-start: 6px;\n  font-size: 0.72em;\n  opacity: 0.8;\n  vertical-align: middle;\n}\n.tree-item-self.qt-hidden-item > .tree-item-inner {\n  opacity: 0.4;\n  font-style: italic;\n}\n.tree-item-self.qt-hidden-item {\n  text-decoration: line-through;\n  text-decoration-color: var(--text-faint);\n}\n\n/* ===== aio-explorer 追加：专注模式 ===== */\n.qt-focus-icon.is-active {\n  color: var(--interactive-accent);\n  background-color: var(--background-modifier-hover);\n}\n.qt-focus-icon.is-active svg {\n  color: var(--interactive-accent);\n}\n.is-active.qt-focus-icon {\n  box-shadow: inset 0 0 0 1px var(--interactive-accent);\n  border-radius: var(--radius-s);\n}\n\n/* ===== aio-explorer：拖拽排序总开关按钮 =====\n   样式照搬 immersive-folder 的同名按钮。注意选择器必须写足权重：\n   Obsidian 自带 `.nav-buttons-container .nav-action-button.is-active` 权重更高，\n   会被双class 规则覆盖（immersive-folder 源码注释里也提醒了这一点）。*/\n.nav-buttons-container .nav-action-button.qt-drag-sort-icon.is-active {\n  background-color: hsla(var(--color-accent-hsl), 0.18);\n  color: var(--color-accent);\n}\n.nav-buttons-container .nav-action-button.qt-drag-sort-icon {\n  cursor: pointer;\n}\n/* ============================================================\n   aio-explorer：标题栏按钮在窄屏 / 窄侧栏下的协调处理\n   ------------------------------------------------------------\n   背景：Obsidian 的 `.nav-buttons-container` 是 position:absolute\n   贴在标题栏右侧，且 `flex-wrap: nowrap`（workspace-drawer 下强制）。\n   按钮一多，侧栏一窄，标题就被挤掉、按钮甚至会被压成半个方块\n   （半个方块 + is-active 底色 = 用户看到的「空高亮方块」）。\n\n   做法（刻意不用 @container）：\n     CSS 容器查询需要在祖先上声明 container-type，而 container-type\n     会附加 layout containment —— 该元素会变成绝对定位后代的包含块，\n     这会改动 `.nav-buttons-container`（position:absolute）的定位参照，\n     有把标题栏按钮挪位的风险。\n     所以改为：JS 用 ResizeObserver 量侧栏宽度，按阈值挂/摘 class，\n     样式这边只做两件确定安全的事。\n\n   class 由 toggleNavDensity() 维护：\n     .qt-nav-tight  侧栏 < 260px —— 收紧内边距与图标尺寸\n     .qt-nav-tightest 侧栏 < 200px —— 进一步收紧\n   ============================================================ */\n\n/* 1) 按钮永不被压缩、永不换行。\n      这是「显示完整、不变成半个方块」的第一道保证：\n      宁可标题文字让位，图标也必须是完整的正方形。*/\n.workspace-drawer .nav-buttons-container {\n  flex-wrap: nowrap;\n  max-width: 100%;\n}\n.workspace-drawer .nav-buttons-container > .nav-action-button {\n  flex: 0 0 auto;\n  box-sizing: border-box;\n}\n\n/* 2) 侧栏偏窄：收紧内边距 + 缩小图标，7 个按钮仍能排成一行 */\n.workspace-drawer.qt-nav-tight .nav-buttons-container {\n  gap: 0;\n}\n.workspace-drawer.qt-nav-tight .nav-buttons-container > .nav-action-button {\n  padding: var(--size-2-1, 2px);\n  height: var(--touch-size-s, 22px);\n  width: var(--touch-size-s, 22px);\n}\n.workspace-drawer.qt-nav-tight .nav-buttons-container > .nav-action-button > svg {\n  --icon-size: 14px;\n  width: 14px;\n  height: 14px;\n}\n\n/* 极窄（分屏 / 手机横屏）：再收一档，仍保持完整的正方形 */\n.workspace-drawer.qt-nav-tightest .nav-buttons-container > .nav-action-button {\n  padding: 1px;\n  height: 20px;\n  width: 20px;\n}\n.workspace-drawer.qt-nav-tightest .nav-buttons-container > .nav-action-button > svg {\n  --icon-size: 13px;\n  width: 13px;\n  height: 13px;\n}\n\n/* 3) 手机：触控目标不该被压到 20px 以下，改成允许换到第二行——\n      图标依旧完整完整可见，只是排布由一行变两行。*/\nbody.is-phone .workspace-drawer .nav-buttons-container {\n  flex-wrap: wrap;\n  row-gap: var(--size-2-1, 2px);\n}\n\n/* 4) 空间不够时标题先让位：标题是可截断的，按钮必须一直可见。\n      按钮是操作入口，标题只是说明，优先级更低。*/\n.workspace-drawer .workspace-drawer-header-left,\n.workspace-drawer .workspace-drawer-header-name-text {\n  min-width: 0;\n}\n.workspace-drawer .workspace-drawer-header-name-text {\n  text-overflow: ellipsis;\n  overflow: hidden;\n  white-space: nowrap;\n}\n\n/* 5) 图标在按钮内水平居中，避免看起来偏在一侧 */\n.workspace-drawer .nav-buttons-container > .nav-action-button > svg {\n  display: block;\n  margin-inline: auto;\n}\n\n/* ===== aio-explorer：自绘排序图标的尺寸兜底 =====\n   自绘 svg 已带 width/height=16，但主题可能用 --icon-size 覆盖 .svg-icon 的宽高，\n   这里把「图标必须可见」这件事写死：给固定尺寸 + 让 stroke 跟随文字色，\n   避免出现「有底色、没图形」的空方块。*/\n.workspace-drawer .nav-action-button.qt-drag-sort-icon > svg.qt-drag-sort-svg {\n  display: block;\n  width: 16px;\n  height: 16px;\n  min-width: 16px;\n  min-height: 16px;\n  flex: 0 0 auto;\n  color: currentColor;\n  pointer-events: none;\n}\n/* 窄侧栏时跟着一起缩小（与 .qt-nav-tight 的 22px 按钮配套） */\n.workspace-drawer.qt-nav-tight .nav-action-button.qt-drag-sort-icon > svg.qt-drag-sort-svg {\n  width: 14px;\n  height: 14px;\n  min-width: 14px;\n  min-height: 14px;\n}\n.workspace-drawer.qt-nav-tightest .nav-action-button.qt-drag-sort-icon > svg.qt-drag-sort-svg {\n  width: 13px;\n  height: 13px;\n  min-width: 13px;\n  min-height: 13px;\n}\n\n/* ===== aio-explorer：拖拽排序开关的「关闭」外观 =====\n   按钮常驻，关闭时只取消高亮 —— 但要让人一眼看出「现在是关的」。\n   做法：保留图标轮廓（不隐藏、不变形），只把描边色压到 muted 并去掉底色。\n   不用 opacity 整体淡出：那样图标会跟着变淡，在窄屏下更难辨认，\n   而且 immersive-folder 用同样的处理（.immersive-folder-blocked { opacity:.4 }）\n   会让「关掉的按钮」看起来像坏了。这里保持形状清晰，只换颜色。*/\n.workspace-drawer .nav-action-button.qt-drag-sort-icon:not(.is-active) {\n  background-color: transparent;\n  color: var(--text-faint);\n}\n.workspace-drawer .nav-action-button.qt-drag-sort-icon:not(.is-active) > svg.qt-drag-sort-svg {\n  color: var(--text-faint);\n}\n.workspace-drawer .nav-action-button.qt-drag-sort-icon:not(.is-active):hover {\n  background-color: var(--background-modifier-hover);\n  color: var(--text-normal);\n}\n.workspace-drawer .nav-action-button.qt-drag-sort-icon:not(.is-active):hover > svg.qt-drag-sort-svg {\n  color: var(--text-normal);\n}\n\n/* ============================================================\n   笔记计数（融合 File Explorer Note Count）\n   ------------------------------------------------------------\n   原插件用「写 data-count 属性 + CSS ::after 显示」的做法，\n   这里沿用同一套机制，规则基本照搬（选择器与属性名保持一致），\n   仅调整了与本插件已有样式的配合。\n\n   为什么用 data-count 而不是直接插文字节点：\n   文字节点会被 Obsidian 的虚拟滚动回收/重建，属性则会跟随行元素，\n   在行被复用后依然保留 —— 这与文件树「虚拟滚动、DOM 节点回收复用」\n   的机制是相容的。\n   ============================================================ */\n\n/* 计数数字本体 */\n.nav-folder-title[data-count]::after,\n.qt-root-folder-title[data-count]::after {\n  content: attr(data-count);\n  display: inline-block;\n  position: relative;\n  font-size: calc(100% * 0.8);\n  margin-right: 4px;\n  padding: 2px 0;\n  transition: opacity 100ms ease-in-out;\n}\n\n/* 根文件夹行（库名 + 全库总数） */\n.qt-root-folder-title {\n  display: flex;\n}\n.qt-root-folder-row {\n  margin-top: 15px;\n}\n\n/* 「折叠时也显示数量」的开关效果：\n   关闭时，只显示【折叠着】的目录的数字（已展开的目录里能直接看到内容，\n   数字视为冗余）；打开时，展开与折叠都显示。\n\n   ★ 为什么改用 .qt-hide-expanded-count 而不是原来的 body 全局类：\n     原插件靠 body 上的 oz-show-all-num 开关，而这个类需要插件在\n     onLayoutReady 时机正确挂上；一旦时机没走到（布局已就绪后才注册回调、\n     视图尚未挂载等），body 上就永远没有这个类，\n     于是「已展开且含子文件夹」的目录一律被隐藏 —— 表现为\n     第 1、2 层数字消失、第 3 层（叶子目录）正常，且开关显示为「已开启」。\n     改为自己在每个标题元素上打一个明确标记，不依赖任何全局时序。*/\n.qt-hide-expanded-count\n  .nav-folder:not(.is-collapsed)\n  > .nav-folder-title.oz-with-subfolder[data-count]:not([data-path=\"/\"])::after {\n  opacity: 0;\n}\n\n/* 兼容：body 上有全局类时同样隐藏 */\nbody:not(.oz-show-all-num)\n  .nav-folder:not(.is-collapsed)\n  > .nav-folder-title.oz-with-subfolder[data-count]:not([data-path=\"/\"])::after {\n  opacity: 0;\n}\n\n/* 让标题文字先占满剩余宽度，数字自然被推到行尾右侧 */\n.nav-folder-title-content {\n  flex-grow: 1;\n}\n\n/* ============================================================\n   aio-explorer：设置面板的横向分组标签栏\n   ------------------------------------------------------------\n   起因：设置项越来越多，整页拉得很长，滚动找设置很费劲。\n   做法：一级标题横向排成标签栏，点哪个只显示那个分组的内容。\n   宽度不够时标签栏自己横向滚动，不会把页面撑宽。\n   ============================================================ */\n.qt-settings .qt-tab-bar {\n  display: flex;\n  /* aio-explorer（2026-10-21）：由 nowrap + 横向滚动改为 wrap 换行。\n     起因：英文模式下标签更长（General / Dragging / Focus mode / File cleaner /\n     Note count / Note pin / File icons / Title adjust），横向滚动虽然不撑宽页面，\n     但滚动条被隐藏了 → 最右侧标签被裁掉一半，用户看不到自己点的哪个标签。\n     改为换行后，放不下就排到第二排，标签永远完整可见。 */\n  flex-wrap: wrap;\n  gap: var(--size-2-1, 2px);\n  overflow: visible;\n  margin-bottom: var(--size-4-3, 8px);\n  padding-bottom: 2px;\n  border-bottom: 1px solid var(--background-modifier-border);\n}\n/* 单个标签：像一枚药丸，未选中低调、选中明显 */\n.qt-settings .qt-tab {\n  /* 换行后每个标签都要保持自身宽度，绝不被压扁换字 */\n  flex: 0 0 auto;\n  max-width: 100%;\n  appearance: none;\n  cursor: pointer;\n  font-size: var(--font-ui-small);\n  line-height: 1.4;\n  padding: var(--size-2-1, 2px) var(--size-4-3, 8px);\n  border-radius: var(--radius-s);\n  border: 1px solid transparent;\n  background-color: transparent;\n  color: var(--text-muted);\n  white-space: nowrap;\n  transition: background-color 100ms ease-in-out, color 100ms ease-in-out;\n}\n.qt-settings .qt-tab:hover {\n  background-color: var(--background-modifier-hover);\n  color: var(--text-normal);\n}\n/* 选中态：用主题强调色，浅色深色都能分辨 */\n.qt-settings .qt-tab.qt-tab-active {\n  background-color: hsla(var(--color-accent-hsl), 0.16);\n  border-color: hsla(var(--color-accent-hsl), 0.35);\n  color: var(--text-normal);\n  font-weight: var(--font-semibold);\n}\n\n/* 面板：同一时刻只显示当前分组 */\n.qt-settings .qt-tab-panel {\n  display: none;\n}\n.qt-settings .qt-tab-panel.qt-tab-panel-active {\n  display: block;\n}\n\n/* ============================================================\n   专注模式的「设备开关」行\n   ------------------------------------------------------------\n   之前这三行被塞进 setting 的 controlEl（右侧窄栏），\n   「电脑」这种两字标签被挤成竖排、控件也挤在一起。\n   现在改为横跨整行：标签在左、下拉在右，整行对齐。\n   ============================================================ */\n.qt-device-field {\n  /* 让内部这块占满整行，脱离左右两栏的挤压 */\n  flex-direction: column;\n  align-items: stretch;\n  gap: var(--size-2-2, 4px);\n}\n.qt-device-field .setting-item-control {\n  display: none;\n}\n.qt-device-rows {\n  display: flex;\n  flex-direction: column;\n  gap: var(--size-2-1, 2px);\n  width: 100%;\n  min-width: 0;\n}\n/* 每一行：左标签右下拉，中间留空自动对齐 */\n.qt-device-rows .setting-item {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: var(--size-4-3, 8px);\n  border: none;\n  border-radius: var(--radius-s);\n  padding: var(--size-2-1, 2px) 0;\n  min-height: 0;\n  background-color: transparent;\n}\n.qt-device-rows .setting-item:hover {\n  background-color: var(--background-modifier-hover);\n}\n/* 标签不被压成竖排 —— 关键的一条 */\n.qt-device-rows .setting-item-name {\n  flex: 0 0 auto;\n  white-space: nowrap;\n  width: auto;\n  font-size: var(--font-ui-small);\n  color: var(--text-normal);\n}\n.qt-device-rows .setting-item-control {\n  flex: 0 0 auto;\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;\n}\n.qt-device-rows select {\n  min-width: 7em;\n  max-width: 9em;\n}\n/* 当前设备提示：告诉用户「你现在这台是哪台」，避免改错行 */\n.qt-device-hint {\n  margin-top: var(--size-2-2, 4px);\n  font-size: var(--font-ui-smaller, 0.8em);\n  color: var(--text-faint);\n  text-align: right;\n}\n\n/* ============================================================\n   aio-explorer：文件清理（融合 File Cleaner Redux）\n   ------------------------------------------------------------\n   两处用到样式：\n   1) 设置页里的二级分区标题（文件夹 / 文件 / Markdown…）\n   2) 清理前的确认弹窗（清单、计数、按钮）\n   ============================================================ */\n\n/* 二级分区标题：比一级标题弱一档，让 21 项设置有清晰的层次 */\n.qt-settings .setting-item.qt-clean-subhead {\n  border: none;\n  background-color: transparent;\n  padding: var(--size-4-3, 8px) 0 var(--size-2-2, 4px);\n  min-height: 0;\n}\n.qt-settings .qt-clean-subhead .setting-item-name {\n  font-size: var(--font-ui-small);\n  font-weight: var(--font-semibold);\n  color: var(--text-muted);\n  letter-spacing: 0.04em;\n}\n.qt-settings .qt-clean-subhead .setting-item-info {\n  flex: 1 1 auto;\n}\n/* 标题下面一条细分隔线，视觉上把各区分开 */\n.qt-settings .qt-clean-subhead::after {\n  content: \"\";\n  display: block;\n  height: 1px;\n  margin-top: var(--size-2-2, 4px);\n  background-color: var(--background-modifier-border);\n}\n\n/* ── 清理确认弹窗 ── */\n.qt-clean-list {\n  /* 原来 40vh 偏矮，路径折行后行数变多；放宽一点并保留滚动 */\n  max-height: 55vh;\n  overflow-y: auto;\n  overflow-x: hidden;\n  border: 1px solid var(--background-modifier-border);\n  border-radius: var(--radius-s);\n  margin: var(--size-4-2, 6px) 0;\n  padding: var(--size-2-2, 4px) 0;\n}\n.qt-clean-row {\n  display: flex;\n  /* 路径会折成多行，勾选框与标签要顶部对齐，否则勾选框会跑到中间 */\n  align-items: flex-start;\n  gap: var(--size-4-2, 6px);\n  padding: var(--size-2-2, 4px) var(--size-4-2, 6px);\n  border-bottom: 1px solid var(--background-modifier-border);\n}\n.qt-clean-row:last-child {\n  border-bottom: none;\n}\n.qt-clean-row:hover {\n  background-color: var(--background-modifier-hover);\n}\n.qt-clean-row input[type=\"checkbox\"] {\n  flex: 0 0 auto;\n  margin: 0;\n  /* 与第一行文字对齐 */\n  margin-top: 0.2em;\n}\n/* 文件路径：换行完整显示。\n   之前用了 white-space:nowrap + text-overflow:ellipsis，\n   长文件名就被截断成「…/07 第七篇，风险意识篇」，看不出到底要删哪个文件 ——\n   而这恰恰是用户在删除前最需要看清的信息。\n   文件名普遍很长（含目录层级），必须允许折行；折行时用悬挂缩进对齐，\n   方便区分「下一行是新的一项」还是「上一项的续行」。 */\n.qt-clean-row > span:first-of-type {\n  flex: 1 1 auto;\n  min-width: 0;\n  /* 不用 text-overflow，也不 nowrap —— 完整显示 */\n  overflow-wrap: anywhere;\n  word-break: break-word;\n  white-space: normal;\n  font-family: var(--font-monospace);\n  font-size: var(--font-ui-smaller);\n  line-height: 1.5;\n  /* 续行缩进：折行后仍能看出它属于哪一行 */\n  padding-left: 1.2em;\n  text-indent: -1.2em;\n}\n/* 「文件」/「文件夹」标签：靠右、不换行 */\n.qt-clean-kind {\n  flex: 0 0 auto;\n  white-space: nowrap;\n  margin-top: 0.2em;\n  padding: 0 6px;\n  border-radius: var(--radius-s);\n  background-color: var(--background-modifier-border);\n  color: var(--text-muted);\n  font-size: var(--font-ui-smaller);\n}\n.qt-clean-count {\n  color: var(--text-muted);\n  font-size: var(--font-ui-small);\n  margin-bottom: var(--size-4-2, 6px);\n}\n.qt-clean-buttons {\n  display: flex;\n  flex-wrap: wrap;\n  gap: var(--size-2-2, 4px);\n  justify-content: flex-end;\n}\n.qt-clean-buttons button {\n  cursor: pointer;\n}\n\n/* ============================================================\n   aio-explorer：模块总开关（专注 / 文件清理 / 笔记计数）\n   ------------------------------------------------------------\n   这三个开关决定「整页设置当前是否生效」，所以要一眼看得出，\n   做法：加淡色底 + 上方细线，把它和下面的普通设置项区分开。\n   ============================================================ */\n.qt-settings .setting-item.qt-module-switch {\n  margin-bottom: var(--size-4-3, 8px);\n  padding: var(--size-4-2, 6px) var(--size-4-3, 8px);\n  border-radius: var(--radius-m);\n  border: none;\n  background-color: hsla(var(--color-accent-hsl), 0.07);\n  border-top: 2px solid hsla(var(--color-accent-hsl), 0.28);\n}\n.qt-settings .qt-module-switch .setting-item-name {\n  font-weight: var(--font-semibold);\n}\n/* 说明文字缩进对齐，让它和上面的标题不显得是两件独立的事 */\n.qt-settings .qt-module-switch .setting-item-description {\n  font-size: var(--font-ui-smaller);\n  color: var(--text-muted);\n}\n\n/* aio-explorer：启动通知开关的实时状态文字 */\n.qt-inline-status {\n  display: inline-block;\n  margin-left: 8px;\n  padding: 1px 8px;\n  border-radius: 999px;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--text-muted);\n  background: var(--background-modifier-border);\n  vertical-align: middle;\n}\n.qt-inline-status-off {\n  color: var(--text-success, #4caf50);\n  background: var(--background-modifier-success, rgba(76, 175, 80, 0.15));\n}\n\n\n/* ===== 文件置顶 =====\n   样式随 Aio Explorer 自带。 */\n/* Native theme tokens; every rule is scoped to this view. */\n.workspace-leaf-content[data-type=\"000folder-pin-view\"] .view-content.fpv-root,\n.workspace-leaf-content[data-type=\"000quiet-tree-note-pin\"] .view-content.fpv-root {\n    display: flex;\n    flex-direction: column;\n    height: 100%;\n    min-height: 0;\n    container: fpv / inline-size;\n    padding: 0;\n    overflow: hidden;\n}\n.fpv-root .fpv-toolbar {\n    display: flex;\n    flex: 0 0 auto;\n    align-items: center;\n    justify-content: center;\n    gap: 2px;\n    padding: 6px 8px 4px;\n    flex-wrap: nowrap;\n    min-width: 0;\n}\n.fpv-root button.fpv-tool {\n    --icon-size: var(--icon-m, 18px);\n    display: inline-flex;\n    flex: 0 1 30px;\n    align-items: center;\n    justify-content: center;\n    width: 30px;\n    min-width: 0;\n    box-sizing: border-box;\n    height: 28px;\n    padding: 5px;\n    border: 0;\n    border-radius: var(--clickable-icon-radius, 4px);\n    background: transparent;\n    box-shadow: none;\n    color: var(--icon-color, var(--text-muted));\n    cursor: var(--cursor, default);\n}\n.fpv-root button.fpv-tool:hover { background: var(--background-modifier-hover); color: var(--icon-color-hover, var(--text-normal)); }\n.fpv-root button.fpv-tool.is-active { background: var(--background-modifier-active-hover); color: var(--text-normal); }\n.fpv-root button.fpv-tool:disabled { opacity: 0.4; cursor: default; }\n.fpv-root .fpv-selection-bar {\n    display: flex;\n    flex: 0 0 auto;\n    align-items: center;\n    justify-content: space-between;\n    gap: 8px;\n    padding: 4px 10px;\n    font-size: var(--font-ui-small);\n    color: var(--text-muted);\n    border-bottom: 1px solid var(--background-modifier-border);\n}\n.fpv-root .fpv-selection-bar[hidden] { display: none; }\n.fpv-root .fpv-selection-bar button { padding: 2px 8px; height: auto; font-size: inherit; }\n.fpv-root .fpv-tool svg { width: var(--icon-size); height: var(--icon-size); max-width: 100%; flex-shrink: 1; stroke-width: var(--icon-stroke, 1.75px); }\n/* Keep all six actions visible as the sidebar narrows, without resize handlers. */\n@container fpv (max-width: 205px) {\n    .fpv-root .fpv-toolbar { gap: 1px; padding-inline: 4px; }\n    .fpv-root button.fpv-tool { padding-inline: 3px; }\n}\n@container fpv (max-width: 175px) {\n    .fpv-root .fpv-toolbar { gap: 0; padding-inline: 2px; }\n    .fpv-root button.fpv-tool { --icon-size: 16px; padding-inline: 2px; }\n}\n.fpv-root .fpv-bar {\n    display: flex;\n    flex: 0 1 auto;\n    flex-direction: column;\n    align-items: stretch;\n    gap: 1px;\n    min-width: 0;\n    min-height: 0;\n    padding: 4px 8px 7px;\n    overflow-y: auto;\n    overscroll-behavior-y: contain;\n    scrollbar-width: thin;\n}\n.fpv-root .fpv-bar::-webkit-scrollbar { width: 8px; }\n.fpv-root .fpv-bar[hidden] { display: none; }\n.fpv-root .fpv-subfolder-bar {\n    padding-top: 0;\n    padding-bottom: 6px;\n    border-bottom: 1px solid var(--background-modifier-border);\n    margin-bottom: 3px;\n}\n.fpv-root .fpv-subfolder-bar button.fpv-pin { height: 25px; font-size: var(--font-ui-smaller, 12px); }\n.fpv-root .fpv-subfolder-bar button.fpv-pin.is-active { box-shadow: inset 2px 0 0 var(--interactive-accent); }\n.fpv-root button.fpv-pin {\n    display: block;\n    flex: 0 0 auto;\n    width: 100%;\n    max-width: 100%;\n    height: 27px;\n    min-height: 0;\n    padding: 3px 9px;\n    overflow: hidden;\n    border: 0;\n    border-radius: var(--radius-s, 4px);\n    background: transparent;\n    box-shadow: none;\n    color: var(--text-muted);\n    font: inherit;\n    font-size: var(--font-ui-small, 13px);\n    font-weight: var(--font-normal, 400);\n    line-height: 21px;\n    text-align: left;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    cursor: var(--cursor, default);\n}\n.fpv-root button.fpv-pin:hover { background: var(--background-modifier-hover); color: var(--text-normal); }\n.fpv-root button.fpv-pin.is-active {\n    color: var(--nav-item-color-active, var(--text-normal));\n    background: var(--nav-item-background-active, var(--background-modifier-hover));\n    font-weight: var(--font-semibold, 600);\n    box-shadow: inset 2px 0 0 var(--interactive-accent);\n}\n.fpv-root .fpv-pin.is-dragging { opacity: 0.45; }\n.fpv-root .fpv-pin.drag-over { outline: 1px solid var(--interactive-accent); outline-offset: -1px; }\n.fpv-root .fpv-pin.fpv-drop-target, .fpv-root .fpv-row.fpv-drop-target { outline: 2px solid var(--interactive-accent); outline-offset: -2px; }\n.fpv-root .fpv-pin.fpv-drop-invalid, .fpv-root .fpv-row.fpv-drop-invalid { outline: 2px solid var(--text-error); outline-offset: -2px; }\n.fpv-root .fpv-tree {\n    flex: 1 1 0;\n    min-height: 0;\n    padding: 2px 8px 10px;\n    overflow-y: auto;\n    overflow-x: hidden;\n    scrollbar-gutter: stable;\n    overflow-anchor: none;\n}\n.fpv-root .fpv-row {\n    display: flex;\n    align-items: center;\n    gap: 4px;\n    min-height: 27px;\n    margin: 0;\n    padding: 3px 8px 3px calc(5px + var(--fpv-depth, 0) * var(--nav-item-children-padding-start, 16px));\n    border-radius: var(--nav-item-radius, 4px);\n    color: var(--nav-item-color, var(--text-muted));\n    font-size: var(--nav-item-size, var(--font-ui-small, 13px));\n    font-weight: var(--nav-item-weight, 400);\n    line-height: 1.5;\n    cursor: var(--cursor, default);\n    user-select: none;\n}\n.fpv-root .fpv-row:hover { background: var(--nav-item-background-hover, var(--background-modifier-hover)); color: var(--nav-item-color-hover, var(--text-normal)); }\n.fpv-root .fpv-row.is-active { background: var(--nav-item-background-active, var(--background-modifier-hover)); color: var(--nav-item-color-active, var(--text-normal)); }\n.fpv-root .fpv-row.is-selected { background: var(--nav-item-background-selected, var(--background-modifier-hover)); color: var(--nav-item-color-selected, var(--text-normal)); }\n.fpv-root .fpv-row.is-dragging { opacity: 0.45; }\n.fpv-root .fpv-arrow { display: flex; flex: 0 0 14px; width: 14px; color: var(--nav-collapse-icon-color, var(--text-faint)); }\n.fpv-root .fpv-arrow svg { width: 14px; height: 14px; stroke-width: 2px; }\n.fpv-root .fpv-row[aria-expanded=\"true\"] > .fpv-arrow { transform: rotate(90deg); }\n.fpv-root .fpv-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.fpv-root .fpv-tool:focus-visible,\n.fpv-root .fpv-pin:focus-visible,\n.fpv-root .fpv-row:focus-visible { outline: 2px solid var(--background-modifier-border-focus, var(--interactive-accent)); outline-offset: -2px; }\n.fpv-root .fpv-empty { padding: 14px 8px; color: var(--text-muted); font-size: var(--font-ui-small, 13px); line-height: 1.6; }\n.fpv-root .fpv-hint { color: var(--text-faint); padding-top: 4px; }\n.fpv-root .fpv-editor-row { padding: 2px 5px 5px calc(23px + var(--fpv-depth, 0) * 16px); }\n.fpv-root input.fpv-input { width: 100%; height: 28px; font-size: var(--font-ui-small, 13px); }\n.fpv-root .fpv-input-message { padding: 4px 0 0; color: var(--text-muted); font-size: var(--font-ui-smaller, 12px); line-height: 1.4; overflow-wrap: anywhere; }\n.fpv-root .fpv-input[aria-invalid=\"true\"] { border-color: var(--text-error); }\n.fpv-root .fpv-input[aria-invalid=\"true\"] + .fpv-input-message { color: var(--text-error); }\n.fpv-root .fpv-row[hidden], .fpv-root .fpv-empty[hidden] { display: none; }\n@media (pointer: coarse) {\n    .fpv-root button.fpv-tool { width: 36px; height: 36px; }\n    .fpv-root button.fpv-pin { height: 32px; }\n    .fpv-root .fpv-row { min-height: 34px; }\n}\n\n/* ============================================================================\n   aio-explorer：文件图标 —— 多彩文件夹图标\n   多彩文件夹图标的完整实现。\n   ----------------------------------------------------------------------------\n   工作原理（与主题版完全一致）：\n   1) 按文件夹在列表中的兄弟位置取模 7（nth-child 7n+2 ~ 7n+8）循环上色；\n      （2026-10-21 起为 7 色：红/橙/黄/绿/青/蓝/紫，按用户要求去掉了粉色）\n   2) 颜色写在 --qt-colorful-folder-color 变量上，由后代图标继承；\n   3) 文件夹图标的 svg 设为透明，容器用 mask 画出文件夹形状，\n      background-color 透出 → 形成彩色文件夹图标；\n   4) 根目录（库名）图标保持默认色，不参与循环。\n   开关：设置 → Aio Explorer →「文件图标」→ 先开总开关，再开「多彩文件夹图标」。\n   颜色优先取主题的 --color-* 变量；主题没定义时用括号内的兜底色\n   （即 Border 主题浅色模式的取值），换任何主题都不会失色。\n   类名用插件自己的 qt-colorful-folder，与主题的 .colorful-folder 互不干扰。\n   ============================================================================ */\n\n/* 2026-10-21：按用户要求去掉最后一种粉色，由 8 色改为 7 色循环\n   （nth-child 的模数随之从 8 改为 7）\n\n   ★ 2026-10-21 修正：本段原来用 7n+2 ~ 7n+8。\n     CSS 的 nth-child 不允许 n 为负数，所以 7n+8 永远匹配不到「第 1 个」元素\n     （实测 Chrome：position 1 在 7n+8 下 background-color 仍为 rgba(0,0,0,0)），\n     导致列表里第一个文件夹拿不到 --qt-colorful-folder-color；\n     而基础渲染段又把 svg 设成 color: transparent，\n     于是第一个文件夹的图标彻底隐形（且「关闭子文件夹跟随」时必现）。\n     现统一改为 7n+1 ~ 7n+7，与下面「子文件夹跟随」段同一套范式。 */\nbody.qt-colorful-folder .nav-folder.qt-fc1 {\n    --qt-colorful-folder-color: var(--color-red, #dd2c38);\n}\nbody.qt-colorful-folder .nav-folder.qt-fc2 {\n    --qt-colorful-folder-color: var(--color-orange, #de7417);\n}\nbody.qt-colorful-folder .nav-folder.qt-fc3 {\n    --qt-colorful-folder-color: var(--color-yellow, #c09c0c);\n}\nbody.qt-colorful-folder .nav-folder.qt-fc4 {\n    --qt-colorful-folder-color: var(--color-green, #1da51d);\n}\nbody.qt-colorful-folder .nav-folder.qt-fc5 {\n    --qt-colorful-folder-color: var(--color-cyan, #16a6ab);\n}\nbody.qt-colorful-folder .nav-folder.qt-fc6 {\n    --qt-colorful-folder-color: var(--color-blue, #1775d9);\n}\nbody.qt-colorful-folder .nav-folder.qt-fc7 {\n    --qt-colorful-folder-color: var(--color-purple, #8f47e1);\n}\n\n/* 核心上色：只作用于文件列表里的文件夹图标（.collapse-icon 仅文件夹才有）。\n   比主题基础规则多写一个 .nav-folder，保证 specificity 压过\n   body:not(.file-icon-remove) ... .tree-item-icon.collapse-icon 的\n   background-color: currentColor，颜色循环必然生效。 */\nbody.qt-colorful-folder .workspace-leaf-content[data-type=\"file-explorer\"] .nav-folder .tree-item-icon.collapse-icon {\n    background-color: var(--qt-colorful-folder-color);\n}\n\n/* ============================================================================\n   aio-explorer：文件图标 —— 子文件夹图标颜色跟随一级文件夹\n   ---------------------------------------------------------------------------\n   提取自用户自定义片段「(自定义)子文件夹图标颜色跟随一级文件夹.css」，未改动片段文件。\n\n   要解决的问题：\n     主题的「多彩文件夹图标」按文件夹在列表中的**兄弟位置**循环上色，\n     ① 每进入一层就重新轮一遍；② 文件树是虚拟滚动，只渲染看得见的行，\n        一滚动「位置」就变了 → 颜色跟着变。同一层文件夹颜色五颜六色，很难认。\n\n   本规则改成：颜色由**所在一级文件夹的位置**决定，一级颜色定死后不再变化。\n     ① 一级文件夹按在列表中的顺序循环 7 色（红橙黄绿青蓝紫）；\n     ② 所有子层级文件夹通过 CSS 变量继承自动跟随所属一级文件夹的颜色，\n        并随纵向指引线一起变色；\n     ③ 因为是 DOM 位置而非路径，所以换任何目录结构、任何用户都生效，\n        也不会暴露使用者的文件夹名字。\n\n   与原片段的差别：\n     · 原片段按文件夹名字（data-path）写死 14 行对照表 + 灰色兜底，\n       别人装上完全不生效；现改为按位置自动循环，任何目录结构都有效。\n     · 选择器前缀由主题的 `.colorful-folder` 换成插件自己的 `qt-colorful-folder`，\n       只需打开本插件的「多彩文件夹图标」开关就生效。\n   ============================================================================ */\n\n/* 一级文件夹：按在列表中的出现顺序循环 7 色。\n   CSS 自定义属性会自动继承给后代，所以下面这一组规则只要作用在【一级文件夹】上，\n   它下面的所有子文件夹就都会跟着用同一个颜色 —— 不需要为子文件夹单独写规则。\n\n   ★ 一级文件夹怎么选中（本项目踩过最大的坑，务必保留）：\n     不用 CSS 选择器判断，改由插件用 JS 打类 —— 见 main.js 的 markFirstLevelFolders()。\n     原因（2026-10-21 从 obsidian.asar 1.14.4 核心代码实证）：\n     · 文件树【从不】给任何节点加 .mod-root —— core 里 mod-root 只出现在\n       发布站点树和工作区容器上；官方 app.css 里那条 .nav-folder.mod-root\n       是历史遗留规则。所以任何以 .mod-root 为锚点的选择器在真实环境命中 0。\n     · 一级文件夹挂在 rootEl.childrenEl（一个【没有 class 的 div】）下，\n       纯 CSS 无法把它和二级文件夹区分开。\n     · 可靠的判据是 data-path（core 里 selfEl.setAttr(\"data-path\", file.path)）：\n       一级 = 路径不含 \"/\"，更深层级 = 含 \"/\"。插件据此打 .qt-first 与 .qt-first-cN。\n     · 颜色序号也不靠 :nth-child —— 文件树是虚拟滚动，DOM 里只有可见行，\n       :nth-child 会随滚动乱跳。序号由插件从 vault 取【完整顺序】后算好。\n\n   类名由 JS 打：.qt-first-c1 ~ .qt-first-c7 = 7 色循环。\n\n   子文件夹不写任何 --wb-branch-color 规则 —— 保持从父级继承来的值。\n   （如果给所有 .nav-folder 都设兜底色，就会把继承值覆盖成灰色，\n     这正是旧实现里子文件夹颜色不对的原因。）\n\n   子文件夹不写任何 --wb-branch-color 规则 —— 保持从父级继承来的值。\n   （如果给所有 .nav-folder 都设兜底色，就会把继承值覆盖成灰色，\n     这正是旧实现里子文件夹颜色不对的原因。） */\nbody.qt-subfolder-inherit .nav-folder.qt-first-c1 {\n    --wb-branch-color: var(--color-red, #dd2c38);\n}\nbody.qt-subfolder-inherit .nav-folder.qt-first-c2 {\n    --wb-branch-color: var(--color-orange, #de7417);\n}\nbody.qt-subfolder-inherit .nav-folder.qt-first-c3 {\n    --wb-branch-color: var(--color-yellow, #c09c0c);\n}\nbody.qt-subfolder-inherit .nav-folder.qt-first-c4 {\n    --wb-branch-color: var(--color-green, #1da51d);\n}\nbody.qt-subfolder-inherit .nav-folder.qt-first-c5 {\n    --wb-branch-color: var(--color-cyan, #16a6ab);\n}\nbody.qt-subfolder-inherit .nav-folder.qt-first-c6 {\n    --wb-branch-color: var(--color-blue, #1775d9);\n}\nbody.qt-subfolder-inherit .nav-folder.qt-first-c7 {\n    --wb-branch-color: var(--color-purple, #8f47e1);\n}\n\n/* 图标上色：选择器比「多彩文件夹图标」段更长（多 .nav-folder + !important），\n   颜色优先用一级文件夹的颜色。\n   ★ 加 var(--wb-branch-color, currentColor) 兜底：万一某一级文件夹没被\n     上面 7 条命中（例如层级结构特殊），至少退回主题默认文字色，\n     绝不会出现「变量为空 → 背景全透明 → 图标消失」这种静默故障。 */\nbody.qt-subfolder-inherit.qt-colorful-folder\n    .workspace-leaf-content[data-type=\"file-explorer\"]\n    .nav-folder .tree-item-icon.collapse-icon {\n    background-color: var(--wb-branch-color, currentColor) !important;\n}\n\n/* 纵向指引线用同一个颜色（Obsidian 的指引线颜色取自 --nav-indentation-guide-color） */\nbody.qt-subfolder-inherit .nav-folder > .nav-folder-children {\n    --nav-indentation-guide-color:\n        color-mix(in srgb, var(--wb-branch-color, currentColor) 70%, transparent);\n}\n\n\n/* ---- 以下为基础渲染规则，让「彩色形状」在任何主题下都能正确显示 ----\n   若正在使用 Border 主题，这些规则与其自带规则形状完全相同，覆盖后无差异。 */\n\n/* 文件夹展开态：容器 mask 成文件夹形状，svg 透明让底色透出 */\nbody.qt-colorful-folder .workspace-leaf-content[data-type=\"file-explorer\"] .nav-folder .tree-item-icon.collapse-icon {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cpath stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333' d='M4 9.333 4.967 7.4a1.333 1.333 0 0 1 1.193-.733h7.173m0 0a1.333 1.333 0 0 1 1.294 1.666l-1.034 4a1.333 1.333 0 0 1-1.293 1H2.667A1.333 1.333 0 0 1 1.333 12V3.333C1.333 2.6 1.933 2 2.667 2h2.62a1.333 1.333 0 0 1 1.106.6l.547.8a1.333 1.333 0 0 0 1.107.6H12a1.333 1.333 0 0 1 1.333 1.333v1.334Z'/%3e%3c/svg%3e\");\n}\nbody.qt-colorful-folder .workspace-leaf-content[data-type=\"file-explorer\"] .nav-folder .tree-item-icon.collapse-icon svg.svg-icon {\n    color: transparent;\n}\n/* 文件夹折叠态：换成收起来的文件夹形状 */\nbody.qt-colorful-folder .workspace-leaf-content[data-type=\"file-explorer\"] .nav-folder.is-collapsed .tree-item-icon.collapse-icon {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cpath stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333' d='M2.667 13.333h10.666A1.333 1.333 0 0 0 14.667 12V5.333A1.333 1.333 0 0 0 13.333 4H8.047a1.333 1.333 0 0 1-1.107-.6l-.547-.8A1.333 1.333 0 0 0 5.287 2h-2.62a1.333 1.333 0 0 0-1.334 1.333V12c0 .733.6 1.333 1.334 1.333Z'/%3e%3c/svg%3e\");\n}\n\n\n/* ============================================================================\n   aio-explorer：文件图标 —— 自定义图标 + 文件夹字体加粗\n   · 整套图标系统（文件夹展开/折叠形状、文件按扩展名分图标、根目录库名图标、\n     标签/书签面板图标），选择器前缀为插件自己的 body.qt-custom-icons；\n   · 文件夹字体加粗通过 --nav-item-weight 系列变量实现 —— 这些变量由 Obsidian 核心消费\n     （app.css: .tree-item-self { font-weight: var(--nav-item-weight) }），\n     因此换任何主题都有效。\n   ----------------------------------------------------------------------------\n   开关语义（与用户在 Border 里的体验对应）：\n   · 自定义图标 开 = 显示提取出来的这套图标；关 = 不显示，回归主题/软件原生状态。\n     在 Border 主题下与主题自带图标完全相同（规则一致，覆盖无差异）；\n     本开关主要供切换到其他主题时使用。\n   · 文件夹字体加粗 开 = 文件列表里的文件夹名称加粗；关 = 恢复正常字重。\n   两者都受「文件图标」总开关控制，拨动立即生效。\n   ============================================================================ */\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"tag\"] .tree-item:not(:hover) .tree-item-icon.collapse-icon svg.svg-icon,\nbody.qt-custom-icons .workspace-leaf-content:is([data-type=\"bookmarks\"], [data-type=\"file-explorer\"]) .tree-item-icon.collapse-icon svg.svg-icon {\n    color: transparent;\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"tag\"] .tree-item:not(:hover) .tree-item-icon.collapse-icon,\nbody.qt-custom-icons .workspace-leaf-content:is([data-type=\"bookmarks\"], [data-type=\"file-explorer\"]) .tree-item-icon.collapse-icon {\n    background-color: currentColor;\n    opacity: var(--icon-opacity);\n}\n\n/* ★ 2026-10-21 修正（本轮实测抓到的回归）：\n   下面这条原本照抄主题的\n       :is(.nav-file-title, .nav-folder.mod-root > .nav-folder-title)::before\n   上一轮清理 mod-root 锚点时，被误改成 `.nav-folder > .nav-folder-title`，\n   结果【每个文件夹】都多出一个 ::before 伪元素。\n   而紧随其后那条规则给这个 ::before 画的 mask 是主题给「库根（vault 名）」\n   用的仓库图标（一个方框里带圆点），不是文件夹。\n   更糟的是这个 ::before 与真正的文件夹图标 .tree-item-icon 位置完全重叠：\n       ::before          position:absolute; margin-left:calc(-1 * var(--size-4-5))\n       .tree-item-icon   position:absolute; margin-inline-start:calc(-1 * var(--size-4-5))\n   于是黑色的仓库方框把彩色的文件夹图标整个盖住 →\n   用户看到的现象正是「图标形状不对 + 完全没有颜色」。\n   正确做法：文件夹的 ::before 整条删掉（主题原文只给 mod-root 库根行，\n   而文件树从不渲染库根那一行），只保留 .nav-file-title 的文件图标。\n   同理，下一条给文件夹 ::before 设 mask 的规则也一并删除。 */\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"tag\"] .tree-item-self:not(.mod-collapsible):before,\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"file-explorer\"] .nav-file-title::before {\n    content: \" \";\n    position: absolute;\n    margin-left: calc(-1 * var(--size-4-5));\n    width: var(--size-4-4);\n    height: var(--size-4-4);\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    opacity: var(--icon-opacity);\n    background-color: currentColor;\n    flex: 0 0 auto;\n}\n\n/* 2026-10-21：随上一条一起删除。这里原本给「文件夹 ::before」设 mask，\n   而那个 ::before 本身就是误加的（见上）。库根图标交给主题的 mod-root 规则处理，\n   本插件不再重复绘制，避免与 .tree-item-icon 抢位置。 */\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"file-explorer\"] .tree-item-icon.collapse-icon,\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"bookmarks\"] .tree-item-icon.collapse-icon {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cpath stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333' d='M4 9.333 4.967 7.4a1.333 1.333 0 0 1 1.193-.733h7.173m0 0a1.333 1.333 0 0 1 1.294 1.666l-1.034 4a1.333 1.333 0 0 1-1.293 1H2.667A1.333 1.333 0 0 1 1.333 12V3.333C1.333 2.6 1.933 2 2.667 2h2.62a1.333 1.333 0 0 1 1.106.6l.547.8a1.333 1.333 0 0 0 1.107.6H12a1.333 1.333 0 0 1 1.333 1.333v1.334Z'/%3e%3c/svg%3e\");\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"file-explorer\"] .is-collapsed .tree-item-icon.collapse-icon,\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"bookmarks\"] .is-collapsed .tree-item-icon.collapse-icon {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cpath stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333' d='M2.667 13.333h10.666A1.333 1.333 0 0 0 14.667 12V5.333A1.333 1.333 0 0 0 13.333 4H8.047a1.333 1.333 0 0 1-1.107-.6l-.547-.8A1.333 1.333 0 0 0 5.287 2h-2.62a1.333 1.333 0 0 0-1.334 1.333V12c0 .733.6 1.333 1.334 1.333Z'/%3e%3c/svg%3e\");\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"file-explorer\"] .nav-file-title::before {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cg stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333'%3e%3cpath d='M9.667 1.333H4a1.333 1.333 0 0 0-1.333 1.334v10.666A1.333 1.333 0 0 0 4 14.667h8a1.333 1.333 0 0 0 1.333-1.334V5L9.667 1.333Z'/%3e%3cpath d='M9.333 1.333v4h4'/%3e%3c/g%3e%3c/svg%3e\");\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"file-explorer\"] .nav-file-title[data-path$=\".canvas\"]::before {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cpath stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333' d='M6 2H2.667A.667.667 0 0 0 2 2.667v4.666c0 .369.298.667.667.667H6a.667.667 0 0 0 .667-.667V2.667A.667.667 0 0 0 6 2Zm7.333 0H10a.667.667 0 0 0-.667.667v2c0 .368.299.666.667.666h3.333A.667.667 0 0 0 14 4.667v-2A.667.667 0 0 0 13.333 2Zm0 6H10a.667.667 0 0 0-.667.667v4.666c0 .368.299.667.667.667h3.333a.667.667 0 0 0 .667-.667V8.667A.667.667 0 0 0 13.333 8ZM6 10.667H2.667a.667.667 0 0 0-.667.666v2c0 .368.298.667.667.667H6a.667.667 0 0 0 .667-.667v-2A.667.667 0 0 0 6 10.667Z'/%3e%3c/svg%3e\");\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"file-explorer\"] .nav-file-title[data-path$=\".base\"]::before {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cpath stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333' d='M6 2H2.667A.667.667 0 0 0 2 2.667V6c0 .368.298.667.667.667H6A.667.667 0 0 0 6.667 6V2.667A.667.667 0 0 0 6 2Zm0 7.333H2.667A.667.667 0 0 0 2 10v3.333c0 .368.298.667.667.667H6a.667.667 0 0 0 .667-.667V10A.667.667 0 0 0 6 9.333Zm3.333-6.666H14M9.333 6H14m-4.667 4H14m-4.667 3.333H14'/%3e%3c/svg%3e\");\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"file-explorer\"] .is-unsupported.nav-file-title::before {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cg stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333'%3e%3cpath d='M9.667 1.333H4a1.333 1.333 0 0 0-1.333 1.334v10.666A1.333 1.333 0 0 0 4 14.667h8a1.333 1.333 0 0 0 1.333-1.334V5L9.667 1.333Z'/%3e%3cpath d='M6.667 6.867c.133-.267.333-.534.6-.667A1.4 1.4 0 0 1 9 6.467c.2.266.333.533.333.866C9.333 8.2 8 8.667 8 8.667m0 2.666h.007'/%3e%3c/g%3e%3c/svg%3e\");\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"file-explorer\"] .is-unsupported.nav-file-title:is([data-path$=\".zip\"], [data-path$=\".7z\"])::before {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cg stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333'%3e%3cpath d='M2.667 14.667v-12c0-.334.133-.667.4-.934.266-.266.6-.4.933-.4h5.667L13.333 5v8.333c0 .334-.133.667-.4.934-.266.266-.6.4-.933.4h-1.333'/%3e%3cpath d='M9.333 1.333v4h4m-6.666 9.334a1.333 1.333 0 1 0 0-2.667 1.333 1.333 0 0 0 0 2.667Zm0-10V4m0 4v-.667m0 4.667v-1.333'/%3e%3c/g%3e%3c/svg%3e\");\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"file-explorer\"] .nav-file-title[data-path$=\".webm\"]::before {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cg stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333'%3e%3cpath d='M2.667 14.667H12a1.333 1.333 0 0 0 1.333-1.334V5L9.667 1.333H4a1.333 1.333 0 0 0-1.333 1.334v2'/%3e%3cpath d='M9.333 1.333v4h4M4.667 6.667 2.667 8H1.333v2.667h1.334l2 1.333V6.667Zm2.666.666c.427.534.667 1.247.667 2 0 .754-.24 1.467-.667 2'/%3e%3c/g%3e%3c/svg%3e\");\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"file-explorer\"] .nav-file-title:is([data-path$=\".svg\"], [data-path$=\".bmp\"], [data-path$=\".jpeg\"], [data-path$=\".jpg\"], [data-path$=\".png\"], [data-path$=\".gif\"])::before {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cg stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333'%3e%3cpath d='M12.667 2H3.333C2.597 2 2 2.597 2 3.333v9.334C2 13.403 2.597 14 3.333 14h9.334c.736 0 1.333-.597 1.333-1.333V3.333C14 2.597 13.403 2 12.667 2Z'/%3e%3cpath d='M6 7.333a1.333 1.333 0 1 0 0-2.666 1.333 1.333 0 0 0 0 2.666ZM14 10l-2.057-2.057a1.333 1.333 0 0 0-1.886 0L4 14'/%3e%3c/g%3e%3c/svg%3e\");\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"file-explorer\"] .nav-file-title[data-path$=\".pdf\"]::before {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cg stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333'%3e%3cpath d='M9.667 1.333H4a1.333 1.333 0 0 0-1.333 1.334v10.666A1.333 1.333 0 0 0 4 14.667h8a1.333 1.333 0 0 0 1.333-1.334V5L9.667 1.333Z'/%3e%3cpath d='M9.333 1.333v4h4m-2.666 3.334H5.333m5.334 2.666H5.333M6.667 6H5.333'/%3e%3c/g%3e%3c/svg%3e\");\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"file-explorer\"] .nav-file-title[data-path$=\".excalidraw.md\"]::before {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cg stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333' clip-path='url(%23a)'%3e%3cpath d='M8 12.667 12.667 8l2 2L10 14.667l-2-2Z'/%3e%3cpath d='m12 8.667-1-5-9.667-2.334L3.667 11l5 1L12 8.667ZM1.333 1.333l5.058 5.058'/%3e%3cpath d='M7.333 8.667a1.333 1.333 0 1 0 0-2.667 1.333 1.333 0 0 0 0 2.667Z'/%3e%3c/g%3e%3cdefs%3e%3cclipPath id='a'%3e%3cpath fill='white' d='M0 0h16v16H0z'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e\");\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"tag\"] .tree-item:not(:hover) .tree-item-icon.collapse-icon {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cg stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333' clip-path='url(%23a)'%3e%3cpath d='M8.781 1.333c.354 0 .693.14.943.391l4.473 4.473a1.6 1.6 0 0 1 0 2.272l-3.061 3.062a1.6 1.6 0 0 1-2.272 0L4.391 7.057A1.329 1.329 0 0 1 4 6.115V2a.667.667 0 0 1 .667-.667H8.78ZM1.333 4.667V8.78c0 .354.14.693.391.943l4.473 4.473a1.6 1.6 0 0 0 2.128.129'/%3e%3cpath d='M7 4.667A.333.333 0 1 0 7 4a.333.333 0 0 0 0 .667Z'/%3e%3c/g%3e%3cdefs%3e%3cclipPath id='a'%3e%3cpath fill='white' d='M0 0h16v16H0z'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e\");\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"tag\"] .tree-item-self:not(.mod-collapsible)::before {\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cg clip-path='url(%23a)'%3e%3cpath stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333' d='M8 1.333H1.333V8l6.194 6.193a1.617 1.617 0 0 0 2.28 0l4.386-4.386a1.617 1.617 0 0 0 0-2.28L8 1.333ZM4.667 4.667h.006'/%3e%3c/g%3e%3cdefs%3e%3cclipPath id='a'%3e%3cpath fill='white' d='M0 0h16v16H0z'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e\");\n}\n\nbody.qt-custom-icons .workspace-leaf-content[data-type=\"bookmarks\"] svg.lucide-folder {\n    background-color: currentColor;\n    -webkit-mask-image: url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3e%3cg stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.333'%3e%3cpath d='M1.333 6V3.333C1.333 2.6 1.933 2 2.667 2h2.62a1.333 1.333 0 0 1 1.106.6l.547.8a1.333 1.333 0 0 0 1.107.6h5.286a1.333 1.333 0 0 1 1.334 1.333V12a1.333 1.333 0 0 1-1.334 1.333h-12'/%3e%3cpath d='m5.333 10.667 2-2-2-2'/%3e%3cpath d='M1.333 10.667V10a1.333 1.333 0 0 1 1.334-1.333h4'/%3e%3c/g%3e%3c/svg%3e\");\n}\n\n/* ---- 文件夹字体加粗 ----\n   核心 CSS 用 font-weight: var(--nav-item-weight) 渲染标题，\n   悬停/选中态另有 --nav-item-weight-hover / --nav-item-weight-active，\n   三个一起改才不会出现「加粗了但悬停时变回去」的闪跳。\n   2026-10-22：从写死的 bold(700) 改成读 --qt-folder-bold-weight，\n   由 JS 按滑块档位写进 body 的 inline style（400=不加粗=不打这个类）。\n   兜底值 600：万一变量没写进来，用 Obsidian 自己的标准强调档，\n   也不会比原来的 bold 更粗。 */\nbody.qt-folder-bold .nav-folder-title {\n    --nav-item-weight-hover: var(--qt-folder-bold-weight, 600);\n    --nav-item-weight-active: var(--qt-folder-bold-weight, 600);\n    --nav-item-weight: var(--qt-folder-bold-weight, 600);\n}\n/* 双保险：上面只改变量，若用户环境里有规则直接写死 font-weight\n   （例如某些 CSS 片段用 font-weight: 600 !important 强制标题字重），\n   变量的变化就会被压住——开关看似无效。这里再直接声明一次字重，\n   选择器多写一个 .tree-item-self 把 specificity 提到 (0,3,1)，\n   足以压过常见的 body .nav-folder-title 类（(0,2,1)）直接声明。 */\nbody.qt-folder-bold .tree-item-self.nav-folder-title {\n    font-weight: var(--qt-folder-bold-weight, 600) !important;\n}\n\n\n/* ============================================================================\n   aio-explorer：标题换行\n   文件列表标题不修剪文件名。\n   （theme.css 6328-6330 行），未改动主题本身。\n   ----------------------------------------------------------------------------\n   工作原理（与主题版完全一致）：\n   Obsidian 核心给标题文字设的是 white-space: var(--nav-item-white-space)，\n   而 --nav-item-white-space 默认为 pre（不换行），配合 overflow:hidden +\n   text-overflow:ellipsis，长名字会被截断成「前面…后面」。\n   本规则把 white-space 改成 normal，长名字就会在标题框内自动换行成多行，\n   不再截断；文件夹标题与文件标题都生效（与主题版作用范围相同）。\n   开关：设置 → Aio Explorer →「标题换行」→ 拨动立即生效，无需重启。\n   类名用插件自己的 qt-title-wrap，与主题的 .file-names-untrim 互不干扰。\n   ============================================================================ */\n\n/* ============================================================================\n   aio-explorer：设置页「当前生效状态」面板（2026-10-21）\n   让开关到底生不效一眼可见：绿勾=生效中，红叉=没落地。\n   ============================================================================ */\n.qt-live-status {\n    border-top: 1px solid var(--background-modifier-border);\n}\n.qt-live-panel {\n    margin: 4px 0 14px;\n    padding: 10px 12px;\n    border: 1px solid var(--background-modifier-border);\n    border-radius: 8px;\n    background: var(--background-secondary);\n}\n.qt-live-items {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 6px 18px;\n}\n.qt-live-item {\n    display: flex;\n    align-items: baseline;\n    gap: 6px;\n    font-size: var(--font-ui-small);\n}\n.qt-live-name {\n    color: var(--text-muted);\n}\n.qt-live-ok {\n    color: var(--text-success, #2ea043);\n    font-weight: 600;\n}\n.qt-live-size {\n    color: var(--text-normal);\n    font-weight: 600;\n}\n.qt-live-no {\n    color: var(--text-error, #e05252);\n    font-weight: 600;\n}\n.qt-live-hint {\n    margin-top: 6px;\n    font-size: var(--font-ui-smaller);\n    color: var(--text-faint);\n}\n.qt-live-actions {\n    margin-top: 10px;\n}\n.qt-live-actions button.mod-cta {\n    cursor: pointer;\n}\n.qt-live-actions button.mod-cta:disabled {\n    opacity: 0.6;\n    cursor: progress;\n}\n\nbody.qt-title-wrap .workspace-leaf-content[data-type=\"file-explorer\"] :is(.nav-file-title-content, .nav-folder-title-content) {\n    white-space: normal;\n}\n\n/* Aio Explorer:「重置数据」确认弹窗的标题\n   原为createEl(\"h2\")，官方要求标题走CSS 类而非内联/裸标签，\n   改用 h3 + 本类，字号字重与Obsidian 弹窗标题一致。 */\n.qt-modal-heading {\n    margin: 0 0 var(--size-4-2, 8px) 0;\n    font-size: var(--font-ui-large, 1.2em);\n    font-weight: var(--bold-weight, 600);\n    line-height: 1.3;\n    color: var(--text-normal);\n}\n"

/** 判断一个文件是否该被计入（按扩展名白名单/黑名单）。 */
function noteCountFilter(settings) {
  const list = settings.filterList ?? [];
  return (file) => {
    if (!(file instanceof import_obsidian4.TFile)) return false;
    if (list.length === 0) return true;
    const ext = (file.extension || "").toLowerCase();
    return settings.blacklist ? !list.includes(ext) : list.includes(ext);
  };
}

/** 递归统计 folder 下所有符合 filter 的文件数（含子文件夹）。 */
function countNotes(folder, filter) {
  let count = 0;
  for (const child of folder.children ?? []) {
    if (filter(child)) count++;
    if (child instanceof import_obsidian4.TFolder) count += countNotes(child, filter);
  }
  return count;
}

/** 收集 targetPaths 里每个路径的所有祖先（含自身），去重。 */
function collectAffectedFolders(targetPaths) {
  const set = /* @__PURE__ */ new Set();
  for (const path of targetPaths) {
    let current = path;
    while (current && !set.has(current)) {
      set.add(current);
      current = current === "/" ? null : current.slice(0, current.lastIndexOf("/")) || "/";
    }
  }
  return set;
}
/** 按配置层级推导专注目标路径。 */
function focusPathFor(path, level, customFolderPath) {
  if (level === "custom") return customFolderPath || path;
  if (level === "file") return path;
  const parts = path.split("/");
  if (level === "parent") return parts.length <= 1 ? path : parts.slice(0, -1).join("/");
  if (level === "grandparent") return parts.length <= 2 ? parts[0] || path : parts.slice(0, -2).join("/");
  return parts.length <= 3 ? parts[0] || path : parts.slice(0, -3).join("/");
}
function applyHide(items, hidden) {
  if (!hidden?.length) return items;
  const set = new Set(hidden);
  return items.filter((item) => !set.has(item.file.name));
}
function applySortMode(items, mode, names) {
  if (!mode || mode === "custom") return sortItems(items, names, (item) => item.file.name);
  if (mode === "native") return items;
  const arr = [...items];
  const nameOf = (item) => item.file.name;
  const statOf = (item) => item.file.stat ?? {};
  if (mode === "name-asc") return arr.sort((a, b) => nameOf(a).localeCompare(nameOf(b), "zh"));
  if (mode === "name-desc") return arr.sort((a, b) => nameOf(b).localeCompare(nameOf(a), "zh"));
  if (mode === "created-new") return arr.sort((a, b) => (statOf(b).ctime ?? 0) - (statOf(a).ctime ?? 0));
  if (mode === "created-old") return arr.sort((a, b) => (statOf(a).ctime ?? 0) - (statOf(b).ctime ?? 0));
  if (mode === "modified-new") return arr.sort((a, b) => (statOf(b).mtime ?? 0) - (statOf(a).mtime ?? 0));
  if (mode === "modified-old") return arr.sort((a, b) => (statOf(a).mtime ?? 0) - (statOf(b).mtime ?? 0));
  return items;
}
function applyPin(items, pinned) {
  if (!pinned?.length) return items;
  const rank = new Map(pinned.map((name, index) => [name, index]));
  const top = [];
  const rest = [];
  for (const item of items) (rank.has(item.file.name) ? top : rest).push(item);
  top.sort((a, b) => rank.get(a.file.name) - rank.get(b.file.name));
  return [...top, ...rest];
}
/**
 * ★★★ Obsidian 文件树对「文件夹之间」的原生排序比较器
 * （obsidian.asar 1.14.4 getSortedFolderItems 实证，逐字符复刻）：
 *   n.sort((e, n) => {
 *     const i = e instanceof TFolder, r = n instanceof TFolder;
 *     return i || r
 *       ? (i && !r ? -1 : r && !i ? 1 : BT(e.name, n.name))   // 两边都是文件夹 → BT
 *       : qL[this.sortOrder](e, n);                          // 两边都是文件 → 用户的排序设置
 *   });
 *   BT = new Intl.Collator(void 0, { usage: "sort", sensitivity: "base", numeric: true }).compare
 * 三个要点：
 *   1. sortOrder（按名称/修改时间/创建时间）【只作用于文件】；
 *      文件夹之间永远走 BT，与用户的排序设置无关；
 *   2. sensitivity:"base" → 不区分大小写、不区分重音；
 *   3. numeric:true → 自然数字序（"笔记9" 排在 "笔记10" 前面）。
 * 多彩文件夹的顺序表必须用它才能和屏幕显示顺序逐行一致
 * （以前用 (a<b?-1:a>b?1:0) 纯码元序，正是"颜色看着乱"的根因之一）。
 */
const NATIVE_FOLDER_COLLATOR = new Intl.Collator(void 0, { usage: "sort", sensitivity: "base", numeric: true });
function renameOrder(order, oldPath, newPath) {
  const next = /* @__PURE__ */ Object.create(null);
  const oldParent = parentPath(oldPath), newParent = parentPath(newPath);
  for (const [key, names] of Object.entries(order)) {
    const path = key === oldPath || key.startsWith(oldPath + "/") ? newPath + key.slice(oldPath.length) : key;
    let updated = [...names];
    if (key === oldParent)
      updated = oldParent === newParent ? updated.map((n) => n === baseName(oldPath) ? baseName(newPath) : n) : updated.filter((n) => n !== baseName(oldPath));
    if (key === newParent && oldParent !== newParent && order[oldParent]?.includes(baseName(oldPath)) && !updated.includes(baseName(newPath)))
      updated.push(baseName(newPath));
    next[path] = [...new Set(updated)];
  }
  return next;
}
/**
 * aio-explorer 修复：文件重命名/移动后，同步修正 folderSettings 里的
 * pinned / hidden 名单，否则会出现「隐藏/置顶的条目改名后规则失效」，
 * 以及「条目已被移走但hidden 记录还留着（再也匹配不到任何东西）」。
 */
function renameFolderSettings(folderSettings, oldPath, newPath) {
  if (!folderSettings || typeof folderSettings !== "object") return folderSettings;
  const oldParent = parentPath(oldPath), newParent = parentPath(newPath);
  const oldName = baseName(oldPath), newName = baseName(newPath);
  const next = /* @__PURE__ */ Object.create(null);
  for (const [key, entry] of Object.entries(folderSettings)) {
    const path = key === oldPath || key.startsWith(oldPath + "/") ? newPath + key.slice(oldPath.length) : key;
    const value = { ...entry };
    for (const field of ["pinned", "hidden"]) {
      const list = value[field];
      if (!Array.isArray(list)) continue;
      if (key === oldParent) {
        value[field] = oldParent === newParent
          ? [...new Set(list.map((n) => n === oldName ? newName : n))]
          : list.filter((n) => n !== oldName);
      } else if (key === oldPath || key.startsWith(oldPath + "/")) {
        // 目录本身改名：其下 pinned/hidden 的名字不变，无需处理
      }
      if (Array.isArray(value[field]) && value[field].length === 0) delete value[field];
    }
    next[path] = value;
  }
  return next;
}
function deleteOrders(order, paths) {
  const deleted = new Set(paths);
  const removed = (path) => {
    for (; ; ) {
      if (deleted.has(path)) return true;
      const slash = path.lastIndexOf("/");
      if (slash < 0) return false;
      path = path.slice(0, slash);
    }
  };
  const next = /* @__PURE__ */ Object.create(null);
  for (const [key, names] of Object.entries(order)) {
    if (removed(key)) continue;
    next[key] = names.filter((name) => !deleted.has(childPath(key, name)));
  }
  return next;
}
/** aio-explorer 修复：条目被删除后，一并清理 folderSettings 里残留的 pinned/hidden 记录。 */
function deleteFolderSettings(folderSettings, paths) {
  if (!folderSettings || typeof folderSettings !== "object") return folderSettings;
  const deleted = new Set(paths);
  const removed = (path) => {
    for (; ; ) {
      if (deleted.has(path)) return true;
      const slash = path.lastIndexOf("/");
      if (slash < 0) return false;
      path = path.slice(0, slash);
    }
  };
  const next = /* @__PURE__ */ Object.create(null);
  for (const [key, entry] of Object.entries(folderSettings)) {
    if (removed(key)) continue;
    const value = { ...entry };
    for (const field of ["pinned", "hidden"]) {
      const list = value[field];
      if (!Array.isArray(list)) continue;
      const kept = list.filter((name) => !deleted.has(childPath(key, name)));
      if (kept.length) value[field] = kept;
      else delete value[field];
    }
    next[key] = value;
  }
  return next;
}

// src/native.ts
function compatibleExplorer(value) {
  const view = value;
  const root = view?.navFileContainerEl;
  const realm = root?.ownerDocument?.defaultView;
  return !!(realm && typeof realm.ResizeObserver === "function" && typeof realm.MutationObserver === "function" && typeof realm.PointerEvent === "function" && typeof realm.requestAnimationFrame === "function" && typeof root?.querySelectorAll === "function" && typeof view?.getSortedFolderItems === "function" && typeof view.requestSort === "function" && view.fileItems && typeof view.fileItems === "object");
}
function snapshot(app, view) {
  const tree = {
    nodes: /* @__PURE__ */ Object.create(null),
    roots: []
  };
  const expanded = /* @__PURE__ */ new Set();
  function visit(folder, depth) {
    const children = view.getSortedFolderItems(folder).map((item) => item.file);
    const ids = children.map((file) => file.path);
    if (folder.isRoot()) tree.roots = ids;
    else tree.nodes[folder.path].children = ids;
    for (const file of children) {
      tree.nodes[file.path] = {
        id: file.path,
        name: file.name,
        parentId: folder.isRoot() ? null : folder.path,
        kind: file instanceof import_obsidian.TFolder ? "folder" : "file",
        children: []
      };
      if (file instanceof import_obsidian.TFolder && view.fileItems[file.path]?.collapsed === false) {
        expanded.add(file.path);
        visit(file, depth + 1);
      }
    }
  }
  visit(app.vault.getRoot(), 0);
  return { tree, rows: flattenTree(tree, expanded) };
}
function attachSort(view, store, onError = console.error) {
  if (!compatibleExplorer(view)) throw new Error("unavailable");
  const original = view.getSortedFolderItems;
  const hadOwn = Object.hasOwn(view, "getSortedFolderItems");
  let active = true;
  const failed = /* @__PURE__ */ new Set();
  function report(folder, error) {
    if (!failed.has(folder.path)) {
      failed.add(folder.path);
      onError(error);
    }
  }
  function sorted(folder) {
    if (!active) return original.call(this, folder);
    let items;
    try {
      items = original.call(this, folder);
      if (!Array.isArray(items) || items.some((item) => typeof item?.file?.name !== "string"))
        throw new Error("unavailable");
    } catch (error) {
      report(folder, error);
      return folder.children.map((file) => this.fileItems[file.path]).filter(Boolean);
    }
    try {
      if (!active) return items;
      // aio-explorer 追加：专注模式 + 始终隐藏目录。
      // 注意 excluded（排除目录）只影响排序/拖拽，不影响专注与隐藏的可见性判断。
      let list = items;
      list = applyAutoHide(list, store.settings.autoHidePaths);
      if (store.isFocus && store.focusedPath) list = applyFocus(list, store.focusedPath);
      if (excluded(folder.path, store.rules)) return list;
      const config = store.settings.folderSettings?.[folder.path];
      if (!store.settings.showHidden && config?.hidden?.length)
        list = applyHide(list, config.hidden);
      list = applySortMode(list, config?.sortOrder ?? "custom", store.order[folder.path]);
      list = applyPin(list, config?.pinned);
      failed.delete(folder.path);
      return list;
    } catch (error) {
      report(folder, error);
      return items;
    }
  }
  view.getSortedFolderItems = sorted;
  const restore = () => {
    active = false;
    if (view.getSortedFolderItems === sorted) {
      if (hadOwn) view.getSortedFolderItems = original;
      else delete view.getSortedFolderItems;
    }
    try {
      view.requestSort();
    } catch (error) {
      onError(error);
    }
  };
  try {
    view.requestSort();
  } catch (error) {
    restore();
    throw error;
  }
  return restore;
}

// src/drag.ts
var import_obsidian2 = require("obsidian");

// lib/drag-geometry.ts
function nearestGap(y, rowHeight, count, previous) {
  if (previous !== null && Math.abs(y - previous * rowHeight) <= rowHeight / 2 + 5) return previous;
  return Math.max(0, Math.min(count, Math.round(y / rowHeight)));
}
function makeBoundaryPicker(rect, anchorY, count, choice, slotHeight, screenWidth, screenHeight, originX, originY, scrollTop) {
  const width = Math.min(252, Math.max(190, rect.width - 32), screenWidth - 16);
  const side = rect.left + rect.width + 12 + width <= screenWidth - 8 ? "right" : "below";
  const header = 30, height = header + count * slotHeight;
  const left = side === "right" ? rect.left + rect.width + 10 : Math.max(8, Math.min(screenWidth - width - 8, rect.left + rect.width - width - 10));
  const desiredTop = side === "right" ? anchorY - header - (choice + 0.5) * slotHeight : anchorY + 14;
  const top = Math.max(8, Math.min(screenHeight - height - 8, desiredTop));
  return {
    left,
    top,
    width,
    height,
    header,
    slotHeight,
    originX,
    originY,
    scrollTop,
    side,
    armed: false
  };
}
function contains(rect, x, y, padding = 0) {
  return x >= rect.left - padding && x <= rect.left + rect.width + padding && y >= rect.top - padding && y <= rect.top + rect.height + padding;
}
function pickerHit(picker, x, y, count, previousChoice) {
  if (contains(picker, x, y, 4)) {
    if (!picker.armed || y < picker.top + picker.header) return "bridge";
    const local = y - picker.top - picker.header;
    if (local >= previousChoice * picker.slotHeight - 5 && local <= (previousChoice + 1) * picker.slotHeight + 5)
      return previousChoice;
    return Math.max(0, Math.min(count - 1, Math.floor(local / picker.slotHeight)));
  }
  const endX = picker.side === "right" ? picker.left : Math.max(picker.left, Math.min(picker.left + picker.width, picker.originX));
  const endY = picker.side === "right" ? picker.originY : picker.top;
  if (picker.side === "right" && x >= picker.originX - 8 && x <= picker.left + 4) {
    const progress = Math.max(
      0,
      Math.min(1, (x - picker.originX) / Math.max(1, picker.left - picker.originX))
    );
    const top = picker.originY + (picker.top - picker.originY) * progress - 8;
    const bottom = picker.originY + (picker.top + picker.height - picker.originY) * progress + 8;
    if (y >= top && y <= bottom) return "bridge";
  }
  const bridge = {
    left: Math.min(picker.originX, endX) - 8,
    top: Math.min(picker.originY, endY) - 8,
    width: Math.abs(picker.originX - endX) + 16,
    height: Math.abs(picker.originY - endY) + 16
  };
  return contains(bridge, x, y) ? "bridge" : null;
}

// lib/drag-hit-test.ts
var emptyHit = {
  target: null,
  band: null,
  candidates: [],
  invalid: null,
  noOp: false
};
function normalizeHit(tree, rows, id, hit) {
  const noOp = !!hit.target && isNoopMove(tree, id, hit.target);
  if (!noOp) return { ...hit, noOp };
  const node = tree.nodes[id];
  const row = rows.find((r) => r.id === id);
  return {
    ...hit,
    noOp: true,
    target: {
      parentId: node.parentId,
      beforeId: id,
      depth: row?.depth ?? 0,
      kind: "insert"
    }
  };
}
function chooseDepth(candidates, x, choice) {
  const center = (index) => 30 + candidates[index].depth * 22;
  const closest = candidates.reduce(
    (best, _t, i) => Math.abs(center(i) - x) < Math.abs(center(best) - x) ? i : best,
    choice
  );
  if (closest === choice) return choice;
  const midpoint = (center(closest) + center(choice)) / 2;
  return center(closest) > center(choice) ? x > midpoint + 6 ? closest : choice : x < midpoint - 6 ? closest : choice;
}
function resolveTreeHit(tree, rows, id, rowHeight, x, y, previous = emptyHit, horizontal = false) {
  if (!rows.length) return emptyHit;
  const index = Math.max(0, Math.min(rows.length - 1, Math.floor(y / rowHeight)));
  const row = rows[index], fraction = (y - index * rowHeight) / rowHeight;
  const node = tree.nodes[row.id];
  const sourceBoundary = row.id === id && (fraction < 0.25 || fraction > 0.75) && gapTargets(tree, rows, Math.round(y / rowHeight), id).length > 1;
  if (row.id === id && fraction >= 0 && fraction <= 1 && !sourceBoundary) {
    return normalizeHit(tree, rows, id, {
      ...emptyHit,
      target: {
        parentId: node.parentId,
        beforeId: id,
        depth: row.depth,
        kind: "insert"
      }
    });
  }
  const wasInside = previous.target?.kind === "inside" && previous.target.parentId === row.id;
  if (row.id !== id && node.kind === "folder" && fraction > (wasInside ? 0.2 : 0.32) && fraction < (wasInside ? 0.8 : 0.68)) {
    const target = insideTarget(tree, row.id, row.depth), error = validateMove(tree, id, target);
    return normalizeHit(tree, rows, id, {
      ...emptyHit,
      target: error ? null : target,
      invalid: error
    });
  }
  if (isInSubtree(tree, row.id, id) && fraction > 0.25 && fraction < 0.75)
    return { ...emptyHit, invalid: "\u4E0D\u80FD\u653E\u5165\u81EA\u8EAB\u6216\u81EA\u5DF1\u7684\u5B50\u76EE\u5F55" };
  const gap = nearestGap(y, rowHeight, rows.length, previous.band?.gap ?? null);
  const candidates = gapTargets(tree, rows, gap, id);
  if (!candidates.length) return { ...emptyHit, invalid: "\u4E0D\u80FD\u653E\u5165\u81EA\u8EAB\u6216\u81EA\u5DF1\u7684\u5B50\u76EE\u5F55" };
  const same = candidates.findIndex((t) => t.parentId === tree.nodes[id].parentId);
  let choice = previous.band?.gap === gap ? Math.min(previous.band.choice, candidates.length - 1) : Math.max(0, same);
  if (horizontal) choice = chooseDepth(candidates, x, choice);
  return normalizeHit(tree, rows, id, {
    target: candidates[choice],
    band: { gap, count: candidates.length, choice },
    candidates,
    invalid: null
  });
}

// src/presentation.ts
var displayName = (name) => name.replace(/\.md$/i, "");
function destinationLabel(tree, target, source, t, modeOf) {
  const original = childrenOf(tree, target.parentId);
  const siblings = original.filter((id) => id !== source);
  const before = target.beforeId === source ? original[original.indexOf(source) + 1] ?? null : target.beforeId;
  const index = before === null ? siblings.length : siblings.indexOf(before);
  const previous = index > 0 ? tree.nodes[siblings[index - 1]] : null;
  const next = before ? tree.nodes[before] : null;
  const format = (key) => t(key).replace("{previous}", displayName(previous?.name ?? "")).replace("{next}", displayName(next?.name ?? ""));
  let position = previous && next ? format("positionBetween") : previous ? format("positionAfter") : next ? format("positionBefore") : t("positionFirst");
  // 2026-10-22：目标文件夹是按时间/名称排序时，选的位置不会生效，
  // 选择器里必须直说，不能假装"插到 A 和 B 中间"。
  if (modeOf) {
    const mode = modeOf(target.parentId ?? "/");
    if (mode && mode !== "custom") position += " \xB7 " + t("positionByRule");
  }
  return {
    directory: target.parentId ? tree.nodes[target.parentId].name : t("root"),
    path: target.parentId ?? t("root"),
    position
  };
}

// src/drag.ts
var ROW = 28;
var DragController = class {
  constructor(plugin, view) {
    this.plugin = plugin;
    this.view = view;
    this.root = view.navFileContainerEl;
    this.doc = this.root.ownerDocument;
    this.win = this.doc.defaultView;
    const realm = this.win;
    this.resizeObserver = new realm.ResizeObserver(() => this.invalidateGeometry());
    this.themeObserver = new realm.MutationObserver(() => this.invalidateGeometry());
    this.dom = this.win;
    this.root.classList.add("qt-explorer");
    // aio-explorer：监听注册集中在 bindDragListeners()，由「拖拽排序」开关
    // 决定是否调用（关闭时浏览器原生拖拽完全可用 → 拖到正文 = 插入链接）。
    this.bindDragListeners();
  }
  /** aio-explorer：启用/恢复拖拽排序的全部事件监听与DOM 观察。 */
  bindDragListeners() {
    if (this.dragListening) return;
    this.dragListening = true;
    this.listen(this.root, "pointerdown", (e) => this.pointerDown(e), {
      capture: true
    });
    this.listen(
      this.doc,
      "pointermove",
      (e) => {
        const p = e;
        if (this.press?.input === "mouse" && p.pointerId === this.press.pointer)
          this.move(p.clientX, p.clientY, p);
      },
      { capture: true, passive: false }
    );
    this.listen(
      this.doc,
      "pointerup",
      (e) => {
        const p = e;
        if (this.press?.input === "mouse" && p.pointerId === this.press.pointer)
          this.end(p.clientX, p.clientY, p);
      },
      { capture: true }
    );
    this.listen(
      this.doc,
      "pointercancel",
      (e) => {
        if (e.pointerType !== "touch") this.cancel();
      },
      { capture: true }
    );
    this.listen(this.root, "touchstart", (e) => this.touchStart(e), {
      capture: true,
      passive: true
    });
    this.listen(
      this.doc,
      "touchmove",
      (e) => {
        const event = e;
        if (this.press?.input !== "touch") return;
        const touch = Array.from(event.touches).find((t) => t.identifier === this.press?.pointer);
        if (event.touches.length !== 1 || !touch) {
          this.cancel();
          return;
        }
        this.move(touch.clientX, touch.clientY, event);
      },
      { capture: true, passive: false }
    );
    this.listen(
      this.doc,
      "touchend",
      (e) => {
        const event = e;
        if (this.press?.input !== "touch") return;
        const touch = Array.from(event.changedTouches).find(
          (t) => t.identifier === this.press?.pointer
        );
        if (touch) this.end(touch.clientX, touch.clientY, event);
      },
      { capture: true, passive: false }
    );
    this.listen(this.doc, "touchcancel", () => this.cancel(), {
      capture: true
    });
    this.listen(
      this.root,
      "dragstart",
      (e) => {
        // aio-explorer：这里**不**拦截。
        // 原生 HTML5 拖拽一旦被preventDefault 就无法恢复，
        // 而"拖到正文插入链接"必须依赖它。
        // 排序排序用的是 pointer 事件（自有实现），两者可以并存：
        // 浏览器启动原生拖拽后，我们仍然能在 pointerup 时做排序落盘。
        void e;
      },
      { capture: false }
    );
    this.listen(
      this.root,
      "click",
      (e) => {
        if (Date.now() < this.suppressClickUntil || e.target.closest(".qt-handle")) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      { capture: true }
    );
    this.listen(
      this.root,
      "contextmenu",
      (e) => {
        if (this.press?.active || this.press?.input === "touch" && Date.now() - this.press.time > 150) {
          e.preventDefault();
          e.stopImmediatePropagation();
        } else this.cancel();
      },
      { capture: true }
    );
    this.listen(
      this.doc,
      "keydown",
      (e) => {
        const event = e;
        if (event.key === "Escape" && this.press) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.cancel();
        }
      },
      { capture: true }
    );
    this.listen(this.root, "keydown", (e) => this.handleKey(e));
    this.listen(this.win, "blur", () => this.cancel());
    this.listen(this.win, "resize", () => this.cancel());
    this.listen(this.doc, "visibilitychange", () => {
      if (this.doc.hidden) this.cancel();
    });
    this.listen(
      this.root,
      "scroll",
      () => {
        if (this.press && !this.press.active) this.cancel();
        this.picker = null;
        this.needsResolve = true;
      },      { passive: true }
    );
    this.observer = new this.win.MutationObserver((records) => {
      let changed = false;
      let structureChanged = false;
      for (const record of records) {
        const target = record.target;
        if (record.type === "attributes") {
          if (record.attributeName === "class") {
            const nativeClasses = (value) => value.split(/\s+/).filter((name) => name && !name.startsWith("qt-")).join(" ");
            if (nativeClasses(record.oldValue ?? "") === nativeClasses(target.getAttribute("class") ?? ""))
              continue;
            if (/(^|\s)is-collapsed(\s|$)/.test(record.oldValue ?? "") !== target.classList.contains("is-collapsed"))
              structureChanged = true;
          }
          if (target.closest?.(".qt-handle,.qt-hold-progress")) continue;
          changed = true;
          if (record.attributeName === "data-path") {
            this.pendingDecorations.add(target);
            structureChanged = true;
          }
        } else {
          for (const node of [...record.addedNodes, ...record.removedNodes]) {
            if (node.nodeType !== 1) {
              changed = true;
              continue;
            }
            const el = node;
            if (el.matches(".qt-handle,.qt-hold-progress")) continue;
            changed = true;
            if (this.root.contains(el)) this.pendingDecorations.add(el);
          }
        }
      }
      if (!changed) return;
      this.invalidateGeometry();
      this.snapshotDirty ||= structureChanged;
      if (this.pendingDecorations.size && !this.decorateFrame)
        this.decorateFrame = this.win.requestAnimationFrame(() => {
          this.decorateFrame = 0;
          const pending = [...this.pendingDecorations];
          this.pendingDecorations.clear();
          const ancestors = new Set(pending);
          for (const el of pending) {
            if (!this.root.contains(el)) continue;
            let parent = el.parentElement;
            let covered = false;
            while (parent && parent !== this.root) {
              if (ancestors.has(parent)) {
                covered = true;
                break;
              }
              parent = parent.parentElement;
            }
            if (covered) continue;
            this.decorate(el);
          }
        });
    });
    try {
      this.observer.observe(this.root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ["data-path", "class", "style"]
      });
      this.decorate();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }
  plugin;
  view;
  doc;
  win;
  dom;
  root;
  observer;
  disposers = [];
  // aio-explorer：拖拽排序总闸（false = 完全不接管，原生拖拽可用）
  dragListening = false;
  press = null;
  data = null;
  hit = emptyHit;
  ghost;
  line;
  surface;
  pickerEl;
  cancelZone;
  cancelHovered = false;
  picker = null;
  pickerKey = "";
  pickerSince = 0;
  hoverId = "";
  hoverSince = 0;
  timer = 0;
  frame = 0;
  decorateFrame = 0;
  suppressClickUntil = 0;
  activeFolder;
  destroyed = false;
  failed = false;
  resizeObserver;
  themeObserver;
  observedRows = /* @__PURE__ */ new Set();
  pendingDecorations = /* @__PURE__ */ new Set();
  measuredRows = null;
  measuredOrigin = {
    top: 0,
    left: 0,
    scrollTop: 0,
    scrollLeft: 0,
    width: 0
  };
  needsResolve = true;
  snapshotDirty = false;
  lastBounds = "";
  invalidateGeometry() {
    this.measuredRows = null;
    this.needsResolve = true;
  }
  fault(error) {
    this.cancel();
    if (!this.failed) this.plugin.report(error, "compatibilityError");
    this.failed = true;
  }
  listen(target, type, fn, options) {
    const guarded = (event) => {
      try {
        fn(event);
      } catch (error) {
        this.fault(error);
      }
    };
    target.addEventListener(type, guarded, options);
    this.disposers.push(() => target.removeEventListener(type, guarded, options));
  }
  decorate(scope = this.root) {
    this.root.dataset.qtTrigger = this.plugin.settings.trigger;
    const selector = ".tree-item-self[data-path]";
    const rows = scope.matches(selector) ? [scope] : scope.querySelectorAll(selector);
    for (const el of rows) {
      const path = el.dataset.path;
      const parent = parentPath(path);
      const config = this.plugin.settings.folderSettings?.[parent];
      // 2026-10-22 修复：这里原先还要求「父文件夹必须是自定义排序」才给拖拽，
      // 结果时间/名称排序的文件夹整片掉回 Obsidian 原生拖拽 —— 没有长按抬起、
      // 没有手柄、没有位置提示，用户感觉"拖拽排序坏了"。
      // 现在把两件事拆开：
      //   · 「这一行能不能被拖」= 只要不是排除目录/搜索中/库根，就允许（走插件机制）；
      //   · 「同一个文件夹里能不能换顺序」= 由 move() 按排序模式判断并给明确提示。
      const allowed = !this.view.searchQuery && path !== "/" && !excluded(parent, this.plugin.settings.excluded);
      const name = baseName(path);
      el.classList.toggle("qt-pinned-item", !!config?.pinned?.includes(name));
      el.classList.toggle("qt-hidden-item", !!this.plugin.settings.showHidden && !!config?.hidden?.includes(name));
      let handle = el.querySelector(":scope > .qt-handle");
      el.classList.toggle("qt-sortable", allowed);
      if (!allowed || this.plugin.settings.trigger !== "handle") {
        handle?.remove();
        continue;
      }
      if (!handle) {
        handle = this.dom.createSpan();
        handle.className = "qt-handle";
        handle.setAttribute("role", "button");
        handle.tabIndex = 0;
        (0, import_obsidian2.setIcon)(handle, "grip-vertical");
        el.append(handle);
      }
      handle.setAttribute("aria-label", `${this.plugin.t("hold")}: ${path}`);
    }
  }
  eligible(target) {
    if (this.failed || this.destroyed) return null;
    const element = target;
    if (!element?.closest || element.closest("input,textarea,[contenteditable=true],.collapse-icon"))
      return null;
    if (this.view.searchQuery) return null;
    const row = element.closest(".tree-item-self[data-path]");
    if (!row || !this.root.contains(row) || !row.classList.contains("qt-sortable")) return null;
    if (this.plugin.settings.trigger === "handle" && !element.closest(".qt-handle")) return null;
    return row;
  }
  pointerDown(event) {
    if (event.pointerType === "touch") {
      if (this.eligible(event.target)) event.stopPropagation();
      return;
    }
    if (event.button !== 0 || !event.isPrimary) return;
    if (event.shiftKey || event.altKey) return;
    const row = this.eligible(event.target);
    if (row) this.begin(row, event.clientX, event.clientY, "mouse", event.pointerId);
  }
  touchStart(event) {
    if (event.touches.length !== 1) {
      this.cancel();
      return;
    }
    const row = this.eligible(event.target), touch = event.touches[0];
    if (row) {
      event.stopPropagation();
      this.begin(row, touch.clientX, touch.clientY, "touch", touch.identifier);
    }
  }
  begin(el, x, y, input, pointer) {
    this.cancel();
    this.press = {
      id: el.dataset.path,
      el,
      input,
      startX: x,
      startY: y,
      x,
      y,
      time: Date.now(),
      active: false,
      pointer
    };
    const delay = input === "touch" ? this.plugin.settings.delay : this.plugin.settings.mouseDelay;
    this.timer = this.win.setTimeout(() => {
      try {
        if (this.press && (input === "touch" || Math.hypot(this.press.x - x, this.press.y - y) >= 4))
          this.activate();
      } catch (error) {
        this.fault(error);
      }
    }, delay);
  }
  activate() {
    const p = this.press;
    if (!p || p.active || !p.el.isConnected) return;
    const data = snapshot(this.plugin.app, this.view);
    if (this.press !== p) return;
    this.data = data;
    this.snapshotDirty = false;
    this.invalidateGeometry();
    this.themeObserver.observe(this.doc.body, {
      attributes: true,
      attributeFilter: ["class", "style"]
    });
    if (!this.data.tree.nodes[p.id]) {
      this.cancel();
      return;
    }
    p.active = true;
    p.el.classList.add("qt-source");
    this.root.classList.add("qt-dragging");
    try {
      this.view.onFilePointerout?.(
        new this.win.PointerEvent("pointerout", {
          relatedTarget: this.root
        }),
        p.el
      );
    } catch (error) {
      console.warn("[Aio Explorer] Tooltip cleanup unavailable", error);
    }
    this.surface = this.dom.createDiv();
    this.surface.className = "qt-drag-surface";
    this.surface.setAttribute("aria-hidden", "true");
    this.surface.addEventListener("contextmenu", (event) => event.preventDefault());
    this.surface.addEventListener(
      "wheel",
      (event) => {
        const scale = event.deltaMode === 1 ? ROW : event.deltaMode === 2 ? this.root.clientHeight : 1;
        this.root.scrollTop += event.deltaY * scale;
        event.preventDefault();
      },
      { passive: false }
    );
    this.doc.body.append(this.surface);
    this.doc.getSelection()?.removeAllRanges();
    this.ghost = this.dom.createDiv();
    this.ghost.className = "qt-ghost";
    this.ghost.setAttribute("aria-hidden", "true");
    this.ghost.style.setProperty("width", `${Math.min(280, Math.max(220, p.el.getBoundingClientRect().width))}px`);
    const card = this.dom.createDiv();
    card.className = "qt-ghost-card";
    const grip = this.dom.createSpan();
    grip.className = "qt-ghost-grip";
    (0, import_obsidian2.setIcon)(grip, "grip-vertical");
    const icon = this.dom.createSpan();
    icon.className = "qt-ghost-icon";
    (0, import_obsidian2.setIcon)(icon, this.data.tree.nodes[p.id].kind === "folder" ? "folder" : "file-text");
    const title = this.dom.createEl("strong");
    title.textContent = displayName(this.data.tree.nodes[p.id].name);
    const badge = this.dom.createSpan();
    badge.className = "qt-ghost-badge";
    badge.textContent = this.plugin.t("lifted");
    const header = this.dom.createDiv();
    header.className = "qt-ghost-row";
    header.append(grip, icon, title, badge);
    card.append(header);
    if (p.input === "mouse") {
      const hint = this.dom.createDiv();
      hint.className = "qt-ghost-cancel";
      const [before, after] = this.plugin.t("cancelWithKey").split("{key}");
      const key = this.dom.createEl("kbd");
      key.textContent = "Esc";
      hint.append(before, key, after);
      card.append(hint);
    } else {
      this.cancelZone = this.dom.createDiv();
      this.cancelZone.className = "qt-cancel-zone";
      this.cancelZone.setAttribute("role", "status");
      const icon2 = this.dom.createSpan();
      (0, import_obsidian2.setIcon)(icon2, "x");
      const text = this.dom.createSpan();
      text.className = "qt-cancel-text";
      text.textContent = this.plugin.t("dragToCancel");
      this.cancelZone.append(icon2, text);
      this.doc.body.append(this.cancelZone);
    }
    const label = this.dom.createSpan();
    label.className = "qt-ghost-label";
    label.hidden = true;
    this.ghost.append(card, label);
    this.doc.body.append(this.ghost);
    this.line = this.dom.createDiv();
    this.line.className = "qt-drop-line";
    this.doc.body.append(this.line);
    this.pickerEl = this.dom.createDiv();
    this.pickerEl.className = "qt-picker";
    this.pickerEl.hidden = true;
    this.doc.body.append(this.pickerEl);
    this.tick();
  }
  move(x, y, event) {
    const p = this.press;
    if (!p) return;
    p.x = x;
    p.y = y;
    this.needsResolve = true;
    // aio-explorer：按住 Ctrl（Mac 为 Cmd）拖 = 交给原生，
    // 这样浏览器能正常启动 HTML5 拖拽 → 拖到正文 = 插入链接。
    const distance = Math.hypot(x - p.startX, y - p.startY);
    if (!p.active) {
      if (p.input === "touch" && distance > 8) {
        this.cancel();
        return;
      }
      if (p.input === "mouse" && distance >= 4 && Date.now() - p.time >= this.plugin.settings.mouseDelay)
        this.activate();
    }
    if (!p.active) return;
    // aio-explorer 关键修复（思路对齐 Flexplorer）：
    // 只有「鼠标仍在文件列表内」时才拦截事件。移出边界后立刻不再拦截，
    // 浏览器才能继续它自己的 HTML5 拖拽 → 拖到正文 = 插入链接。
    // 参考 Flexplorer 的 onDrop：`if (!explorerEl.contains(e.target)) { cleanup; return; }`
    // —— 落在外面就直接撒手，绝不 preventDefault。
    if (this.outsideBounds(x, y)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  /**
   * aio-explorer：指针是否已离开文件列表区域。
   * 留一点容差（默认 6px），避免拖到列表边缘时手抖被误判成"移出去了"，
   * 导致排序中途失效、文件夹"粘不住"。
   */
  outsideBounds(x, y) {
    const b = this.root.getBoundingClientRect();
    const pad = 6;
    return x < b.left - pad || x > b.right + pad || y < b.top - pad || y > b.bottom + pad;
  }
  /**
   * aio-explorer：放弃接管本次拖拽，交还给原生。
   * 关键点：不能走 cancel()——它会设suppressClickUntil 并吞掉后续 click，
   * 导致「点一下打开笔记」都失效。这里用一个中性状态 handoff 收尾：
   * 保留 press（但 active=false），让 pointerup 时不拦截任何事件。
   */
  yieldToNative() {
    const p = this.press;
    if (!p) return;
    p.active = false;
    p.handedOff = true;
    this.win.clearTimeout(this.timer);
    this.win.cancelAnimationFrame(this.frame);
    p.el.classList.remove("qt-source");
    this.activeFolder?.classList.remove("qt-inside");
    this.activeFolder = void 0;
    this.root.classList.remove("qt-dragging");
    this.surface?.remove();
    this.surface = void 0;
    this.cancelZone?.remove();
    this.cancelZone = void 0;
    this.cancelHovered = false;
    this.ghost?.remove();
    this.line?.remove();
    this.pickerEl?.remove();
    this.ghost = this.line = this.pickerEl = void 0;
    this.data = null;
    this.resizeObserver.disconnect();
    this.themeObserver.disconnect();
  }
  measured(bounds = this.root.getBoundingClientRect()) {
    if (!this.data) return [];
    if (this.measuredRows && this.measuredOrigin.width === bounds.width) {
      const dx = bounds.left - this.measuredOrigin.left - (this.root.scrollLeft - this.measuredOrigin.scrollLeft);
      const dy = bounds.top - this.measuredOrigin.top - (this.root.scrollTop - this.measuredOrigin.scrollTop);
      if (!dx && !dy) return this.measuredRows;
      this.measuredRows = this.measuredRows.map((row) => ({
        ...row,
        rect: {
          ...row.rect,
          top: row.rect.top + dy,
          bottom: row.rect.bottom + dy,
          left: row.rect.left + dx,
          right: row.rect.right + dx
        }
      }));
    } else {
      const indexes = new Map(this.data.rows.map((row, index) => [row.id, index]));
      this.measuredRows = Array.from(
        this.root.querySelectorAll(".tree-item-self[data-path]")
      ).flatMap((el) => {
        const id = el.dataset.path, index = indexes.get(id), rect = index === void 0 ? null : el.getBoundingClientRect();
        return index !== void 0 && rect && rect.height > 0 ? [
          {
            id,
            index,
            el,
            rect: {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              width: rect.width,
              height: rect.height
            }
          }
        ] : [];
      }).sort((a, b) => a.index - b.index);
      const next = /* @__PURE__ */ new Set([this.root, ...this.measuredRows.map((row) => row.el)]);
      for (const el of this.observedRows) if (!next.has(el)) this.resizeObserver.unobserve(el);
      for (const el of next) if (!this.observedRows.has(el)) this.resizeObserver.observe(el);
      this.observedRows = next;
    }
    this.measuredOrigin = {
      top: bounds.top,
      left: bounds.left,
      width: bounds.width,
      scrollTop: this.root.scrollTop,
      scrollLeft: this.root.scrollLeft
    };
    return this.measuredRows;
  }
  resolve() {
    if (this.snapshotDirty && this.press?.active) {
      const press = this.press;
      const data2 = snapshot(this.plugin.app, this.view);
      if (this.press !== press) return;
      this.data = data2;
      this.snapshotDirty = false;
      this.invalidateGeometry();
    }
    const p = this.press, data = this.data;
    if (!p?.active || !data) return;
    const bounds = this.root.getBoundingClientRect();
    Object.assign(this.surface.style, {
      left: `${bounds.left}px`,
      top: `${bounds.top}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`
    });
    const measured = this.measured(bounds);
    this.cancelHovered = !!this.cancelZone && contains(this.cancelZone.getBoundingClientRect(), p.x, p.y);
    this.cancelZone?.classList.toggle("is-active", this.cancelHovered);
    const cancelText = this.cancelZone?.querySelector(".qt-cancel-text");
    if (cancelText) {
      const text = this.plugin.t(this.cancelHovered ? "releaseToCancel" : "dragToCancel");
      if (cancelText.textContent !== text) cancelText.textContent = text;
    }
    if (this.cancelHovered) {
      this.hit = emptyHit;
      this.picker = null;
      this.pickerKey = "";
      this.hoverId = "";
      this.paint(measured);
      return;
    }
    if (!measured.length) {
      this.hit = emptyHit;
      return;
    }
    let kept = false;
    if (this.picker && this.hit.band) {
      if (Math.hypot(p.x - this.picker.originX, p.y - this.picker.originY) > 6)
        this.picker.armed = true;
      const choice = pickerHit(
        this.picker,
        p.x,
        p.y,
        this.hit.candidates.length,
        this.hit.band.choice
      );
      if (choice !== null) {
        kept = true;
        if (typeof choice === "number")
          this.hit = normalizeHit(data.tree, data.rows, p.id, {
            ...this.hit,
            target: this.hit.candidates[choice],
            band: { ...this.hit.band, choice }
          });
      } else {
        this.picker = null;
        this.pickerKey = "";
      }
    }
    if (!kept) {
      if (p.x < bounds.left || p.x > bounds.right || p.y < bounds.top || p.y > bounds.bottom) {
        this.hit = emptyHit;
        this.picker = null;
        this.pickerKey = "";
        this.paint(measured);
        return;
      }
      const closest = measured.reduce(
        (best, row) => Math.abs(p.y - (row.rect.top + row.rect.height / 2)) < Math.abs(p.y - (best.rect.top + best.rect.height / 2)) ? row : best
      );
      const logicalY = (closest.index + (p.y - closest.rect.top) / closest.rect.height) * ROW;
      this.hit = resolveTreeHit(
        data.tree,
        data.rows,
        p.id,
        ROW,
        p.x - bounds.left,
        logicalY,
        this.hit
      );
      if (this.hit.target && excluded(this.hit.target.parentId ?? "/", this.plugin.settings.excluded))
        this.hit = { ...emptyHit, invalid: this.plugin.t("locked") };
      if (this.hit.band && this.hit.candidates.length > 1) {
        const key = `${this.hit.band.gap}:${this.hit.candidates.map(targetKey).join("|")}`;
        if (key !== this.pickerKey) {
          this.pickerKey = key;
          this.pickerSince = Date.now();
          this.picker = null;
        }
        if (!this.picker && Date.now() - this.pickerSince >= 240) {
          this.picker = makeBoundaryPicker(
            bounds,
            this.gapY(measured),
            this.hit.candidates.length,
            this.hit.band.choice,
            46,
            this.win.innerWidth,
            this.cancelZone ? this.cancelZone.getBoundingClientRect().top - 8 : this.win.innerHeight,
            p.x,
            p.y,
            this.root.scrollTop
          );
        }
      } else {
        this.pickerKey = "";
        this.picker = null;
      }
    }
    if (this.hit.target && excluded(this.hit.target.parentId ?? "/", this.plugin.settings.excluded))
      this.hit = {
        ...this.hit,
        target: null,
        invalid: this.plugin.t("locked")
      };
    const folder = this.hit.target?.kind === "inside" ? this.hit.target.parentId ?? "" : "";
    if (folder !== this.hoverId) {
      this.hoverId = folder;
      this.hoverSince = Date.now();
    }
    if (folder && Date.now() - this.hoverSince > 650) {
      const item = this.view.fileItems[folder];
      this.hoverSince = Infinity;
      if (item?.collapsed && item.setCollapsed) {
        void Promise.resolve(item.setCollapsed(false)).then(() => {
          if (this.press === p) {
            const data2 = snapshot(this.plugin.app, this.view);
            if (this.press !== p) return;
            this.data = data2;
            this.invalidateGeometry();
            this.hit = emptyHit;
            this.picker = null;
          }
        }).catch((error) => this.fault(error));
      }
    }
    this.paint(measured);
  }
  gapY(rows) {
    const gap = this.hit.band?.gap ?? 0;
    const next = rows.find((row) => row.index === gap);
    if (next) return next.rect.top;
    const previous = rows.find((row) => row.index === gap - 1);
    return previous ? previous.rect.bottom : this.press.y;
  }
  paint(rows) {
    const p = this.press;
    const bounds = this.root.getBoundingClientRect();
    // aio-explorer：鼠标已在文件列表之外 → 排序视觉（跟随的小卡片/ 插入线 /
    // 取消区）全部隐藏，避免"拖到正文时卡着一个小卡片"。
    if (this.outsideBounds(p.x, p.y)) {
      this.ghost.style.setProperty("display", "none");
      this.line.hidden = true;
      this.cancelZone?.classList.remove("is-active");
      return;
    }
    if (this.ghost.style.display === "none") this.ghost.style.removeProperty("display");
    if (this.line.hidden) this.line.hidden = false;
    const { width, height } = this.ghost.getBoundingClientRect();
    const x = Math.max(
      8,
      Math.min(p.input === "touch" ? p.x - width / 2 : p.x + 16, this.win.innerWidth - width - 8)
    );
    let y = Math.max(
      8,
      Math.min(p.y + (p.input === "touch" ? -height - 24 : 14), this.win.innerHeight - height - 8)
    );
    if (this.picker && x < this.picker.left + this.picker.width && x + width > this.picker.left && y < this.picker.top + this.picker.height && y + height > this.picker.top) {
      const above = this.picker.top - height - 8;
      const below = this.picker.top + this.picker.height + 8;
      const bottom = this.cancelZone?.getBoundingClientRect().top ?? this.win.innerHeight;
      y = p.input === "touch" && above >= 8 ? above : below + height <= bottom - 8 ? below : Math.max(8, above);
    }
    this.ghost.style.setProperty("transform", `translate3d(${x}px,${y}px,0)`);
    const text = this.hit.invalid ? this.plugin.t("invalid") : "";
    const label = this.ghost.querySelector(".qt-ghost-label");
    if (label.textContent !== text) label.textContent = text;
    label.hidden = !text;
    const target = this.hit.target;
    const activeFolder = target?.kind === "inside" ? rows.find((row) => row.id === target.parentId)?.el : void 0;
    if (activeFolder !== this.activeFolder) {
      this.activeFolder?.classList.remove("qt-inside");
      this.activeFolder = activeFolder;
      this.activeFolder?.classList.add("qt-inside");
    }
    const lineY = this.gapY(rows);
    this.line.hidden = !target || this.hit.noOp && !this.picker || target.kind === "inside" || lineY < bounds.top || lineY > bounds.bottom;
    if (target) {
      const parent = rows.find((row) => row.id === target.parentId);
      const sibling = rows.find(
        (row) => this.data.tree.nodes[row.id].parentId === target.parentId
      );
      const anchor = sibling?.el.querySelector(".tree-item-inner")?.getBoundingClientRect();
      const parentAnchor = parent?.el.querySelector(".tree-item-inner")?.getBoundingClientRect();
      const left = Math.max(
        bounds.left + 8,
        (anchor?.left ?? (parentAnchor?.left ?? bounds.left + 22) + 18) - 12
      );
      this.line.style.setProperty("transform", `translate3d(${left}px,${lineY}px,0)`);
      this.line.style.setProperty("width", `${Math.max(20, bounds.right - left - 12)}px`);
    }
    this.pickerEl.hidden = !this.picker;
    if (this.picker) {
      const picker = this.picker;
      Object.assign(this.pickerEl.style, {
        left: `${picker.left}px`,
        top: `${picker.top}px`,
        width: `${picker.width}px`
      });
      const key = this.hit.candidates.map(targetKey).join("|");
      if (this.pickerEl.dataset.key !== key) {
        this.pickerEl.dataset.key = key;
        this.pickerEl.replaceChildren();
        const heading = this.dom.createDiv();
        heading.className = "qt-picker-heading";
        const headingIcon = this.dom.createSpan();
        (0, import_obsidian2.setIcon)(headingIcon, "layers");
        const headingTitle = this.dom.createSpan();
        headingTitle.textContent = this.plugin.t("choose");
        const hint = this.dom.createEl("small");
        hint.textContent = this.plugin.t("chooseHint");
        heading.append(headingIcon, headingTitle, hint);
        this.pickerEl.append(heading);
        for (const candidate of this.hit.candidates) {
          const option = this.dom.createDiv();
          option.className = "qt-picker-option";
          const description = destinationLabel(this.data.tree, candidate, p.id, this.plugin.t, (path) => this.plugin.sortModeOf(path));
          const icon = this.dom.createSpan();
          icon.className = "qt-picker-icon";
          (0, import_obsidian2.setIcon)(icon, "corner-down-right");
          const text2 = this.dom.createDiv();
          text2.className = "qt-picker-text";
          const name = this.dom.createEl("strong");
          name.textContent = description.directory;
          name.title = description.path;
          const position = this.dom.createSpan();
          position.textContent = isNoopMove(this.data.tree, p.id, candidate) ? this.plugin.t("unchanged") : description.position;
          text2.append(name, position);
          const check = this.dom.createSpan();
          check.className = "qt-picker-check";
          (0, import_obsidian2.setIcon)(check, "check");
          option.append(icon, text2, check);
          this.pickerEl.append(option);
        }
      }
      Array.from(this.pickerEl.querySelectorAll(".qt-picker-option")).forEach(
        (option, index) => option.classList.toggle("is-selected", index === this.hit.band?.choice)
      );
    }
  }
  tick = () => {
    if (!this.press?.active) return;
    try {
      const rect = this.root.getBoundingClientRect(), p = this.press;
      const boundsKey = `${rect.top}:${rect.left}:${rect.width}:${rect.height}:${this.root.scrollTop}:${this.root.scrollLeft}`;
      if (boundsKey !== this.lastBounds) this.needsResolve = true;
      this.lastBounds = boundsKey;
      const now = Date.now();
      if (this.needsResolve || this.pickerKey && !this.picker && now - this.pickerSince >= 240 || this.hoverId && now - this.hoverSince > 650) {
        this.needsResolve = false;
        this.resolve();
        if (this.press !== p) return;
      }
      if (!this.picker && !this.cancelHovered && p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom) {
        const edge = 40;
        const bottom = Math.min(
          rect.bottom,
          this.cancelZone ? this.cancelZone.getBoundingClientRect().top - 12 : rect.bottom
        );
        const delta = p.y < rect.top + edge ? -Math.min(9, (rect.top + edge - p.y) / 4) : p.y > bottom - edge ? Math.min(9, (p.y - bottom + edge) / 4) : 0;
        if (delta) this.root.scrollTop += delta;
      }
      this.frame = this.win.requestAnimationFrame(this.tick);
    } catch (error) {
      this.fault(error);
    }
  };
  end(x, y, event) {
    const p = this.press;
    if (!p) return;
    if (p.handedOff) {
      this.press = null;
      return;
    }
    if (p.active) {
      //aio-explorer：只在松手点确实落在文件列表内时才拦截并落盘排序；
      // 若落在正文（列表外），说明用户是想插链接 → 不干预。
      if (this.outsideBounds(x, y)) {
        this.yieldToNative();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      p.x = x;
      p.y = y;
      this.snapshotDirty = true;
      this.invalidateGeometry();
      this.resolve();
      if (this.press !== p) return;
      const target = this.hit.target, noOp = this.hit.noOp;
      this.cancel();
      if (target && !noOp) void this.plugin.move(this.view, p.id, target);
    } else this.cancel();
  }
  handleKey(event) {
    if (!event.target.closest(".qt-handle") || !["ArrowUp", "ArrowDown"].includes(event.key))
      return;
    const row = event.target.closest("[data-path]");
    if (!row) return;
    event.preventDefault();
    event.stopPropagation();
    const data = snapshot(this.plugin.app, this.view), id = row.dataset.path, node = data.tree.nodes[id];
    if (!node) return;
    const ids = node.parentId ? data.tree.nodes[node.parentId].children : data.tree.roots, index = ids.indexOf(id);
    if (event.key === "ArrowUp" && index === 0 || event.key === "ArrowDown" && index === ids.length - 1)
      return;
    void this.plugin.move(this.view, id, {
      parentId: node.parentId,
      beforeId: event.key === "ArrowUp" ? ids[index - 1] : ids[index + 2] ?? null,
      depth: 0,
      kind: "insert"
    });
  }
  cancel() {
    if (this.press?.active) this.suppressClickUntil = Date.now() + 500;
    this.win.clearTimeout(this.timer);
    this.win.cancelAnimationFrame(this.frame);
    this.press?.el.classList.remove("qt-source");
    this.activeFolder?.classList.remove("qt-inside");
    this.activeFolder = void 0;
    this.root.classList.remove("qt-dragging");
    this.surface?.remove();
    this.surface = void 0;
    this.cancelZone?.remove();
    this.cancelZone = void 0;
    this.cancelHovered = false;
    this.ghost?.remove();
    this.line?.remove();
    this.pickerEl?.remove();
    this.ghost = this.line = this.pickerEl = void 0;
    this.press = null;
    this.data = null;
    this.resizeObserver.disconnect();
    this.themeObserver.disconnect();
    this.observedRows.clear();
    this.measuredRows = null;
    this.snapshotDirty = false;
    this.lastBounds = "";
    this.hit = emptyHit;
    this.picker = null;
    this.pickerKey = "";
    this.hoverId = "";
  }
  /**
   * aio-explorer：关闭「拖拽排序」——彻底摘除所有拖拽相关监听与浮层，
   * 让浏览器原生 HTML5 拖拽完全可用（拖笔记到正文 = 插入链接）。
   * 参考 immersive-folder 的 stop()：disconnect + removeEventListener + clear。
   */
  stopDrag() {
    if (!this.dragListening) return;
    this.dragListening = false;
    this.cancel();
    try {
      this.observer.disconnect();
    } catch (error) { /* 忽略：观察器可能尚未启动 */ }
    this.win.cancelAnimationFrame(this.decorateFrame);
    this.decorateFrame = 0;
    this.disposers.forEach((fn) => {
      try {
        fn();
      } catch (error) { /* 忽略卸载异常 */ }
    });
    this.disposers = [];
    this.resizeObserver.disconnect();
    this.themeObserver.disconnect();
    this.root.querySelectorAll(".qt-handle").forEach((handle) => handle.remove());
    this.root.querySelectorAll(".qt-sortable").forEach((row) => row.classList.remove("qt-sortable"));
    delete this.root.dataset.qtTrigger;
    this.root.classList.remove("qt-dragging");
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancel();
    this.observer.disconnect();
    this.win.cancelAnimationFrame(this.decorateFrame);
    this.disposers.forEach((fn) => fn());
    this.root.querySelectorAll(".qt-handle").forEach((handle) => handle.remove());
    this.root.querySelectorAll(".qt-sortable").forEach((row) => row.classList.remove("qt-sortable"));
    this.root.classList.remove("qt-explorer");
    delete this.root.dataset.qtTrigger;
  }
};

// src/i18n.ts
var en = {
  compatibilityError: "Aio Explorer paused this interaction because a native interface failed. Reload the plugin after updating Obsidian.",
  lifted: "Lifted",
  chooseHint: "Move here, then release",
  positionBetween: "Between {previous} and {next}",
  positionAfter: "After {previous}",
  positionBefore: "Before {next}",
  positionFirst: "First position",
  interaction: "Dragging",
  general: "General",
  ordering: "Ordering",
  details: "Show details",
  interactionHelp: "Hold for the configured delay, then move at least 4 pixels to lift. A normal click still opens the item.",
  interactionHelpMobile: "Hold still for the configured delay to lift. Swipe before the delay to scroll normally; release after dragging to drop.",
  noExclusions: "No excluded directories",
  addDirectory: "Add directory",
  chooseDirectory: "Choose a vault directory",
  directoryPlaceholder: "Directory path, e.g. Assets/Images",
  add: "Add",
  remove: "Remove",
  language: "Language",
  languageHelp: "Choose the language for Aio Explorer, or follow Obsidian.",
  showLoadNotice: "Turn off startup notice",
  showLoadNoticeHelp: "Stop showing the Aio Explorer card in the top-right corner when Obsidian starts.",
  auto: "Follow Obsidian",
  settings: "Aio Explorer",
  intro: "Arrange the native file explorer. Hold to lift, move to choose a position, then release. Press Esc to cancel.",
  trigger: "Drag trigger",
  row: "Long press anywhere on the row",
  handle: "Right-side handle",
  delay: "Long-press delay",
  delayHelp: "Mouse delay in milliseconds (default: 200). Touch uses a separate delay.",
  delayHelpMobile: "Touch delay in milliseconds (default: 500). Mouse delay is configured separately on desktop.",
  exclusions: "Excluded directories",
  exclusionsHelp: "Enter a vault-relative directory path or choose a folder.\nContents and subdirectories are excluded; the folder itself can still be positioned in its parent.\nRemove a rule to enable custom sorting again.",
  attachment: "Add current attachment folder",
  noAttachment: "No single attachment directory is configured (root or current-note folders are not excluded automatically).",
  reload: "Reload plugin data",
  reset: "Restore native order for this folder",
  ready: "Plugin data reloaded",
  error: "Aio Explorer: could not apply the change. Check the plugin data.json file.",
  invalidPath: "Use a vault-relative directory path without ..",
  invalidJson: "Invalid data.json format. The original file and last valid order are retained; repair the file and reload plugin data.",
  newerDataVersion: "This data.json was written by a newer Aio Explorer. Update the plugin; the file has not been changed.",
  missingLegacyOrder: "The old sorting file is missing. Sync or restore the JSON file specified by jsonPath, then reload plugin data to finish upgrading. No empty order was saved.",
  invalidLegacyOrder: "The old sorting file is invalid. Repair the JSON file specified by jsonPath, then reload plugin data. The original files have not been changed.",
  migrationBackupFailed: "Could not back up the old data. Check storage permissions and free space, then reload plugin data to retry the upgrade. The original data has not been overwritten.",
  migrationSaveFailed: "Could not save the upgraded data. A backup is in the Aio Explorer plugin folder under backups. Check storage and reload plugin data to retry.",
  dataRecovery: "Data recovery",
  resetData: "Back up and reset ordering",
  resetDataHelp: "Back up the invalid data in the Aio Explorer plugin folder under backups, then reset all custom ordering. Recognizable settings will be retained. Notes and folders will not be moved or deleted. Resetting takes effect only if the backup succeeds; the new order may sync to your other devices.",
  keepData: "Keep current data",
  confirmResetData: "Back up and reset",
  resetDataDone: "Invalid data backed up and ordering reset. You can sort again.",
  dataChanged: "The data changed while recovery was open. Reload plugin data before trying again; nothing was reset.",
  unavailable: "This Obsidian version exposes no compatible native file explorer. Sorting was not attached.",
  locked: "This directory is excluded from custom sorting.",
  moving: "Dragging",
  hold: "Hold to drag",
  cancel: "Release outside the list or press Esc to cancel",
  cancelWithKey: "Press {key} to cancel",
  dragToCancel: "Drag here to cancel",
  releaseToCancel: "Release to cancel",
  choose: "Which folder?",
  root: "Vault root",
  inside: "Move into",
  before: "Before",
  end: "At the end",
  unchanged: "Keep current position",
  invalid: "Cannot drop here",
  moved: "Position saved",
  collision: "A file or folder with this name already exists at the destination.",
  changed: "The list changed during dragging. Please try again.",
  rollbackFailed: "Sorting could not be saved, and the file could not be moved back. Check its current location before continuing.",
  readError: "The plugin data.json cannot be read. The last valid order is retained; fix the file to continue.",
  resetDone: "Native order restored for this folder",
  sortMenu: "Sort order",
  parentFolderSort: "Parent folder sort order",
  sortCustom: "Custom order",
  sortNameAsc: "File name (A to Z)",
  sortNameDesc: "File name (Z to A)",
  sortCreatedNew: "Created time (new to old)",
  sortCreatedOld: "Created time (old to new)",
  sortModifiedNew: "Modified time (new to old)",
  sortModifiedOld: "Modified time (old to new)",
  sortNative: "Native Obsidian order",
  saveAsCustom: "Save as custom order",
  saveAsCustomDone: "Saved as custom order",
  sortApplied: "Sort order updated",
  pinItem: "Pin to top",
  unpinItem: "Unpin",
  pinDone: "Pinned to top",
  unpinDone: "Unpinned",
  hideItem: "Hide from view",
  unhideItem: "Unhide",
  hideDone: "Hidden from view",
  unhideDone: "Unhidden",
  showHiddenOn: "Show hidden items",
  showHiddenOff: "Hide hidden items",
  showHiddenDone: "Hidden items are now visible",
  hideHiddenDone: "Hidden items are now hidden again",
  pinnedMarker: "Pinned",
  hiddenMarker: "Hidden",
  sortGroupTitle: "Sorting per folder",
  sortGroupDesc: "Right-click a file or folder in the file explorer to set its sorting, pin or hide it.",
  dragSortToggle: "Drag to reorder",
  dragSortHelp: "When off, the file explorer's drag is left to Obsidian, so dragging a note into the editor inserts a link. Sorting, hiding, pinning and focus mode are unaffected. You can also toggle it from the button in the explorer header.",
  dragSortOn: "Turn off drag to reorder",
  dragSortOff: "Turn on drag to reorder",
  // ===== 拖拽与排序模式的关系（2026-10-22）=====
  autoCustomOnDrop: "Switch to custom order when dropping in",
  autoCustomOnDropHelp: "When you drop a file into a folder that is sorted by time or name, that folder is switched to Custom order so the position you picked is kept. Off: the file simply lands wherever the folder's sort rule puts it.",
  dragSortLocked: "This folder is sorted by {mode}, so its order cannot be rearranged by hand. Pick another folder to move the item to, or use right-click → Sort order → Custom order.",
  movedByRule: "Moved. Its position is decided by this folder's sort rule.",
  movedAutoCustom: "Moved. The folder was switched to Custom order, so your position is kept.",
  positionByRule: "position set by this folder's sort rule",
  linkDragTip: "Drag into the editor to insert a link",
  linkDragTipHelp: "Drag a note from the file explorer into a note to insert a link — turn off Drag to reorder in settings first.",
  countGroupTitle: "File count",
  countShowAll: "Show counts for collapsed folders",
  countShowAllHelp: "By default only expanded folders show their count. Turn this on to keep seeing the number inside collapsed folders too.",
  countAddRoot: "Add a row for the whole vault",
  countAddRootHelp: "Obsidian does not show a top-level vault row. Turn this on to add one at the very top of the file explorer, showing the vault name and the total note count.",
  countOnlyMd: "Only count Markdown notes",
  countOnlyMdHelp: "Turn this off to choose which types of files are counted.",
  countFilterList: "Which files to count",
  countFilterListHelp: "Enter file extensions separated by commas. Leave empty to count everything.",
  countFilterPlaceholder: "Empty = count everything",
  countBlacklist: "Invert the list",
  countBlacklistHelp: "By default the list says what to count. Turn this on so the list says what to leave out instead.",
  sortSectionTitle: "Per-folder sorting & exclusions",
  focusModuleOn: "Enable focus mode",
  focusModuleOnHelp: "Turn the whole focus feature on or off. When off, the right-click item, the toolbar button and the command all stop working, and nothing is filtered out.",
  cleanModuleOn: "Enable file cleaner",
  cleanModuleOnHelp: "Turn the whole cleaner on or off. When off, the toolbar icon, the command and the startup run all stop.",
  countModuleOn: "Enable file count",
  countModuleOnHelp: "Turn the whole file count on or off. When off, no number shows next to any folder and the count is not maintained.",

  focusGroupTitle: "Focus mode",
  focusShowMenu: "Show Focus in the right-click menu",
  focusShowMenuHelp: "When off, use the command palette or the button in the file explorer header instead.",
  focusShowIcon: "Show focus button in the file explorer header",
  focusShowIconHelp: "Adds a button to the file explorer title bar that toggles focus mode.",
  focusLevel: "Focus level",
  focusLevelHelp: "Determines what to focus when using the command or the header button. The right-click menu always focuses the clicked item.",
  focusLevelFile: "Current file only",
  focusLevelParent: "Parent folder",
  focusLevelGrandparent: "Grandparent folder",
  focusDevices: "Enable on which devices",
  focusDevicesHelp: "Focus mode takes up screen space and is rarely needed on touch devices. Turn it off per device; when off, the right-click item and the button both disappear on that device.",
  focusDeviceDesktop: "Desktop",
  focusDeviceTablet: "Tablet",
  focusDevicePhone: "Phone",
  focusDeviceOn: "Enabled",
  focusDeviceOff: "Disabled",
  focusDeviceCurrent: "Current device: {device}",
  focusDisabledHere: "Focus mode is turned off for this device. Turn it back on in settings.",
  cleanDevices: "Enable on which devices",
  cleanDevicesHelp: "Cleanup deletes or moves files, so it is safer to only allow it where you want it. When off, the trash icon disappears on that device and cleanup will not run there.",
  countDevices: "Enable on which devices",
  countDevicesHelp: "Counts are useful on a big screen but only add clutter on a phone. When off, numbers are hidden and no longer updated on that device.",

  focusLevelGreatGrandparent: "Great grandparent folder",
  focusLevelCustom: "Specific folder",
  focusCustomPath: "Folder path",
  focusCustomPathHelp: "Focus this folder regardless of which note is open.",
  focusCustomPathPlaceholder: "Folder/subfolder",
  focusEnter: "Focus",
  focusExit: "Exit focus",
  focusEntered: "Focus mode on",
  focusExited: "Focus mode off",
  focusCommand: "Toggle focus mode",
  focusCommandHelp: "Enter or exit focus mode. The file explorer then keeps only the current branch.",
  focusAutoHide: "Always hidden folders",
  focusAutoHideHelp: "These folders never show in the file explorer.",
  focusAutoHideManage: "Manage",
  focusAutoHideEmpty: "No folders are always hidden yet.",
  focusAutoHideTitle: "Always hidden folders",
  focusAutoHideIntro: "The following folders will always be hidden from the file explorer.",
  focusAutoHidePlaceholder: "Folder path, e.g. 000attachments",
  focusAutoHideAdd: "Add",
  focusFolderOption: "Folder",
  focusSave: "Save",
  focusCancel: "Cancel",
  focusLevelChanged: "Focus level updated",
  loadedNotice: "Aio Explorer is loaded. Right-click a file in the file explorer, or click the explorer's sort button.",
  cleanGroupTitle: "File cleaner",
  cleanBtn: "Clean files",
  cleanDeleteDestination: "Deleted files",
  cleanDeleteDestinationHelp: "What happens to a file after it's deleted.",
  cleanDestGlobal: "Use Obsidian global option",
  cleanDestSystem: "Move to system trash",
  cleanDestObsidian: "Move to Obsidian trash (.trash folder)",
  cleanDestPermanent: "Permanently delete",
  cleanTrashAge: "Trash directory age threshold",
  cleanTrashAgeHelp: "Amount of days files can be in the .trash folder before they are permanently removed. Use -1 to disable.",
  cleanNotifications: "Notifications",
  cleanNotificationsHelp: "How should notifications for this feature be handled",
  cleanNotifyAll: "Show all",
  cleanNotifyErrors: "Show only errors",
  cleanNotifyNone: "Hide all",
  cleanFoldersHeader: "Folders",
  cleanRemoveFolders: "Remove folders",
  cleanRemoveFoldersHelp: "Include empty folders in cleanup",
  cleanFolderMode: "Folder filtering",
  cleanFolderModeHelp: "Whether the folders listed below should be excluded or included during cleanup",
  cleanFolderExclude: "Exclude these (scan all others)",
  cleanFolderInclude: "Only clean these",
  cleanFolders: "Folder list",
  cleanFoldersHelp: "Folder paths, one per line. Case-sensitive. Supports regular expressions (use .* as wildcard). Ignored if empty.",
  cleanFoldersPlaceholder: "Example://nfolder/subfolder//nfolder2/subfolder2",
  cleanFilesHeader: "Files",
  cleanAttachmentMode: "Attachment extension filtering",
  cleanAttachmentModeHelp: "Whether the extensions listed below should be excluded or included during cleanup",
  cleanAttachmentExclude: "Exclude these (treat all others as attachments)",
  cleanAttachmentInclude: "Only clean these extensions",
  cleanAttachmentExtensions: "Attachment extensions",
  cleanAttachmentExtensionsHelp: "Extensions separated by commas. The .* wildcard selects all. Ignored if empty.",
  cleanAttachmentPlaceholder: "Example: jpg, png, pdf, *",
  cleanFileAgeThreshold: "File age threshold",
  cleanFileAgeThresholdHelp: "Only files and folders over the specified threshold will be cleaned up (in days). Use 0 for no limit.",
  cleanMdHeader: "Markdown files",
  cleanDeleteEmptyMarkdown: "Delete empty Markdown files",
  cleanDeleteEmptyMarkdownHelp: "Removes Markdown files if their size is 0 or the content is blank",
  cleanDeleteEmptyWithBacklinks: "Delete empty Markdown files with backlinks",
  cleanDeleteEmptyWithBacklinksHelp: "Removes empty Markdown files even if they are linked to by other files.",
  cleanIgnoredFrontmatter: "Ignored frontmatter",
  cleanIgnoredFrontmatterHelp: "If a file contains only frontmatter and only these properties, it will be removed. Comma-separated.",
  cleanIgnoreAllFrontmatter: "Ignore all frontmatter",
  cleanIgnoreAllFrontmatterHelp: "Ignores all frontmatter, including the ones set above.",
  cleanCodeblockTypes: "Codeblock parsing",
  cleanCodeblockTypesHelp: "List of codeblock types that should be checked for attachments. Supports regular expressions. Comma-separated.",
  cleanCodeblockPlaceholder: "Example: ad-summary, ad-.*, tabs",
  cleanOtherHeader: "Other",
  cleanDeleteConfirmation: "Preview deleted files",
  cleanDeleteConfirmationHelp: "Show a confirmation box with a list of files to be removed",
  cleanRunOnStartup: "Run on startup",
  cleanRunOnStartupHelp: "Runs the cleaner on startup",
  cleanCloseNewTabs: "Close new tabs",
  cleanCloseNewTabsHelp: "Close leftover New tabs",
  cleanDeleteEmptyOnClose: "Delete empty file on close",
  cleanDeleteEmptyOnCloseHelp: "Whether to clean up recently closed Markdown files. Only cleans empty files matching the rules above",
  cleanExcalidraw: "Treat canvas drawings as attachments",
  cleanExcalidrawHelp: "With this on, empty canvas drawings no longer referenced by other files will be removed.",
  cleanDebug: "Enable debug logging",
  cleanDebugHelp: "Whether debug logging should be enabled",
  cleanDangerHeader: "Danger zone",
  cleanReset: "Reset settings",
  cleanResetHelp: "Resets the configuration back to default values",
  cleanResetBtn: "Reset",
  cleanConfirmTitle: "Deletion confirmation",
  cleanConfirmText: "Selected files and folders will be removed. Uncheck any you wish to keep.",
  cleanKindFile: "Files",
  cleanKindFolder: "Folders",
  cleanSelectedCount: "{n} selected",
  cleanCancel: "Cancel",
  cleanConfirm: "Confirm",
  cleanSelectAll: "Select all",
  cleanUnselectAll: "Unselect all",
  cleanResetConfirmTitle: "Reset settings",
  cleanResetConfirmText: "Are you sure you want to reset the file cleaner settings?",
  cleanNotifySuccess: "Clean successful",
  cleanNotifyNothing: "No file to clean",
  cleanNotifyFailed: "Failed to clean: ",
  cleanNotifyUnexpected: "An unexpected error occurred, please check the console",
  cleanNotifyReset: "File cleaner: settings reset",
  cleanModuleOffNotice: "File cleaner is turned off. Enable it in settings first.",
  // ===== 文件置顶 =====
  pinGroupTitle: "File pin",
  pinModuleOn: "Enable file pin",
  pinModuleOnHelp: "Master switch for the pinned-folder tree view. When off, its view, ribbon icon and commands are all disabled.",
  pinDevices: "Enable on which devices",
  pinDevicesHelp: "The pinned tree is most useful on desktop. Turn a device off to hide the view and stop it there.",
  pinLanguage: "Language",
  pinLanguageHelp: "Choose the language for the file pin panel, or follow Obsidian.",
  pinAutoReveal: "Auto-reveal active file",
  pinAutoRevealHelp: "Follow the active note within pinned folders. Notes outside them leave the view unchanged.",
  // ===== 文件图标 =====
  iconGroupTitle: "File icons",
  iconModuleOn: "Enable file icons",
  iconModuleOnHelp: "Master switch for the file icon feature. When off, the colorful folder icon effect below stops working.",
  iconColorfulFolder: "Colorful folder icons",
  iconColorfulFolderHelp: "Cycle folder icons in the file explorer through 7 colors (red, orange, yellow, green, cyan, blue, purple) so adjacent folders are easy to tell apart. Ported from the same setting in the Border theme; works with any theme.",
  iconFolderBold: "Bold folder name",
  iconFolderBoldHelp: "How heavy folder names look in the file explorer. Drag the slider: 400 is off, 500 is subtle, 600 is Obsidian's own standard emphasis, 700 is bold, 800 is extra bold. 600 is recommended. Ported from the same setting in the Border theme; works with any theme.",
  iconFolderBoldReset: "Reset to the recommended 600",
  folderBoldOff: "Off",
  folderBoldLight: "Subtle",
  folderBoldMedium: "Medium",
  folderBoldStrong: "Bold",
  folderBoldExtra: "Extra bold",
  iconCustomIcons: "Custom icons",
  iconCustomIconsHelp: "On: show the icon set extracted from the Border theme (folder shapes plus per-extension file icons). Off: do not show them, back to the native look. On the Border theme itself this matches the theme's own icons; the switch is meant for other themes.",
  // ===== 标题调整 =====
  liveStateTitle: "Live status",
  liveStateDesc: "Read straight from the window body class — if anything shows a cross, the switch did not land. Press the button to re-apply everything; no restart needed.",
  liveStateStyles: "Stylesheet in memory",
  liveStateWindows: "Windows synced",
  liveApplyBtn: "Re-apply all switches now",
  liveApplyDone: "All switches re-applied.",
  liveStateOn: "on",
  liveStateOff: "off",
  liveStateSizeDesktop: "{size} (this desktop) · mobile {mobile}",
  liveStateSizeMobile: "{size} (this mobile) · desktop {desktop}",
  applyNowFailed: "Switch changed, but it could not be applied right away: ",
  saveAfterApplyFailed: "Applied right away, but writing data.json failed: ",
  titleAdjustGroupTitle: "Title adjust",
  subfolderInherit: "Subfolder colors follow top level",
  subfolderInheritHelp: "Stops the rainbow from reshuffling on every scroll. Each top-level folder keeps one fixed color, and all folders and guide lines under it share that color. Ported from your own CSS snippet; needs the colorful-folder switch above to be on.",
  titleFontSize: "Title font size",
  titleFontSizeHelp: "Drag to resize file and folder names in the file list. Changes the file list only — it does not touch the note text size set in Appearance. This is the desktop value; phones automatically use the separate mobile value below.",
  titleFontSizeReset: "Reset to default",
  mobileTitleFontSize: "Mobile title font size",
  mobileTitleFontSizeHelp: "Font size for the file list on phones (Obsidian marks the app with an is-mobile flag automatically). Stored in the same data.json as the desktop value, so one sync covers every device — no per-device setup needed.",
  titleStateFontSize: "Title font size",
  titleWrapGroupTitle: "Title wrap",
  titleWrap: "Title wrap",
  titleWrapHelp: "When a file or folder name is too long, wrap it onto multiple lines instead of truncating it with an ellipsis. Ported from the same setting in the Border theme; works with any theme.",
};
var zh = {
  lifted: "\u5DF2\u62FF\u8D77",
  chooseHint: "\u79FB\u5230\u540E\u677E\u624B",
  positionBetween: "{previous} \u4E0E {next} \u4E4B\u95F4",
  positionAfter: "{previous} \u4E4B\u540E",
  positionBefore: "{next} \u4E4B\u524D",
  positionFirst: "\u7B2C\u4E00\u4E2A\u4F4D\u7F6E",
  interaction: "\u62D6\u62FD\u4EA4\u4E92",
  general: "\u901A\u7528",
  ordering: "\u6392\u5E8F",
  details: "\u67E5\u770B\u8BF4\u660E",
  interactionHelp: "\u6309\u4F4F\u8FBE\u5230\u8BBE\u7F6E\u7684\u5EF6\u8FDF\u540E\uFF0C\u518D\u79FB\u52A8\u81F3\u5C11 4 \u50CF\u7D20\u5373\u53EF\u63D0\u8D77\u3002\u666E\u901A\u70B9\u51FB\u4ECD\u7136\u6253\u5F00\u6761\u76EE\u3002",
  interactionHelpMobile: "\u4FDD\u6301\u6309\u4F4F\uFF0C\u8FBE\u5230\u8BBE\u7F6E\u7684\u5EF6\u8FDF\u540E\u63D0\u8D77\uFF1B\u63D0\u524D\u6ED1\u52A8\u5219\u6B63\u5E38\u6EDA\u52A8\u3002\u63D0\u8D77\u540E\u79FB\u52A8\u4F4D\u7F6E\uFF0C\u677E\u624B\u653E\u4E0B\u3002",
  noExclusions: "\u5C1A\u672A\u6392\u9664\u4EFB\u4F55\u76EE\u5F55",
  addDirectory: "\u6DFB\u52A0\u76EE\u5F55",
  chooseDirectory: "\u4ECE\u77E5\u8BC6\u5E93\u9009\u62E9\u76EE\u5F55",
  directoryPlaceholder: "\u76EE\u5F55\u8DEF\u5F84\uFF0C\u4F8B\u5982 Assets/Images",
  add: "\u6DFB\u52A0",
  remove: "\u79FB\u9664",
  language: "\u8BED\u8A00",
  languageHelp: "\u9009\u62E9 Aio Explorer \u7684\u754C\u9762\u8BED\u8A00\uFF0C\u9ED8\u8BA4\u8DDF\u968F Obsidian\u3002",
  auto: "\u8DDF\u968F Obsidian",
  showLoadNotice: "\u5173\u95ED\u542F\u52A8\u901A\u77E5",
  showLoadNoticeHelp: "\u5173\u95ED\u540E\uFF0CObsidian \u542F\u52A8\u65F6\u4E0D\u518D\u663E\u793A\u53F3\u4E0A\u89D2\u7684\u63D0\u793A\u5361\u7247\u3002",
  settings: "Aio Explorer",
  intro: "\u76F4\u63A5\u6574\u7406\u539F\u751F\u6587\u4EF6\u5217\u8868\u3002\u957F\u6309\u63D0\u8D77\uFF0C\u79FB\u52A8\u9009\u62E9\u4F4D\u7F6E\uFF0C\u677E\u624B\u653E\u4E0B\uFF1B\u6309 Esc \u53D6\u6D88\u3002",
  trigger: "\u62D6\u62FD\u89E6\u53D1\u533A\u57DF",
  row: "\u6574\u884C\u957F\u6309",
  handle: "\u53F3\u4FA7\u624B\u67C4",
  delay: "\u957F\u6309\u5EF6\u8FDF",
  delayHelp: "\u9F20\u6807\u6309\u4F4F\u7684\u5EF6\u8FDF\uFF0C\u5355\u4F4D\u6BEB\u79D2\uFF0C\u9ED8\u8BA4\u4E3A 200\u3002\u4E0E\u89E6\u5C4F\u5EF6\u8FDF\u5206\u522B\u4FDD\u5B58\u3002",
  delayHelpMobile: "\u89E6\u5C4F\u957F\u6309\u5EF6\u8FDF\uFF0C\u5355\u4F4D\u6BEB\u79D2\uFF0C\u9ED8\u8BA4\u4E3A 500\u3002\u9F20\u6807\u5EF6\u8FDF\u5728\u684C\u9762\u7AEF\u5355\u72EC\u8BBE\u7F6E\u3002",
  exclusions: "\u6392\u9664\u7684\u76EE\u5F55",
  exclusionsHelp: "\u8F93\u5165\u76F8\u5BF9\u4E8E\u77E5\u8BC6\u5E93\u7684\u76EE\u5F55\u8DEF\u5F84\uFF0C\u6216\u4ECE\u5217\u8868\u4E2D\u9009\u62E9\u3002\n\u8BE5\u76EE\u5F55\u53CA\u5B50\u76EE\u5F55\u7684\u5185\u90E8\u6761\u76EE\u4E0D\u6392\u5E8F\u3001\u4E0D\u8BB0\u5F55\uFF1B\u76EE\u5F55\u672C\u8EAB\u4ECD\u53EF\u5728\u4E0A\u4E00\u7EA7\u8C03\u6574\u4F4D\u7F6E\u3002\n\u79FB\u9664\u89C4\u5219\u540E\u6062\u590D\u6392\u5E8F\u529F\u80FD\u3002",
  attachment: "\u52A0\u5165\u5F53\u524D\u9644\u4EF6\u76EE\u5F55",
  noAttachment: "\u5F53\u524D\u6CA1\u6709\u72EC\u7ACB\u7684\u9644\u4EF6\u76EE\u5F55\uFF08\u4E0D\u4F1A\u81EA\u52A8\u6392\u9664\u6839\u76EE\u5F55\u6216\u76F8\u5BF9\u5F53\u524D\u7B14\u8BB0\u7684\u76EE\u5F55\uFF09\u3002",
  reload: "\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6\u6570\u636E",
  reset: "\u6062\u590D\u6B64\u76EE\u5F55\u7684\u539F\u751F\u6392\u5E8F",
  ready: "\u63D2\u4EF6\u6570\u636E\u5DF2\u91CD\u65B0\u52A0\u8F7D",

  error: "Aio Explorer\uFF1A\u672A\u80FD\u5E94\u7528\u66F4\u6539\uFF0C\u8BF7\u68C0\u67E5\u63D2\u4EF6\u7684 data.json\u3002",
  invalidPath: "\u8BF7\u4F7F\u7528\u4E0D\u542B .. \u7684\u77E5\u8BC6\u5E93\u76F8\u5BF9\u76EE\u5F55\u8DEF\u5F84\u3002",
  invalidJson: "data.json \u683C\u5F0F\u65E0\u6548\u3002\u5DF2\u4FDD\u7559\u539F\u6587\u4EF6\u53CA\u4E0A\u6B21\u6709\u6548\u6392\u5E8F\uFF1B\u4FEE\u590D\u6587\u4EF6\u540E\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6\u6570\u636E\u5373\u53EF\u3002",
  newerDataVersion: "\u6B64 data.json \u6765\u81EA\u66F4\u9AD8\u7248\u672C\u7684 Aio Explorer\uFF0C\u8BF7\u66F4\u65B0\u63D2\u4EF6\u540E\u518D\u4F7F\u7528\u3002\u539F\u6587\u4EF6\u672A\u88AB\u4FEE\u6539\u3002",
  missingLegacyOrder: "\u672A\u627E\u5230\u65E7\u6392\u5E8F\u6587\u4EF6\u3002\u8BF7\u540C\u6B65\u6216\u6062\u590D jsonPath \u6307\u5B9A\u7684 JSON \u6587\u4EF6\uFF0C\u518D\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6\u6570\u636E\u5B8C\u6210\u5347\u7EA7\uFF1B\u6CA1\u6709\u5199\u5165\u7A7A\u6392\u5E8F\u3002",
  invalidLegacyOrder: "\u65E7\u6392\u5E8F\u6587\u4EF6\u683C\u5F0F\u65E0\u6548\u3002\u8BF7\u4FEE\u590D jsonPath \u6307\u5B9A\u7684 JSON \u6587\u4EF6\uFF0C\u518D\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6\u6570\u636E\uFF1B\u539F\u6587\u4EF6\u672A\u88AB\u4FEE\u6539\u3002",
  migrationBackupFailed: "\u65E7\u6570\u636E\u5907\u4EFD\u5931\u8D25\u3002\u8BF7\u68C0\u67E5\u5B58\u50A8\u6743\u9650\u548C\u5269\u4F59\u7A7A\u95F4\uFF0C\u518D\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6\u6570\u636E\u91CD\u8BD5\u5347\u7EA7\uFF1B\u539F\u6570\u636E\u672A\u88AB\u8986\u76D6\u3002",
  migrationSaveFailed: "\u5347\u7EA7\u540E\u7684\u6570\u636E\u4FDD\u5B58\u5931\u8D25\u3002\u5907\u4EFD\u4F4D\u4E8E Aio Explorer \u63D2\u4EF6\u76EE\u5F55\u7684 backups \u5185\uFF1B\u8BF7\u68C0\u67E5\u5B58\u50A8\u5E76\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6\u6570\u636E\u91CD\u8BD5\u3002",
  dataRecovery: "\u6570\u636E\u6062\u590D",
  resetData: "\u5907\u4EFD\u5E76\u91CD\u7F6E\u6392\u5E8F",
  resetDataHelp: "\u5148\u5C06\u635F\u574F\u6570\u636E\u5907\u4EFD\u5230 Aio Explorer \u63D2\u4EF6\u76EE\u5F55\u7684 backups \u5185\uFF0C\u518D\u6E05\u9664\u6240\u6709\u81EA\u5B9A\u4E49\u6392\u5E8F\u3002\u4FDD\u7559\u80FD\u8BC6\u522B\u7684\u8BBE\u7F6E\uFF0C\u4E0D\u4F1A\u79FB\u52A8\u6216\u5220\u9664\u4EFB\u4F55\u7B14\u8BB0\u3001\u76EE\u5F55\u3002\u53EA\u6709\u5907\u4EFD\u6210\u529F\u624D\u4F1A\u91CD\u7F6E\uFF1B\u91CD\u7F6E\u540E\u7684\u6392\u5E8F\u53EF\u80FD\u540C\u6B65\u5230\u5176\u4ED6\u8BBE\u5907\u3002",
  keepData: "\u4FDD\u7559\u5F53\u524D\u6570\u636E",
  confirmResetData: "\u5907\u4EFD\u5E76\u91CD\u7F6E",
  resetDataDone: "\u5DF2\u5907\u4EFD\u635F\u574F\u6570\u636E\u5E76\u91CD\u7F6E\u6392\u5E8F\uFF0C\u53EF\u4EE5\u91CD\u65B0\u62D6\u52A8\u6392\u5E8F\u4E86\u3002",
  dataChanged: "\u6062\u590D\u671F\u95F4\u6570\u636E\u5DF2\u53D1\u751F\u53D8\u5316\uFF0C\u8BF7\u5148\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6\u6570\u636E\u518D\u91CD\u8BD5\uFF1B\u6CA1\u6709\u91CD\u7F6E\u4EFB\u4F55\u6570\u636E\u3002",
  compatibilityError: "\u539F\u751F\u63A5\u53E3\u5F02\u5E38\uFF0CAio Explorer \u5DF2\u6682\u505C\u5F53\u524D\u5217\u8868\u7684\u62D6\u52A8\u3002\u66F4\u65B0 Obsidian \u540E\u53EF\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6\u3002",
  unavailable: "\u5F53\u524D Obsidian \u7684\u539F\u751F\u6587\u4EF6\u5217\u8868\u63A5\u53E3\u4E0D\u517C\u5BB9\uFF0C\u5C1A\u672A\u63A5\u5165\u6392\u5E8F\u3002",
  locked: "\u6B64\u76EE\u5F55\u5DF2\u6392\u9664\uFF0C\u4E0D\u53C2\u4E0E\u81EA\u5B9A\u4E49\u6392\u5E8F\u3002",
  moving: "\u6B63\u5728\u62D6\u62FD",
  hold: "\u957F\u6309\u62D6\u62FD",
  cancel: "\u79FB\u51FA\u5217\u8868\u677E\u624B\u6216\u6309 Esc \u53D6\u6D88",
  cancelWithKey: "\u6309 {key} \u53D6\u6D88",
  dragToCancel: "\u62D6\u5230\u8FD9\u91CC\u53D6\u6D88",
  releaseToCancel: "\u677E\u624B\u53D6\u6D88",
  choose: "\u653E\u5230\u54EA\u4E2A\u76EE\u5F55\uFF1F",
  root: "\u77E5\u8BC6\u5E93\u6839\u76EE\u5F55",
  inside: "\u79FB\u5165",
  before: "\u653E\u5728\u6B64\u9879\u4E4B\u524D\uFF1A",
  end: "\u653E\u5728\u672B\u5C3E",
  unchanged: "\u4FDD\u6301\u539F\u4F4D\u7F6E",
  invalid: "\u4E0D\u80FD\u653E\u5728\u8FD9\u91CC",
  moved: "\u4F4D\u7F6E\u5DF2\u4FDD\u5B58",
  collision: "\u76EE\u6807\u76EE\u5F55\u5DF2\u7ECF\u5B58\u5728\u540C\u540D\u6587\u4EF6\u6216\u6587\u4EF6\u5939\u3002",
  changed: "\u62D6\u62FD\u671F\u95F4\u5217\u8868\u53D1\u751F\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u62D6\u52A8\u3002",
  rollbackFailed: "\u6392\u5E8F\u4FDD\u5B58\u5931\u8D25\uFF0C\u4E14\u6587\u4EF6\u672A\u80FD\u79FB\u56DE\u539F\u4F4D\u7F6E\u3002\u8BF7\u68C0\u67E5\u6587\u4EF6\u5F53\u524D\u4F4D\u7F6E\u540E\u518D\u7EE7\u7EED\u3002",
  readError: "\u65E0\u6CD5\u8BFB\u53D6\u63D2\u4EF6\u7684 data.json\u3002\u6682\u65F6\u4FDD\u7559\u4E0A\u6B21\u6709\u6548\u6392\u5E8F\uFF0C\u4FEE\u590D\u6587\u4EF6\u540E\u5373\u53EF\u7EE7\u7EED\u3002",
  resetDone: "\u5DF2\u6062\u590D\u6B64\u76EE\u5F55\u7684\u539F\u751F\u6392\u5E8F",
  sortMenu: "排序方式",
  parentFolderSort: "父文件夹排序方式",
  sortCustom: "自定义顺序",
  sortNameAsc: "文件名（A → Z）",
  sortNameDesc: "文件名（Z → A）",
  sortCreatedNew: "创建时间（新 → 旧）",
  sortCreatedOld: "创建时间（旧 → 新）",
  sortModifiedNew: "修改时间（新 → 旧）",
  sortModifiedOld: "修改时间（旧 → 新）",
  sortNative: "恢复原生排序",
  saveAsCustom: "保存为自定义顺序",
  saveAsCustomDone: "已保存为自定义顺序",
  sortApplied: "排序方式已更新",
  pinItem: "置顶此项目",
  unpinItem: "取消置顶",
  pinDone: "已置顶",
  unpinDone: "已取消置顶",
  hideItem: "隐藏此项目",
  unhideItem: "取消隐藏",
  hideDone: "已隐藏此项目",
  unhideDone: "已取消隐藏",
  showHiddenOn: "显示隐藏项",
  showHiddenOff: "隐藏「隐藏项」",
  showHiddenDone: "已显示隐藏项",
  hideHiddenDone: "已重新隐藏隐藏项",
  pinnedMarker: "已置顶",
  hiddenMarker: "已隐藏",
  sortGroupTitle: "每文件夹排序",
  sortGroupDesc: "在文件列表中右键某个文件或文件夹，即可单独设置它的排序方式、置顶或隐藏。",
  dragSortToggle: "拖拽排序",
  dragSortHelp: "关闭后不再接管文件列表的拖拽，此时把笔记拖进正文可插入链接；排序、隐藏、置顶、专注等其他功能不受影响。也可直接点文件列表右上角的开关按钮。",
  dragSortOn: "关闭拖拽排序",
  dragSortOff: "开启拖拽排序",
  // ===== 拖拽与排序模式的关系（2026-10-22）=====
  autoCustomOnDrop: "拖入时切换为自定义排序",
  autoCustomOnDropHelp: "把文件拖进「按时间/按名称排序」的文件夹时，自动把该文件夹切成 Custom order，保留你选的位置。关闭时：文件按那个文件夹的排序规则落位，你选的位置不生效。",
  dragSortLocked: "这个文件夹当前按{mode}排序，不能手动调整顺序。可以拖到别的文件夹，或在右键「Sort order」里改回「Custom order」。",
  movedByRule: "已移动。位置由该文件夹的排序规则决定。",
  movedAutoCustom: "已移动。该文件夹已切换为 Custom order，你选的位置已生效。",
  positionByRule: "位置由该文件夹的排序规则决定",
  linkDragTip: "拖到正文插入链接",
  linkDragTipHelp: "把笔记从左侧文件列表拖到右侧笔记正文，即可插入链接——需先关闭「拖拽排序」（按钮在右上角或设置里都行）。",
  countGroupTitle: "文件计数",
  countShowAll: "折叠时也显示数量",
  countShowAllHelp: "默认只显示展开的文件夹数量。开启后，文件夹收起时也能看到里面的笔记数。",
  countAddRoot: "显示库的总行",
  countAddRootHelp: "Obsidian 本身不显示最外层的库。开启后会在文件列表最上面多出一行，显示库名和整个库的笔记总数。",
  countOnlyMd: "只统计 Markdown 笔记",
  countOnlyMdHelp: "关闭后可以自己指定要统计哪些类型的文件。",
  countFilterList: "统计哪些文件",
  countFilterListHelp: "填文件扩展名，多个用英文逗号隔开。留空表示全部都算。",
  countFilterPlaceholder: "留空 = 全部都算",
  countBlacklist: "反过来排除",
  countBlacklistHelp: "默认是「只算列表里的」。开启后变成「不算列表里的」，其余全部统计。",
  focusDevices: "在哪些设备上启用",
  focusDevicesHelp: "专注模式用起来占屏幕，触屏设备上通常不需要。可以按设备分别关掉，关掉后这台设备上右键菜单和按钮都不会出现专注。",
  focusDeviceDesktop: "电脑",
  focusDeviceTablet: "平板",
  focusDevicePhone: "手机",
  focusDeviceOn: "启用",
  focusDeviceOff: "不启用",
  focusDeviceCurrent: "当前设备：{device}",
  focusDisabledHere: "专注模式已在当前设备关闭，可在设置里重新打开",
  cleanDevices: "在哪些设备上启用",
  cleanDevicesHelp: "清理会真的删文件或移文件，建议只在你愿意的地方开。关掉后这台设备上垃圾桶图标会消失，也不会再自动清理。",
  countDevices: "在哪些设备上启用",
  countDevicesHelp: "数字在大屏上很有用，手机上只会显得挤。关掉后这台设备上不显示数量，也不再统计。",

  cleanGroupTitle: "文件清理",
  cleanBtn: "清理文件",
  cleanDeleteDestination: "删除方式",
  cleanDeleteDestinationHelp: "文件被删除后去哪里。",
  cleanDestGlobal: "跟随 Obsidian 设置",
  cleanDestSystem: "移到系统回收站",
  cleanDestObsidian: "移到软件回收站（.trash 文件夹）",
  cleanDestPermanent: "彻底删除（不可恢复）",
  cleanTrashAge: "回收站保留天数",
  cleanTrashAgeHelp: "文件在 .trash 里放多少天后才彻底清除。填 -1 表示不自动清除。",
  cleanNotifications: "通知",
  cleanNotificationsHelp: "这个功能要弹多少提示。",
  cleanNotifyAll: "全部显示",
  cleanNotifyErrors: "只显示错误",
  cleanNotifyNone: "全部不显示",
  cleanFoldersHeader: "文件夹",
  cleanRemoveFolders: "一并清理空文件夹",
  cleanRemoveFoldersHelp: "把没有任何内容的空文件夹也一起删掉。",
  cleanFolderMode: "文件夹范围",
  cleanFolderModeHelp: "下面的列表是「要排除的」还是「只清理这些」。",
  cleanFolderExclude: "排除这些（其余全扫）",
  cleanFolderInclude: "只清理这些",
  cleanFolders: "文件夹列表",
  cleanFoldersHelp: "填目录路径，一行一个；区分大小写；支持正则（可用 .* 通配）。留空表示不限制。",
  cleanFoldersPlaceholder: "示例：\n文件夹/子文件夹\n文件夹2/子文件夹2",
  cleanFilesHeader: "文件",
  cleanAttachmentMode: "附件范围",
  cleanAttachmentModeHelp: "下面的扩展名列表是「只清理这些」还是「排除这些」。",
  cleanAttachmentExclude: "排除这些（其余全算附件）",
  cleanAttachmentInclude: "只清理这些扩展名",
  cleanAttachmentExtensions: "附件扩展名",
  cleanAttachmentExtensionsHelp: "填扩展名，用英文逗号隔开；可用 .* 表示全部。留空表示按上面的范围设置处理。",
  cleanAttachmentPlaceholder: "示例：jpg, png, pdf, *",
  cleanFileAgeThreshold: "只清理超过天数的文件",
  cleanFileAgeThresholdHelp: "只清理最后修改时间超过这个天数的文件和文件夹。填 0 表示不限。",
  cleanMdHeader: "Markdown 文件",
  cleanDeleteEmptyMarkdown: "清理空 Markdown",
  cleanDeleteEmptyMarkdownHelp: "文件大小为 0、或内容只有空白时删掉。",
  cleanDeleteEmptyWithBacklinks: "有链接指向的空文件也清理",
  cleanDeleteEmptyWithBacklinksHelp: "即使还有别的笔记链接到它，也照样清理。",
  cleanIgnoredFrontmatter: "这些 frontmatter 字段算「有内容」",
  cleanIgnoredFrontmatterHelp: "如果一个文件只有 frontmatter，而且字段全在列表里，就当空文件清理。用逗号隔开。",
  cleanIgnoreAllFrontmatter: "忽略所有 frontmatter",
  cleanIgnoreAllFrontmatterHelp: "只要有 frontmatter 就算有内容（与上面的设置相反）。",
  cleanCodeblockTypes: "要检查的代码块类型",
  cleanCodeblockTypesHelp: "这些代码块类型里引用的附件算「在用」。支持正则，用逗号隔开。",
  cleanCodeblockPlaceholder: "示例：ad-summary, ad-.*, tabs",
  cleanOtherHeader: "其他",
  cleanDeleteConfirmation: "删除前让我确认",
  cleanDeleteConfirmationHelp: "清理前弹出清单，逐项勾选后再删。建议保持开启。",
  cleanRunOnStartup: "启动时自动清理",
  cleanRunOnStartupHelp: "打开 Obsidian 后自动跑一次清理。",
  cleanCloseNewTabs: "清理后关掉空白标签页",
  cleanCloseNewTabsHelp: "清理完成后把残留的空白标签页关掉。",
  cleanDeleteEmptyOnClose: "关闭笔记时，若为空就删掉",
  cleanDeleteEmptyOnCloseHelp: "关掉一个空笔记时直接清理掉它。只对符合上面规则的空文件生效。",
  cleanExcalidraw: "把画板文件当附件处理",
  cleanExcalidrawHelp: "开启后，没被引用的空白画板文件也会被清理。",
  cleanDebug: "输出调试日志",
  cleanDebugHelp: "在控制台输出清理过程，便于排查。",
  cleanDangerHeader: "危险操作",
  cleanReset: "恢复默认设置",
  cleanResetHelp: "把文件清理的所有设置恢复成默认值。",
  cleanResetBtn: "恢复",
  cleanConfirmTitle: "确认清理",
  cleanConfirmText: "下面这些文件和文件夹将被清理，取消勾选可以保留。",
  cleanKindFile: "文件",
  cleanKindFolder: "文件夹",
  cleanSelectedCount: "已选中 {n} 项",
  cleanCancel: "取消",
  cleanConfirm: "确定",
  cleanSelectAll: "全选",
  cleanUnselectAll: "全不选",
  cleanResetConfirmTitle: "恢复默认设置",
  cleanResetConfirmText: "确定要把文件清理的设置全部恢复成默认值吗？",
  cleanNotifySuccess: "清理完成",
  cleanNotifyNothing: "没有需要清理的内容",
  cleanNotifyFailed: "清理失败：",
  cleanNotifyUnexpected: "清理时出错，请看控制台",
  cleanNotifyReset: "文件清理：设置已恢复默认",
  cleanModuleOffNotice: "文件清理已关闭，请先在设置里打开",

  sortSectionTitle: "每文件夹排序与排除目录",
  focusModuleOn: "启用专注模式",
  focusModuleOnHelp: "整个专注功能的总开关。关闭后右键菜单、标题栏按钮、命令面板都失效，文件列表也不再被筛选。",
  cleanModuleOn: "启用文件清理",
  cleanModuleOnHelp: "整个清理功能的总开关。关闭后侧栏图标、命令面板、启动时自动清理都不再运行。",
  countModuleOn: "启用文件计数",
  countModuleOnHelp: "整个计数功能的总开关。关闭后任何文件夹后面都不再显示笔记数量，也不再统计。",

  focusGroupTitle: "专注模式",
  focusShowMenu: "在右键菜单中显示「专注」",
  focusShowMenuHelp: "关闭后，右键菜单里不再出现专注选项，仍可用命令面板或文件列表右上角的按钮切换。",
  focusShowIcon: "在文件列表右上角显示专注按钮",
  focusShowIconHelp: "在文件列表标题栏加一个按钮，点一下即可进入或退出专注模式。",
  focusLevel: "切换时的专注层级",
  focusLevelHelp: "决定用命令面板或右上角按钮切换时，专注到当前笔记的哪一层。右键菜单始终专注到被点击的那一项。",
  focusLevelFile: "仅当前笔记",
  focusLevelParent: "所在文件夹",
  focusLevelGrandparent: "上一级文件夹",
  focusLevelGreatGrandparent: "上两级文件夹",
  focusLevelCustom: "指定文件夹",
  focusCustomPath: "指定的文件夹路径",
  focusCustomPathHelp: "填写一个文件夹路径，无论当前打开哪篇笔记，都专注到这个文件夹。",
  focusCustomPathPlaceholder: "文件夹/子文件夹",
  focusEnter: "专注",
  focusExit: "退出专注",
  focusEntered: "已进入专注模式",
  focusExited: "已退出专注模式",
  focusCommand: "切换专注模式",
  focusCommandHelp: "进入或退出专注模式。进入后文件列表只保留当前所在的分支，其余部分暂时收起。",
  focusAutoHide: "始终隐藏的文件夹",
  focusAutoHideHelp: "这些文件夹在文件列表中始终不显示，适合放临时收集、附件等不需要天天看的目录。",
  focusAutoHideManage: "管理",
  focusAutoHideEmpty: "尚未设置始终隐藏的文件夹。",
  focusAutoHideTitle: "始终隐藏的文件夹",
  focusAutoHideIntro: "以下文件夹将在文件列表中始终隐藏。",
  focusAutoHidePlaceholder: "文件夹路径，例如 MyFolder/SubFolder",
  focusAutoHideAdd: "添加",
  focusFolderOption: "文件夹",
  focusSave: "保存",
  focusCancel: "取消",
  focusLevelChanged: "专注层级已更新",
  loadedNotice: "Aio Explorer 已加载：右键文件列表可看到「排序方式 / 置顶 / 隐藏 / 专注」，文件夹后有笔记数量，侧栏有清理图标。想把笔记拖进正文插入链接，请在设置里关掉「拖拽排序」。",
  // ===== 文件置顶 =====
  pinGroupTitle: "文件置顶",
  pinModuleOn: "启用文件置顶",
  pinModuleOnHelp: "置顶文件夹树视图的总开关。关闭后视图、侧栏图标和命令都不可用。",
  pinDevices: "在哪些设备上启用",
  pinDevicesHelp: "置顶树在电脑上最有用；手机上可关掉。关闭后这台设备不显示视图、不再统计。",
  pinLanguage: "语言",
  pinLanguageHelp: "选择文件置顶面板的界面语言，默认跟随 Obsidian。",
  pinAutoReveal: "自动显示当前文件",
  pinAutoRevealHelp: "在已固定的文件区内跟随当前笔记；其他位置的笔记不会改变此视图。",
  // ===== 文件图标 =====
  iconGroupTitle: "文件图标",
  iconModuleOn: "启用文件图标",
  iconModuleOnHelp: "整个文件图标功能的总开关。关闭后，下面的多彩文件夹图标等效果全部失效。",
  iconColorfulFolder: "多彩文件夹图标",
  iconColorfulFolderHelp: "让文件列表里的文件夹图标按顺序循环显示 7 种颜色（红、橙、黄、绿、青、蓝、紫），相邻目录一眼就能区分。",
  iconFolderBold: "文件夹字体加粗",
  iconFolderBoldHelp: "调整文件列表里文件夹名称的粗细。左右拖动滑块：400 不加粗、500 轻微、600 适中（Obsidian 自己的标准强调，推荐）、700 加粗、800 特粗。默认从 600 起步，比原来的「一开就加粗」柔和很多。",
  iconFolderBoldReset: "恢复推荐档位 600",
  folderBoldOff: "不加粗",
  folderBoldLight: "轻微",
  folderBoldMedium: "适中",
  folderBoldStrong: "加粗",
  folderBoldExtra: "特粗",
  iconCustomIcons: "自定义图标",
  iconCustomIconsHelp: "开启：显示整套文件图标（文件夹形状 + 按扩展名区分的文件图标）；关闭：不显示，回归软件/主题的原生状态。",
  // ===== 即时生效状态（2026-10-21）=====
  liveStateTitle: "当前生效状态",
  liveStateDesc: "直接读取窗口 body 上的类名，不靠猜。哪一项显示「未生效」就说明开关没落地，点右边按钮重新应用一次即可，不用重启 Obsidian。",
  liveStateStyles: "样式表在内存",
  liveStateWindows: "已同步窗口",
  liveApplyBtn: "立即重新应用所有开关",
  liveApplyDone: "已重新应用全部开关。",
  liveStateOn: "生效中",
  liveStateOff: "未生效",
  liveStateSizeDesktop: "{size}（本机电脑端） · 手机端 {mobile}",
  liveStateSizeMobile: "{size}（本机手机端） · 电脑端 {desktop}",
  applyNowFailed: "设置已切换，但未能即时应用：",
  saveAfterApplyFailed: "设置已即时生效，但写入 data.json 失败：",
  // ===== 标题调整 =====
  titleAdjustGroupTitle: "标题调整",
  subfolderInherit: "子文件夹颜色跟随一级文件夹",
  subfolderInheritHelp: "解决「颜色随滚动乱跳」：每个一级文件夹固定一种颜色，它下面的所有子文件夹与纵向指引线都跟随这个颜色，滚到哪都一样。需要先打开上面的「多彩文件夹图标」开关。",
  titleFontSize: "标题字体大小调整",
  titleFontSizeHelp: "左右拖动即可调整文件列表里文件与文件夹名称的大小。只影响左侧文件列表，不会改动笔记正文字号（那是「外观 → 字体 → 字体大小」管的）。这是电脑端的值；手机端会自动改用下面「手机端标题字体大小」里设置的值。",
  titleFontSizeReset: "恢复默认大小",
  mobileTitleFontSize: "手机端标题字体大小",
  mobileTitleFontSizeHelp: "手机上文件列表的字号（Obsidian 会自动给手机打上 is-mobile 标记，插件据此识别，无需手动切换）。和电脑端的值存在同一份 data.json 里一起同步，设置一次所有设备通用，不用在手机上再单独调。",
  titleStateFontSize: "标题字体大小",
  titleWrapGroupTitle: "标题换行",
  titleWrap: "标题换行",
  titleWrapHelp: "文件名或文件夹名太长时，自动换成多行显示，不再用省略号截断。",
};
function translate(language, key) {
  // 缺键兜底（2026-10-22）：语言表里漏了某个键时退回英文，英文也没有才显示键名本身，
  // 界面上永远不该出现 "undefined"。
  const table = String(language).startsWith("zh") ? zh : en;
  const value = table[key];
  if (value !== void 0) return value;
  const fallback = en[key];
  return fallback !== void 0 ? fallback : key;
}

// src/settings.ts
var import_obsidian3 = require("obsidian");

// src/settings-data.ts
function readSettings(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const raw = data;
  const result = {};
  if (raw.language === "auto" || raw.language === "zh" || raw.language === "en")
    result.language = raw.language;
  if (raw.trigger === "row" || raw.trigger === "handle") result.trigger = raw.trigger;
  if (typeof raw.delay === "number" && Number.isFinite(raw.delay))
    result.delay = Math.max(180, Math.min(800, raw.delay));
  if (typeof raw.mouseDelay === "number" && Number.isFinite(raw.mouseDelay))
    result.mouseDelay = Math.max(180, Math.min(800, raw.mouseDelay));
  if (Array.isArray(raw.excluded)) {
    const paths = raw.excluded;
    if (paths.every((path) => typeof path === "string")) {
      try {
        result.excluded = [...new Set(paths.map(relativePath))];
      } catch {
      }
    }
  }
  if (raw.folderSettings && typeof raw.folderSettings === "object" && !Array.isArray(raw.folderSettings)) {
    const folderSettings = /* @__PURE__ */ Object.create(null);
    for (const [path, value] of Object.entries(raw.folderSettings)) {
      if (typeof path !== "string" || !value || typeof value !== "object" || Array.isArray(value)) continue;
      if (path !== "/") {
        try {
          if (relativePath(path) !== path) continue;
        } catch {
          continue;
        }
      }
      const entry = {};
      if (SORT_MODES.includes(value.sortOrder)) entry.sortOrder = value.sortOrder;
      // 空数组不保留，避免留下无意义的空壳配置
      if (Array.isArray(value.pinned) && value.pinned.length && value.pinned.every((name) => typeof name === "string"))
        entry.pinned = [...value.pinned];
      if (Array.isArray(value.hidden) && value.hidden.length && value.hidden.every((name) => typeof name === "string"))
        entry.hidden = [...value.hidden];
      if (Object.keys(entry).length) folderSettings[path] = entry;
    }
    result.folderSettings = folderSettings;
  }
  if (typeof raw.showHidden === "boolean") result.showHidden = raw.showHidden;
  if (typeof raw.showLoadNotice === "boolean") result.showLoadNotice = raw.showLoadNotice;
  // aio-explorer：拖拽排序总开关（false = 不接管，原生拖拽可插入链接）
  if (typeof raw.dragSortEnabled === "boolean") result.dragSortEnabled = raw.dragSortEnabled;
  // aio-explorer：拖入按规则排序的文件夹时，是否自动切成自定义排序（2026-10-22）
  if (typeof raw.autoCustomOnDrop === "boolean") result.autoCustomOnDrop = raw.autoCustomOnDrop;
  // ===== 专注模式 =====
  if (typeof raw.showFocusMenu === "boolean") result.showFocusMenu = raw.showFocusMenu;
  if (typeof raw.showFocusIcon === "boolean") result.showFocusIcon = raw.showFocusIcon;
  // ===== 设备开关：focusDevices / cleanDevices / countDevices
  //     三个模块各一份 { desktop: true, tablet: ..., phone: ... } =====
  for (const devicesKey of ["focusDevices", "cleanDevices", "countDevices", "pinDevices"]) {
    const source = raw[devicesKey];
    if (source && typeof source === "object") {
      const picked = {};
      for (const key of DEVICE_KEYS)
        if (typeof source[key] === "boolean") picked[key] = source[key];
      // 一个都没给就退回默认值（交给 loadSettings 的 spread 兜底）
      if (Object.keys(picked).length) result[devicesKey] = picked;
    }
  }
  if (FOCUS_LEVELS.includes(raw.focusLevel)) result.focusLevel = raw.focusLevel;
  if (typeof raw.customFolderPath === "string") result.customFolderPath = raw.customFolderPath;
  if (Array.isArray(raw.autoHidePaths) && raw.autoHidePaths.every((p) => typeof p === "string"))
    result.autoHidePaths = [...new Set(raw.autoHidePaths.map((p) => p.trim()).filter(Boolean))];
  // ===== 模块总开关（专注 / 清理 / 计数）=====
  // 关掉时整个模块不工作，而不只是隐藏界面。
  if (typeof raw.focusModuleEnabled === "boolean") result.focusModuleEnabled = raw.focusModuleEnabled;
  if (typeof raw.cleanModuleEnabled === "boolean") result.cleanModuleEnabled = raw.cleanModuleEnabled;
  if (typeof raw.countModuleEnabled === "boolean") result.countModuleEnabled = raw.countModuleEnabled;
  // ===== 文件清理 =====
  // 全部用 clean 前缀，避免与既有配置项冲突。
  if (typeof raw.cleanDeleteDestination === "string") result.cleanDeleteDestination = raw.cleanDeleteDestination;
  if (typeof raw.cleanTrashAge === "number") result.cleanTrashAge = raw.cleanTrashAge;
  if (typeof raw.cleanNotifications === "string") result.cleanNotifications = raw.cleanNotifications;
  if (typeof raw.cleanFolderMode === "boolean") result.cleanFolderMode = raw.cleanFolderMode;
  if (Array.isArray(raw.cleanFolders) && raw.cleanFolders.every((v) => typeof v === "string"))
    result.cleanFolders = [...new Set(raw.cleanFolders.map((v) => v.trim()).filter(Boolean))];
  if (typeof raw.cleanRemoveFolders === "boolean") result.cleanRemoveFolders = raw.cleanRemoveFolders;
  if (typeof raw.cleanAttachmentMode === "boolean") result.cleanAttachmentMode = raw.cleanAttachmentMode;
  if (Array.isArray(raw.cleanAttachmentExtensions) && raw.cleanAttachmentExtensions.every((v) => typeof v === "string"))
    result.cleanAttachmentExtensions = [...new Set(raw.cleanAttachmentExtensions.map((v) => v.trim().replace(/^\./, "").toLowerCase()).filter(Boolean))];
  if (typeof raw.cleanFileAgeThreshold === "number") result.cleanFileAgeThreshold = raw.cleanFileAgeThreshold;
  if (typeof raw.cleanDeleteEmptyMarkdown === "boolean") result.cleanDeleteEmptyMarkdown = raw.cleanDeleteEmptyMarkdown;
  if (typeof raw.cleanDeleteEmptyWithBacklinks === "boolean") result.cleanDeleteEmptyWithBacklinks = raw.cleanDeleteEmptyWithBacklinks;
  if (Array.isArray(raw.cleanIgnoredFrontmatter) && raw.cleanIgnoredFrontmatter.every((v) => typeof v === "string"))
    result.cleanIgnoredFrontmatter = [...new Set(raw.cleanIgnoredFrontmatter.map((v) => v.trim()).filter(Boolean))];
  if (typeof raw.cleanIgnoreAllFrontmatter === "boolean") result.cleanIgnoreAllFrontmatter = raw.cleanIgnoreAllFrontmatter;
  if (Array.isArray(raw.cleanCodeblockTypes) && raw.cleanCodeblockTypes.every((v) => typeof v === "string"))
    result.cleanCodeblockTypes = [...new Set(raw.cleanCodeblockTypes.map((v) => v.trim()).filter(Boolean))];
  if (typeof raw.cleanDeleteConfirmation === "boolean") result.cleanDeleteConfirmation = raw.cleanDeleteConfirmation;
  if (typeof raw.cleanRunOnStartup === "boolean") result.cleanRunOnStartup = raw.cleanRunOnStartup;
  if (typeof raw.cleanCloseNewTabs === "boolean") result.cleanCloseNewTabs = raw.cleanCloseNewTabs;
  if (typeof raw.cleanDeleteEmptyOnClose === "boolean") result.cleanDeleteEmptyOnClose = raw.cleanDeleteEmptyOnClose;
  if (typeof raw.cleanExcalidrawAsAttachment === "boolean") result.cleanExcalidrawAsAttachment = raw.cleanExcalidrawAsAttachment;
  if (typeof raw.cleanDebugLogging === "boolean") result.cleanDebugLogging = raw.cleanDebugLogging;
  // ===== 文件计数 =====
  if (typeof raw.showAllNumbers === "boolean") result.showAllNumbers = raw.showAllNumbers;
  if (typeof raw.addRootFolder === "boolean") result.addRootFolder = raw.addRootFolder;
  if (typeof raw.blacklist === "boolean") result.blacklist = raw.blacklist;
  if (Array.isArray(raw.filterList) && raw.filterList.every((v) => typeof v === "string"))
    result.filterList = [...new Set(raw.filterList.map((v) => v.trim().toLowerCase()).filter(Boolean))];
  // ===== 文件置顶 =====
  if (typeof raw.pinModuleEnabled === "boolean") result.pinModuleEnabled = raw.pinModuleEnabled;
  // pinData 是「笔记置顶」模块自己的数据树（pinnedFolders/zones/...），结构由该模块的 normalizeData 校验，这里原样放行
  if (raw.pinData && typeof raw.pinData === "object" && !Array.isArray(raw.pinData)) result.pinData = raw.pinData;
  // ===== 文件图标 =====
  if (typeof raw.iconModuleEnabled === "boolean") result.iconModuleEnabled = raw.iconModuleEnabled;
  if (typeof raw.iconColorfulFolder === "boolean") result.iconColorfulFolder = raw.iconColorfulFolder;
  // 「文件夹字体加粗」2026-10-22 从布尔开关改成 5 档滑块（400..800）。
  // 新字段 iconFolderBoldWeight：0 或 400 = 关闭；500/600/700/800 = 字重档位。
  // 旧数据只有布尔 iconFolderBold，这里做一次性迁移：
  //   true → 700（就是原来写死的 bold，保持原视觉）、false → 0。
  // 迁移后旧布尔不再写回，data.json 里会渐渐只剩新字段。
  if (typeof raw.iconFolderBoldWeight === "number") {
    const w = raw.iconFolderBoldWeight;
    if (w === 0 || (w >= FOLDER_BOLD_MIN && w <= FOLDER_BOLD_MAX)) {
      result.iconFolderBoldWeight = w <= FOLDER_BOLD_MIN ? 0 : w;
    }
  } else if (typeof raw.iconFolderBold === "boolean") {
    result.iconFolderBoldWeight = raw.iconFolderBold ? FOLDER_BOLD_LEGACY_ON : 0;
  }
  if (typeof raw.iconCustomIcons === "boolean") result.iconCustomIcons = raw.iconCustomIcons;
  if (typeof raw.titleWrapEnabled === "boolean") result.titleWrapEnabled = raw.titleWrapEnabled;
  if (typeof raw.subfolderInherit === "boolean") result.subfolderInherit = raw.subfolderInherit;
  if (typeof raw.titleFontSize === "number" && raw.titleFontSize >= 10 && raw.titleFontSize <= 30) {
    result.titleFontSize = Math.round(raw.titleFontSize);
  }
  // 手机端字号：和电脑端同一条滑块轨道，校验规则也一样；
  // 没存过或存坏了就落到 0，应用时自动回退到电脑端的值。
  if (typeof raw.mobileTitleFontSize === "number" && raw.mobileTitleFontSize >= 10 && raw.mobileTitleFontSize <= 30) {
    result.mobileTitleFontSize = Math.round(raw.mobileTitleFontSize);
  }
  return result;
}
/**
 * aio-explorer 修复（配置迁移）：
 * 旧实现右键「文件夹」时，把 hidden/pinned 写进该文件夹自己的名下，例如
 *   folderSettings["未命名"].hidden = ["未命名"]
 * 而读取过滤规则时是按「父目录」查的（父目录渲染它的孩子），于是这条记录
 * 永远匹配不上 → 「隐藏此项目」点了没反应。
 * 这里在读取配置时做一次纯路径迁移：把自吞记录搬到父目录，并从自身目录剔除。
 * 不需要访问 vault，纯路径运算。
 */
function migrateSelfEntries(folderSettings) {
  if (!folderSettings || typeof folderSettings !== "object") return folderSettings;
  let dirty = false;
  for (const key of Object.keys(folderSettings)) {
    if (key === "/") continue;
    const entry = folderSettings[key];
    if (!entry || typeof entry !== "object") continue;
    const selfName = baseName(key);
    if (!selfName) continue;
    const parent = parentPath(key);
    const moved = {};
    for (const field of ["hidden", "pinned"]) {
      const list = entry[field];
      if (Array.isArray(list) && list.includes(selfName)) (moved[field] ||= []).push(selfName);
    }
    if (!moved.hidden && !moved.pinned) continue;
    dirty = true;
    const parentEntry = { ...(folderSettings[parent] ?? {}) };
    for (const field of ["hidden", "pinned"]) {
      if (!moved[field]) continue;
      const set = new Set(Array.isArray(parentEntry[field]) ? parentEntry[field] : []);
      for (const name of moved[field]) set.add(name);
      parentEntry[field] = [...set];
    }
    folderSettings[parent] = parentEntry;
    for (const field of ["hidden", "pinned"]) {
      if (!moved[field] || !Array.isArray(entry[field])) continue;
      const rest = entry[field].filter((name) => name !== selfName);
      if (rest.length) entry[field] = rest;
      else delete entry[field];
    }
    if (!Object.keys(entry).length) delete folderSettings[key];
  }
  return dirty ? folderSettings : folderSettings;
}
function loadSettings(data, excluded2, skipMigrate = false) {
  const stored = readSettings(data);
  if (stored.folderSettings && !skipMigrate) migrateSelfEntries(stored.folderSettings);
  return {
    language: "zh",
    trigger: "row",
    delay: 500,
    mouseDelay: 200,
    excluded: excluded2,
    folderSettings: /* @__PURE__ */ Object.create(null),
    showHidden: false,
    // aio-explorer 修复：启动通知默认【关闭】。
    // 原来是 true（默认弹通知），每个新用户装好插件、重启 Obsidian 都会看到
    // 右上角那张"Aio Explorer 已加载"卡片，第一印象就是"这插件好吵闹"。
    // 现在默认不弹；想看的用户在「通用」里把「关闭启动通知」关掉即可。
    showLoadNotice: false,
    dragSortEnabled: true,
    // 拖入按规则排序的文件夹时，是否自动切成自定义排序（默认关，保持原样落位）
    autoCustomOnDrop: false,
    showFocusMenu: true,
    showFocusIcon: true,
    // 模块总开关：默认全开（保持升级前的行为）
    focusModuleEnabled: true,
    cleanModuleEnabled: true,
    countModuleEnabled: true,
    // 设备开关：三个模块各一份，默认全开
    focusDevices: { desktop: true, tablet: true, phone: true },
    cleanDevices: { desktop: true, tablet: true, phone: true },
    countDevices: { desktop: true, tablet: true, phone: true },
    focusLevel: "parent",
    customFolderPath: "",
    autoHidePaths: [],
    // ===== 文件清理 =====
    // 默认值逐项对齐 DEFAULT_SETTINGS
    cleanDeleteDestination: "obsidian-option",
    cleanTrashAge: -1,
    cleanNotifications: "showAll",
    cleanFolderMode: CLEAN_EXCLUDE,
    cleanFolders: [],
    cleanRemoveFolders: false,
    cleanAttachmentMode: CLEAN_INCLUDE,
    cleanAttachmentExtensions: [],
    cleanFileAgeThreshold: 0,
    cleanDeleteEmptyMarkdown: true,
    cleanDeleteEmptyWithBacklinks: false,
    cleanIgnoredFrontmatter: [],
    cleanIgnoreAllFrontmatter: false,
    cleanCodeblockTypes: [],
    cleanDeleteConfirmation: true,
    cleanRunOnStartup: false,
    cleanCloseNewTabs: false,
    cleanDeleteEmptyOnClose: false,
    cleanExcalidrawAsAttachment: false,
    cleanDebugLogging: false,
    // ===== 文件计数 =====
    showAllNumbers: true,
    filterList: ["md"],
    blacklist: false,
    addRootFolder: false,
    // ===== 文件置顶 =====
    pinModuleEnabled: true,
    pinDevices: { desktop: true, tablet: true, phone: true },
    pinData: null,
    // ===== 文件图标 =====
    // 默认全关：纯外观功能，升级后不改变现有观感，用户在设置里自行开启
    iconModuleEnabled: false,
    iconColorfulFolder: false,
    // 「文件夹字体加粗」2026-10-22 起是 5 档滑块（0=关闭，500..800=字重）。
    // 默认 0 保持原行为；老数据的布尔 iconFolderBold 由 readSettings 迁移。
    iconFolderBoldWeight: 0,
    iconCustomIcons: false,
    subfolderInherit: false,
    titleWrapEnabled: false,
    titleFontSize: 0,
    // 手机端默认 16px：0 或没设置时应用阶段会自动回退到电脑端的值
    mobileTitleFontSize: TITLE_FONT_SIZE_MOBILE_DEFAULT,
    ...stored
  };
}

// src/data.ts
var DATA_VERSION = 1;
function canResetData(error) {
  return error instanceof Error && ["invalidJson", "invalidLegacyOrder", "invalidPath"].includes(error.message);
}
function readOrderState(value) {
  if (Array.isArray(value) && Number.isInteger(value[0]) && value[0] > 1)
    throw new Error("newerDataVersion");
  if (!Array.isArray(value) || value.length !== 2 || value[0] !== 1 || !Array.isArray(value[1]))
    throw new Error("invalidJson");
  const order = /* @__PURE__ */ Object.create(null);
  for (const entry of value[1]) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || Object.hasOwn(order, entry[0]))
      throw new Error("invalidJson");
    order[entry[0]] = entry[1];
  }
  return parseOrder(JSON.stringify(order));
}
var DataStore = class {
  constructor(io, defaults) {
    this.io = io;
    this.defaults = defaults;
    this.settings = loadSettings(null, defaults);
  }
  // aio-explorer 追加：专注模式运行时状态（不落盘，重启即退出专注）。
  isFocus = false;
  focusedPath = null;
  io;
  defaults;
  order = /* @__PURE__ */ Object.create(null);
  settings;
  error = null;
  tail = Promise.resolve();
  get rules() {
    return this.settings.excluded;
  }
  serial(action) {
    const task = this.tail.then(async () => {
      try {
        const result = await action();
        this.error = null;
        return result;
      } catch (error) {
        this.error = error;
        throw error;
      }
    });
    this.tail = task.catch(() => {
    });
    return task;
  }
  async read() {
    const raw = await this.io.load();
    if (raw === null || raw === void 0)
      return { settings: loadSettings(null, this.defaults), order: /* @__PURE__ */ Object.create(null) };
    const { settings, order, legacy, versioned } = await this.decode(raw);
    if (!versioned) await this.replace(raw, this.encode(settings, order), legacy);
    // aio-explorer 修复：loadSettings 内部会把旧版「自吞」的hidden/pinned 记录
    // 从自身目录搬到父目录。若磁盘原文与迁移后不同，说明发生了迁移 → 写回磁盘，
    // 避免每次启动都重复迁移、也避免旧脏数据一直留着。
    else if (JSON.stringify(this.encode(settings, order)) !== JSON.stringify(this.encode(loadSettings(raw, this.defaults, true), order)))
      await this.replace(raw, this.encode(settings, order), null);
    return { settings, order: withoutExcluded(order, settings.excluded) };
  }
  async decode(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalidJson");
    const data = raw;
    const versioned = Object.hasOwn(data, "dataVersion");
    if (versioned && data.dataVersion !== DATA_VERSION) {
      if (typeof data.dataVersion === "number" && Number.isInteger(data.dataVersion) && data.dataVersion > DATA_VERSION)
        throw new Error("newerDataVersion");
      throw new Error("invalidJson");
    }
    const settings = loadSettings(data, this.defaults);
    let order;
    let legacy;
    if (!versioned && !Object.hasOwn(data, "orderState") && typeof data.jsonPath === "string") {
      const path = relativePath(data.jsonPath);
      if (!path.toLowerCase().endsWith(".json")) throw new Error("invalidPath");
      const text = await this.io.loadLegacy(path);
      if (text === null) throw new Error("missingLegacyOrder");
      try {
        order = parseOrder(text);
      } catch (error) {
        throw new Error("invalidLegacyOrder", { cause: error });
      }
      legacy = { path, text };
    } else {
      order = readOrderState(data.orderState);
    }
    return { settings, order, legacy, versioned };
  }
  async replace(raw, data, legacy) {
    try {
      await this.io.backup(raw, legacy);
    } catch (error) {
      throw new Error("migrationBackupFailed", { cause: error });
    }
    try {
      await this.io.save(data);
    } catch (error) {
      throw new Error("migrationSaveFailed", { cause: error });
    }
  }
  encode(settings, order) {
    return { dataVersion: DATA_VERSION, ...settings, orderState: [1, Object.entries(order)] };
  }
  load() {
    return this.serial(async () => {
      const next = await this.read();
      const changed = JSON.stringify(this.encode(next.settings, next.order)) !== JSON.stringify(this.encode(this.settings, this.order));
      Object.assign(this.settings, next.settings);
      this.order = next.order;
      return changed;
    });
  }
  update(change) {
    return this.serial(async () => {
      const current = await this.read();
      const before = JSON.stringify(this.encode(current.settings, current.order));
      const order = withoutExcluded(
        change(current.order, current.settings),
        current.settings.excluded
      );
      const data = this.encode(current.settings, order);
      readOrderState(data.orderState);
      if (JSON.stringify(data) !== before) await this.io.save(data);
      Object.assign(this.settings, current.settings);
      this.order = order;
    });
  }
  saveSettings(patch) {
    const changes = readSettings(patch);
    return this.update((order, settings) => {
      Object.assign(settings, changes);
      return order;
    });
  }
  resetInvalidData() {
    return this.serial(async () => {
      const text = await this.io.loadRaw();
      if (text === null) throw new Error("dataChanged");
      let raw;
      try {
        raw = JSON.parse(text.replace(/^\uFEFF/, ""));
      } catch {
      }
      if (raw !== void 0) {
        let invalid = false;
        try {
          await this.decode(raw);
        } catch (error) {
          if (!canResetData(error)) throw error;
          invalid = true;
        }
        if (!invalid) throw new Error("dataChanged");
      }
      let legacy;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const data = raw;
        if (!Object.hasOwn(data, "orderState") && !Object.hasOwn(data, "dataVersion") && typeof data.jsonPath === "string") {
          let path;
          try {
            path = relativePath(data.jsonPath);
          } catch {
          }
          if (path) {
            const oldText = await this.io.loadLegacy(path);
            if (oldText !== null) legacy = { path, text: oldText };
          }
        }
      }
      const settings = loadSettings({ ...this.settings, ...readSettings(raw) }, this.defaults);
      const order = /* @__PURE__ */ Object.create(null);
      await this.replace(text, this.encode(settings, order), legacy);
      Object.assign(this.settings, settings);
      this.order = order;
    });
  }
  settled() {
    return this.tail;
  }
};

// src/settings.ts
var ResetDataModal = class extends import_obsidian3.Modal {
  constructor(plugin, done) {
    super(plugin.app);
    this.plugin = plugin;
    this.done = done;
  }
  plugin;
  done;
  onOpen() {
    const p = this.plugin, t = p.t;
    this.contentEl.createEl("h3", { text: t("resetData"), cls: "qt-modal-heading" });
    this.contentEl.createEl("p", { text: t("resetDataHelp") });
    new import_obsidian3.Setting(this.contentEl).addButton((button) => button.setButtonText(t("keepData")).onClick(() => this.close())).addButton(
      (button) => button.setButtonText(t("confirmResetData")).onClick(async () => {
        button.setDisabled(true);
        try {
          p.cancelDrags();
          await p.store.resetInvalidData();
          p.refresh();
          this.close();
          new import_obsidian3.Notice(t("resetDataDone"));
        } catch (error) {
          p.report(error);
        } finally {
          button.setDisabled(false);
          this.done();
        }
      })
    );
  }
};
var FolderPicker = class extends import_obsidian3.FuzzySuggestModal {
  constructor(app, choose, placeholder) {
    super(app);
    this.choose = choose;
    this.setPlaceholder(placeholder);
  }
  choose;
  getItems() {
    const folders = [];
    const visit = (parent) => {
      for (const child of parent.children)
        if (child instanceof import_obsidian3.TFolder) {
          folders.push(child);
          visit(child);
        }
    };
    visit(this.app.vault.getRoot());
    return folders;
  }
  getItemText(folder) {
    return folder.path;
  }
  onChooseItem(folder) {
    this.choose(folder.path);
  }
};
var ExplorerSettingsTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    // aio-explorer：记住设置页当前打开的分组，刷新后停在原处
    this.activeGroup = null;
  }
  plugin;
  // aio-explorer：故意不实现 getSettingDefinitions()。
  //
  // Obsidian 新版设置框架的路由是：
  //     renderTab() { this.settingItems.length > 0 ? f4(this) : this.display() }
  // 而 settingItems 来自 getSettingDefinitions()。只要这个方法返回非空，
  // 框架就用自己的渲染器画，**根本不会调用 display()**。
  // 之前这里返回了 6 个分组，于是插件走了框架分支，
  // 我们自己写的标签栏（renderLegacy）一次都没执行过 —— 界面毫无变化。
  //
  // 删掉它 → settingItems 保持基类的空数组 → 走 display() → 标签栏生效。
  display() {
    this.renderLegacy();
  }
  /**
   * 兜底：如果框架又换路由、不再调 display()，我们要自己接管。
   * 上一轮就是因为框架走了 getSettingDefinitions 的声明式分支，
   * display() 一次都没被调用，标签栏完全没出现却毫无察觉。
   * 这里把 renderTab 也接管过来，并在 renderLegacy 之后自检 DOM，
   * 一旦标签栏没建出来就立刻抛错 —— 控制台会明确报出「标签栏未生成」，而不是让界面静默地保持旧样，
   * 而不是让界面静默地保持旧样。
   */
  renderTab() {
    this.renderLegacy();
    if (!this.containerEl.querySelector(".qt-tab-bar")) {
      throw new Error("[Aio Explorer] 设置页标签栏未生成：renderTab 路由被框架改写，需重新核对 PluginSettingTab 的调用约定");
    }
  }
  renderLegacy() {
    const root = this.containerEl;
    root.empty();
    root.addClass("qt-settings");
    const groups = this.groups();
    if (!groups.length) return;
    // aio-explorer：一级标题横向排成标签栏，点哪个只显示哪个分组。
    // 起因是设置项越来越多、整页拉得太长，滚动找设置很费劲。
    const active = this.activeGroup;
    const show = (key) => {
      this.activeGroup = key;
      panels.forEach((panel) => panel.toggleClass("qt-tab-panel-active", panel.__key === key));
      tabs.forEach((tab) => {
        const on = tab.__key === key;
        tab.toggleClass("qt-tab-active", on);
        tab.setAttribute("aria-selected", on ? "true" : "false");
      });
    };
    const tabBar = root.createDiv({ cls: "qt-tab-bar", attr: { role: "tablist" } });
    const body = root.createDiv({ cls: "qt-tab-body" });
    const tabs = [];
    const panels = [];
    for (const group of groups) {
      const key = String(group.heading);
      const tab = tabBar.createEl("button", {
        cls: "qt-tab",
        text: group.heading,
        attr: { type: "button", role: "tab", "aria-selected": "false" }
      });
      tab.__key = key;
      tab.addEventListener("click", () => show(key));
      tabs.push(tab);
      const panel = body.createDiv({ cls: "qt-tab-panel", attr: { role: "tabpanel" } });
      panel.__key = key;
      new import_obsidian3.Setting(panel).setName(group.heading).setHeading();
      for (const row of group.items) {
        const setting = new import_obsidian3.Setting(panel).setName(row.name);
        if (row.desc) setting.setDesc(row.desc);
        row.render(setting);
      }
      panels.push(panel);
    }
    // 记住上次看的分组；分组被删了就退回第一个
    const keys = panels.map((panel) => panel.__key);
    show(keys.includes(active) ? active : keys[0]);
  }
  refreshSettings() {
    if (!this.containerEl.isConnected) return;
    // 只走自己的渲染器（内部会记住当前分组，刷新后仍停在原处）。
    // 不能再走框架的 update()：它操作的是声明式 settingItems，
    // 而我们既然放弃了声明式路线，update() 就只会让界面和状态脱节。
    this.renderLegacy();
  }
  /**
   * 一个模块的「总开关」设置项（专注 / 文件清理 / 笔记计数）。
   * 三个模块的写法完全一致，抽出来避免重复。
   */
  renderModuleSwitch(p, t, nameKey, descKey, settingKey) {
    return {
      name: t(nameKey),
      desc: t(descKey),
      aliases: [nameKey, "开关", "总开关"],
      render: (setting) => {
        // 加醒目样式，让人一眼看出这一整页设置当前是否生效
        setting.settingEl.addClass("qt-module-switch");
        setting.addToggle((toggle) =>
          toggle.setValue(!!p.settings[settingKey]).onChange(async (value) => {
            toggle.setDisabled(true);
            try {
              await p.saveSettings({ [settingKey]: value });
              // 立刻生效，不等重启
              p.applyModuleSwitch();
              p.refresh();
            } finally {
              toggle.setDisabled(false);
            }
          })
        );
      }
    };
  }

  /**
   * 一个模块的「在哪些设备上启用」设置项（专注 / 文件清理 / 笔记计数）。
   * 三个模块的写法完全一致，抽出来避免重复 —— 之前只有专注模式有，
   * 现在三处都用它，以后加第四个模块也只是一行调用。
   */
  renderDeviceSwitch(p, t, nameKey, descKey, settingKey) {
    return {
      name: t(nameKey),
      desc: t(descKey),
      aliases: ["device", "platform", "desktop", "tablet", "phone", "设备", "电脑", "平板", "手机"],
      render: (setting) => {
        // 三个设备分别给一个下拉，语义是「这台设备上要不要这个模块」。
        // 默认全开；只关掉不需要的那种即可。
        const rows = [
          ["desktop", t("focusDeviceDesktop")],
          ["tablet", t("focusDeviceTablet")],
          ["phone", t("focusDevicePhone")]
        ];
        // 挂到 settingEl 上并让它横跨整行——
        // 放进 controlEl（右侧窄栏）会把「电脑」这类两字标签挤成竖排。
        setting.settingEl.addClass("qt-device-field");
        const holder = setting.settingEl.createDiv({ cls: "qt-device-rows" });
        for (const [key, label] of rows) {
          const current = p.settings[settingKey]?.[key];
          new (0, import_obsidian4.Setting)(holder)
            .setName(label)
            .addDropdown((dropdown) => {
              dropdown.addOption("on", t("focusDeviceOn"));
              dropdown.addOption("off", t("focusDeviceOff"));
              dropdown.setValue(current === false ? "off" : "on");
              dropdown.onChange(async (value) => {
                const next = { ...(p.settings[settingKey] ?? {}), [key]: value === "on" };
                await p.saveSettings({ [settingKey]: next });
                // ★ 当前设备的开关变了，必须重新跑一遍模块判定：
                //   关掉时要撤掉图标/ 抹掉数字，开回来时要加回去，
                //   否则用户就得重启 Obsidian 才看得出变化。
                p.applyModuleSwitch();
                p.syncNavIcons();
                p.refresh();
              });
            });
        }
        const here = currentDeviceKey();
        holder.createDiv({
          cls: "qt-device-hint",
          text: t("focusDeviceCurrent").replace(/\{device\}/, t("focusDevice" + here[0].toUpperCase() + here.slice(1)))
        });
      }
    };
  }

  /* ===== 文件清理：设置项的共用渲染方法 =====
     21 项设置如果每项都写一遍 try/finally + setDisabled，
     会有大量重复且容易漏。这里抽成几个小方法，行为完全一致：
     —— 改动期间禁用控件，失败也会恢复；
     —— 文本类输入做 debounce(600)，非法输入直接忽略（不写脏配置）。*/

  /** 一个「下拉选择」设置项。toPatch 把选中值转成配置 patch。 */
  renderCleanDropdown(p, t, nameKey, descKey, aliases, options, current, toPatch) {
    return {
      name: t(nameKey),
      desc: t(descKey),
      aliases,
      render: (setting) => {
        setting.addDropdown((dropdown) => {
          dropdown.addOptions(options).setValue(current).onChange(async (value) => {
            dropdown.setDisabled(true);
            try {
              await p.saveSettings(toPatch(value));
            } finally {
              dropdown.setDisabled(false);
            }
          });
        });
      }
    };
  }

  /** 一个「单行数字/文本」设置项。parse 返回 null 表示输入非法、忽略之。 */
  renderCleanText(p, t, nameKey, descKey, aliases, current, placeholder, parse) {
    return {
      name: t(nameKey),
      desc: t(descKey),
      aliases,
      render: (setting) => {
        setting.addText((text) => {
          text.setPlaceholder(placeholder).setValue(current)
            .onChange((0, import_obsidian4.debounce)(async (value) => {
              const patch = parse(value);
              if (!patch) return;
              await p.saveSettings(patch);
            }, 600, true));
        });
      }
    };
  }

  /** 一个「多行文本」设置项（按行或按逗号拆分由 parse 决定）。 */
  renderCleanTextArea(p, t, nameKey, descKey, aliases, current, placeholder, rows, parse) {
    return {
      name: t(nameKey),
      desc: t(descKey),
      aliases,
      render: (setting) => {
        setting.addTextArea((text) => {
          text.inputEl.rows = rows;
          text.inputEl.cols = 25;
          text.setPlaceholder(placeholder).setValue(current)
            .onChange((0, import_obsidian4.debounce)(async (value) => {
              await p.saveSettings(parse(value));
            }, 600, true));
        });
      }
    };
  }

  /** 一个「开关」设置项。 */
  renderCleanToggle(p, t, nameKey, descKey, aliases, current, toPatch) {
    return {
      name: t(nameKey),
      desc: t(descKey),
      aliases,
      render: (setting) => {
        setting.addToggle((toggle) => toggle.setValue(!!current).onChange(async (value) => {
          toggle.setDisabled(true);
          try {
            await p.saveSettings(toPatch(value));
          } finally {
            toggle.setDisabled(false);
          }
        }));
      }
    };
  }

  /** 二级分区标题（文件夹 / 文件 / Markdown / 其他 / 危险操作）。 */
  renderCleanSubhead(t, label) {
    return {
      name: label,
      render: (setting) => {
        setting.settingEl.addClass("qt-clean-subhead");
        setting.setDesc("");
        setting.controlEl?.empty?.();
      }
    };
  }

  /** 「恢复默认设置」按钮：只重置文件清理这一组，不影响其他功能。 */
  renderCleanReset(p, t) {
    return {
      name: t("cleanReset"),
      desc: t("cleanResetHelp"),
      aliases: ["reset", "重置", "恢复"],
      render: (setting) => {
        setting.addButton((button) => {
          button.setButtonText(t("cleanResetBtn")).setWarning().onClick(async () => {
            button.setDisabled(true);
            try {
              await p.saveSettings({
                cleanDeleteDestination: "obsidian-option",
                cleanTrashAge: -1,
                cleanNotifications: "showAll",
                cleanFolderMode: CLEAN_EXCLUDE,
                cleanFolders: [],
                cleanRemoveFolders: false,
                cleanAttachmentMode: CLEAN_INCLUDE,
                cleanAttachmentExtensions: [],
                cleanFileAgeThreshold: 0,
                cleanDeleteEmptyMarkdown: true,
                cleanDeleteEmptyWithBacklinks: false,
                cleanIgnoredFrontmatter: [],
                cleanIgnoreAllFrontmatter: false,
                cleanCodeblockTypes: [],
                cleanDeleteConfirmation: true,
                cleanRunOnStartup: false,
                cleanCloseNewTabs: false,
                cleanDeleteEmptyOnClose: false,
                cleanExcalidrawAsAttachment: false,
                cleanDebugLogging: false
              });
              p.cleanNotify(p.t("cleanNotifyReset"));
              p.refresh();
            } finally {
              button.setDisabled(false);
            }
          });
        });
      }
    };
  }

  groups() {
    const p = this.plugin, t = p.t;
    const key = import_obsidian3.Platform.isMobile ? "delay" : "mouseDelay";
    const groups = [
      {
        heading: t("general"),
        items: [
          {
            name: t("language"),
            desc: t("languageHelp"),
            aliases: ["language", "\u8BED\u8A00"],
            render: (setting) => {
              setting.settingEl.addClass("qt-language-field");
              setting.addDropdown(
                (dropdown) => dropdown.addOptions({ auto: t("auto"), zh: "\u4E2D\u6587", en: "English" }).setValue(p.settings.language).onChange(async (value) => {
                  await p.saveSettings({ language: value });
                  // 2026-10-22：不只重画设置页 —— 命令名 / 图标提示 / 置顶面板一起刷，
                  // 否则会停在「设置页英文、命令面板还是中文」的半截状态。
                  p.applyLanguageChange();
                  this.refreshSettings();
                })
              );
            }
          },
          {
            name: t("showLoadNotice"),
            desc: t("showLoadNoticeHelp"),
            aliases: ["notice", "\u901A\u77E5", "\u542F\u52A8\u63D0\u793A", "\u5173\u95ED\u901A\u77E5"],
            render: (setting) => {
              setting.addToggle(
                // aio-explorer: toggle means "mute startup notice".
                // ON => do NOT show notice => store showLoadNotice = false.
                // aio-explorer 修复：判定从 `=== false` 改成 `!== true`。
                // 数据里没有这个字段时（新用户、或极早期版本存档），旧写法会把
                // 开关显示成"会弹通知"，与新的默认行为（不弹）自相矛盾。
                (toggle) => toggle.setValue(p.settings.showLoadNotice !== true).onChange(async (value) => {
                  toggle.setDisabled(true);
                  try {
                    await p.saveSettings({ showLoadNotice: !value });
                  } finally {
                    toggle.setDisabled(false);
                  }
                })
              );
            }
          },
        ]
      },
      {
        heading: t("interaction"),
        items: [
          {
            name: t("trigger"),
            desc: t(import_obsidian3.Platform.isMobile ? "interactionHelpMobile" : "interactionHelp"),
            aliases: ["drag", "handle", "row", "\u62D6\u62FD", "\u624B\u67C4", "\u6574\u884C"],
            render: (setting) => {
              setting.addDropdown(
                (dropdown) => dropdown.addOptions({ row: t("row"), handle: t("handle") }).setValue(p.settings.trigger).onChange(async (value) => {
                  await p.saveSettings({ trigger: value });
                  p.refresh();
                })
              );
            }
          },
          {
            name: t("delay"),
            desc: t(import_obsidian3.Platform.isMobile ? "delayHelpMobile" : "delayHelp"),
            aliases: ["delay", "long press", "\u5EF6\u8FDF", "\u957F\u6309"],
            render: (setting) => {
              const valueEl = (0, import_obsidian3.requireApiVersion)("1.13.0") ? null : setting.controlEl.createSpan({
                cls: "qt-delay-value",
                text: `${p.settings[key]} ms`
              });
              setting.addSlider(
                (slider) => slider.setLimits(180, 800, 10).setValue(p.settings[key]).onChange(async (value) => {
                  p.cancelDrags();
                  valueEl?.setText(`${value} ms`);
                  await p.saveSettings({ [key]: value });
                })
              );
            }
          },
          {
            name: t("dragSortToggle"),
            desc: t("dragSortHelp"),
            aliases: ["drag", "sort", "reorder", "link", "\u62D6\u62FD", "\u6392\u5E8F"],
            render: (setting) => {
              setting.addToggle(
                (toggle) => toggle.setValue(p.settings.dragSortEnabled).onChange(async (value) => {
                  toggle.setDisabled(true);
                  try {
                    await p.setDragSortEnabled(value);
                  } finally {
                    this.refreshSettings();
                  }
                })
              );
            }
          },
          {
            // 2026-10-22：拖拽排序与「按时间/名称排序」的关系设置。
            // 关（默认）：拖进按规则排序的文件夹，文件按规则落位，你选的位置不生效；
            // 开：自动把那个文件夹切成 Custom order，位置说到做到。
            name: t("autoCustomOnDrop"),
            desc: t("autoCustomOnDropHelp"),
            aliases: ["custom", "sort", "drop", "\u81EA\u5B9A\u4E49", "\u6392\u5E8F"],
            render: (setting) => {
              setting.addToggle(
                (toggle) => toggle.setValue(p.settings.autoCustomOnDrop === true).onChange(async (value) => {
                  toggle.setDisabled(true);
                  try {
                    await p.saveSettings({ autoCustomOnDrop: value });
                  } finally {
                    toggle.setDisabled(false);
                  }
                })
              );
            }
          },
          {
            name: t("linkDragTip"),
            desc: t("linkDragTipHelp"),
            aliases: ["link", "tip", "\u94FE\u63A5", "\u63D0\u793A"],
            render: () => {
            }
          },
          // aio-explorer：原先「排序」标签里只有「排除的目录」一项，
          // 「每文件夹排序」标签更只有一句说明文字 —— 两者都不值得各占一个标签位，
          // 现在都并入「拖拽交互」，用小标题分区。
          {
            name: t("sortSectionTitle"),
            render: (setting) => {
              setting.settingEl.addClass("qt-clean-subhead");
              setting.controlEl?.empty?.();
            }
          },
          {
            name: t("sortGroupDesc"),
            render: () => {
            }
          },
          ...(import_obsidian3.Platform.isMobile ? [] : [
            {
              name: t("exclusions"),
              desc: t("exclusionsHelp"),
              aliases: ["assets", "exclude", "\u6392\u9664", "\u9644\u4EF6"],
              render: (setting) => this.renderExclusions(setting)
            }
          ])
        ]
      }
    ];
    // ===== aio-explorer：专注模式设置 =====
    groups.push({
      heading: t("focusGroupTitle"),
      items: [
        this.renderModuleSwitch(p, t, "focusModuleOn", "focusModuleOnHelp", "focusModuleEnabled"),
        // aio-explorer（2026-10-21）：设备开关上移到总开关正下方。
        // 「这台设备上要不要开」是决定「能不能用」的前置条件，
        // 放在总开关下面读起来才顺；原先它排在自定义路径之后，离总开关太远。
        this.renderDeviceSwitch(p, t, "focusDevices", "focusDevicesHelp", "focusDevices"),
        {
          name: t("focusShowMenu"),
          desc: t("focusShowMenuHelp"),
          aliases: ["focus", "menu", "\u4E13\u6CE8", "\u83DC\u5355"],
          render: (setting) => {
            setting.addToggle(
              (toggle) => toggle.setValue(p.settings.showFocusMenu).onChange(async (value) => {
                await p.saveSettings({ showFocusMenu: value });
                this.refreshSettings();
              })
            );
          }
        },
        {
          name: t("focusShowIcon"),
          desc: t("focusShowIconHelp"),
          aliases: ["icon", "button", "\u56FE\u6807", "\u6309\u94AE"],
          render: (setting) => {
            setting.addToggle(
              (toggle) => toggle.setValue(p.settings.showFocusIcon).onChange(async (value) => {
                await p.saveSettings({ showFocusIcon: value });
                p.syncFocusIcon();
                this.refreshSettings();
              })
            );
          }
        },
        {
          name: t("focusLevel"),
          desc: t("focusLevelHelp"),
          aliases: ["level", "focus", "\u5C42\u7EA7", "\u4E13\u6CE8"],
          render: (setting) => {
            setting.addDropdown(
              (dropdown) => dropdown.addOptions({
                file: t("focusLevelFile"),
                parent: t("focusLevelParent"),
                grandparent: t("focusLevelGrandparent"),
                greatgrandparent: t("focusLevelGreatGrandparent"),
                custom: t("focusLevelCustom")
              }).setValue(p.settings.focusLevel).onChange(async (value) => {
                await p.saveSettings({ focusLevel: value });
                p.refresh();
                this.refreshSettings();
              })
            );
          }
        },
        {
          name: t("focusCustomPath"),
          desc: t("focusCustomPathHelp"),
          aliases: ["custom", "path", "\u6307\u5B9A", "\u8DEF\u5F84"],
          visible: () => p.settings.focusLevel === "custom",
          render: (setting) => {
            setting.addText(
              (text) => text.setPlaceholder(t("focusCustomPathPlaceholder")).setValue(p.settings.customFolderPath).onChange(async (value) => {
                await p.saveSettings({ customFolderPath: value });
              })
            );
          }
        },
        {
          name: t("focusAutoHide"),
          desc: t("focusAutoHideHelp"),
          aliases: ["auto hide", "hidden", "\u9690\u85CF", "\u6C38\u4E45"],
          render: (setting) => this.renderAutoHide(setting)
        }
      ]
    });
    // ===== aio-explorer：文件清理 =====
    // 集中在一个标签页里，用二级标题分区（删除方式 / 文件夹 / 文件 /
    // Markdown / 其他 / 危险操作），避免再占多个一级标签位。
    groups.push({
      heading: t("cleanGroupTitle"),
      items: [].concat(
        this.renderModuleSwitch(p, t, "cleanModuleOn", "cleanModuleOnHelp", "cleanModuleEnabled"),
        this.renderDeviceSwitch(p, t, "cleanDevices", "cleanDevicesHelp", "cleanDevices"),
        // —— 删除方式 ——
        this.renderCleanDropdown(p, t, "cleanDeleteDestination", "cleanDeleteDestinationHelp",
          ["delete", "trash", "删除", "回收站"], {
            "obsidian-option": t("cleanDestGlobal"),
            system: t("cleanDestSystem"),
            obsidian: t("cleanDestObsidian"),
            permanent: t("cleanDestPermanent")
          }, p.settings.cleanDeleteDestination, (v) => ({ cleanDeleteDestination: v })),
        this.renderCleanText(p, t, "cleanTrashAge", "cleanTrashAgeHelp",
          ["trash", "age", "回收站", "天数"], String(p.settings.cleanTrashAge), "-1",
          (raw) => {
            const num = Number.parseInt(raw, 10);
            return Number.isFinite(num) && num >= -1 ? { cleanTrashAge: num } : null;
          }),
        this.renderCleanDropdown(p, t, "cleanNotifications", "cleanNotificationsHelp",
          ["notice", "通知", "提示"], {
            showAll: t("cleanNotifyAll"),
            showOnlyErrors: t("cleanNotifyErrors"),
            hideAll: t("cleanNotifyNone")
          }, p.settings.cleanNotifications, (v) => ({ cleanNotifications: v })),
        // —— 文件夹 ——
        this.renderCleanSubhead(t, t("cleanFoldersHeader")),
        this.renderCleanDropdown(p, t, "cleanFolderMode", "cleanFolderModeHelp",
          ["folder", "folder mode", "文件夹", "范围"], {
            [String(CLEAN_EXCLUDE)]: t("cleanFolderExclude"),
            [String(CLEAN_INCLUDE)]: t("cleanFolderInclude")
          }, String(!!p.settings.cleanFolderMode), (v) => ({ cleanFolderMode: v === "true" })),
        this.renderCleanTextArea(p, t, "cleanFolders", "cleanFoldersHelp",
          ["folder list", "excluded folders", "文件夹列表", "排除"],
          p.settings.cleanFolders.join("\n"), t("cleanFoldersPlaceholder"), 3,
          (raw) => ({ cleanFolders: raw.split("\n").map((v) => v.trim()).filter(Boolean) })),
        this.renderCleanToggle(p, t, "cleanRemoveFolders", "cleanRemoveFoldersHelp",
          ["remove folders", "empty folder", "空文件夹", "删文件夹"], p.settings.cleanRemoveFolders,
          (v) => ({ cleanRemoveFolders: v })),
        // —— 文件 ——
        this.renderCleanSubhead(t, t("cleanFilesHeader")),
        this.renderCleanDropdown(p, t, "cleanAttachmentMode", "cleanAttachmentModeHelp",
          ["attachment", "extension mode", "附件", "扩展名"], {
            [String(CLEAN_INCLUDE)]: t("cleanAttachmentInclude"),
            [String(CLEAN_EXCLUDE)]: t("cleanAttachmentExclude")
          }, String(!!p.settings.cleanAttachmentMode), (v) => ({ cleanAttachmentMode: v === "true" })),
        this.renderCleanTextArea(p, t, "cleanAttachmentExtensions", "cleanAttachmentExtensionsHelp",
          ["extension", "filter", "扩展名", "附件"],
          p.settings.cleanAttachmentExtensions.join(", "), t("cleanAttachmentPlaceholder"), 2,
          (raw) => ({
            cleanAttachmentExtensions: raw.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean)
          })),
        this.renderCleanText(p, t, "cleanFileAgeThreshold", "cleanFileAgeThresholdHelp",
          ["age", "threshold", "天数", "年龄"], String(p.settings.cleanFileAgeThreshold), "0",
          (raw) => {
            const num = Number.parseInt(raw, 10);
            return Number.isFinite(num) && num >= 0 ? { cleanFileAgeThreshold: num } : null;
          }),
        // —— Markdown ——
        this.renderCleanSubhead(t, t("cleanMdHeader")),
        this.renderCleanToggle(p, t, "cleanDeleteEmptyMarkdown", "cleanDeleteEmptyMarkdownHelp",
          ["empty", "markdown", "空文件", "清理"], p.settings.cleanDeleteEmptyMarkdown,
          (v) => ({ cleanDeleteEmptyMarkdown: v })),
        this.renderCleanToggle(p, t, "cleanDeleteEmptyWithBacklinks", "cleanDeleteEmptyWithBacklinksHelp",
          ["backlink", "反向链接", "链接"], p.settings.cleanDeleteEmptyWithBacklinks,
          (v) => ({ cleanDeleteEmptyWithBacklinks: v })),
        this.renderCleanTextArea(p, t, "cleanIgnoredFrontmatter", "cleanIgnoredFrontmatterHelp",
          ["frontmatter", "属性", "元数据"],
          p.settings.cleanIgnoredFrontmatter.join(", "), "created, updated", 2,
          (raw) => ({
            cleanIgnoredFrontmatter: raw.split(",").map((v) => v.trim()).filter(Boolean)
          })),
        this.renderCleanToggle(p, t, "cleanIgnoreAllFrontmatter", "cleanIgnoreAllFrontmatterHelp",
          ["all frontmatter", "全部属性"], p.settings.cleanIgnoreAllFrontmatter,
          (v) => ({ cleanIgnoreAllFrontmatter: v })),
        this.renderCleanTextArea(p, t, "cleanCodeblockTypes", "cleanCodeblockTypesHelp",
          ["codeblock", "代码块"],
          p.settings.cleanCodeblockTypes.join(", "), t("cleanCodeblockPlaceholder"), 2,
          (raw) => ({ cleanCodeblockTypes: raw.split(",").map((v) => v.trim()).filter(Boolean) })),
        // —— 其他 ——
        this.renderCleanSubhead(t, t("cleanOtherHeader")),
        this.renderCleanToggle(p, t, "cleanDeleteConfirmation", "cleanDeleteConfirmationHelp",
          ["confirm", "preview", "确认", "预览"], p.settings.cleanDeleteConfirmation,
          (v) => ({ cleanDeleteConfirmation: v })),
        this.renderCleanToggle(p, t, "cleanRunOnStartup", "cleanRunOnStartupHelp",
          ["startup", "启动", "开机"], p.settings.cleanRunOnStartup,
          (v) => ({ cleanRunOnStartup: v })),
        this.renderCleanToggle(p, t, "cleanCloseNewTabs", "cleanCloseNewTabsHelp",
          ["tabs", "标签页"], p.settings.cleanCloseNewTabs,
          (v) => ({ cleanCloseNewTabs: v })),
        this.renderCleanToggle(p, t, "cleanDeleteEmptyOnClose", "cleanDeleteEmptyOnCloseHelp",
          ["close", "关闭", "空文件"], p.settings.cleanDeleteEmptyOnClose,
          (v) => ({ cleanDeleteEmptyOnClose: v })),
        this.renderCleanToggle(p, t, "cleanExcalidraw", "cleanExcalidrawHelp",
          ["excalidraw", "白板"], p.settings.cleanExcalidrawAsAttachment,
          (v) => ({ cleanExcalidrawAsAttachment: v })),
        this.renderCleanToggle(p, t, "cleanDebug", "cleanDebugHelp",
          ["debug", "调试", "日志"], p.settings.cleanDebugLogging,
          (v) => ({ cleanDebugLogging: v })),
        // —— 危险操作 ——
        this.renderCleanSubhead(t, t("cleanDangerHeader")),
        this.renderCleanReset(p, t)
      )
    });
    //===== 文件计数 =====
    groups.push({
      heading: t("countGroupTitle"),
      items: [
        this.renderModuleSwitch(p, t, "countModuleOn", "countModuleOnHelp", "countModuleEnabled"),
        this.renderDeviceSwitch(p, t, "countDevices", "countDevicesHelp", "countDevices"),
        {
          name: t("countShowAll"),
          desc: t("countShowAllHelp"),
          aliases: ["count", "number", "\u8BA1\u6570", "\u6570\u5B57"],
          render: (setting) => {
            setting.addToggle(
              (toggle) => toggle.setValue(p.settings.showAllNumbers).onChange(async (value) => {
                toggle.setDisabled(true);
                try {
                  await p.saveSettings({ showAllNumbers: value });
                  p.applyShowAllNumbers();
                } finally {
                  toggle.setDisabled(false);
                }
              })
            );
          }
        },
        {
          name: t("countAddRoot"),
          desc: t("countAddRootHelp"),
          aliases: ["root", "vault", "\u6839\u6587\u4EF6\u5939", "\u5E93"],
          render: (setting) => {
            setting.addToggle(
              (toggle) => toggle.setValue(p.settings.addRootFolder).onChange(async (value) => {
                toggle.setDisabled(true);
                try {
                  await p.saveSettings({ addRootFolder: value });
                  p.reloadNoteCounts();
                } finally {
                  toggle.setDisabled(false);
                }
              })
            );
          }
        },
        {
          name: t("countOnlyMd"),
          desc: t("countOnlyMdHelp"),
          aliases: ["markdown", "filter", "md", "\u8FC7\u6EE4", "\u7B14\u8BB0"],
          // 「等于默认的 md 白名单」这一状态折叠成这一个开关，
          // 与 showOnlyNoteValue 行为一致。
          get value() {
            const d = { filterList: ["md"], blacklist: false };
            const st = p.settings;
            return st.blacklist === d.blacklist
              && st.filterList.length === d.filterList.length
              && d.filterList.every((x) => st.filterList.includes(x));
          },
          render: (setting) => {
            setting.addToggle(
              (toggle) => toggle.setValue(this.value).onChange(async (value) => {
                toggle.setDisabled(true);
                try {
                  await p.saveSettings(value ? { filterList: ["md"], blacklist: false } : {});
                  p.reloadNoteCounts();
                } finally {
                  toggle.setDisabled(false);
                }
              })
            );
          }
        },
        {
          name: t("countFilterList"),
          desc: t("countFilterListHelp"),
          aliases: ["filter", "extension", "list", "\u6269\u5C55\u540D", "\u5217\u8868"],
          render: (setting) => {
            setting.addTextArea((text) => {
              const commit = async (value) => {
                await p.saveSettings({
                  filterList: value.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean)
                });
                p.reloadNoteCounts();
              };
              text.inputEl.rows = 2;
              text.inputEl.cols = 25;
              text.setPlaceholder(t("countFilterPlaceholder"))
                .setValue(p.settings.filterList.join(", "))
                .onChange((0, import_obsidian4.debounce)(commit, 500, true));
            });
          }
        },
        {
          name: t("countBlacklist"),
          desc: t("countBlacklistHelp"),
          aliases: ["blacklist", "exclude", "\u9ED1\u540D\u5355", "\u6392\u9664"],
          render: (setting) => {
            setting.addToggle(
              (toggle) => toggle.setValue(p.settings.blacklist).onChange(async (value) => {
                toggle.setDisabled(true);
                try {
                  await p.saveSettings({ blacklist: value });
                  p.reloadNoteCounts();
                } finally {
                  toggle.setDisabled(false);
                }
              })
            );
          }
        }
      ]
    });
    //===== 文件置顶 =====
    groups.push({
      heading: t("pinGroupTitle"),
      items: [
        this.renderModuleSwitch(p, t, "pinModuleOn", "pinModuleOnHelp", "pinModuleEnabled"),
        this.renderDeviceSwitch(p, t, "pinDevices", "pinDevicesHelp", "pinDevices"),
        // aio-explorer（2026-10-21）：原先这里有一个「语言」下拉框，
        // 但「通用」标签页已经有整份插件的总语言设置（同一个 p.settings.language），
        // 这里再放一个只会让人困惑 —— 已按用户要求移除。
        // pinData.language 字段与 refreshLanguage() 保留在代码里，
        // 防止老数据/外部调用出意外；面板语言一律跟随「通用」的总设置。
        {
          name: t("pinAutoReveal"),
          desc: t("pinAutoRevealHelp"),
          aliases: ["reveal", "自动显示", "自动定位"],
          render: (setting) => {
            setting.addToggle((toggle) => toggle.setValue(!!p.settings.pinData?.autoReveal).onChange(async (value) => {
              const data = p.settings.pinData ?? {};
              data.autoReveal = value;
              await p.saveSettings({ pinData: data });
              p.pinModule?.views().forEach((view) => {
                view.updateToolbar();
                if (value) view.revealActive();
              });
            }));
          }
        }
      ]
    });
    /* ================================================================
       即时生效状态面板（2026-10-21 新增）
       作用：把「到底生不生效」摆在明面上。状态直接从 body 类读，
       真实反映窗口状态；万一对不上，点按钮重新应用一次即可，
       从此不必再靠重启 Obsidian 碰运气。
       ================================================================ */
    const liveStatusItem = (mode) => ({
      name: t("liveStateTitle"),
      desc: t("liveStateDesc"),
      aliases: ["状态", "生效", "state", "live", "刷新"],
      render: (setting) => {
        setting.settingEl.addClass("qt-live-status");
        // 状态面板要显示在设置行下面，所以挂在 settingEl 的父容器里；
        // 三级兜底：万一某个环境的 settingEl 没有父节点，也不至于整页设置崩掉。
        const host = setting.settingEl?.parentElement ?? setting.containerEl ?? setting.settingEl;
        const paint = () => {
          host.querySelectorAll(".qt-live-panel").forEach((n) => n.remove());
          const st = p.liveSwitchState();
          const wrap = host.createDiv({ cls: "qt-live-panel" });
          const list = wrap.createDiv({ cls: "qt-live-items" });
          const add = (label, ok) => {
            const item = list.createDiv({ cls: "qt-live-item" });
            item.createDiv({ cls: "qt-live-name", text: label });
            item.createDiv({ cls: ok ? "qt-live-ok" : "qt-live-no", text: ok ? "\u2713 " + t("liveStateOn") : "\u2717 " + t("liveStateOff") });
          };
          if (mode === "icon") {
            add(t("iconColorfulFolder"), st.colorful);
            add(t("iconCustomIcons"), st.customIcons);
            add(t("subfolderInherit"), st.subfolderInherit);
          } else {
            add(t("titleWrap"), st.titleWrap);
            // 文件夹字重：生效时顺带显示当前档位名 + 数值，一眼看清是"适中"还是"加粗"
            const boldWeightName = (w) => w === 500 ? t("folderBoldLight") : w === 600 ? t("folderBoldMedium") : w === 700 ? t("folderBoldStrong") : w === 800 ? t("folderBoldExtra") : t("folderBoldOff");
            list.createDiv({ cls: "qt-live-item" },
              (el) => {
                el.createDiv({ cls: "qt-live-name", text: t("iconFolderBold") });
                const label = st.bold
                  ? "\u2713 " + t("liveStateOn") + " \u00b7 " + boldWeightName(st.boldWeight) + " " + st.boldWeight
                  : "\u2717 " + t("liveStateOff");
                el.createDiv({ cls: st.bold ? "qt-live-ok" : "qt-live-no", text: label });
              });
            list.createDiv({ cls: "qt-live-item" },
              (el) => {
                el.createDiv({ cls: "qt-live-name", text: t("titleStateFontSize") });
                // 同时显示电脑端与手机端的值：本机实际生效的写在前面
                // 两段文案都在 en/zh 表里（含 {size}/{mobile}/{desktop} 占位符），
                // 不能再把中文写死在代码里 —— 否则英文界面里会漏出中文。
                const mobileText = st.mobileFontSize ? st.mobileFontSize + "px" : t("liveStateOff");
                const desktopText = st.fontSize ? st.fontSize + "px" : t("liveStateOff");
                const text = st.isMobile
                  ? t("liveStateSizeMobile").replace("{size}", mobileText).replace("{desktop}", desktopText)
                  : t("liveStateSizeDesktop").replace("{size}", desktopText).replace("{mobile}", mobileText);
                el.createDiv({ cls: "qt-live-size", text: st.fontSize || st.mobileFontSize ? text : t("liveStateOff") });
              });
          }
          add(t("liveStateStyles"), st.styleInMemory);
          wrap.createDiv({ cls: "qt-live-hint", text: t("liveStateWindows") + ": " + st.windows });
          wrap.createDiv({ cls: "qt-live-actions" }, (actions) => {
            actions.createEl("button", {
              cls: "mod-cta",
              text: t("liveApplyBtn"),
              onClick: async (event) => {
                event.preventDefault();
                const btn = event.currentTarget;
                btn.disabled = true;
                try {
                  // 只重跑「文件图标」与「标题换行」两个模块，
                  // 不去碰专注/清理/计数等其它模块，避免牵连出别的问题。
                  p.applyIconModuleSwitch();
                  p.applyTitleAdjustSwitch();
                  await p.refreshLiveStylesheet();
                  p.applyIconModuleSwitch();
                  p.applyTitleAdjustSwitch();
                  paint();
                  new import_obsidian3.Notice(t("liveApplyDone"), 2500);
                } catch (error) {
                  console.error("[Aio Explorer] 重新应用失败", error);
                  new import_obsidian3.Notice(String(error?.message ?? error), 8e3);
                } finally {
                  btn.disabled = false;
                }
              },
            });
          });
        };
        paint();
      },
    });
    // ===== aio-explorer：文件图标 =====
    // 新增标签页，排在最后。颜色循环逻辑放在 styles.css 的 .qt-colorful-folder 段，
    // 用插件自己的类，不依赖主题。
    groups.push({
      heading: t("iconGroupTitle"),
      items: [
        this.renderModuleSwitch(p, t, "iconModuleOn", "iconModuleOnHelp", "iconModuleEnabled"),
        {
          name: t("iconColorfulFolder"),
          desc: t("iconColorfulFolderHelp"),
          aliases: ["colorful", "folder", "icon", "多彩", "文件夹", "图标", "颜色"],
          render: (setting) => {
            setting.addToggle(
              (toggle) => toggle.setValue(!!p.settings.iconColorfulFolder).onChange(async (value) => {
                // ① 同步改内存 → ② 同步打类生效：零延迟，不等任何磁盘 IO
                p.settings.iconColorfulFolder = value;
                try {
                  p.applyIconModuleSwitch();
                } catch (error) {
                  console.error("[Aio Explorer] 开关即时应用失败", error);
                  new import_obsidian3.Notice(t("applyNowFailed") + error.message, 6e3);
                }
                // ③ 视觉已经变了，立刻解锁开关 —— 绝不让「保存慢/保存卡住」把开关卡成灰色
                toggle.setDisabled(false);
                // ④ 剩下的热读样式与落盘放后台，全程不阻塞界面
                void p.refreshLiveStylesheet();
                p.saveSettings({ iconColorfulFolder: value }).catch((error) => {
                  console.error("[Aio Explorer] 设置保存失败", error);
                  new import_obsidian3.Notice(t("saveAfterApplyFailed") + error.message, 8e3);
                });
              })
            );
          }
        },
        {
          name: t("iconCustomIcons"),
          desc: t("iconCustomIconsHelp"),
          aliases: ["custom", "icon", "folder", "file", "自定义", "图标", "文件夹", "文件"],
          render: (setting) => {
            setting.addToggle(
              (toggle) => toggle.setValue(!!p.settings.iconCustomIcons).onChange(async (value) => {
                // ① 同步改内存 → ② 同步打类生效：零延迟，不等任何磁盘 IO
                p.settings.iconCustomIcons = value;
                try {
                  p.applyIconModuleSwitch();
                } catch (error) {
                  console.error("[Aio Explorer] 开关即时应用失败", error);
                  new import_obsidian3.Notice(t("applyNowFailed") + error.message, 6e3);
                }
                // ③ 视觉已经变了，立刻解锁开关 —— 绝不让「保存慢/保存卡住」把开关卡成灰色
                toggle.setDisabled(false);
                // ④ 剩下的热读样式与落盘放后台，全程不阻塞界面
                void p.refreshLiveStylesheet();
                p.saveSettings({ iconCustomIcons: value }).catch((error) => {
                  console.error("[Aio Explorer] 设置保存失败", error);
                  new import_obsidian3.Notice(t("saveAfterApplyFailed") + error.message, 8e3);
                });
              })
            );
          }
        },
        {
          name: t("subfolderInherit"),
          desc: t("subfolderInheritHelp"),
          aliases: ["inherit", "subfolder", "folder", "color", "跟随", "子文件夹", "颜色"],
          render: (setting) => {
            setting.addToggle(
              (toggle) => toggle.setValue(!!p.settings.subfolderInherit).onChange(async (value) => {
                // ① 同步改内存 → ② 同步打类生效：零延迟，不等任何磁盘 IO
                p.settings.subfolderInherit = value;
                try {
                  p.applyIconModuleSwitch();
                } catch (error) {
                  console.error("[Aio Explorer] 开关即时应用失败", error);
                  new import_obsidian3.Notice(t("applyNowFailed") + error.message, 6e3);
                }
                // ③ 视觉已经变了，立刻解锁开关
                toggle.setDisabled(false);
                // ④ 剩下的热读样式与落盘放后台，全程不阻塞界面
                void p.refreshLiveStylesheet();
                p.saveSettings({ subfolderInherit: value }).catch((error) => {
                  console.error("[Aio Explorer] 设置保存失败", error);
                  new import_obsidian3.Notice(t("saveAfterApplyFailed") + error.message, 8e3);
                });
              })
            );
          }
        },
        liveStatusItem("icon")
      ]
    });
    // ===== aio-explorer：标题调整（长名换行 + 文件夹名加粗 + 标题字号）=====
    // 独立标签页，排在「文件图标」之后。三项都是「文字」相关，因此统一放在这里，
    // 且都不受「启用文件图标」总开关牵连（那是图标模块的事）。
    groups.push({
      heading: t("titleAdjustGroupTitle"),
      items: [
        {
          name: t("titleWrap"),
          desc: t("titleWrapHelp"),
          aliases: ["wrap", "换行", "标题", "文件名", "修剪", "截断", "省略号"],
          render: (setting) => {
            setting.addToggle(
              (toggle) => toggle.setValue(!!p.settings.titleWrapEnabled).onChange(async (value) => {
                // ① 同步改内存 → ② 同步打类生效：零延迟，不等任何磁盘 IO
                p.settings.titleWrapEnabled = value;
                try {
                  p.applyTitleAdjustSwitch();
                } catch (error) {
                  console.error("[Aio Explorer] 标题换行即时应用失败", error);
                  new import_obsidian3.Notice(t("applyNowFailed") + error.message, 6e3);
                }
                // ③ 视觉已经变了，立刻解锁开关 —— 绝不让「保存慢/保存卡住」把开关卡成灰色
                toggle.setDisabled(false);
                // ④ 剩下的热读样式与落盘放后台，全程不阻塞界面
                void p.refreshLiveStylesheet();
                p.saveSettings({ titleWrapEnabled: value }).catch((error) => {
                  console.error("[Aio Explorer] 设置保存失败", error);
                  new import_obsidian3.Notice(t("saveAfterApplyFailed") + error.message, 8e3);
                });
              })
            );
          }
        },
        {
          name: t("iconFolderBold"),
          desc: t("iconFolderBoldHelp"),
          aliases: ["bold", "folder", "font", "weight", "加粗", "字体", "粗细", "文件夹"],
          render: (setting) => {
            let sliderRef = null;
            // 滑块轨道是 400..800；存进设置的是 0（关闭）或 500..800。
            // 两个方向各一个映射函数，避免 0 和 400 在 UI/数据间来回错位。
            const storedToSlider = () => {
              const v = Number(p.settings.iconFolderBoldWeight) || 0;
              return v >= 500 && v <= FOLDER_BOLD_MAX ? v : FOLDER_BOLD_MIN;
            };
            const sliderToStored = (v) => (v <= FOLDER_BOLD_MIN ? 0 : v);
            const applyBold = (value) => {
              const weight = sliderToStored(value);
              // 同步改内存 → 同步打类+改变量生效（独立于「启用文件图标」总开关）
              p.settings.iconFolderBoldWeight = weight;
              try {
                p.applyTitleAdjustSwitch();
              } catch (error) {
                console.error("[Aio Explorer] 文件夹加粗即时应用失败", error);
                new import_obsidian3.Notice(t("applyNowFailed") + error.message, 6e3);
              }
              void p.refreshLiveStylesheet();
              // 与字号滑块一致：拖动过程中不落盘，停手 300ms 后才存
              window.clearTimeout(p.folderBoldTimer);
              p.folderBoldTimer = window.setTimeout(() => {
                p.folderBoldTimer = 0;
                p.saveSettings({ iconFolderBoldWeight: weight }).catch((error) => {
                  console.error("[Aio Explorer] 设置保存失败", error);
                  new import_obsidian3.Notice(t("saveAfterApplyFailed") + error.message, 8e3);
                });
              }, 300);
            };
            setting.addSlider((slider) => {
              sliderRef = slider;
              slider.setLimits(FOLDER_BOLD_MIN, FOLDER_BOLD_MAX, FOLDER_BOLD_STEP)
                .setValue(storedToSlider())
                .setDynamicTooltip()
                .onChange(async (value) => {
                  applyBold(value);
                });
            });
            setting.addExtraButton((btn) => {
              btn.setIcon("rotate-ccw")
                .setTooltip(t("iconFolderBoldReset"))
                .onClick(async () => {
                  applyBold(FOLDER_BOLD_DEFAULT);
                  sliderRef?.setValue(FOLDER_BOLD_DEFAULT);
                });
            });
          }
        },
        {
          name: t("titleFontSize"),
          desc: t("titleFontSizeHelp"),
          aliases: ["字号", "字体", "大小", "滑块", "font", "size", "slider"],
          render: (setting) => {
            let sliderRef = null;
            const sizeInUse = () => {
              const v = Number(p.settings.titleFontSize) || 0;
              return v >= 10 && v <= 30 ? v : TITLE_FONT_SIZE_DEFAULT;
            };
            const applySize = (value) => {
              const size = Math.round(value);
              p.settings.titleFontSize = size;
              // 拖动过程中每一帧都即时生效，所见即所得
              try {
                p.applyTitleAdjustSwitch();
              } catch (error) {
                console.error("[Aio Explorer] 标题字号即时应用失败", error);
                new import_obsidian3.Notice(t("applyNowFailed") + error.message, 6e3);
              }
              void p.refreshLiveStylesheet();
              // 写盘做 300ms 节流：拖动时不要每秒几十次落盘，停下后再存
              window.clearTimeout(p.titleFontSizeTimer);
              p.titleFontSizeTimer = window.setTimeout(() => {
                p.titleFontSizeTimer = 0;
                p.saveSettings({ titleFontSize: size }).catch((error) => {
                  console.error("[Aio Explorer] 设置保存失败", error);
                  new import_obsidian3.Notice(t("saveAfterApplyFailed") + error.message, 8e3);
                });
              }, 300);
            };
            setting.addSlider((slider) => {
              sliderRef = slider;
              slider.setLimits(TITLE_FONT_SIZE_MIN, TITLE_FONT_SIZE_MAX)
                .setValue(sizeInUse())
                .setDynamicTooltip()
                .onChange(async (value) => {
                  applySize(value);
                });
            });
            setting.addExtraButton((btn) => {
              btn.setIcon("rotate-ccw")
                .setTooltip(t("titleFontSizeReset"))
                .onClick(async () => {
                  applySize(TITLE_FONT_SIZE_DEFAULT);
                  sliderRef?.setValue(TITLE_FONT_SIZE_DEFAULT);
                });
            });
          }
        },
        {
          name: t("mobileTitleFontSize"),
          desc: t("mobileTitleFontSizeHelp"),
          aliases: ["手机", "移动端", "手机字号", "mobile", "phone", "font"],
          render: (setting) => {
            let sliderRef = null;
            const sizeInUse = () => {
              const v = Number(p.settings.mobileTitleFontSize) || 0;
              return v >= 10 && v <= 30 ? v : TITLE_FONT_SIZE_MOBILE_DEFAULT;
            };
            const applyMobileSize = (value) => {
              const size = Math.round(value);
              p.settings.mobileTitleFontSize = size;
              // 手机端的值在电脑上看不到即时效果（电脑的 body 不带 is-mobile），
              // 但仍然重跑一次应用逻辑，保证逻辑状态一致
              try {
                p.applyTitleAdjustSwitch();
              } catch (error) {
                console.error("[Aio Explorer] 手机端标题字号即时应用失败", error);
              }
              void p.refreshLiveStylesheet();
              // 与电脑端滑块一样做 300ms 节流落盘
              window.clearTimeout(p.mobileTitleFontSizeTimer);
              p.mobileTitleFontSizeTimer = window.setTimeout(() => {
                p.mobileTitleFontSizeTimer = 0;
                p.saveSettings({ mobileTitleFontSize: size }).catch((error) => {
                  console.error("[Aio Explorer] 设置保存失败", error);
                  new import_obsidian3.Notice(t("saveAfterApplyFailed") + error.message, 8e3);
                });
              }, 300);
            };
            setting.addSlider((slider) => {
              sliderRef = slider;
              slider.setLimits(TITLE_FONT_SIZE_MIN, TITLE_FONT_SIZE_MAX)
                .setValue(sizeInUse())
                .setDynamicTooltip()
                .onChange(async (value) => {
                  applyMobileSize(value);
                });
            });
            setting.addExtraButton((btn) => {
              btn.setIcon("rotate-ccw")
                .setTooltip(t("titleFontSizeReset"))
                .onClick(async () => {
                  applyMobileSize(TITLE_FONT_SIZE_MOBILE_DEFAULT);
                  sliderRef?.setValue(TITLE_FONT_SIZE_MOBILE_DEFAULT);
                });
            });
          }
        },
        liveStatusItem("title")
      ]
    });
    if (p.store.error)
      groups.unshift({
        heading: t("dataRecovery"),
        items: [
          {
            name: p.errorText(p.store.error),
            render: (setting) => {
              setting.addButton(
                (button) => button.setButtonText(t("reload")).onClick(async () => {
                  button.setDisabled(true);
                  try {
                    await p.reload(true);
                  } finally {
                    this.refreshSettings();
                  }
                })
              );
              if (canResetData(p.store.error))
                setting.addButton(
                  (button) => button.setButtonText(t("resetData")).onClick(() => new ResetDataModal(p, () => this.refreshSettings()).open())
                );
            }
          }
        ]
      });
    return groups;
  }
  async exclusions(next) {
    const p = this.plugin;
    p.cancelDrags();
    try {
      await p.saveSettings({ excluded: next });
      p.refresh();
      this.refreshSettings();
    } catch (error) {
      p.report(error);
    }
  }
  renderExclusions(setting) {
    const p = this.plugin, t = p.t;
    setting.settingEl.addClass("qt-exclusions-field");
    const container = setting.controlEl;
    const list = container.createDiv({ cls: "qt-exclusion-list" });
    if (!p.settings.excluded.length)
      list.createEl("p", { cls: "qt-empty", text: t("noExclusions") });
    for (const path of p.settings.excluded) {
      const row = list.createDiv({ cls: "qt-exclusion-row" });
      (0, import_obsidian3.setIcon)(row.createSpan({ cls: "qt-folder-icon" }), "folder");
      row.createSpan({ text: path, cls: "qt-folder-path", attr: { title: path } });
      const remove = row.createEl("button", {
        cls: "clickable-icon",
        attr: { "aria-label": `${t("remove")}: ${path}` }
      });
      (0, import_obsidian3.setIcon)(remove, "x");
      remove.addEventListener("click", () => {
        remove.disabled = true;
        void this.exclusions(p.settings.excluded.filter((item) => item !== path)).finally(() => {
          remove.disabled = false;
        });
      });
    }
    const add = container.createDiv({ cls: "qt-add-directory" });
    const input = add.createEl("input", {
      type: "text",
      placeholder: t("directoryPlaceholder"),
      attr: { "aria-label": t("addDirectory") }
    });
    const browse = add.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": t("chooseDirectory") }
    });
    (0, import_obsidian3.setIcon)(browse, "folder-search");
    browse.addEventListener(
      "click",
      () => new FolderPicker(
        p.app,
        (path) => {
          input.value = path;
          input.focus();
        },
        t("chooseDirectory")
      ).open()
    );
    const submit = add.createEl("button", { text: t("add") });
    const commit = async () => {
      submit.disabled = true;
      try {
        const paths = parseExclusions(input.value);
        if (paths.length) await this.exclusions([.../* @__PURE__ */ new Set([...p.settings.excluded, ...paths])]);
      } catch (error) {
        p.report(error);
      } finally {
        submit.disabled = false;
      }
    };
    submit.addEventListener("click", () => void commit());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void commit();
      }
    });
    const attachment = container.createEl("button", {
      cls: "qt-text-button",
      text: t("attachment")
    });
    attachment.addEventListener("click", () => {
      const paths = p.attachmentRules();
      if (!paths.length) {
        new import_obsidian3.Notice(t("noAttachment"));
        return;
      }
      attachment.disabled = true;
      void this.exclusions([.../* @__PURE__ */ new Set([...p.settings.excluded, ...paths])]).finally(() => {
        attachment.disabled = false;
      });
    });
  }
  //===== aio-explorer：始终隐藏的文件夹 =====
  async autoHide(next) {
    const p = this.plugin;
    p.cancelDrags();
    try {
      await p.saveSettings({ autoHidePaths: next });
      p.refresh();
      this.refreshSettings();
    } catch (error) {
      p.report(error);
    }
  }
  renderAutoHide(setting) {
    const p = this.plugin, t = p.t;
    setting.settingEl.addClass("qt-exclusions-field");
    const container = setting.controlEl;
    const list = container.createDiv({ cls: "qt-exclusion-list" });
    const paths = p.settings.autoHidePaths ?? [];
    if (!paths.length) list.createEl("p", { cls: "qt-empty", text: t("focusAutoHideEmpty") });
    for (const path of paths) {
      const row = list.createDiv({ cls: "qt-exclusion-row" });
      (0, import_obsidian3.setIcon)(row.createSpan({ cls: "qt-folder-icon" }), "eye-off");
      row.createSpan({ text: path, cls: "qt-folder-path", attr: { title: path } });
      const remove = row.createEl("button", {
        cls: "clickable-icon",
        attr: { "aria-label": `${t("remove")}: ${path}` }
      });
      (0, import_obsidian3.setIcon)(remove, "x");
      remove.addEventListener("click", () => {
        remove.disabled = true;
        void this.autoHide(paths.filter((item) => item !== path)).finally(() => {
          remove.disabled = false;
        });
      });
    }
    const add = container.createDiv({ cls: "qt-add-directory" });
    const input = add.createEl("input", {
      type: "text",
      placeholder: t("focusAutoHidePlaceholder"),
      attr: { "aria-label": t("focusAutoHideTitle") }
    });
    const browse = add.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": t("chooseDirectory") }
    });
    (0, import_obsidian3.setIcon)(browse, "folder-search");
    browse.addEventListener(
      "click",
      () => new FolderPicker(
        p.app,
        (path) => {
          input.value = path;
          input.focus();
        },
        t("chooseDirectory")
      ).open()
    );
    const submit = add.createEl("button", { text: t("focusAutoHideAdd") });
    const commit = async () => {
      submit.disabled = true;
      try {
        const parsed = parseExclusions(input.value);
        if (parsed.length) await this.autoHide([.../* @__PURE__ */ new Set([...paths, ...parsed])]);
      } catch (error) {
        p.report(error);
      } finally {
        submit.disabled = false;
      }
    };
    submit.addEventListener("click", () => void commit());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void commit();
      }
    });
  }
};

// src/main.ts
var QuietTree000Plugin = class extends import_obsidian4.Plugin {
  store;
  settingsTab;
  views = /* @__PURE__ */ new Map();
  ownRenames = /* @__PURE__ */ new Map();
  // aio-explorer 追加：专注模式
  focusIcon = null;
  // aio-explorer 追加：拖拽排序总开关按钮
  dragSortIcon = null;
  // aio-explorer：窄侧栏密度自适应
  navDensityObserver = null;
  navDensityTarget = null;
  // aio-explorer：自绘的排序图标模板（registerNavIcons 时建一次）
  sortSvgFragment = null;
  // aio-explorer：笔记计数 —— 待刷新的目录队列 + 防抖句柄
  noteCountQueue = [];
  noteCountTimer = 0;
  // aio-explorer：兜底轮询句柄（视图没被挂上时重试）
  noteCountWatchTimer = 0;
  // aio-explorer：文件清理 —— 侧栏图标 / 启动定时器 / 上次打开的笔记 / 上次弹窗
  cleanRibbonIcon = null;
  cleanStartupTimer = 0;
  cleanLastOpened = [];
  cleanLastModal = null;
  __cleanReadCache = null;
  busy = false;
  refreshTimer = 0;
  changeTimer = 0;
  changes = [];
  flushing = null;
  alive = false;
  loadingLeaves = /* @__PURE__ */ new WeakSet();
  warnedViews = /* @__PURE__ */ new WeakSet();
  t = (key) => translate(this.settings.language === "auto" ? (0, import_obsidian4.getLanguage)() : this.settings.language, key);
  attachmentRules() {
    const vault = this.app.vault;
    return attachmentExclusion(vault.getConfig("attachmentFolderPath"));
  }
  // ===== aio-explorer 追加：每文件夹排序 / 置顶 / 隐藏 =====
  /**
   * 排序/保存顺序 针对「文件夹本身」（右键文件夹=排它的孩子；右键文件=排它所在目录）。
   */
  folderPathOf(file) {
    return file instanceof import_obsidian4.TFolder ? file.path : file.parent?.path ?? "/";
  }
  /**
   * 隐藏/置顶 是「父目录的过滤规则」，必须写进父目录名下。
   * aio-explorer 修复：原实现对文件夹也用 folderPathOf()，导致隐藏一个文件夹时
   * 把记录写进它自己的 folderSettings（自吞），读取时永远匹配不上 → 隐藏无效。
   */
  containerPathOf(file) {
    if (file instanceof import_obsidian4.TFolder) return file.parent?.path ?? "/";
    return file.parent?.path ?? "/";
  }
  configOf(folderPath) {
    return this.settings.folderSettings?.[folderPath] ?? {};
  }
  sortModeOf(folderPath) {
    return this.configOf(folderPath).sortOrder ?? "custom";
  }
  /** 排序模式的中/英文显示名（提示语里要用，例如"该文件夹当前按创建时间排序"）。 */
  sortModeName(mode) {
    const key = {
      custom: "sortCustom",
      "name-asc": "sortNameAsc",
      "name-desc": "sortNameDesc",
      "created-new": "sortCreatedNew",
      "created-old": "sortCreatedOld",
      "modified-new": "sortModifiedNew",
      "modified-old": "sortModifiedOld",
      native: "sortNative"
    }[mode];
    return key ? this.t(key) : String(mode);
  }
  explorerView() {
    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      const view = leaf.view;
      if (view && typeof view.getSortedFolderItems === "function" && view.fileItems) return view;
    }
    return null;
  }
  async patchFolder(folderPath, patch) {
    const next = { ...(this.settings.folderSettings ?? {}) };
    next[folderPath] = { ...this.configOf(folderPath), ...patch };
    await this.saveSettings({ folderSettings: next });
  }
  // ===== aio-explorer 追加：专注模式 =====
  /** 当前是否处于专注模式 */
  get isFocus() {
    return this.store.isFocus;
  }
  /** 进入专注模式。path 为空时按配置的层级从当前笔记推导。 */
  enterFocus(path) {
    const target = path || this.currentFocusTarget();
    if (!target) return false;
    this.store.isFocus = true;
    this.store.focusedPath = target;
    this.updateFocusIcon();
    this.updateFocusClasses();
    this.refresh();
    new import_obsidian4.Notice(this.t("focusEntered"), 1500);
    return true;
  }
  /** 退出专注模式 */
  exitFocus() {
    if (!this.store.isFocus && !this.store.focusedPath) return;
    this.store.isFocus = false;
    this.store.focusedPath = null;
    this.updateFocusIcon();
    this.updateFocusClasses();
    this.refresh();
    new import_obsidian4.Notice(this.t("focusExited"), 1500);
  }
  /** 切换：已在专注则退出，否则按path 或当前笔记进入 */
  toggleFocus(path) {
    if (this.store.isFocus) this.exitFocus();
    else this.enterFocus(path);
  }
  /** 依据 focusLevel + 当前打开的笔记算出专注目标 */
  currentFocusTarget() {
    const s = this.settings;
    if (s.focusLevel === "custom") return s.customFolderPath || "";
    const file = this.app.workspace.getActiveFile();
    const path = file?.path;
    return path ? focusPathFor(path, s.focusLevel, s.customFolderPath) : "";
  }
  /** 专注按钮点击：优先按层级，无当前笔记时按指定目录 */
  toggleFocusByCommand() {
    if (this.store.isFocus) {
      this.exitFocus();
      return;
    }
    this.enterFocus(this.currentFocusTarget());
  }
  /** 给所有文件浏览器打上专注模式 class（供 CSS 收窄侧栏宽度等样式使用） */
  updateFocusClasses() {
    for (const view of this.allExplorerViews()) {
      const el = view.containerEl;
      if (!el) continue;
      if (this.store.isFocus) el.addClass("qt-focus-mode");
      else el.removeClass("qt-focus-mode");
    }
  }
  allExplorerViews() {
    const views = [];
    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      if (leaf.isDeferred) continue;
      if (leaf.view) views.push(leaf.view);
    }
    return views;
  }
  /** 在文件列表右上角插入/更新「专注」按钮 */
  addFocusIcon() {
    this.removeFocusIcon();
    if (!this.focusEntryEnabled("icon")) return;
    const host = this.navButtonHost();
    if (!host) return;
    const icon = activeDocument.createElement("div");
    icon.className = "clickable-icon nav-action-button qt-focus-icon";
    icon.setAttribute("aria-label", this.t("focusCommand"));
    (0, import_obsidian4.setIcon)(icon, "scan-search");
    this.registerDomEvent(icon, "click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.toggleFocusByCommand();
    });
    this.appendNavButton(host, icon);
    this.focusIcon = icon;
  }
  /**
   * aio-explorer：在标题栏插入/更新「拖拽排序」开关按钮（排在最右侧最后一项）。
   * 关闭时按钮会移除 —— 因为此时功能完全交还给浏览器原生拖拽，
   * 留一个常驻按钮反而会让人以为还能排序。
   */
  addDragSortIcon() {
    this.removeDragSortIcon();
    // aio-explorer：按钮常驻，关闭排序时只是取消高亮，不从标题栏消失。
    // 这样用户永远知道「排序功能在这里」，随时能再点开，不必去设置里找。
    const host = this.navButtonHost();
    if (!host) return;
    const icon = activeDocument.createElement("div");
    icon.className = "clickable-icon nav-action-button qt-drag-sort-icon";
    this.mountSortIcon(icon);
    this.registerDomEvent(icon, "click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      void this.toggleDragSort();
    });
    this.appendNavButton(host, icon);
    this.dragSortIcon = icon;
    this.updateDragSortIcon();
  }
  removeDragSortIcon() {
    this.dragSortIcon?.remove();
    this.dragSortIcon = null;
  }
  /** 取得文件浏览器标题栏的按钮容器 */
  navButtonHost() {
    const leaf = this.app.workspace.getLeavesOfType("file-explorer").find((l) => !l.isDeferred);
    const container = leaf?.view?.containerEl;
    if (!container) return null;
    return this.focusButtonHost(container);
  }
  /**
   * aio-explorer：把按钮追加到标题栏**最右侧**（排在最后一个原生按钮之后）。
   * 若末尾还有非按钮元素（如折叠箭头），则插在最后一个按钮之后。
   */
  appendNavButton(host, icon) {
    const lastButton = Array.from(host.children)
      .reverse()
      .find((el) => el !== icon && el.classList?.contains("nav-action-button"));
    if (lastButton?.nextSibling) host.insertBefore(icon, lastButton.nextSibling);
    else host.appendChild(icon);
  }
  /** 找文件浏览器标题栏里适合插入按钮的容器 */
  focusButtonHost(container) {
    const direct = container.querySelector(".nav-buttons-container") || container.querySelector(".nav-header-button-container");
    if (direct) return direct;
    const actions = container.querySelectorAll(".nav-action-button");
    if (actions.length) {
      const parent = actions[0].parentElement;
      if (parent) return parent;
    }
    return container.querySelector(".view-header") || null;
  }
  updateFocusIcon() {
    const icon = this.focusIcon;
    if (!icon) return;
    if (!this.settings.showFocusIcon) {
      this.removeFocusIcon();
      return;
    }
    icon.setAttribute("aria-label", this.t("focusCommand"));
    if (this.store.isFocus) icon.addClass("is-active");
    else icon.removeClass("is-active");
  }
  removeFocusIcon() {
    this.focusIcon?.remove();
    this.focusIcon = null;
  }
  /** 重新插入专注按钮（设置变更或侧栏重建时调用） */
  /**
   * 某个模块是否在「当前这台设备」上启用（总开关 + 设备开关一起判）。
   * @parammoduleKey  例如 "cleanModuleEnabled"
   * @param devicesKey 例如 "cleanDevices"
   * 没显式配置的设备一律视为开启（向后兼容旧配置）。
   * ★ 每次都现场读 Platform（不缓存）——Obsidian 会在窗口尺寸变化时
   *   当场把平板改判成手机，这时开关会自动跟着切到对应那一份。
   */
  moduleOnHere(moduleKey, devicesKey) {
    if (!this.moduleOn(moduleKey)) return false;
    const devices = this.settings[devicesKey];
    if (!devices || typeof devices !== "object") return true;
    const on = devices[currentDeviceKey()];
    return on === undefined ? true : !!on;
  }

  /**
   * 专注模式是否在「当前这台设备」上启用。
   * 手机 / 平板 / 电脑分别可在设置里单独开关；
   * 当前设备被关掉时，右键菜单、按钮、命令面板都当作专注模式不存在。
   */
  isFocusEnabledHere() {
    return this.moduleOnHere("focusModuleEnabled", "focusDevices");
  }
  /** 文件清理是否在「当前这台设备」上启用。 */
  isCleanEnabledHere() {
    return this.moduleOnHere("cleanModuleEnabled", "cleanDevices");
  }
  /** 笔记计数是否在「当前这台设备」上启用。 */
  isCountEnabledHere() {
    return this.moduleOnHere("countModuleEnabled", "countDevices");
  }
  /** 专注模式的某个入口是否应该出现。 */
  focusEntryEnabled(which) {
    if (!this.isFocusEnabledHere()) return false;
    return which === "menu" ? !!this.settings.showFocusMenu
      : which === "icon" ? !!this.settings.showFocusIcon
      : true;
  }

  syncFocusIcon() {
    if (!this.alive) return;
    const want = this.focusEntryEnabled("icon");
    if (want && !this.focusIcon) this.addFocusIcon();
    else if (want && this.focusIcon && !this.focusIcon.isConnected) this.addFocusIcon();
    else if (!want && this.focusIcon) this.removeFocusIcon();
    else this.updateFocusIcon();
  }
  buildSortSubmenu(menu, folderPath) {
    const current = this.sortModeOf(folderPath);
    const modes = [
      ["custom", "sortCustom", "arrow-up-down"],
      ["name-asc", "sortNameAsc", "arrow-down-a-z"],
      ["name-desc", "sortNameDesc", "arrow-up-z-a"],
      ["created-new", "sortCreatedNew", "calendar-plus"],
      ["created-old", "sortCreatedOld", "calendar-minus"],
      ["modified-new", "sortModifiedNew", "clock"],
      ["modified-old", "sortModifiedOld", "clock"],
      ["native", "sortNative", "list-restart"]
    ];
    for (const [mode, key, icon] of modes)
      menu.addItem((item) => {
        item.setTitle(this.t(key)).setIcon(icon).setChecked(current === mode);
        item.onClick(() => void this.setSortMode(folderPath, mode));
      });
  }
  async setSortMode(folderPath, mode) {
    try {
      await this.patchFolder(folderPath, { sortOrder: mode });
      new import_obsidian4.Notice(this.t("sortApplied"), 1500);
    } catch (error) {
      this.report(error);
    }
  }
  async toggleName(folderPath, key, name, on) {
    try {
      const values = new Set(this.configOf(folderPath)[key] ?? []);
      if (on) values.add(name);
      else values.delete(name);
      await this.patchFolder(folderPath, { [key]: [...values] });
      if (key === "pinned") new import_obsidian4.Notice(this.t(on ? "pinDone" : "unpinDone"), 1500);
      else new import_obsidian4.Notice(this.t(on ? "hideDone" : "unhideDone"), 1500);
    } catch (error) {
      this.report(error);
    }
  }
  async toggleShowHidden() {
    try {
      const next = !this.settings.showHidden;
      await this.saveSettings({ showHidden: next });
      new import_obsidian4.Notice(this.t(next ? "showHiddenDone" : "hideHiddenDone"), 1500);
    } catch (error) {
      this.report(error);
    }
  }
  async saveAsCustom(folderPath) {
    try {
      const view = this.explorerView();
      const folder = this.app.vault.getAbstractFileByPath(folderPath === "/" ? "/" : folderPath);
      let names = [];
      if (view && folder instanceof import_obsidian4.TFolder) {
        const shown = view.getSortedFolderItems(folder).map((item) => item.file.name);
        const seen = new Set(shown);
        const rest = folder.children.map((child) => child.name).filter((name) => !seen.has(name));
        names = [...shown, ...rest];
      } else if (folder instanceof import_obsidian4.TFolder) {
        // aio-explorer 修复：拿不到视图时退化为真实children，避免把顺序写成空
        names = folder.children.map((child) => child.name);
      }
      await this.store.update((order, settings) => {
        order[folderPath] = names;
        const config = settings.folderSettings[folderPath] ?? (settings.folderSettings[folderPath] = {});
        config.sortOrder = "custom";
        return order;
      });
      this.refresh();
      new import_obsidian4.Notice(this.t("saveAsCustomDone"), 1500);
    } catch (error) {
      this.report(error);
    }
  }
  buildItemMenu(menu, file) {
    const folderPath = this.folderPathOf(file);
    const isFolder = file instanceof import_obsidian4.TFolder;
    const sortable = !excluded(folderPath, this.settings.excluded);
    if (sortable) {
      const label = isFolder ? this.t("sortMenu") : this.t("parentFolderSort");
      const sub = new import_obsidian4.Menu();
      this.buildSortSubmenu(sub, folderPath);
      let attached = false;
      menu.addItem((item) => {
        item.setTitle(label).setIcon("arrow-up-down");
        if (typeof item.setSubmenu !== "function") return;
        const ret = item.setSubmenu(sub);
        attached = true;
        if (ret && typeof ret.addItem === "function" && ret !== sub) this.buildSortSubmenu(ret, folderPath);
      });
      if (!attached) this.buildSortSubmenu(menu, folderPath);
      menu.addItem(
        (item) => item.setTitle(this.t("saveAsCustom")).setIcon("save").onClick(() => void this.saveAsCustom(folderPath))
      );
    }
    if (file.path && file.path !== "/" && sortable) {
      const container = this.containerPathOf(file);
      const config = this.configOf(container);
      const name = file.name;
      const pinned = (config.pinned ?? []).includes(name);
      const hidden = (config.hidden ?? []).includes(name);
      menu.addSeparator();
      menu.addItem(
        (item) => item.setTitle(pinned ? this.t("unpinItem") : this.t("pinItem")).setIcon("pin").onClick(() => void this.toggleName(container, "pinned", name, !pinned))
      );
      menu.addItem(
        (item) => item.setTitle(hidden ? this.t("unhideItem") : this.t("hideItem")).setIcon("eye-off").onClick(() => void this.toggleName(container, "hidden", name, !hidden))
      );
    }
    menu.addSeparator();
    menu.addItem(
      (item) => item.setTitle(this.settings.showHidden ? this.t("showHiddenOff") : this.t("showHiddenOn")).setIcon("eye").onClick(() => void this.toggleShowHidden())
    );
    //aio-explorer：专注模式入口
    if (this.focusEntryEnabled("menu") && file.path && file.path !== "/")
      menu.addItem(
        (item) => item.setTitle(this.store.isFocus ? this.t("focusExit") : this.t("focusEnter")).setIcon(this.store.isFocus ? "log-out" : "scan-search").onClick(() => this.toggleFocus(file.path))
      );
    if (sortable)
      menu.addItem(
        (item) => item.setTitle(this.t("reset")).setIcon("list-restart").onClick(() => void this.resetFolder(folderPath))
      );
  }
  // ===== aio-explorer 追加：接管原生文件浏览器「排序」下拉菜单 =====
  // 原生按钮的 aria-label 由 Obsidian 自己的 i18next 提供，这里用同一个实例取文案做匹配，
  // 因此中/英文界面都能命中。
  sortButtonLabel() {
    try {
      if (typeof i18next !== "undefined" && i18next && typeof i18next.t === "function") {
        const key = "plugins.file-explorer.action-change-sort";
        const text = i18next.t(key);
        if (typeof text === "string" && text && text !== key) return text;
      }
    } catch (error) {
      console.error("[Aio Explorer] 读取排序按钮文案失败", error);
    }
    return null;
  }
  sortButton(target) {
    if (!target) return null;
    let el = null;
    try {
      if (typeof target.closest === "function") el = target.closest(".nav-action-button");
    } catch (error) {
      el = null;
    }
    if (!el && target.classList && typeof target.classList.contains === "function" && target.classList.contains("nav-action-button"))
      el = target;
    if (!el) return null;
    const aria = (typeof el.getAttribute === "function" ? el.getAttribute("aria-label") : "") || "";
    const expected = this.sortButtonLabel();
    if (expected && aria === expected) return el;
    return /排序方式|排序顺序|sort order/i.test(aria) ? el : null;
  }
  buildExplorerSortMenu() {
    const menu = new import_obsidian4.Menu();
    const current = this.sortModeOf("/");
    const modes = [
      ["custom", "sortCustom"],
      ["name-asc", "sortNameAsc"],
      ["name-desc", "sortNameDesc"],
      ["created-new", "sortCreatedNew"],
      ["created-old", "sortCreatedOld"],
      ["modified-new", "sortModifiedNew"],
      ["modified-old", "sortModifiedOld"]
    ];
    for (const [mode, key] of modes)
      menu.addItem((item) => {
        item.setTitle(this.t(key)).setChecked(current === mode);
        item.onClick(() => void this.setSortMode("/", mode));
      });
    menu.addSeparator();
    menu.addItem(
      (item) => item.setTitle(this.t("saveAsCustom")).setIcon("save").onClick(() => void this.saveAsCustom("/"))
    );
    menu.addItem(
      (item) => item.setTitle(this.settings.showHidden ? this.t("showHiddenOff") : this.t("showHiddenOn")).setIcon("eye").setChecked(this.settings.showHidden).onClick(() => void this.toggleShowHidden())
    );
    return menu;
  }
  patchSortMenu() {
    const proto = import_obsidian4.Menu ? import_obsidian4.Menu.prototype : null;
    const original = proto ? proto.showAtMouseEvent : null;
    if (!proto || typeof original !== "function") {
      console.error("[Aio Explorer] 当前 Obsidian 不支持接管排序菜单");
      return;
    }
    const plugin = this;
    const patched = function (event) {
      try {
        const button = plugin.alive ? plugin.sortButton(event && event.target) : null;
        if (button) {
          const menu = plugin.buildExplorerSortMenu();
          if (typeof menu.setParentElement === "function") menu.setParentElement(button);
          return original.call(menu, event);
        }
      } catch (error) {
        console.error("[Aio Explorer] 接管原生排序菜单失败", error);
      }
      return original.call(this, event);
    };
    proto.showAtMouseEvent = patched;
    this.restoreSortMenu = () => {
      if (proto.showAtMouseEvent === patched) proto.showAtMouseEvent = original;
    };
  }
  async onload() {
    this.store = new DataStore(
      {
        load: async () => {
          const data = await this.loadData();
          if (data == null && await this.app.vault.adapter.exists(this.manifest.dir + "/data.json"))
            throw new Error("invalidJson");
          return data;
        },
        save: (data) => this.saveData(data),
        loadRaw: async () => {
          const adapter = this.app.vault.adapter;
          const path = this.manifest.dir + "/data.json";
          return await adapter.exists(path) ? adapter.read(path) : null;
        },
        loadLegacy: async (path) => {
          const adapter = this.app.vault.adapter;
          return await adapter.exists(path) ? adapter.read(path) : null;
        },
        backup: async (data, legacy) => {
          const adapter = this.app.vault.adapter;
          const root = this.manifest.dir + "/backups";
          if (!await adapter.exists(root)) await adapter.mkdir(root);
          const base = root + "/data-v1-" + Date.now();
          let path = base;
          for (let suffix = 1; await adapter.exists(path); suffix++) path = base + "-" + suffix;
          await adapter.mkdir(path);
          await adapter.write(
            path + "/data.json",
            typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n"
          );
          if (legacy) await adapter.write(path + "/sort-order.json", legacy.text);
        }
      },
      // aio-explorer 修复：默认排除目录改为【空数组】。
      // 原来这里传 this.attachmentRules()（当前库的 Obsidian 附件文件夹设置），
      // 于是新用户装好插件，「排除的目录」里就预填了一条他自己库的附件目录名
      // （例如附件文件夹设成 "000附件" 的库），观感就像"插件夹带了别人的设置"。
      // 附件目录现在完全由用户自己决定：设置页「加入当前附件目录」按钮
      // （renderExclusions 里调 attachmentRules()）随时能一键加进来。
      []
    );
    this.settings = this.store.settings;
    try {
      await this.store.load();
    } catch (error) {
      this.report(error, "readError");
    }
    this.alive = true;
    this.patchSortMenu();
    this.register(() => this.restoreSortMenu?.());
    // aio-explorer：文件图标 —— 启动时按已保存的开关打上 body 类，
    // 重启 Obsidian 后「多彩文件夹图标」保持上次的状态。
    this.applyIconModuleSwitch();
    // aio-explorer：标题换行 —— 启动时同样按已保存开关打类，与图标模块独立。
    // 即时生效改造：先把样式装进内存，再打类，避免 styles.css 没进内存时开关看起来无效。
    this.ensureLiveStylesheet();
    void this.refreshLiveStylesheet();
    this.applyTitleAdjustSwitch();
    //aio-explorer：注册「拖拽排序」开关图标（形状取自 immersive-folder 的排序图标：
    // 上下箭头 + 中间横线），并把按钮加入 onLayoutReady 的同步流程。
    this.registerNavIcons();
    console.debug("[Aio Explorer] loaded");
    // 启动通知：只有明确存了 true 才弹。
    // aio-explorer 修复：原来 undefined 也弹（配合默认值 true），导致默认
    // 不弹的改革对"数据里没这个字段的新用户"无效——他们照样看到通知。
    // 现在默认值已是 false，这里同步把 undefined 归到"不弹"一边。
    if (this.settings.showLoadNotice === true) new import_obsidian4.Notice(this.t("loadedNotice"), 4e3);
    this.settingsTab = new ExplorerSettingsTab(this.app, this);
    this.addSettingTab(this.settingsTab);
    // ===== aio-explorer：文件置顶 =====
    this.initPinModule();
    // ===== aio-explorer：文件清理 =====
    // 图标用 lucide 的 trash
    this.cleanRibbonIcon = this.addRibbonIcon("trash", this.t("cleanBtn"), () => void this.runVaultCleanup());
    // 2026-10-22：命令统一在 registerCommands() 里注册 ——
    // 命令名是注册那一刻算好存进命令表的，语言切换后必须删掉重建才会跟着变。
    this.registerCommands();
    // 命令是否可用随总开关变化：用 checkCallback 而不是直接删命令，
    // 这样开关切换后无需重启 Obsidian 就能生效。
    // 启动后延迟 1 秒跑一次（给 vault 一点加载时间）
    this.register(() => window.clearTimeout(this.cleanStartupTimer));
    this.scheduleCleanOnStartup();
    // 关闭笔记时，若它是空的就清掉
    this.cleanLastOpened = [];
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        if (!this.settings.cleanDeleteEmptyOnClose) return;
        if (!this.isCleanEnabledHere()) return;
        const open = this.app.workspace.getLeavesOfType("markdown").map((l) => l.view?.file);
        for (const f of this.cleanLastOpened) {
          if (!f || open.includes(f)) continue;
          const folder = f.parent;
          if (!folder) continue;
          if (this.settings.cleanFolderMode === CLEAN_EXCLUDE && isFolderExcluded(folder, this.settings)) continue;
          if (this.settings.cleanFolderMode === CLEAN_INCLUDE && !isFolderIncluded(folder, this.settings)) continue;
          const ctx = {
            settings: this.settings,
            backlinksOf: (x) => this.cleanBacklinkCount(x),
            cacheOf: (x) => this.cleanFileCache(x),
            contentOf: (x) => this.__cleanReadSync(x)
          };
          if (isEmptyMarkdown(f, ctx)) void this.cleanRemoveFile(f);
        }
        this.cleanLastOpened = open.filter(Boolean);
      })
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.syncViews();
        this.syncNavIcons();
        this.updateFocusClasses();
      })
    );
    this.app.workspace.onLayoutReady(() => {
      if (this.alive) {
        this.syncViews();
        this.syncNavIcons();
        this.updateFocusClasses();
        this.startNoteCounting();
      }
    });
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.cancelDrags();
        if (this.ownRenames.get(oldPath) === file.path) return;
        this.queueChange({ kind: "rename", from: oldPath, to: file.path });
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        this.cancelDrags();
        this.queueChange({ kind: "delete", path: file.path });
      })
    );
    this.registerEvent(this.app.vault.on("create", () => this.cancelDrags()));
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        try {
          this.buildItemMenu(menu, file);
        } catch (error) {
          console.error("[Aio Explorer] file menu", error);
        }
      })
    );
    this.registerInterval(window.setInterval(() => this.syncViews(), 2e3));
  }
  /**
   * aio-explorer：注册标题栏图标并加入布局同步流程。
   * 「拖拽排序」开关用immersive-folder 的排序图标形状（上下箭头 + 中间横线），
   * 但图标只作为**开关的视觉标识**，实际切换放在设置面板里（关闭后按钮即移除）。
   */
  registerNavIcons() {
    // aio-explorer：图标不交给 Obsidian 的图标注册表，直接自己建 DOM。
    //
    // 为什么这么做（都是 obsidian.asar 里的实证）：
    //   addIcon(id, frag)  → 只把片段存进 TM[id]，**不会**立即生成图标；
    //   getIcon(id)        → createElementNS("svg", {viewBox:"0 0 100 100"})
    //                         后把 frag 赋给 svg.innerHTML，并走 PM() 缓存；
    //   setIcon(parent,id) → 读 parent.firstChild，取不到就换成 getIcon 的结果。
    // 这条链上任何一环对不上（例如缓存里的 svg 尺寸依赖主题的 --icon-size、
    // 而自定义 svg 只设了 viewBox 没有 width/height），表现就是
    // 「按钮有一个 is-active 底色，但里面空空如也」。
    //
    // 所以这里只借 Obsidian 的 createElementNS / setAttribute，
    // 其余全部自己写死：显式 width/height/stroke，图标必然可见。
    try {
      const paths = ["M50 40 V14", "M37 27 L50 14 L63 27", "M24 50 H76", "M50 60 V86", "M37 73 L50 86 L63 73"];
      const svg = this.buildSortSvg(paths);
      this.sortSvgFragment = svg;
    } catch (error) {
      console.error("[Aio Explorer] 构建拖拽排序图标失败", error);
      this.sortSvgFragment = null;
    }
    this.syncNavIcons();
  }
  /**
   * 手工构建「上下箭头 + 中间横线」的排序图标。
   * 显式给出全部属性，不依赖主题变量，也不走 setIcon/getIcon。
   */
  buildSortSvg(paths) {
    const doc = this.app?.workspace?.containerEl?.ownerDocument ?? activeDocument;
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("class", "svg-icon qt-drag-sort-svg");
    for (const d of paths) {
      const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "8");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
    }
    return svg;
  }
  /** 把排序图标放进按钮；已有一个就复用，避免重复插入。 */
  mountSortIcon(button) {
    if (!button) return;
    if (button.querySelector(".qt-drag-sort-svg")) return;
    const svg = this.sortSvgFragment
      ? this.sortSvgFragment.cloneNode(true)
      : this.buildSortSvg(["M50 40 V14", "M37 27 L50 14 L63 27", "M24 50 H76", "M50 60 V86", "M37 73 L50 86 L63 73"]);
    button.appendChild(svg);
  }
  /** aio-explorer：布局变化时重建标题栏按钮（专注 + 拖拽排序开关）。 */
  syncNavIcons() {
    if (!this.alive) return;
    // 先移除旧的排序开关，再按当前状态决定是否重建，保证它始终在最右侧
    this.removeDragSortIcon();
    if (this.settings.showFocusIcon) this.addFocusIcon();
    this.addDragSortIcon();
    this.watchNavDensity();
  }
  /**
   * aio-explorer：侧栏变窄时收紧标题栏按钮，避免图标被压成半个方块
   * （半个方块 + is-active 底色看起来就是一个「空高亮方块」）。
   * 阈值与 styles.css 里的 .qt-nav-tight / .qt-nav-tightest 一致。
   */
  watchNavDensity() {
    const leaf = this.app.workspace.getLeavesOfType("file-explorer").find((l) => !l.isDeferred);
    const drawer = leaf?.view?.containerEl;
    if (!drawer || drawer === this.navDensityTarget) return;
    this.navDensityTarget?.disconnect?.();
    this.navDensityTarget = drawer;
    const apply = () => this.toggleNavDensity();
    const realm = drawer.ownerDocument?.defaultView ?? window;
    if (typeof realm.ResizeObserver === "function") {
      this.navDensityObserver = new realm.ResizeObserver(apply);
      this.navDensityObserver.observe(drawer);
    } else {
      // 没有 ResizeObserver 时退回到窗口尺寸变化，抽屉宽度多半跟着窗口走
      this.registerDomEvent(realm, "resize", apply);
    }
    apply();
  }
  /** 按侧栏宽度给抽屉挂上/摘掉密度 class。 */
  toggleNavDensity() {
    const drawer = this.navDensityTarget;
    if (!drawer) return;
    const width = drawer.getBoundingClientRect?.().width ?? drawer.offsetWidth ?? 0;
    drawer.classList.toggle("qt-nav-tight", width > 0 && width < 260);
    drawer.classList.toggle("qt-nav-tightest", width > 0 && width < 200);
  }
  onunload() {
    this.alive = false;
    this.restoreSortMenu?.();
    this.removeDragSortIcon();
    this.navDensityObserver?.disconnect?.();
    this.navDensityObserver = null;
    window.clearTimeout(this.noteCountTimer);
    window.clearInterval(this.noteCountWatchTimer);
    // aio-explorer：清理「等文件树出现」的轮询定时器（2026-10-21 新增）
    if (this.qtFileTreeWaiter) {
      window.clearTimeout(this.qtFileTreeWaiter);
      this.qtFileTreeWaiter = null;
    }
    // aio-explorer：卸载时把确认弹窗一并关掉，避免残留一个空窗口
    try {
      this.cleanLastModal?.close?.();
    } catch (error) {
      // 弹窗可能已经关了，忽略
    }
    this.cleanLastModal = null;
    this.cleanLastOpened = [];
    // aio-explorer：卸载时摘掉文件图标的 body 类，避免插件停用后颜色/图标/加粗残留
    activeDocument.body?.classList?.remove(COLORFUL_FOLDER_CLASS);
    activeDocument.body?.classList?.remove(FOLDER_BOLD_CLASS);
    activeDocument.body?.classList?.remove(CUSTOM_ICONS_CLASS);
    activeDocument.body?.classList?.remove(TITLE_WRAP_CLASS);
    activeDocument.body?.classList?.remove(SUBFOLDER_INHERIT_CLASS);
    // 字号是通过 body 的 inline style 设的，卸载时一并撤掉，别在窗口里留痕迹
    try {
      activeDocument.body?.style?.removeProperty("--nav-item-size");
    } catch (error) {
      console.error("[Aio Explorer] 清理标题字号失败", error);
    }
    // 文件夹字重档位同理：也是 body 的 inline style，一并撤掉
    try {
      activeDocument.body?.style?.removeProperty(FOLDER_BOLD_WEIGHT_VAR);
    } catch (error) {
      console.error("[Aio Explorer] 清理文件夹字重失败", error);
    }
    // 移除自己注入的样式标签，别在窗口里留垃圾
    for (const doc of this.qtDocuments().keys()) {
      if (typeof doc.getElementById === "function") doc.getElementById(QT_LIVE_STYLE_ID)?.remove();
    }
    activeDocument.body?.classList?.remove(NOTE_COUNT_SHOW_ALL_CLASS);
    for (const view of this.allExplorerViews())
      view?.navFileContainerEl?.classList?.remove(NOTE_COUNT_HIDE_EXPANDED_CLASS);
    // aio-explorer：卸载时必须把计数痕迹全部清掉。
    // 只摘 body 的全局类不够 —— data-count 属性和根文件夹行是直接挂在
    // 侧栏 DOM 上的，不清就会在插件停用后永久残留（数字一直显示）。
    for (const view of this.allExplorerViews()) this.clearNoteCounts(view);
    this.navDensityTarget?.classList?.remove("qt-nav-tight", "qt-nav-tightest");
    this.navDensityTarget = null;
    //aio-explorer：还原专注模式残留的 DOM 状态
    this.removeFocusIcon();
    for (const view of this.allExplorerViews()) view.containerEl?.removeClass("qt-focus-mode");
    if (this.store) {
      this.store.isFocus = false;
      this.store.focusedPath = null;
    }
    window.clearTimeout(this.refreshTimer);
    window.clearTimeout(this.changeTimer);
    void this.flushChanges().catch((error) => this.report(error));
    for (const binding of this.views.values()) {
      binding.drag?.destroy();
      binding.restore();
    }
    this.views.clear();
  }
  report(error, fallback = "error") {
    console.error("[Aio Explorer]", error);
    new import_obsidian4.Notice(this.errorText(error, fallback), 7e3);
    this.settingsTab?.refreshSettings();
  }
  errorText(error, fallback = "readError") {
    const key = error instanceof Error ? error.message : "";
    const known = [
      "invalidPath",
      "invalidJson",
      "newerDataVersion",
      "missingLegacyOrder",
      "invalidLegacyOrder",
      "migrationBackupFailed",
      "migrationSaveFailed",
      "dataChanged",
      "collision",
      "locked",
      "changed",
      "rollbackFailed"
    ];
    return this.t(known.includes(key) ? key : fallback);
  }
  async saveSettings(patch) {
    await this.flushChanges();
    await this.store.saveSettings(patch);
    this.refresh();
  }
  /* ================================================================
     语言切换（2026-10-22 新增）
     问题：Obsidian 的「命令名 / 侧栏图标提示」是注册那一刻就固定下来的字符串，
     切换语言后不会自动更新，于是英文界面里命令面板仍是中文。
     这里把它们集中起来，语言一变就整批重建/改写。
     ================================================================ */
  /** 本插件所有命令的清单（id + 取名字的函数 + 行为）。名字用函数是为了每次重建都读最新语言。 */
  commandSpecs() {
    return [
      { id: "clean-files", name: () => this.t("cleanBtn"), run: () => void this.runVaultCleanup() },
      { id: "reload-order", name: () => this.t("reload"), run: () => void this.reload(true) },
      { id: "reset-root-order", name: () => `${this.t("reset")} \u2014 ${this.t("root")}`, run: () => void this.resetFolder("/") },
      { id: "toggle-show-hidden", name: () => `${this.t("showHiddenOn")} / ${this.t("showHiddenOff")}`, run: () => void this.toggleShowHidden() },
      { id: "save-root-as-custom", name: () => `${this.t("saveAsCustom")} \u2014 ${this.t("root")}`, run: () => void this.saveAsCustom("/") },
      {
        id: "toggle-focus",
        name: () => this.t("focusCommand"),
        run: () => {
          if (!this.isFocusEnabledHere()) {
            new import_obsidian4.Notice(this.t("focusDisabledHere"), 3e3);
            return;
          }
          this.toggleFocusByCommand();
        }
      }
    ];
  }
  /** 注册全部命令；重复调用会先删后建，所以不会在命令面板里出现两份。 */
  registerCommands() {
    for (const spec of this.commandSpecs()) {
      try {
        if (typeof this.removeCommand === "function") this.removeCommand(spec.id);
      } catch (error) {
        console.debug("[Aio Explorer] 命令重建失败（可忽略，重启后生效）", error);
      }
      this.addCommand({ id: spec.id, name: spec.name(), callback: spec.run });
    }
  }
  /** 语言变了以后，把不在设置页里、需要手动重画的界面刷一遍。 */
  applyLanguageChange() {
    // ① 命令面板里的命令名
    this.registerCommands();
    // ② 侧栏图标的悬浮提示（Obsidian 用 aria-label / data-tooltip 两处）
    const retitle = (el, text) => {
      if (!el || typeof el.setAttribute !== "function") return;
      el.setAttribute("aria-label", text);
      el.setAttribute("data-tooltip-position", "right");
      el.setAttribute("data-tooltip", text);
    };
    retitle(this.cleanRibbonIcon, this.t("cleanBtn"));
    // 置顶图标的文案由「文件置顶」模块自己的语言表提供（键名 title），
    // 主表里没有这个键，所以优先问模块要。
    retitle(this.pinRibbonIcon, this.pinModule ? this.pinModule.t("title") : this.t("pinGroupTitle"));
    // ③ 专注模式 / 拖拽排序图标的自绘 aria-label、侧栏数字等都走 syncNavIcons
    try {
      this.syncNavIcons();
    } catch (error) {
      console.debug("[Aio Explorer] 图标提示刷新失败", error);
    }
    // ④ 文件置顶面板（命令名 + 卡片 + 工具栏一起重建）
    try {
      this.pinModule?.refreshLanguage();
    } catch (error) {
      console.debug("[Aio Explorer] 置顶面板语言刷新失败", error);
    }
    // ⑤ 文件列表（右键菜单是即时生成的，这里只需重画拖拽相关状态）
    try {
      this.refresh();
    } catch (error) {
      console.debug("[Aio Explorer] 刷新失败", error);
    }
  }
  /**
   * ★ 2026-10-21 新增：重建文件列表前先记住滚动位置，重建后原样放回去。
   *
   * 背景（从 obsidian.asar 1.14.4 核心代码实证，不靠推断）：
   *   本插件 refresh() → view.requestSort() → 核心 file-explorer 的 sort()，
   *   核心 sort() 的实现是：
   *       var l = s.scrollTop;                     ← 先存旧值
   *       r.infinityScroll.rootEl.vChildren.setChildren(p);   ← 换掉虚拟树的子节点
   *       r.applySearchFilter();
   *       s.scrollTop = l;                         ← 再写回
   *       r.infinityScroll.compute();
   *   但文件树是【虚拟滚动】：DOM 里只有当前可见的十几行，
   *   setChildren 的瞬间容器高度会塌陷（实测 scrollHeight 从 13000 掉到 12688），
   *   浏览器会在塌陷期间自动补偿 scrollTop；
   *   等核心写回 l 时，这个 l 已经不是用户看到的位置了。
   *   紧接着 compute() 重排，位置就漂到了别处 —— 表现就是「一切换开关，
   *   左侧文件列表莫名其妙跳到很下面/最底部」。
   *
   * 修法（不动核心，只在外面包一层）：
   *   refresh 之前把每个文件树的 scrollTop 存下来，refresh 之后再写回。
   *   因为核心在 compute() 之后还会再动一次位置，所以要等它跑完
   *   （双 rAF + 一小段延时）再写回，否则会被核心覆盖掉。
   */
  withFileTreeScrollPreserved(fn) {
    const snapshots = [];
    for (const doc of this.qtDocuments().keys()) {
      if (typeof doc.querySelectorAll !== "function") continue;
      const trees = doc.querySelectorAll('.workspace-leaf-content[data-type="file-explorer"] .nav-files-container');
      for (let i = 0; i < trees.length; i++) {
        const el = trees[i];
        const top = el.scrollTop;
        if (typeof top === "number" && Number.isFinite(top)) {
          snapshots.push({ el, top });
        }
      }
    }
    let result;
    try {
      result = fn();
    } finally {
      // 即便 fn 抛错也要把位置放回去，不能让用户为一次报错付出滚动位置的代价
      const restoreIn = () => {
        for (const { el, top } of snapshots) {
          try {
            if (el.isConnected && el.scrollTop !== top) el.scrollTop = top;
          } catch (error) {
            /* 元素已被核心替换掉，忽略即可 */
          }
        }
      };
      // 取窗口对象时不能直接写 `?? window`：文件树可能一个都没有
      // （比如刚启动、或全部视图都在弹窗里），那时空 window 兜底反而会抛错。
      // 所以先把每个快照各自的窗口收齐，实在没有才用同步兜底。
      const wins = [];
      for (const { el } of snapshots) {
        const w = el?.ownerDocument?.defaultView;
        if (w && !wins.includes(w)) wins.push(w);
      }
      if (!wins.length && typeof window !== "undefined") wins.push(window);
      for (const w of wins) {
        if (typeof w.requestAnimationFrame === "function") {
          w.requestAnimationFrame(() => {
            // 这里必须用箭头函数包一层：
            // 直接写 requestAnimationFrame(restoreIn(w)) 会【立刻】执行 restoreIn(w)，
            // 并把它的返回值（undefined）当成回调传给 rAF → 下一帧执行 undefined() 直接抛错。
            if (typeof w.requestAnimationFrame === "function") w.requestAnimationFrame(() => restoreIn());
            else restoreIn();
            // 核心的 compute() 是 50ms 延迟的，再补一刀
            if (typeof w.setTimeout === "function") w.setTimeout(() => restoreIn(), 80);
          });
        } else if (typeof w.setTimeout === "function") {
          w.setTimeout(() => restoreIn(), 80);
        } else {
          restoreIn();
        }
      }
      if (!wins.length) restoreIn(null);
    }
    return result;
  }
  queueChange(change) {
    this.changes.push(change);
    if (!this.changeTimer)
      this.changeTimer = window.setTimeout(() => {
        this.changeTimer = 0;
        void this.flushChanges().catch((error) => this.report(error));
      }, 100);
  }
  async flushChanges() {
    window.clearTimeout(this.changeTimer);
    this.changeTimer = 0;
    if (this.flushing) return this.flushing;
    this.flushing = this.applyChanges();
    try {
      await this.flushing;
    } finally {
      this.flushing = null;
    }
  }
  async applyChanges() {
    while (this.changes.length) {
      const batch = this.changes.splice(0);
      await this.store.update((order, settings) => {
        let deletes = [];
        for (const change of batch) {
          if (change.kind === "delete") {
            deletes.push(change.path);
            continue;
          }
          if (deletes.length) {
            order = deleteOrders(order, deletes);
            settings.folderSettings = deleteFolderSettings(settings.folderSettings, deletes);
            deletes = [];
          }
          settings.excluded = renameExclusions(settings.excluded, change.from, change.to);
          order = renameOrder(order, change.from, change.to);
          settings.folderSettings = renameFolderSettings(settings.folderSettings, change.from, change.to);
        }
        if (deletes.length) {
          order = deleteOrders(order, deletes);
          settings.folderSettings = deleteFolderSettings(settings.folderSettings, deletes);
        }
        return order;
      });
      this.refresh();
    }
  }
  async onExternalSettingsChange() {
    this.cancelDrags();
    await this.reload();
  }
  cancelDrags() {
    for (const { drag } of this.views.values()) drag.cancel();
  }
  refresh() {
    if (!this.alive) return;
    this.cancelDrags();
    if (this.refreshTimer) return;
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = 0;
      if (!this.alive) return;
      // ★ 包一层滚动保护：核心 sort() 重建虚拟树时会让 scrollTop 漂移，
      //   详见 withFileTreeScrollPreserved() 的注释。
      this.withFileTreeScrollPreserved(() => {
        for (const [view, { drag }] of this.views) {
          try {
            view.requestSort();
            drag.decorate();
          } catch (error) {
            this.viewError(view, error);
          }
        }
      });
    }, 0);
  }
  viewError(view, error) {
    console.error("[Aio Explorer] native explorer compatibility", error);
    this.views.get(view)?.drag?.cancel();
    if (!this.warnedViews.has(view)) {
      this.warnedViews.add(view);
      new import_obsidian4.Notice(this.t("compatibilityError"), 7e3);
    }
  }
  /* ================================================================
     模块总开关（专注 / 文件清理 / 笔记计数）
     ================================================================ */

  /**
   * 某个模块当前是否启用。
   * 配置里没有这一项时视为启用（向后兼容旧配置）。
   */
  moduleOn(key) {
    return this.settings[key] !== false;
  }

  /**
   * 应用三个模块的总开关 —— 关掉就真的不工作，而不只是把界面藏起来：
   * 专注：退出专注并取消筛选，同时撤掉菜单项、按钮与命令；
   * 清理：移除侧栏图标与命令，不再响应启动清理、关闭清理、监听；
   * 计数：清掉所有 data-count 与容器标记并停掉兜底轮询。
   * 每次改完设置都调一次，不需要重启 Obsidian。
   */
  applyModuleSwitch() {
    this.applyFocusModuleSwitch();
    this.applyCleanModuleSwitch();
    this.applyCountModuleSwitch();
    this.applyPinModuleSwitch();
    this.applyIconModuleSwitch();
    this.applyTitleAdjustSwitch();
  }

  /**
   * 标题换行开关。
   * 与文件图标模块相互独立：不受 iconModuleEnabled 总开关控制，
   * 自己一个开关往 body 打/摘 qt-title-wrap 类。
   */
  applyTitleAdjustSwitch() {
    return this.applyBodyClasses((body) => {
      // ① 长名字自动换行（原来叫「标题换行」，现已并入「标题调整」）
      body.classList.toggle(TITLE_WRAP_CLASS, this.moduleOn("titleWrapEnabled"));
      // ② 文件夹名加粗（从「文件图标」移来，独立于图标总开关）
      //    2026-10-22：布尔开关改成 5 档滑块。0 = 关闭（摘类、撤变量）；
      //    500..800 = 字重档位，写进 body 的 --qt-folder-bold-weight，
      //    styles.css 的 qt-folder-bold 规则消费它。hover/active 三态
      //    在 CSS 里绑同一个变量，不会出现"加粗了但悬停时变回去"的闪跳。
      const boldWeight = Number(this.settings.iconFolderBoldWeight) || 0;
      const boldOn = boldWeight >= 500 && boldWeight <= FOLDER_BOLD_MAX;
      body.classList.toggle(FOLDER_BOLD_CLASS, boldOn);
      if (boldOn) {
        body.style?.setProperty?.(FOLDER_BOLD_WEIGHT_VAR, String(boldWeight));
      } else {
        // 关掉时撤掉属性，让 CSS 里的 var() 兜底值也不生效（类已摘，双保险）
        body.style?.removeProperty?.(FOLDER_BOLD_WEIGHT_VAR);
      }
      // ③ 标题字号：直接改核心的 --nav-item-size，只影响文件列表标题。
      //    用 body 的 inline style，优先级高于任何主题声明；关掉时移除属性，
      //    自动回到 Obsidian 默认值（--font-ui-small）。
      //    手机端自动分流：Obsidian 会给手机上的 body 打 is-mobile 类，
      //    这里按每个窗口各自的 body 判断，电脑用电脑值、手机用手机值，
      //    两个值存同一份 data.json 一起同步，无需按设备分别设置。
      const size = Number(this.settings.titleFontSize) || 0;
      const mobileSize = Number(this.settings.mobileTitleFontSize) || 0;
      const sizeOk = (v) => v >= TITLE_FONT_SIZE_MIN && v <= TITLE_FONT_SIZE_MAX;
      const isMobileBody = !!body.classList?.contains?.("is-mobile");
      const finalSize = isMobileBody && sizeOk(mobileSize) ? mobileSize : size;
      if (sizeOk(finalSize)) {
        body.style?.setProperty?.("--nav-item-size", `${finalSize}px`);
      } else {
        // 关掉时撤掉属性，自动回到 Obsidian 默认字号（--font-ui-small）
        body.style?.removeProperty?.("--nav-item-size");
      }
    }, "标题调整");
  }

  /* ================================================================
     即时生效三件套（2026-10-21 新增）
     目标：拨动开关 → 视觉立刻变化，不依赖重启，也不依赖
     Obsidian 有没有把 styles.css 加载进内存。
     ================================================================ */

  /**
   * 需要打类的所有窗口文档。
   * 以前只用 activeDocument 单数，主窗口能用，但笔记拖到独立弹窗后
   * 弹窗里就没效果了。这里把主窗口 + 所有已打开的叶子窗口都收进来。
   */
  qtDocuments() {
    const docs = /* @__PURE__ */ new Map();
    const add = (doc) => {
      if (doc?.body?.classList && !docs.has(doc)) docs.set(doc, doc.body);
    };
    add(this.app?.workspace?.containerEl?.ownerDocument ?? activeDocument);
    try {
      this.app?.workspace?.iterateAllLeaves?.((leaf) => {
        add(leaf?.view?.containerEl?.ownerDocument);
      });
    } catch (error) {
      console.error("[Aio Explorer] 枚举窗口失败", error);
    }
    add(activeDocument);
    return docs;
  }

  /**
   * 内存里的样式文本：磁盘读到的最新 styles.css 优先，
   * 还没读到（或读失败）时用内置兜底，绝不出现「没有样式」的空窗期。
   */
  liveCssText() {
    if (typeof this.__qtLiveCss !== "string" || this.__qtLiveCss.length < 200) {
      this.__qtLiveCss = QT_LIVE_CSS_FALLBACK;
    }
    return this.__qtLiveCss;
  }

  /**
   * 把样式装进 <head>。幂等：内容没变就不碰 DOM。
   * 插在 head 最前面 = 优先级最低，只做「styles.css 没加载时的兜底」，
   * 不会反过来盖住 Obsidian 正常加载的那份。
   */
  ensureLiveStylesheet() {
    const docs = this.qtDocuments();
    const css = this.liveCssText();
    if (!css) return false;
    for (const doc of docs.keys()) {
      // 防御：个别环境（如测试桩）可能没有 head / getElementById，跳过即可，
      // 不能因为「没地方插样式」而让打类这一步跟着失败。
      if (!doc?.head || typeof doc.getElementById !== "function") continue;
      let el = doc.getElementById(QT_LIVE_STYLE_ID);
      if (!el) {
        el = doc.createElement("style");
        el.id = QT_LIVE_STYLE_ID;
        el.setAttribute("data-qt-live", "1");
        doc.head?.insertBefore(el, doc.head.firstChild);
      }
      if (el.textContent !== css) el.textContent = css;
    }
    return docs.size > 0;
  }

  /**
   * 后台重读磁盘上的 styles.css 并更新注入的 <style>。
   * 不 await —— 拨开关时不等 IO，视觉零延迟。
   * 效果：以后我只改 styles.css，你拨一下开关就生效，不用重启 Obsidian。
   */
  refreshLiveStylesheet() {
    const path = ".obsidian/plugins/aio-explorer/styles.css";
    const adapter = this.app?.vault?.adapter;
    // 环境不具备读文件能力时（例如某些测试/早期启动阶段），
    // 直接用内置兜底即可，不该抛错把整个开关流程带崩。
    if (!adapter || typeof adapter.read !== "function") {
      this.ensureLiveStylesheet();
      return Promise.resolve(false);
    }
    return adapter
      .read(path)
      .then((text) => {
        if (typeof text === "string" && text.length > 500) {
          this.__qtLiveCss = text;
        }
      })
      .catch(() => {
        /* 读不到就用内置兜底，不打扰用户 */
      })
      .then(() => this.ensureLiveStylesheet());
  }

  /**
   * 打 body 类的统一入口：先保证样式在位，再对每个窗口打/摘类。
   * 任何一步失败都往控制台报明确原因，不再静默。
   */
  applyBodyClasses(fn, label) {
    const docs = this.qtDocuments();
    if (docs.size === 0) {
      console.error(`[Aio Explorer] 找不到任何 document.body，「${label}」无法生效`);
      return false;
    }
    this.ensureLiveStylesheet();
    let ok = false;
    for (const [doc, body] of docs) {
      try {
        fn(body);
        ok = true;
      } catch (error) {
        console.error(`[Aio Explorer] 「${label}」在窗口 ${doc.location?.href ?? "?"} 失败`, error);
      }
    }
    return ok;
  }

  /** 当前各开关的真实生效状态（直接从 body 类读，不猜），给设置页显示用。 */
  liveSwitchState() {
    const docs = this.qtDocuments();
    const first = docs.values().next().value;
    const cls = first?.classList;
    const has = (name) => !!cls?.contains(name);
    const styleInMemory = (() => {
      for (const doc of docs.keys()) {
        if (typeof doc.getElementById === "function" && doc.getElementById(QT_LIVE_STYLE_ID)) return true;
      }
      return false;
    })();
    const rawSize = first?.style?.getPropertyValue?.("--nav-item-size") ?? "";
    // 文件夹字重档位：从 body 的 inline style 读（和字号一个路子）。
    // 类摘掉时属性也撤了，这里自然读到空 → 0。
    const rawBoldWeight = first?.style?.getPropertyValue?.(FOLDER_BOLD_WEIGHT_VAR) ?? "";
    // 手机端的值从设置里读（电脑上看不到手机的 inline style，但值是同一份设置）
    const mobileSizeRaw = Number(this.settings.mobileTitleFontSize) || 0;
    return {
      colorful: has(COLORFUL_FOLDER_CLASS),
      bold: has(FOLDER_BOLD_CLASS),
      boldWeight: rawBoldWeight ? Number.parseInt(rawBoldWeight, 10) || 0 : 0,
      customIcons: has(CUSTOM_ICONS_CLASS),
      subfolderInherit: has(SUBFOLDER_INHERIT_CLASS),
      titleWrap: has(TITLE_WRAP_CLASS),
      fontSize: rawSize ? Number.parseInt(rawSize, 10) || 0 : 0,
      mobileFontSize: mobileSizeRaw >= TITLE_FONT_SIZE_MIN && mobileSizeRaw <= TITLE_FONT_SIZE_MAX ? mobileSizeRaw : 0,
      isMobile: has("is-mobile"),
      styleInMemory,
      windows: docs.size,
    };
  }

  /**
   * 文件图标总开关 + 三个子开关（多彩文件夹图标 / 文件夹字体加粗 / 自定义图标）。
   * 各自往 body 打/摘自己的类，颜色与形状规则全在 styles.css 里，
   * 与主题自己的 .colorful-folder / .folder-font-bold / .file-icon-remove 互不干扰。
   * 模块总开关关掉时，三个类都会被摘掉。
   */
  /**
   * 取【完整的】文件夹顺序表（与虚拟滚动无关）。
   *
   * 为什么需要它：文件树用 infinityScroll 虚拟滚动，DOM 里只有当前可见的行。
   * 如果按"DOM 里第几个"算颜色序号，滚动一下颜色就全变了。
   * 所以顺序必须来自【整个库】，而不是当前 DOM。
   *
   * ★★★ 2026-10-22 重写：顺序表必须与「屏幕显示顺序」同源
   *   （多彩文件夹"乱序"bug 根因：用户看到颜色乱，实际是稳定的错位）
   *   旧实现用 `folders.sort((a,b)=>(a<b?-1:a>b?1:0))` 纯 UTF-16 码元序编号，
   *   与屏幕显示顺序是两张表 → 颜色整体错位。
   *   而且"只按名称排"也不够：屏幕上文件夹的位置还受插件自己的
   *   始终隐藏目录 / 隐藏名单 / 每文件夹排序模式（含自定义手动顺序）/ 置顶 影响
   *   —— Obsidian 1.14.4 原生没有手动排文件夹的功能，这些全是本插件提供的，
   *   用户完全可能让"屏幕第 3 个"不是"名称第 3 个"。
   *
   * 正解：完整复刻渲染管线（attachSort 里 sorted() 的同一批函数、同一份数据）：
   *   ① 原生顺序 = NATIVE_FOLDER_COLLATOR（obsidian.asar 实证的文件夹比较器）；
   *   ② applyAutoHide（始终隐藏的目录）；
   *   ③ 专注模式【故意不纳入】：那是临时视图状态，纳入会导致开关一次专注全库变色；
   *      颜色按"非专注时的全局位置"算，与"搜索时不重排"的策略一致；
   *   ④ excluded 父夹：渲染管线到此提前收工（后续隐藏/排序/置顶全部不生效），
   *      顺序表也同样收手，保持原生序；
   *   ⑤ applyHide（隐藏名单，仅 showHidden 关时生效）；
   *   ⑥ applySortMode（custom=手动顺序，未录到的按原生序尾随；
   *      name-asc/name-desc、created-new/old、modified-new/old、native 各路模式）；
   *   ⑦ applyPin（置顶提前）。
   * 复用的全是渲染管线自己那几只函数 + 同一份 vault 对象
   * （.file.stat 有无两边看到的是同一个对象，完全一致）→ 结果必然一致。
   *
   * ★ 根目录键的坑：渲染管线用 folder.path 查设置，库根的 path 是 "/"；
   *   而 markFirstLevelFolders 按"一级文件夹 data-path 不含 /"反推父路径为 ""，
   *   groups 图必须继续用 "" 作根键。所以查 folderSettings/order/excluded 时
   *   要把 "" 换算成 "/"（settingsKey），否则根目录的手动顺序/置顶/隐藏全部失效。
   *
   * 产出：
   *   firstLevel : 根下所有文件夹的路径数组（= 屏幕上一级文件夹的顺序）
   *   groups     : Map<父路径, 该父目录下所有文件夹的路径数组>（根键为 ""）
   * 用 Map 存 groups 便于 O(1) 查兄弟组。
   *
   * 拿不到 vault（极端情况）时返回 null，调用方会走兜底分支。
   */
  folderColorOrder() {
    const vault = this.app?.vault;
    const root = vault?.getRoot?.();
    if (!root || !Array.isArray(root.children)) return null;
    const settings = this.store?.settings ?? {};
    const order = this.store?.order ?? /* @__PURE__ */ Object.create(null);
    const rules = Array.isArray(settings.excluded) ? settings.excluded : [];
    const folderSettings = settings.folderSettings ?? /* @__PURE__ */ Object.create(null);
    const firstLevel = [];
    const groups = new Map();
    const visit = (parentPath, children) => {
      const folders = [];
      for (const child of children) {
        if (!child || typeof child.path !== "string") continue;
        // 只收文件夹（vault 里 TFolder 有 children 数组，文件没有）
        if (!Array.isArray(child.children)) continue;
        folders.push(child);
      }
      // ① 原生顺序：核心 getSortedFolderItems 里"两边都是文件夹"的分支
      //    走 BT(e.name, n.name)，即 NATIVE_FOLDER_COLLATOR（见其定义处注释）
      folders.sort((a, b) => NATIVE_FOLDER_COLLATOR.compare(a.name, b.name));
      let list = folders.map((file) => ({ file }));
      // ② 始终隐藏的目录（渲染管线的第一步过滤）
      list = applyAutoHide(list, settings.autoHidePaths);
      // ③ 专注模式跳过（见上方注释）
      // ④ 排除目录：与渲染管线一致——父夹被排除时后续的隐藏/排序/置顶全部不生效
      const settingsKey = parentPath === "" ? "/" : parentPath;
      if (!excluded(settingsKey, rules)) {
        const config = folderSettings[settingsKey];
        // ⑤ 隐藏名单
        if (!settings.showHidden && config?.hidden?.length) list = applyHide(list, config.hidden);
        // ⑥ 排序模式（custom = 手动顺序，未录到的保持原生序尾随）
        list = applySortMode(list, config?.sortOrder ?? "custom", order[settingsKey]);
        // ⑦ 置顶提前
        list = applyPin(list, config?.pinned);
      }
      const paths = list.map((item) => item.file.path);
      groups.set(parentPath, paths);
      if (parentPath === "") firstLevel.push(...paths);
      for (const child of children) {
        if (!child || !Array.isArray(child.children)) continue;
        visit(child.path, child.children);
      }
    };
    visit("", root.children);
    return { firstLevel, groups };
  }

  /**
   * 给「一级文件夹」打 FIRST_LEVEL_CLASS 标记（styles.css 的 7 色循环靠它选中一级）。
   *
   * ★ 判定依据（2026-10-21 从 obsidian.asar 1.14.4 核心代码实证）：
   *   Obsidian 给文件树每个节点的标题行写入 data-path = 文件夹在库内的相对路径：
   *       selfEl.setAttr("data-path", this.file.path)   ← 核心代码原话
   *   库根自己的 path 是 "/"，它【不会】作为一行渲染出来；
   *   直接挂在库根下的一级文件夹，path 里【不含 "/"】（如 "Projects"）；
   *   更深层的文件夹 path 一定含 "/"（如 "Projects/Archive"）。
   *   → 所以「data-path 不含 /」= 一级文件夹，这是 100% 可靠的判据。
   *
   * ★ 为什么不能靠 .mod-root：
   *   1.14.4 核心代码里 mod-root 只出现在发布站点树 / 工作区容器上，
   *   文件树（FO/pO/LO/IO 这条链）从头到尾【没有】给任何节点加过 mod-root；
   *   官方 app.css 里 ".workspace-drawer .nav-folder.mod-root" 是历史遗留规则。
   *   → 任何以 .mod-root 为锚点的选择器在真实环境里命中 0。
   *
   * ★ 为什么不能靠 :has()：
   *   一级文件夹挂在 rootEl.childrenEl（一个【没有 class 的 div】）下，
   *   纯 CSS 无法区分它和二级文件夹（.nav-folder-children 也没有专属 class），
   *   唯一勉强能写的 :has() 写法在不同 Electron 版本上可能整个不生效。
   *
   * 每次先清掉旧标记再重打，避免虚拟滚动复用 DOM 节点后残留错位。
   */
  markFirstLevelFolders() {
    for (const doc of this.qtDocuments().keys()) {
      if (typeof doc.querySelectorAll !== "function") continue;
      const stale = doc.querySelectorAll("." + FIRST_LEVEL_CLASS);
      for (let i = 0; i < stale.length; i++) {
        stale[i].classList?.remove(FIRST_LEVEL_CLASS);
        for (let c = 1; c <= 7; c++) {
          stale[i].classList?.remove(FIRST_LEVEL_CLASS + "-c" + c);
          stale[i].classList?.remove(FOLDER_COLOR_CLASS + c);
        }
      }
      const folders = doc.querySelectorAll('.workspace-leaf-content[data-type="file-explorer"] .nav-folder');
      // 按 data-path 取出每个文件夹的路径（一级 = 不含 "/"）
      const pathOf = (el) => {
        const title = el.querySelector(":scope > .nav-folder-title");
        if (!title) return null;
        const path = title.getAttribute("data-path");
        return typeof path === "string" ? path : null;
      };
      // --- 收集当前可见的文件夹及其 data-path ---
      //   data-path 是【库内相对路径】（Obsidian 核心代码：
      //   selfEl.setAttr("data-path", this.file.path)），
      //   所以"含 /"= 更深层级，"不含 /"= 一级文件夹。
      const visible = [];
      for (let i = 0; i < folders.length; i++) {
        const path = pathOf(folders[i]);
        if (path === null) continue;
        if (path === "" || path === "/") continue;
        visible.push({ el: folders[i], path });
      }
      if (!visible.length) continue;

      // ★ 颜色序号必须【与虚拟滚动无关】，否则滚动一下颜色就全变了。
      //   文件树用 infinityScroll 虚拟滚动，DOM 里只有当前可见的行，
      //   所以不能靠"DOM 里第几个"来算序号。
      //   正解：用 Obsidian 自己的文件列表 API 拿到【完整】的一级文件夹顺序，
      //        按这个顺序给可见元素编号；顺序表来自 vault，不受滚动影响。
      const order = this.folderColorOrder();
      if (order) {
        // 一级文件夹：按完整一级列表里的下标取模 7
        for (const item of visible) {
          if (item.path.indexOf("/") !== -1) continue;
          const idx = order.firstLevel.indexOf(item.path);
          if (idx < 0) continue;
          item.el.classList?.add(FIRST_LEVEL_CLASS);
          item.el.classList?.add(FIRST_LEVEL_CLASS + "-c" + ((idx % 7) + 1));
        }
        // 每一级文件夹：在自己那组兄弟里的下标取模 7
        for (const item of visible) {
          const cut = item.path.lastIndexOf("/");
          const parentPath = cut === -1 ? "" : item.path.slice(0, cut);
          const siblings = order.groups.get(parentPath);
          if (!siblings) continue;
          const idx = siblings.indexOf(item.path);
          if (idx < 0) continue;
          item.el.classList?.add(FOLDER_COLOR_CLASS + ((idx % 7) + 1));
        }
      } else {
        // 拿不到完整顺序时的兜底：按当前可见项的【名称】用原生比较器排
        // （Obsidian 对文件夹就是这个名字比较器，见 NATIVE_FOLDER_COLLATOR 注释；
        //   比什么都不做要好，至少颜色不会是灰的，且顺序与主分支一致）
        const firstLevel = visible.filter((x) => x.path.indexOf("/") === -1);
        firstLevel.sort((a, b) => NATIVE_FOLDER_COLLATOR.compare(baseName(a.path), baseName(b.path)));
        for (let i = 0; i < firstLevel.length; i++) {
          firstLevel[i].el.classList?.add(FIRST_LEVEL_CLASS);
          firstLevel[i].el.classList?.add(FIRST_LEVEL_CLASS + "-c" + ((i % 7) + 1));
        }
        const groups = new Map();
        for (const item of visible) {
          const cut = item.path.lastIndexOf("/");
          const parentPath = cut === -1 ? "" : item.path.slice(0, cut);
          if (!groups.has(parentPath)) groups.set(parentPath, []);
          groups.get(parentPath).push(item);
        }
        for (const items of groups.values()) {
          items.sort((a, b) => NATIVE_FOLDER_COLLATOR.compare(baseName(a.path), baseName(b.path)));
          for (let i = 0; i < items.length; i++) {
            items[i].el.classList?.add(FOLDER_COLOR_CLASS + ((i % 7) + 1));
          }
        }
      }
    }
  }

  /**
   * 文件树内容会随展开/收起、虚拟滚动而增删 DOM 节点，新出现的节点没有标记类。
   * 用 MutationObserver 监听文件树的 childList 变化，节流后重打标记。
   *
   * ★ 2026-10-21 修正（用户报告「重启 Obsidian 后多彩文件夹图标完全消失，
   *   必须手动关掉再打开才恢复」）：
   *   原来这里只对【当下已经存在】的 .nav-files-container 注册 observer。
   *   但插件 onload 跑的时候，Obsidian 还没创建文件树视图 —— 容器数为 0，
   *   于是 observer 一个都没注册上；紧接着的 markFirstLevelFolders() 也因为
   *   找不到任何 .nav-folder 而没打出任何 .qt-fc1..7 标记。
   *   文件树后来渲染出来了，却再没有任何人补打标记 →
   *   CSS 拿不到颜色 → 「多彩文件夹图标」重启后彻底消失（图标还在，只是无色）。
   *   手动关掉再打开能好，是因为那时容器已经存在，observer 注册成功。
   *
   *   修法：容器不存在时，不要放弃 —— 改成监听 body 的 childList，
   *   等 .nav-files-container 出现后再注册真正的 observer 并补打标记。
   */
  watchFirstLevelFolders() {
    const master = this.moduleOn("iconModuleEnabled");
    const need = master && !!this.settings.subfolderInherit;
    for (const watcher of this.qtFirstLevelWatchers ?? []) watcher.disconnect?.();
    this.qtFirstLevelWatchers = [];
    if (!need) {
      this.markFirstLevelFolders();
      return;
    }
    let registered = 0;
    for (const doc of this.qtDocuments().keys()) {
      if (typeof doc.querySelector !== "function") continue;
      const trees = doc.querySelectorAll('.workspace-leaf-content[data-type="file-explorer"] .nav-files-container');
      for (let t = 0; t < trees.length; t++) {
        const tree = trees[t];
        if (typeof MutationObserver !== "function") break;
        let queued = false;
        const observer = new MutationObserver(() => {
          if (queued) return;
          queued = true;
          const run = () => {
            queued = false;
            try { this.markFirstLevelFolders(); } catch (error) {
              console.error("[Aio Explorer] 重打一级文件夹标记失败", error);
            }
          };
          if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
          else setTimeout(run, 100);
        });
        observer.observe(tree, { childList: true, subtree: true });
        this.qtFirstLevelWatchers.push(observer);
        registered++;
      }
    }
    this.markFirstLevelFolders();
    // ★ 关键补丁：文件树还不存在时，监听 body，等它出现再补注册 + 补打标记。
    //   否则重启后「多彩文件夹图标」永远出不来。
    if (registered === 0) this.waitForFileTree();
  }

  /**
   * 等文件树视图出现（Obsidian 启动时才创建），出现后：
   *   ① 重新注册真正的 MutationObserver（监听树内增删）
   *   ② 立刻补打一遍一级/兄弟色标记
   * 最多等 QT_FILE_TREE_WAIT_MS 毫秒，超时就放弃（避免死循环占资源）。
   */
  waitForFileTree() {
    if (this.qtFileTreeWaiter) return;
    const master = this.moduleOn("iconModuleEnabled");
    if (!master || !this.settings.subfolderInherit) return;
    const docs = this.qtDocuments();
    let deadline = 0;
    const start = Date.now();
    const tryRegister = () => {
      let found = 0;
      for (const doc of docs.keys()) {
        if (typeof doc.querySelectorAll !== "function") continue;
        const trees = doc.querySelectorAll('.workspace-leaf-content[data-type="file-explorer"] .nav-files-container');
        for (let t = 0; t < trees.length; t++) {
          found++;
          const tree = trees[t];
          if (typeof MutationObserver !== "function") continue;
          let queued = false;
          const observer = new MutationObserver(() => {
            if (queued) return;
            queued = true;
            const run = () => {
              queued = false;
              try { this.markFirstLevelFolders(); } catch (error) {
                console.error("[Aio Explorer] 重打一级文件夹标记失败", error);
              }
            };
            if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
            else setTimeout(run, 100);
          });
          observer.observe(tree, { childList: true, subtree: true });
          this.qtFirstLevelWatchers.push(observer);
        }
      }
      return found;
    };
    const tick = () => {
      if (!this.alive) { this.qtFileTreeWaiter = null; return; }
      const found = tryRegister();
      if (found > 0) {
        this.qtFileTreeWaiter = null;
        // 树出现了，立刻补打标记 —— 这一步就是「重启后颜色回来」的关键
        try { this.markFirstLevelFolders(); } catch (error) {
          console.error("[Aio Explorer] 首次补打一级文件夹标记失败", error);
        }
        return;
      }
      if (Date.now() - start > QT_FILE_TREE_WAIT_MS) {
        this.qtFileTreeWaiter = null;
        return;
      }
      this.qtFileTreeWaiter = setTimeout(tick, 200);
    };
    this.qtFileTreeWaiter = setTimeout(tick, 200);
  }

  applyIconModuleSwitch() {
    const master = this.moduleOn("iconModuleEnabled");
    // ★ 2026-10-21：先把样式装进内存再打标记。
    //   原来顺序是「先 watchFirstLevelFolders() → 后 ensureLiveStylesheet()」，
    //   启动那一刻样式还没就位，标记即使打上了也看不到颜色。
    //   ensureLiveStylesheet() 内部有 QT_LIVE_CSS_FALLBACK 兜底，不会出现无样式空窗。
    this.ensureLiveStylesheet();
    this.watchFirstLevelFolders();
    return this.applyBodyClasses((body) => {
      body.classList.toggle(COLORFUL_FOLDER_CLASS, master && !!this.settings.iconColorfulFolder);
      body.classList.toggle(CUSTOM_ICONS_CLASS, master && !!this.settings.iconCustomIcons);
      body.classList.toggle(SUBFOLDER_INHERIT_CLASS, master && !!this.settings.subfolderInherit);
      // 加粗已移到「标题调整」标签页，由 applyTitleAdjustSwitch 负责打类，
      // 因此不再受这里的「启用文件图标」总开关牵连。
    }, "文件图标");
  }

  /** 专注模式总开关。 */
  applyFocusModuleSwitch() {
    const on = this.moduleOn("focusModuleEnabled");
    if (on) {
      this.refresh();
      return;
    }
    // 先退出专注，否则文件列表会被锁在筛选态里出不来
    if (this.store?.isFocus) this.exitFocus();
    // 关掉菜单项与按钮：两处判定都要看总开关
    this.patchFocusMenu?.(false);
    this.syncNavIcons();
    this.refresh();
  }

  /** 文件清理总开关（含设备开关）。 */
  applyCleanModuleSwitch() {
    const on = this.isCleanEnabledHere();
    // ★ 双向处理：之前只做了「移除」，重新开启时没有「加回来」，
    //   导致用户关掉一次后再也看不到垃圾桶图标 —— 必须重启 Obsidian 才能恢复。
    if (!on) {
      // 关闭：移除图标
      if (this.cleanRibbonIcon) {
        this.cleanRibbonIcon.remove?.();
        this.cleanRibbonIcon = null;
      }
      this.cleanLastOpened = [];
      try {
        this.cleanLastModal?.close?.();
      } catch (error) {
        // 弹窗可能已关
      }
      this.cleanLastModal = null;
      // ★ 设备关掉时也要停掉已排好的启动清理，
      //   否则关掉后那一秒仍会跑一次真正的删除。
      window.clearTimeout(this.cleanStartupTimer);
      return;
    }
    // 开启：若图标不在，则注册一次（幂等：已存在就不重复注册）
    if (!this.cleanRibbonIcon) {
      this.cleanRibbonIcon = this.addRibbonIcon(
        "trash",
        this.t("cleanBtn"),
        () => void this.runVaultCleanup()
      );
      this.cleanLog("文件清理已启用");
    }
    // 启动自动清理是「一次性」的，开关切换后需要重新安排
    this.scheduleCleanOnStartup();
  }

  /**
   * 按开关安排「启动后延迟 1 秒自动清理」。
   * 抽成方法是为了让 applyCleanModuleSwitch 重新开启时能补上，
   * 否则只在 onload 里安排一次，关掉再开就再也不会自动清理。
   */
  scheduleCleanOnStartup() {
    window.clearTimeout(this.cleanStartupTimer);
    if (!this.settings.cleanRunOnStartup) return;
    if (!this.isCleanEnabledHere()) return;
    if (!this.alive) return;
    this.cleanStartupTimer = window.setTimeout(() => void this.runVaultCleanup(), 1e3);
  }

  /** 笔记计数总开关（含设备开关）。 */
  applyCountModuleSwitch() {
    const on = this.isCountEnabledHere();
    if (on) {
      this.reloadNoteCounts();
      // 关闭时 clearInterval 停掉了兜底轮询，重新开启必须再起一次，
      // 否则之后新打开的文件浏览器视图会永远等不到数字。
      this.startNoteCountWatcher();
      return;
    }
    // 关掉：把所有痕迹抹干净，并停掉兜底轮询
    window.clearInterval(this.noteCountWatchTimer);
    this.noteCountWatchTimer = 0;
    for (const view of this.allExplorerViews()) this.clearNoteCounts(view);
  }

  /* ================================================================
     文件清理（融合 File Cleaner Redux）
     ================================================================ */

  /** 统一的通知出口：按「通知」三档设置决定是否弹出。 */
  cleanNotify(message, isError = false) {
    const mode = this.settings.cleanNotifications;
    if (mode === "hideAll") return;
    if (mode === "showOnlyErrors" && !isError) return;
    new import_obsidian4.Notice(message);
  }

  /** 同步读取一个文件的内容；读不到返回 null（清理判定会跳过它）。 */
  __cleanReadSync(file) {
    if (!this.__cleanReadCache) this.__cleanReadCache = new Map();
    if (this.__cleanReadCache.has(file.path)) return this.__cleanReadCache.get(file.path);
    let text = null;
    try {
      text = this.app.vault.read ? this.__cleanReadSyncImpl(file) : null;
    } catch (error) {
      text = null;
    }
    this.__cleanReadCache.set(file.path, text);
    return text;
  }
  /** 真正读文件的辅助（同步版本，用 readSync 优先）。 */
  __cleanReadSyncImpl(file) {
    const adapter = this.app.vault.adapter;
    if (typeof adapter?.readSync === "function") {
      const out = adapter.readSync(this.app.vault.getFullPath(file.path));
      return typeof out === "string" ? out : String(out ?? "");
    }
    return null;
  }

  /** 用户是否装了某个插件。 */
  cleanHasPlugin(id) {
    return Boolean(Object.getOwnPropertyDescriptor(this.app.plugins?.plugins ?? {}, id));
  }

  /** 某个文件被多少笔记反向链接。 */
  cleanBacklinkCount(file) {
    const data = this.app.metadataCache.getBacklinksForFile?.(file);
    return data?.data?.size ?? 0;
  }

  /** 取文件的缓存信息（sections / frontmatter）。 */
  cleanFileCache(file) {
    return this.app.metadataCache.getFileCache?.(file) ?? null;
  }

  /** 收集所有「正在被引用」的附件路径。 */
  collectAllUsedAttachments() {
    const list = collectUsedAttachments(this.app);
    list.push(...collectCanvasAttachments(this.app));
    if (this.cleanHasPlugin("obsidian-admonition-plugin") || this.cleanHasPlugin("obsidian-admonition"))
      list.push(...collectAdmonitionAttachments(this.app));
    if (this.cleanHasPlugin("ink")) list.push(...collectInkAttachments(this.app));
    list.push(...collectCodeblockAttachments(this.app, this.settings.cleanCodeblockTypes));
    return [...new Set(list)];
  }

  /** 扫描全库，返回待删的文件与文件夹。 */
  async scanVaultForCleanup() {
    this.__cleanReadCache = new Map();
    const now = Date.now();
    const used = this.collectAllUsedAttachments();
    const extensions = cleanExtensions(this.settings.cleanAttachmentExtensions);
    // ink 插件的 drawing / writing 也当附件处理
    if (this.cleanHasPlugin("ink")) extensions.push("drawing", "writing");

    const ctx = {
      settings: this.settings,
      now,
      filteredExtensions: extensions,
      backlinksOf: (f) => this.cleanBacklinkCount(f),
      cacheOf: (f) => this.cleanFileCache(f),
      contentOf: (f) => this.__cleanReadSync(f),
      isOrphanCanvasFn: (f) => isOrphanCanvas(f, this.app),
      hasExcalidraw: () => this.settings.cleanExcalidrawAsAttachment
        && this.cleanHasPlugin("obsidian-excalidraw-plugin"),
      isExcalidrawEmpty: (f) => this.cleanIsExcalidrawEmpty(f),
    };

    const filesToRemove = [];
    const foldersToRemove = [];
    // 从深到浅处理，这样父文件夹判定时子文件夹已在列表里
    const folders = this.app.vault.getAllLoadedFiles()
      .filter((n) => Array.isArray(n.children))
      .filter((n) => n.path !== "/")
      .sort((a, b) => b.path.localeCompare(a.path));

    for (const folder of folders) {
      if (this.settings.cleanFolderMode === CLEAN_EXCLUDE && isFolderExcluded(folder, this.settings)) continue;
      if (this.settings.cleanFolderMode === CLEAN_INCLUDE && !isFolderIncluded(folder, this.settings)) continue;
      const files = folder.children.filter((n) => !Array.isArray(n.children));
      let childrenCount = files.length;
      for (const file of files) {
        if (used.includes(file.path)) continue;
        if (file.extension === "base") continue;
        if (shouldCleanFile(file, ctx)) {
          filesToRemove.push(file);
          childrenCount -= 1;
        }
      }
      // 一个子项都不剩 → 空文件夹
      const hasRealChild = folder.children.some(
        (c) => Array.isArray(c.children) ? !foldersToRemove.includes(c) && c.children.length > 0 : true
      );
      if (childrenCount === 0 && !hasRealChild && folder.path !== "/" && this.settings.cleanRemoveFolders)
        foldersToRemove.push(folder);
    }

    // 连锁判断：若某文件夹的子文件夹也要删，且它自己也空了 → 一并删
    for (const folder of [...foldersToRemove].reverse()) {
      const subFolders = folder.children.filter((c) => Array.isArray(c.children));
      if (subFolders.some((sub) => !foldersToRemove.includes(sub) && sub.children.length > 0)) {
        const i = foldersToRemove.indexOf(folder);
        if (i >= 0) foldersToRemove.splice(i, 1);
      }
    }

    this.cleanLog(`扫描完成：${filesToRemove.length} 个文件、${foldersToRemove.length} 个文件夹待清理`);
    return { filesToRemove, foldersToRemove };
  }

  /** Excalidraw 空白图判定：文件为空或只有 excalidraw 的骨架字段。 */
  cleanIsExcalidrawEmpty(file) {
    const text = this.__cleanReadSync(file);
    if (text == null) return (file.stat?.size ?? 0) === 0;
    try {
      const data = JSON.parse(text);
      const elements = Array.isArray(data.elements) ? data.elements : [];
      // 没有图形元素，且没有任何文件引用 → 视为空白
      if (elements.length > 0) return false;
      return !(this.app.metadataCache.resolvedLinks?.[file.path]
        && Object.keys(this.app.metadataCache.resolvedLinks[file.path]).length > 0);
    } catch (error) {
      return false;
    }
  }

  /** 调试日志（仅在开启时输出）。 */
  cleanLog(message) {
    if (this.settings.cleanDebugLogging) console.debug("[文件清理]", message);
  }

  /** 按设置删除单个文件。 */
  async cleanRemoveFile(file) {
    const dest = this.settings.cleanDeleteDestination;
    try {
      if (dest === "permanent") {
        await this.app.vault.delete(file, true);
      } else if (dest === "system") {
        await this.app.vault.trash(file, true);
      } else if (dest === "obsidian") {
        await this.app.vault.trash(file, false);
      } else {
        // 跟随 Obsidian 全局设置
        await this.app.fileManager.trashFile(file);
      }
      this.cleanLog("已删除文件：", file.path);
    } catch (error) {
      this.cleanNotify(this.t("cleanNotifyFailed") + file.path, true);
    }
  }

  /** 批量删除。 */
  async cleanRemoveFiles(items) {
    if (!items.length) {
      this.cleanNotify(this.t("cleanNotifyNothing"));
      return;
    }
    for (const item of items) await this.cleanRemoveFile(item);
    this.cleanNotify(this.t("cleanNotifySuccess"));
  }

  /** 清理 .trash 里超过指定天数的文件。 */
  async cleanTrashFolder() {
    const age = this.settings.cleanTrashAge;
    if (age < 0) return;
    const adapter = this.app.vault.adapter;
    if (typeof adapter?.exists !== "function" || !(await adapter.exists(".trash"))) return;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - age);
    const thresholdTime = threshold.getTime();
    try {
      const listing = await adapter.list(".trash");
      for (const file of listing?.files ?? []) {
        const stat = await adapter.stat(file);
        if (stat && stat.ctime < thresholdTime) {
          await adapter.remove(file);
          this.cleanLog("已从回收站删除：", file);
        }
      }
      for (const folder of listing?.folders ?? []) {
        const stat = await adapter.stat(folder);
        if (stat && stat.ctime < thresholdTime) {
          await adapter.rmdir(folder, true);
          this.cleanLog("已从回收站删除文件夹：", folder);
        }
      }
    } catch (error) {
      // 回收站不可访问时静默跳过，不影响主流程
    }
  }

  /**
   * 删除前确认弹窗：列出所有待删项，勾选后确认。
   * 用 Modal + 自绘列表，保证中文界面与键盘可用。
   */
  openCleanConfirmModal(files, folders, onConfirm) {
    const { Modal } = import_obsidian4;
    const self = this;
    const chosen = new Set([...files, ...folders]);
    const modal = new Modal(this.app);
    modal.titleEl.setText(this.t("cleanConfirmTitle"));
    const { contentEl } = modal;
    contentEl.createEl("p", { text: this.t("cleanConfirmText") });

    const listEl = contentEl.createDiv({ cls: "qt-clean-list" });
    const rows = [];
    const addRow = (item, kindLabel) => {
      const row = listEl.createDiv({ cls: "qt-clean-row" });
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = true;
      cb.addEventListener("change", () => {
        if (cb.checked) chosen.add(item); else chosen.delete(item);
        updateCount();
      });
      row.createSpan({ text: item.path });
      row.createSpan({ cls: "qt-clean-kind", text: kindLabel });
      rows.push({ item, cb });
    };
    for (const f of files) addRow(f, this.t("cleanKindFile"));
    for (const f of folders) addRow(f, this.t("cleanKindFolder"));

    const countEl = contentEl.createDiv({ cls: "qt-clean-count" });
    const updateCount = () => {
      countEl.setText(this.t("cleanSelectedCount").replace("{n}", String(chosen.size)));
    };
    updateCount();

    const btnRow = contentEl.createDiv({ cls: "qt-clean-buttons modal-button-container" });
    const allBtn = btnRow.createEl("button", { text: this.t("cleanSelectAll") });
    allBtn.addEventListener("click", () => {
      for (const { item, cb } of rows) { cb.checked = true; chosen.add(item); }
      updateCount();
    });
    const noneBtn = btnRow.createEl("button", { text: this.t("cleanUnselectAll") });
    noneBtn.addEventListener("click", () => {
      for (const { item, cb } of rows) { cb.checked = false; chosen.delete(item); }
      updateCount();
    });
    const cancelBtn = btnRow.createEl("button", { text: this.t("cleanCancel") });
    cancelBtn.addEventListener("click", () => modal.close());
    const okBtn = btnRow.createEl("button", { text: this.t("cleanConfirm"), cls: "mod-cta" });
    okBtn.addEventListener("click", () => {
      modal.close();
      void onConfirm([...chosen]);
    });
    modal.open();
    self.cleanLastModal = modal;
    return modal;
  }

  /** 清理总入口：扫描 → 确认 → 删除 → 收尾。 */
  async runVaultCleanup() {
    if (!this.alive) return;
    if (!this.isCleanEnabledHere()) {
      this.cleanNotify(this.t("cleanModuleOffNotice"));
      return;
    }
    this.cleanLog("开始清理");
    let result;
    try {
      result = await this.scanVaultForCleanup();
    } catch (error) {
      this.cleanNotify(this.t("cleanNotifyUnexpected"), true);
      console.error("[文件清理] 扫描出错", error);
      return;
    }
    const { filesToRemove, foldersToRemove } = result;
    const all = [...filesToRemove, ...foldersToRemove];
    if (!all.length) {
      this.cleanNotify(this.t("cleanNotifyNothing"));
    } else if (this.settings.cleanDeleteConfirmation) {
      this.openCleanConfirmModal(filesToRemove, foldersToRemove, (chosen) => {
        void this.finishCleanup(chosen);
      });
    } else {
      await this.finishCleanup(all);
    }
  }

  /** 删除之后的收尾工作。 */
  async finishCleanup(items) {
    await this.cleanRemoveFiles(items);
    if (this.settings.cleanDeleteDestination === "obsidian") await this.cleanTrashFolder();
    if (this.settings.cleanCloseNewTabs) this.app.workspace.detachLeavesOfType?.("empty");
  }

  /* ================================================================
     笔记计数（融合 File Explorer Note Count）
     ================================================================ */

  /** 给一个文件浏览器视图全量刷一次计数。 */
  applyNoteCounts(view) {
    if (!view?.fileItems) return;
    if (!this.isCountEnabledHere()) return;
    // aio-explorer：计数要显示出来了，先把容器标记同步好
    this.syncShowAllNumbers(view.navFileContainerEl);
    const filter = noteCountFilter(this.settings);
    for (const [path, item] of Object.entries(view.fileItems)) {
      if (!(item?.file instanceof import_obsidian4.TFolder)) continue;
      this.writeNoteCount(item, countNotes(item.file, filter));
    }
    this.setupRootFolderRow(view);
  }

  /** 把计数写进行元素：data-count 属性 + 「含子文件夹」标记 class。 */
  writeNoteCount(item, count) {
    const el = item?.selfEl ?? item?.el;
    if (!el) return;
    el.setAttribute("data-count", String(count));
    const hasSubfolder = (item.file.children ?? []).some((c) => c instanceof import_obsidian4.TFolder);
    el.classList.toggle(NOTE_COUNT_SUBFOLDER_CLASS, hasSubfolder);
  }

  /** 只刷新受影响的目录及其祖先（增量更新，避免全库重扫）。 */
  refreshNoteCounts(targetPaths) {
    if (!targetPaths?.length) return;
    // ★ 设备关掉时必须在这里也拦一次：增量更新是直接写 DOM 的，
    //   不经过 applyNoteCounts，漏判就会在已关闭的设备上把数字又写回来。
    if (!this.isCountEnabledHere()) return;
    const filter = noteCountFilter(this.settings);
    for (const view of this.views.keys()) {
      if (!view?.fileItems) continue;
      for (const path of collectAffectedFolders(targetPaths)) {
        const item = view.fileItems[path];
        if (item?.file instanceof import_obsidian4.TFolder)
          this.writeNoteCount(item, countNotes(item.file, filter));
      }
      this.updateRootFolderCount(view);
    }
  }

  /** 清掉某个视图上所有计数痕迹。 */
  clearNoteCounts(view) {
    if (!view?.navFileContainerEl) return;
    for (const el of view.navFileContainerEl.querySelectorAll("[data-count]"))
      el.removeAttribute("data-count");
    for (const el of view.navFileContainerEl.querySelectorAll("." + NOTE_COUNT_SUBFOLDER_CLASS))
      el.classList.remove(NOTE_COUNT_SUBFOLDER_CLASS);
    this.removeRootFolderRow(view);
  }

  /** 全量重刷（设置变更、切换视图时用）。 */
  reloadNoteCounts() {
    for (const view of this.views.keys()) this.applyNoteCounts(view);
  }

  /**
   * 根文件夹行：在导航栏顶部插一行显示「库名 + 全库笔记总数」的可点击行。
   * Obsidian 本身不提供根文件夹行（库切换器在右上角下拉里），
   * 所以这里手动造一行，点它等价于点库切换器。
   */
  setupRootFolderRow(view) {
    this.removeRootFolderRow(view);
    if (!this.settings.addRootFolder) return;
    const header = this.explorerNavHeader(view);
    if (!header) return;
    const row = activeDocument.createElement("div");
    row.className = "tree-item nav-folder qt-root-folder-row";
    row.style.setProperty("margin-top", "15px");
    const title = activeDocument.createElement("div");
    title.className = "tree-item-self nav-folder-title qt-root-folder-title";
    title.setAttribute("data-path", "/");
    const content = activeDocument.createElement("div");
    content.className = "tree-item-inner nav-folder-title-content is-clickable";
    content.textContent = this.app.vault.getName?.() ?? "";
    title.appendChild(content);
    row.appendChild(title);
    row.addEventListener("click", (evt) => {
      evt.preventDefault();
      void this.app.setActiveLeaf?.("root") ?? this.app.workspace.getLeaf("root")?.setViewState?.({ type: "empty" });
    });
    header.parentElement?.insertBefore(row, header);
    view.__qtRootFolderRow = row;
    this.updateRootFolderCount(view);
  }

  /** 更新根文件夹行的总数。 */
  updateRootFolderCount(view) {
    const row = view?.__qtRootFolderRow;
    if (!row) return;
    const root = this.app.vault.getAbstractFileByPath?.("/");
    if (!root) return;
    const total = countNotes(root, noteCountFilter(this.settings));
    row.children[0]?.setAttribute("data-count", String(total));
  }

  /** 移除根文件夹行。 */
  removeRootFolderRow(view) {
    const row = view?.__qtRootFolderRow;
    if (row) row.remove();
    if (view) view.__qtRootFolderRow = null;
  }

  /** 找文件浏览器顶部的导航栏容器。 */
  explorerNavHeader(view) {
    const root = view?.containerEl ?? view?.navFileContainerEl;
    if (!root) return null;
    return root.querySelector(".nav-header") ?? root.querySelector(".nav-buttons-container")?.parentElement ?? null;
  }

  /** 「折叠时也显示」——用 body 上的全局类控制。 */
  applyShowAllNumbers() {
    const body = activeDocument?.body;
    if (!body?.classList) {
      // 不再静默失败：把问题暴露到控制台，而不是让界面保持错误状态
      console.error("[Aio Explorer] 找不到 document.body，「折叠时也显示数量」无法生效");
      return false;
    }
    const want = !!this.settings.showAllNumbers;
    body.classList.toggle(NOTE_COUNT_SHOW_ALL_CLASS, want);
    // 转发到容器标记（所有文件浏览器视图）
    for (const view of this.allExplorerViews()) {
      this.syncShowAllNumbers(view?.navFileContainerEl);
    }
    return body.classList.contains(NOTE_COUNT_SHOW_ALL_CLASS);
  }
  /**
   * 幂等同步 body 的全局类 —— 不依赖 onLayoutReady 是否触发过。
   *
   * 原来的问题：applyShowAllNumbers 只在 onLayoutReady 与设置开关里调用。
   * 只要这两个时机有一个没走到（onLayoutReady 在 layoutReady 已为 true 后
   * 才注册、或注册时序早于 workspace 构建），body 上就永远没有那个类，
   * 于是「已展开且含子文件夹」的目录一律被那条 opacity:0 规则隐藏——
   * 表现就是第 1、2 层数字消失、第 3 层（叶子）正常。
   *
   * 现在每次刷新计数都顺带校准一次，类与开关状态必然一致。
   */
  syncShowAllNumbers(containerEl) {
    const showAll = !!this.settings.showAllNumbers;
    // ① 主标记：打在文件列表容器上，与 body 上的全局类无关，
    //    只要容器找到了就一定生效，不会因为布局时序而漏掉。
    const host = containerEl ?? activeDocument?.body;
    if (host?.classList) {
      const wantHide = !showAll;
      if (host.classList.contains(NOTE_COUNT_HIDE_EXPANDED_CLASS) !== wantHide) {
        host.classList.toggle(NOTE_COUNT_HIDE_EXPANDED_CLASS, wantHide);
        console.debug(
          "[Aio Explorer] 折叠时也显示数量 =", showAll,
          wantHide ? "→ 已隐藏【已展开目录】的数字" : "→ 展开/折叠都显示数字"
        );
      }
    }
    // ② 同时维护 body 上的全局类
    const body = activeDocument?.body;
    if (body?.classList) body.classList.toggle(NOTE_COUNT_SHOW_ALL_CLASS, showAll);
  }

  /**
   * 启动笔记计数的兜底轮询。
   *
   * 为什么需要：计数只在 syncViews() 里、且必须通过 compatibleExplorer()
   * 判定的那一次循环中才会被写进 DOM。任何一环没走到（视图是延迟加载的
   * deferred leaf、判定时机早于 fileItems 就绪、布局时序错位），
   * 数字就永远不会出现，而界面上看不到任何报错。
   *
   * 这里每 2 秒检查一次：只要发现某个文件浏览器视图还没被纳入 this.views，
   * 就重新跑一遍 syncViews()（它内部有幂等保护，已挂上的视图会跳过）。
   * 一旦挂上就会写入计数与容器标记，之后不再重复处理。
   *
   * ★ 抽成独立方法的原因：applyCountModuleSwitch 在模块/设备关闭时会
   *   clearInterval 停掉它，而重新开启时必须能再起来 —— 否则用户关一次
   *   再打开，新加载的文件浏览器视图就永远等不到数字了。
   */
  startNoteCountWatcher() {
    window.clearInterval(this.noteCountWatchTimer);
    this.noteCountWatchTimer = window.setInterval(() => {
      if (!this.alive) return;
      if (!this.app.workspace.layoutReady) return;
      // 总开关或当前设备的开关关掉了，就不用再找视图、也不用再统计
      if (!this.isCountEnabledHere()) return;
      let missing = false;
      for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
        const v = leaf?.view;
        if (v?.fileItems && !this.views.has(v)) { missing = true; break; }
      }
      if (missing) this.syncViews();
    }, 2e3);
  }

  /**
   * 启动笔记计数：刷新一次当前数量，并监听 vault 的增删改名做增量更新。
   * 防抖 500ms —— 批量重命名/移动时不会反复重算。
   */
  startNoteCounting() {
    this.applyShowAllNumbers();
    this.reloadNoteCounts();
    this.startNoteCountWatcher();
    const vault = this.app.vault;
    const handler = (...args) => {
      for (const arg of args) {
        const path = arg instanceof import_obsidian4.TAbstractFile ? arg.path : arg;
        if (typeof path !== "string") continue;
        // 只关心文件夹所在的目录（叶子变化影响的是它的父目录）
        this.noteCountQueue.push(path === "/" ? "/" : path.slice(0, path.lastIndexOf("/")) || "/");
      }
      window.clearTimeout(this.noteCountTimer);
      this.noteCountTimer = window.setTimeout(() => {
        const targets = [...new Set(this.noteCountQueue)];
        this.noteCountQueue.length = 0;
        this.refreshNoteCounts(targets);
      }, 500);
    };
    this.registerEvent(vault.on("create", handler));
    this.registerEvent(vault.on("rename", handler));
    this.registerEvent(vault.on("delete", handler));
  }

  syncViews() {
    if (!this.alive || !this.app.workspace.layoutReady) return;
    const leaves = this.app.workspace.getLeavesOfType("file-explorer");
    for (const leaf of leaves) {
      if (leaf.isDeferred && !this.loadingLeaves.has(leaf)) {
        this.loadingLeaves.add(leaf);
        void leaf.loadIfDeferred().then(() => {
          this.loadingLeaves.delete(leaf);
          if (!leaf.isDeferred) this.syncViews();
        }).catch((error) => {
          this.loadingLeaves.delete(leaf);
          if (this.alive) console.error("[Aio Explorer] Could not load file explorer", error);
        });
      }
    }
    const current = new Set(
      leaves.filter((leaf) => !leaf.isDeferred).map((leaf) => leaf.view)
    );
    for (const [view, binding] of this.views)
      if (!current.has(view) || binding.root !== view.navFileContainerEl) {
        binding.drag?.destroy();
        binding.restore();
        this.clearNoteCounts(view);
        this.views.delete(view);
      }
    for (const view of current) {
      if (this.views.has(view)) continue;
      if (!compatibleExplorer(view)) {
        this.viewError(view, new Error("unavailable"));
        continue;
      }
      // aio-explorer：笔记计数【独立】于拖拽排序挂载。
      //
      // 之前两者写在同一个 try 里：一旦 attachSort 或 DragController 抛错
      // （哪怕与计数毫无关系），就会跳到 catch，applyNoteCounts 永远不执行，
      // 于是数字完全不出现，而界面只提示一句"兼容性"、看不出真因。
      // 现在先把计数写进去，拖拽部分单独 try。
      this.applyNoteCounts(view);
      let restore;
      try {
        restore = attachSort(view, this.store, (error) => this.viewError(view, error));
        const drag = new DragController(this, view);
        // aio-explorer：拖拽排序关闭时，立刻释放 DragController 的全部监听，
        // 让浏览器原生HTML5 拖拽可用（拖到正文 = 插入链接）。
        if (!this.settings.dragSortEnabled) drag.stopDrag();
        this.views.set(view, {
          restore,
          drag,
          root: view.navFileContainerEl
        });
      } catch (error) {
        restore?.();
        this.viewError(view, error);
        // 即便拖拽挂载失败，也要记住这个视图，
        // 否则兜底轮询会每 2 秒重试一次、无限刷 console。
        if (!this.views.has(view)) {
          this.views.set(view, { restore: () => {}, drag: null, root: view.navFileContainerEl });
        }
      }
    }
  }
  /**
   * aio-explorer：切换「拖拽排序」总闸。
   * 开启 → 恢复排序监听；关闭 → 彻底释放（原生拖拽随之可用）。
   */
  async setDragSortEnabled(enabled) {
    const next = !!enabled;
    if (this.settings.dragSortEnabled === next) return;
    this.settings.dragSortEnabled = next;
    try {
      await this.saveSettings({ dragSortEnabled: next });
    } catch (error) {
      this.report(error);
      return;
    }
    this.cancelDrags();
    for (const [view, binding] of this.views) {
      // 拖拽挂载失败时 drag 为 null，此时跳过（计数不受影响）
      if (!binding.drag) return;
      if (next) binding.drag.bindDragListeners();
      else binding.drag.stopDrag();
    }
    this.syncNavIcons();
    this.refresh();
  }
  /** aio-explorer：同步标题栏开关按钮的显示位置与激活状态。 */
  updateDragSortIcon() {
    const icon = this.dragSortIcon;
    if (!icon) return;
    // aio-explorer：开启 = 高亮；关闭 = 去掉高亮。按钮本体永远不动。
    const on = !!this.settings.dragSortEnabled;
    icon.classList.toggle("is-active", on);
    // 高亮时提示"点一下关闭"，不高亮时提示"点一下开启"
    icon.setAttribute("aria-label", on ? this.t("dragSortOn") : this.t("dragSortOff"));
  }
  /** 点击标题栏按钮：在「排序开启 / 关闭」之间切换。 */
  async toggleDragSort() {
    await this.setDragSortEnabled(!this.settings.dragSortEnabled);
  }
  async reload(notify = false) {
    if (!this.alive) return;
    const hadError = !!this.store.error;
    try {
      await this.flushChanges();
      this.syncViews();
      const changed = await this.store.load();
      if (changed || hadError) {
        this.refresh();
        this.settingsTab.refreshSettings();
      }
      if (notify) new import_obsidian4.Notice(this.t("ready"));
    } catch (error) {
      if (notify || !hadError) this.report(error, "readError");
      this.settingsTab.refreshSettings();
    }
  }
  async resetFolder(path) {
    try {
      await this.flushChanges();
      await this.store.update((order) => {
        delete order[path];
        return order;
      });
      this.refresh();
      new import_obsidian4.Notice(this.t("resetDone"));
    } catch (error) {
      this.report(error);
    }
  }
  /** Filesystem moves go through FileManager so Obsidian can update links. */
  async move(view, path, target) {
    this.syncViews();
    if (this.busy || !this.alive) return;
    try {
      await this.flushChanges();
    } catch (error) {
      this.report(error);
      return;
    }
    if (this.busy || !this.alive) return;
    this.busy = true;
    let movedFile = null;
    let originalPath = "";
    try {
      await this.store.load();
      const file = this.app.vault.getAbstractFileByPath(path);
      const destination = target.parentId ?? "/";
      const folder = this.app.vault.getAbstractFileByPath(destination);
      if (!file || !(folder instanceof import_obsidian4.TFolder)) throw new Error("changed");
      const source = file.parent?.path ?? "/";
      if (excluded(source, this.settings.excluded) || excluded(destination, this.settings.excluded))
        throw new Error("locked");
      if (destination === path || destination.startsWith(path + "/")) throw new Error("changed");
      if (target.beforeId === path) return;
      if (target.beforeId && this.app.vault.getAbstractFileByPath(target.beforeId)?.parent !== folder)
        throw new Error("changed");
      // ===== 2026-10-22：拖拽与排序模式的冲突处理 =====
      // 只有「自定义排序」的文件夹才谈得上手动换顺序；按时间/名称/原生排序的文件夹，
      // 手动顺序写了也不会显示（applySortMode 会按规则重排），所以同文件夹内直接拒绝并说清楚。
      const destMode = this.settings.folderSettings?.[destination]?.sortOrder ?? "custom";
      const sameFolder = source === destination;
      if (sameFolder && destMode !== "custom") {
        new import_obsidian4.Notice(this.t("dragSortLocked").replace("{mode}", this.sortModeName(destMode)), 5e3);
        return;
      }
      // aio-explorer 修复：原生 getSortedFolderItems 只返回「已渲染到DOM」的子项，
      // 目标文件夹处于折叠状态时会返回空数组，导致 names 为空 → 落盘时把目标目录
      // 原有顺序全部丢失，且 index 算错抛 "changed"（跨文件夹拖拽报错弹窗的根因）。
      // 这里改为：以原生返回值为基础，用 folder.children 补齐缺失项。
      const shownNames = view.getSortedFolderItems(folder).map((item) => item.file.name).filter((name) => !isInternalName(name));
      const names = [];
      const seen = new Set();
      for (const name of shownNames) {
        if (source !== destination || name !== file.name) {
          if (!seen.has(name)) { seen.add(name); names.push(name) }
        }
      }
      for (const child of folder.children) {
        if (isInternalName(child.name)) continue;
        if (child.name === file.name && source === destination) continue;
        if (child.name === file.name) continue;
        if (seen.has(child.name)) continue;
        seen.add(child.name);
        names.push(child.name);
      }
      const nextPath = childPath(destination, file.name);
      if (source !== destination) {
        if (this.app.vault.getAbstractFileByPath(nextPath) || await this.app.vault.adapter.exists(nextPath))
          throw new Error("collision");
        originalPath = path;
        this.ownRenames.set(path, nextPath);
        try {
          await this.app.fileManager.renameFile(file, nextPath);
          movedFile = file;
        } finally {
          this.ownRenames.delete(path);
        }
      }
      // 方案 2 的开关：拖进按规则排序的文件夹时，按用户设置把它切成自定义排序，
      // 位置才保得住。
      const switchedToCustom = !sameFolder && destMode !== "custom" && this.settings.autoCustomOnDrop === true;
      await this.store.update((order, settings) => {
        if (source !== destination) {
          order = renameOrder(order, path, nextPath);
          settings.excluded = renameExclusions(settings.excluded, path, nextPath);
          settings.folderSettings = renameFolderSettings(settings.folderSettings, path, nextPath);
        }
        // 只有自定义排序才写手动顺序：按规则排序的文件夹写了也没人读，
        // 攒在 data.json 里只是垃圾数据（2026-10-22）。
        if (destMode === "custom" || switchedToCustom) {
          const ordered = sortItems(names, order[destination], (name) => name);
          const before = target.beforeId ? baseName(target.beforeId) : null;
          //aio-explorer 修复：before 不在列表里时不再直接报错（改为追加到末尾），
          // 避免跨文件夹/折叠目录下拖拽时弹出「拖拽期间列表发生变化」。
          let index = before === null ? ordered.length : ordered.indexOf(before);
          if (index < 0) index = ordered.length;
          ordered.splice(index, 0, file.name);
          order[destination] = ordered;
        }
        return order;
      });
      // 放在 rename + 落盘之后：万一失败，不会留下"模式被改了但文件没动"的中间态。
      if (switchedToCustom) {
        await this.patchFolder(destination, { sortOrder: "custom" });
        new import_obsidian4.Notice(this.t("movedAutoCustom"), 2500);
      } else if (!sameFolder && destMode !== "custom") {
        new import_obsidian4.Notice(this.t("movedByRule"), 2500);
      } else {
        new import_obsidian4.Notice(this.t("moved"), 1500);
      }
      this.refresh();
    } catch (error) {
      let failure = error;
      if (movedFile) {
        const from = movedFile.path;
        this.ownRenames.set(from, originalPath);
        try {
          await this.app.fileManager.renameFile(movedFile, originalPath);
        } catch (rollbackError) {
          console.error("[Aio Explorer] rollback", rollbackError);
          failure = new Error("rollbackFailed");
        } finally {
          this.ownRenames.delete(from);
        }
      }
      this.report(failure);
      this.refresh();
    } finally {
      this.busy = false;
    }
  }
};

/* nosourcemap */

// ===== aio-explorer 模块：文件置顶 =====
// 由 folder-pin-view-src/esbuild.embed.mjs 编译 src/embed.ts 生成（IIFE，挂在 __qtPinEmbed）。
// 数据存进本插件 data.json 的 settings.pinData；受「启用笔记置顶 + 设备开关」门控。

"use strict";
var __qtPinEmbed = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/embed.ts
  var embed_exports = {};
  __export(embed_exports, {
    FolderPinModule: () => FolderPinModule,
    PIN_VIEW_TYPE: () => PIN_VIEW_TYPE,
    createFolderPinModule: () => createFolderPinModule
  });
  var import_obsidian5 = __require("obsidian");

  // src/model.ts
  var SORT_ORDERS = ["name-asc", "name-desc", "mtime-desc", "mtime-asc", "ctime-desc", "ctime-asc"];
  var record = (v) => v !== null && typeof v === "object" && !Array.isArray(v) ? v : {};
  var paths = (v) => Array.isArray(v) ? [...new Set(v.filter((p) => typeof p === "string" && p.length > 0 && p !== "/" && !p.split("/").some((s) => !s || s === "." || s === "..")))] : [];
  var zoneKey = (path) => "@" + (path != null ? path : "");
  var containsPath = (folder, path) => !folder || path === folder || path.startsWith(folder + "/");
  function normalizeData(raw) {
    var _a;
    const input = record(raw);
    const pins = paths(input.pinnedFolders);
    const active = typeof input.activeFolderPath === "string" && pins.includes(input.activeFolderPath) ? input.activeFolderPath : (_a = pins[0]) != null ? _a : null;
    const sortOrder = SORT_ORDERS.includes(input.sortOrder) ? input.sortOrder : input.sortOrder === "desc" ? "name-desc" : "name-asc";
    const data = {
      version: 4,
      pinnedFolders: pins,
      activeFolderPath: active,
      sortOrder,
      activeSubfolderPath: null,
      showSubfolderBar: input.showSubfolderBar !== false,
      subfolderOrders: /* @__PURE__ */ Object.create(null),
      language: input.language === "zh" || input.language === "en" ? input.language : "auto",
      autoReveal: input.autoReveal === true,
      zones: /* @__PURE__ */ Object.create(null)
    };
    const subfolder = paths([input.activeSubfolderPath])[0];
    if (data.showSubfolderBar && active && subfolder && directChild(active, subfolder)) data.activeSubfolderPath = subfolder;
    for (const parent of pins) {
      data.subfolderOrders[zoneKey(parent)] = paths(record(input.subfolderOrders)[zoneKey(parent)]).filter((p) => directChild(parent, p));
    }
    const merged = new Set(paths(input.expandedFolders));
    for (const state of Object.values(record(input.zones)))
      for (const path of paths(record(state).expanded)) merged.add(path);
    const savedRoot = record(record(input.zones)[zoneKey(null)]);
    const rootScroll = typeof savedRoot.scrollTop === "number" && Number.isFinite(savedRoot.scrollTop) ? Math.max(0, savedRoot.scrollTop) : 0;
    data.zones[zoneKey(null)] = { expanded: [...merged], scrollTop: rootScroll };
    return data;
  }
  function browsingPath(_data) {
    return null;
  }
  function directChild(parent, path) {
    return path.startsWith(parent + "/") && !path.slice(parent.length + 1).includes("/");
  }
  function getZone(data, path = browsingPath(data)) {
    var _a;
    return (_a = data.zones[zoneKey(path)]) != null ? _a : data.zones[zoneKey(path)] = { expanded: [], scrollTop: 0 };
  }
  function revealZone(pins, current, file) {
    if (current !== null && containsPath(current, file)) return current;
    if (!pins.length) return null;
    return pins.filter((p) => containsPath(p, file)).sort((a, b) => b.length - a.length)[0];
  }
  function ancestorPaths(file, root) {
    const parents = [];
    let path = file.slice(0, file.lastIndexOf("/"));
    if (!file.includes("/")) return parents;
    while (path && path !== root && containsPath(root, path)) {
      parents.unshift(path);
      const index = path.lastIndexOf("/");
      if (index < 0) break;
      path = path.slice(0, index);
    }
    return parents;
  }
  function remapData(data, oldPath, newPath) {
    const remap = (p) => containsPath(oldPath, p) ? newPath + p.slice(oldPath.length) : p;
    data.pinnedFolders = [...new Set(data.pinnedFolders.map(remap))];
    if (data.activeFolderPath) data.activeFolderPath = remap(data.activeFolderPath);
    if (data.activeSubfolderPath) data.activeSubfolderPath = remap(data.activeSubfolderPath);
    const orders = /* @__PURE__ */ Object.create(null);
    for (const [key, order] of Object.entries(data.subfolderOrders)) {
      const parent = remap(key.slice(1));
      orders[zoneKey(parent)] = order.map(remap).filter((p) => directChild(parent, p));
    }
    data.subfolderOrders = orders;
    if (data.activeSubfolderPath && (!data.activeFolderPath || !directChild(data.activeFolderPath, data.activeSubfolderPath))) data.activeSubfolderPath = null;
    const zones = /* @__PURE__ */ Object.create(null);
    for (const [key, state] of Object.entries(data.zones)) {
      const root = remap(key.slice(1)) || null;
      zones[zoneKey(root)] = { ...state, expanded: state.expanded.map(remap).filter((p) => containsPath(root, p) && p !== root) };
    }
    data.zones = zones;
  }
  function removePath(data, path) {
    var _a, _b;
    const oldIndex = data.pinnedFolders.indexOf((_a = data.activeFolderPath) != null ? _a : "");
    data.pinnedFolders = data.pinnedFolders.filter((p) => !containsPath(path, p));
    if (data.activeFolderPath && containsPath(path, data.activeFolderPath))
      data.activeFolderPath = (_b = data.pinnedFolders[Math.min(oldIndex, data.pinnedFolders.length - 1)]) != null ? _b : null;
    if (data.activeSubfolderPath && (containsPath(path, data.activeSubfolderPath) || !data.activeFolderPath || !directChild(data.activeFolderPath, data.activeSubfolderPath))) data.activeSubfolderPath = null;
    for (const [key, order] of Object.entries(data.subfolderOrders)) {
      if (containsPath(path, key.slice(1))) delete data.subfolderOrders[key];
      else data.subfolderOrders[key] = order.filter((p) => !containsPath(path, p));
    }
    for (const [key, zone] of Object.entries(data.zones)) {
      if (containsPath(path, key.slice(1))) delete data.zones[key];
      else zone.expanded = zone.expanded.filter((p) => !containsPath(path, p));
    }
  }
  function comparator(order, locale) {
    const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
    const nameCompare = (a, b) => collator.compare(a.name, b.name) || a.name.localeCompare(b.name);
    return (a, b) => {
      var _a, _b;
      if (a.folder !== b.folder) return a.folder ? -1 : 1;
      if (a.folder || order.startsWith("name")) return nameCompare(a, b) * (order === "name-desc" ? -1 : 1);
      const field = order.startsWith("mtime") ? "mtime" : "ctime";
      const diff = ((_a = a[field]) != null ? _a : 0) - ((_b = b[field]) != null ? _b : 0);
      return (order.endsWith("desc") ? -diff : diff) || nameCompare(a, b);
    };
  }
  function validName(name) {
    return !!name && name === name.trim() && !/[<>:"/\\|?*]/.test(name) && ![...name].some((character) => character.charCodeAt(0) < 32) && !/[. ]$/.test(name) && name !== "." && name !== ".." && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name);
  }
  function entryPath(parent, name, extension = "") {
    const suffix = extension && !name.toLowerCase().endsWith("." + extension.toLowerCase()) ? "." + extension : "";
    return (parent && parent !== "/" ? parent + "/" : "") + name + suffix;
  }

  // src/i18n.ts
  var en = {
    searchFolder: "Search current folder",
    searchUnavailable: "Enable the Search core plugin to search this folder.",
    searchNoFolder: "Select a folder to search.",
    nativeDragUnavailable: "Native file dragging is unavailable in this Obsidian version.",
    selectionMode: "Select multiple items",
    selectionCount: "Selected",
    selectionDone: "Done",
    openSelected: "Open selected files in new tabs",
    subfolders: "Subfolders",
    showSubfolderBar: "Show subfolder shortcuts",
    showSubfolderBarDesc: "Show a second row of draggable shortcuts for direct subfolders. Click the parent tab to return to its full contents.",
    moveSelected: "Move selected items",
    chooseFolder: "Choose a destination folder",
    moveProgress: "Items moved",
    title: "Folder Pin View",
    newNote: "New note",
    newFolder: "New folder",
    sort: "Change sort order",
    autoReveal: "Auto-reveal active file",
    expand: "Expand all",
    collapse: "Collapse all",
    pin: "Pin folder",
    unpin: "Unpin folder",
    rename: "Rename",
    delete: "Delete",
    deleteSelected: "Delete selected",
    openTab: "Open in new tab",
    empty: "This folder is empty",
    pinHint: "Right-click a folder in the file explorer to pin it here.",
    untitled: "Untitled",
    untitledFolder: "Untitled folder",
    invalidName: "Enter a valid name without path separators or reserved characters.",
    exists: "An item with this name already exists.",
    missing: "This file or folder no longer exists.",
    invalidMove: "A folder cannot be moved into itself or one of its subfolders.",
    operationFailed: "Operation failed",
    saveFailed: "Could not save Folder Pin View settings.",
    editHint: "Enter to save \xB7 Esc to cancel",
    language: "Language",
    followApp: "Follow Obsidian",
    languageDesc: "Applies to this plugin. Native dialogs follow Obsidian.",
    autoRevealDesc: "Follow the active note within pinned folders. Notes outside them leave this view unchanged.",
    openView: "Open folder regions",
    reveal: "Reveal active file",
    regions: "Folder regions",
    files: "Files",
    vault: "Vault",
    "name-asc": "File name (A\u2013Z)",
    "name-desc": "File name (Z\u2013A)",
    "mtime-desc": "Modified time (new to old)",
    "mtime-asc": "Modified time (old to new)",
    "ctime-desc": "Created time (new to old)",
    "ctime-asc": "Created time (old to new)"
  };
  var zh = {
    searchFolder: "\u641C\u7D22\u5F53\u524D\u6587\u4EF6\u5939",
    searchUnavailable: "\u8BF7\u542F\u7528\u201C\u641C\u7D22\u201D\u6838\u5FC3\u63D2\u4EF6\u540E\u641C\u7D22\u6B64\u6587\u4EF6\u5939\u3002",
    searchNoFolder: "\u8BF7\u9009\u62E9\u8981\u641C\u7D22\u7684\u6587\u4EF6\u5939\u3002",
    nativeDragUnavailable: "\u5F53\u524D Obsidian \u7248\u672C\u65E0\u6CD5\u4F7F\u7528\u539F\u751F\u6587\u4EF6\u62D6\u653E\u3002",
    selectionMode: "\u591A\u9009\u6A21\u5F0F",
    selectionCount: "\u5DF2\u9009",
    selectionDone: "\u5B8C\u6210",
    openSelected: "\u5728\u65B0\u6807\u7B7E\u9875\u6253\u5F00\u6240\u9009\u6587\u4EF6",
    subfolders: "\u5B50\u6587\u4EF6\u5939\u5207\u6362",
    showSubfolderBar: "\u663E\u793A\u5B50\u6587\u4EF6\u5939\u5FEB\u6377\u680F",
    showSubfolderBarDesc: "\u663E\u793A\u53EF\u62D6\u52A8\u6392\u5E8F\u7684\u76F4\u63A5\u5B50\u6587\u4EF6\u5939\u5FEB\u6377\u680F\u3002\u70B9\u51FB\u7B2C\u4E00\u6392\u7236\u6587\u4EF6\u5939\uFF0C\u8FD4\u56DE\u5176\u5B8C\u6574\u5185\u5BB9\u3002",
    moveSelected: "\u79FB\u52A8\u6240\u9009\u9879\u76EE",
    chooseFolder: "\u9009\u62E9\u76EE\u6807\u6587\u4EF6\u5939",
    moveProgress: "\u5DF2\u79FB\u52A8\u9879\u76EE",
    title: "\u6587\u4EF6\u533A",
    newNote: "\u65B0\u5EFA\u7B14\u8BB0",
    newFolder: "\u65B0\u5EFA\u6587\u4EF6\u5939",
    sort: "\u66F4\u6539\u6392\u5E8F\u65B9\u5F0F",
    autoReveal: "\u81EA\u52A8\u663E\u793A\u5F53\u524D\u6587\u4EF6",
    expand: "\u5168\u90E8\u5C55\u5F00",
    collapse: "\u5168\u90E8\u6298\u53E0",
    pin: "\u56FA\u5B9A\u6587\u4EF6\u5939",
    unpin: "\u53D6\u6D88\u56FA\u5B9A",
    rename: "\u91CD\u547D\u540D",
    delete: "\u5220\u9664",
    deleteSelected: "\u5220\u9664\u6240\u9009\u9879\u76EE",
    openTab: "\u5728\u65B0\u6807\u7B7E\u9875\u4E2D\u6253\u5F00",
    empty: "\u6B64\u6587\u4EF6\u5939\u4E3A\u7A7A",
    pinHint: "\u5728\u6587\u4EF6\u5217\u8868\u4E2D\u53F3\u952E\u6587\u4EF6\u5939\uFF0C\u5373\u53EF\u5C06\u5B83\u56FA\u5B9A\u5230\u8FD9\u91CC\u3002",
    untitled: "\u672A\u547D\u540D",
    untitledFolder: "\u672A\u547D\u540D\u6587\u4EF6\u5939",
    invalidName: "\u8BF7\u8F93\u5165\u6709\u6548\u540D\u79F0\uFF0C\u4E0D\u5305\u542B\u8DEF\u5F84\u5206\u9694\u7B26\u6216\u4FDD\u7559\u5B57\u7B26\u3002",
    exists: "\u5DF2\u5B58\u5728\u540C\u540D\u6587\u4EF6\u6216\u6587\u4EF6\u5939\u3002",
    missing: "\u6B64\u6587\u4EF6\u6216\u6587\u4EF6\u5939\u5DF2\u4E0D\u5B58\u5728\u3002",
    invalidMove: "\u4E0D\u80FD\u5C06\u6587\u4EF6\u5939\u79FB\u5165\u81EA\u8EAB\u6216\u5176\u5B50\u6587\u4EF6\u5939\u3002",
    operationFailed: "\u64CD\u4F5C\u5931\u8D25",
    saveFailed: "\u65E0\u6CD5\u4FDD\u5B58\u6587\u4EF6\u533A\u8BBE\u7F6E\u3002",
    editHint: "Enter \u4FDD\u5B58 \xB7 Esc \u53D6\u6D88",
    language: "\u754C\u9762\u8BED\u8A00",
    followApp: "\u8DDF\u968F Obsidian",
    languageDesc: "\u9002\u7528\u4E8E\u672C\u63D2\u4EF6\uFF1B\u539F\u751F\u5BF9\u8BDD\u6846\u8DDF\u968F Obsidian \u7684\u8BED\u8A00\u3002",
    autoRevealDesc: "\u5728\u5DF2\u56FA\u5B9A\u7684\u6587\u4EF6\u533A\u5185\u8DDF\u968F\u5F53\u524D\u7B14\u8BB0\uFF1B\u5176\u4ED6\u4F4D\u7F6E\u7684\u7B14\u8BB0\u4E0D\u4F1A\u6539\u53D8\u6B64\u89C6\u56FE\u3002",
    openView: "\u6253\u5F00\u6587\u4EF6\u533A",
    reveal: "\u663E\u793A\u5F53\u524D\u6587\u4EF6",
    regions: "\u6587\u4EF6\u533A\u5207\u6362",
    files: "\u6587\u4EF6\u5217\u8868",
    vault: "\u4ED3\u5E93",
    "name-asc": "\u6587\u4EF6\u540D\uFF08A\u2013Z\uFF09",
    "name-desc": "\u6587\u4EF6\u540D\uFF08Z\u2013A\uFF09",
    "mtime-desc": "\u4FEE\u6539\u65F6\u95F4\uFF08\u4ECE\u65B0\u5230\u65E7\uFF09",
    "mtime-asc": "\u4FEE\u6539\u65F6\u95F4\uFF08\u4ECE\u65E7\u5230\u65B0\uFF09",
    "ctime-desc": "\u521B\u5EFA\u65F6\u95F4\uFF08\u4ECE\u65B0\u5230\u65E7\uFF09",
    "ctime-asc": "\u521B\u5EFA\u65F6\u95F4\uFF08\u4ECE\u65E7\u5230\u65B0\uFF09"
  };
  function resolveLanguage(language, appLanguage) {
    return language === "auto" ? appLanguage.toLowerCase().startsWith("zh") ? "zh" : "en" : language;
  }
  function translate(language, key) {
    // 缺键兜底（2026-10-22）：中文表里某个键漏了，就退回英文；
    // 英文也没有才显示键名本身 —— 界面上永远不该出现 "undefined"。
    const table = language === "zh" ? zh : en;
    const value = table[key];
    if (value !== void 0) return value;
    const fallback = en[key];
    return fallback !== void 0 ? fallback : key;
  }

  // src/view.ts
  var import_obsidian4 = __require("obsidian");

  // src/create.ts
  var reservations = /* @__PURE__ */ new WeakMap();
  async function createUntitled(vault, parent, folder, name) {
    let pending = reservations.get(vault);
    if (!pending) reservations.set(vault, pending = /* @__PURE__ */ new Set());
    for (let suffix = 0; ; suffix++) {
      if (vault.getAbstractFileByPath(parent.path) !== parent) throw new Error("Parent folder no longer exists.");
      const path = entryPath(parent.path, name + (suffix ? ` ${suffix}` : ""), folder ? "" : "md");
      if (pending.has(path) || vault.getAbstractFileByPath(path)) continue;
      pending.add(path);
      try {
        return folder ? await vault.createFolder(path) : await vault.create(path, "");
      } catch (error) {
        if (!vault.getAbstractFileByPath(path)) throw error;
      } finally {
        pending.delete(path);
      }
    }
  }

  // src/move.ts
  var import_obsidian = __require("obsidian");
  function planMove(vault, paths2, target) {
    if (vault.getAbstractFileByPath(target.path) !== target) return { moves: [], error: "missing" };
    const selected = [...new Set(paths2)];
    const roots = selected.filter((path) => !selected.some((other) => other !== path && containsPath(other, path)));
    const moves = [];
    const destinations = /* @__PURE__ */ new Set();
    for (const path of roots) {
      const file = vault.getAbstractFileByPath(path);
      if (!file) return { moves: [], error: "missing" };
      if (file instanceof import_obsidian.TFolder && containsPath(file.path, target.path)) return { moves: [], error: "invalidMove" };
      if (file.parent === target) continue;
      const destination = entryPath(target.path, file.name);
      const key = destination.normalize("NFC").toLocaleLowerCase();
      if (destinations.has(key) || target.children.some((child) => child.name.normalize("NFC").toLocaleLowerCase() === file.name.normalize("NFC").toLocaleLowerCase()))
        return { moves: [], error: "exists" };
      destinations.add(key);
      moves.push({ file, from: path, path: destination });
    }
    return { moves };
  }

  // src/move-picker.ts
  var import_obsidian2 = __require("obsidian");
  var MoveFolderModal = class extends import_obsidian2.FuzzySuggestModal {
    constructor(app, paths2, rootLabel, placeholder, choose) {
      super(app);
      this.paths = paths2;
      this.rootLabel = rootLabel;
      this.choose = choose;
      this.setPlaceholder(placeholder);
    }
    getItems() {
      return [.../* @__PURE__ */ new Set([this.app.vault.getRoot(), ...this.app.vault.getAllLoadedFiles()])].filter((file) => file instanceof import_obsidian2.TFolder).filter((folder) => {
        const plan = planMove(this.app.vault, this.paths, folder);
        return !plan.error && plan.moves.length > 0;
      }).sort((a, b) => a.path.localeCompare(b.path, void 0, { numeric: true }));
    }
    getItemText(folder) {
      return folder.isRoot() ? this.rootLabel : folder.path;
    }
    onChooseItem(folder) {
      this.choose(folder);
    }
  };

  // src/native.ts
  var import_obsidian3 = __require("obsidian");
  var FILE_MENU_SOURCE = "file-explorer-context-menu";
  function startNativeDrag(app, event, files, elements) {
    var _a;
    const manager = app.dragManager;
    if (!event.dataTransfer || !files.length || !manager || typeof manager.onDragStart !== "function" || typeof manager.onDragEnd !== "function" || typeof manager.dragFiles !== "function" || typeof manager.dragFile !== "function" || typeof manager.dragFolder !== "function") return null;
    const first = files[0];
    const payload = files.length > 1 ? manager.dragFiles(event, files) : first instanceof import_obsidian3.TFile ? manager.dragFile(event, first) : manager.dragFolder(event, first);
    if (!payload) return null;
    try {
      (_a = manager.updateSource) == null ? void 0 : _a.call(manager, elements, "is-being-dragged");
      manager.onDragStart(event, payload);
    } catch (error) {
      if (manager.draggable === payload) manager.onDragEnd();
      throw error;
    }
    return () => {
      if (manager.draggable === payload) manager.onDragEnd();
    };
  }
  function searchAvailable(app) {
    const plugins = app.internalPlugins;
    return !!plugins && typeof plugins.getEnabledPluginById === "function" && !!plugins.getEnabledPluginById("global-search");
  }
  function folderSearchQuery(path) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    return `path:/^${escaped}\\// ()`;
  }
  async function openFolderSearch(app, path) {
    const query = folderSearchQuery(path);
    const leaf = await app.workspace.ensureSideLeaf("search", "left", { active: true, reveal: true, state: { query } });
    const input = leaf.view.containerEl.querySelector(".search-row input");
    if (input && input.value === query) {
      input.focus();
      input.setSelectionRange(query.length - 1, query.length - 1);
    }
  }

  // src/view.ts
  var VIEW_TYPE = "000folder-pin-view";
  function instanceViewType(type) {
    return type || VIEW_TYPE;
  }
  var nextLabelId = 0;
  var FolderPinView = class extends import_obsidian4.ItemView {
    constructor(leaf, plugin, viewType = VIEW_TYPE) {
      super(leaf);
      this.plugin = plugin;
      this.viewType = viewType;
      this.subfolderSignature = "";
      this.subfolderDrag = null;
      this.moving = false;
      this.containerLabels = [];
      this.pinSignature = "";
      this.rows = /* @__PURE__ */ new Map();
      this.visible = [];
      this.focusedPath = null;
      this.selectedPaths = /* @__PURE__ */ new Set();
      this.selectionAnchor = null;
      this.selectionMode = false;
      this.renderedZone = null;
      this.lastActive = null;
      this.dragPath = null;
      this.fileDrag = null;
      this.endNativeDrag = null;
      this.editor = null;
      this.creationId = 0;
      this.openingPath = null;
      this.deletingPaths = /* @__PURE__ */ new Set();
      this.closed = false;
      this.lastLanguage = "";
      this.t = (key) => this.plugin.t(key);
    }
    get data() {
      return this.plugin.data;
    }
    getViewType() {
      return instanceViewType(this.viewType);
    }
    getDisplayText() {
      return this.t("title");
    }
    getIcon() {
      return "pin";
    }
    async onOpen() {
      this.closed = false;
      this.contentEl.empty();
      this.contentEl.addClass("fpv-root");
      this.toolbar = this.contentEl.createDiv({ cls: "nav-header fpv-toolbar", attr: { role: "toolbar" } });
      this.pinBar = this.contentEl.createDiv({ cls: "fpv-bar", attr: { role: "tablist" } });
      this.subfolderBar = this.contentEl.createDiv({ cls: "fpv-bar fpv-subfolder-bar", attr: { role: "tablist" } });
      this.selectionBar = this.contentEl.createDiv({ cls: "fpv-selection-bar", attr: { hidden: "" } });
      this.selectionLabel = this.selectionBar.createSpan({ attr: { role: "status", "aria-live": "polite" } });
      this.selectionDone = this.selectionBar.createEl("button", { attr: { type: "button" } });
      this.selectionDone.addEventListener("click", () => this.toggleSelectionMode(false));
      this.tree = this.contentEl.createDiv({ cls: "fpv-tree", attr: { role: "tree", tabindex: "0" } });
      this.containerLabels = [];
      for (const [container, key] of [[this.toolbar, "title"], [this.pinBar, "regions"], [this.subfolderBar, "subfolders"], [this.tree, "files"]]) {
        const id = `fpv-label-${++nextLabelId}`;
        const label = this.contentEl.createSpan({ attr: { id, hidden: "" } });
        container.setAttribute("aria-labelledby", id);
        this.containerLabels.push({ el: label, key });
      }
      this.registerDomEvent(this.tree, "scroll", () => {
        this.captureScroll();
        this.plugin.persist();
      });
      this.registerDomEvent(this.tree, "keydown", (event) => this.onTreeKey(event));
      this.registerDomEvent(this.tree, "contextmenu", (event) => {
        if (event.target === this.tree || event.target.closest(".fpv-empty")) {
          event.preventDefault();
          const menu = this.creationMenu(new import_obsidian4.Menu(), this.rootPath());
          const folder = this.rootFolder();
          if (folder) this.plugin.extendFileMenu(menu, folder);
          this.selectionMenu(menu).showAtMouseEvent(event);
        }
      });
      this.localize();
      if (this.data.autoReveal) this.revealActive();
    }
    async onClose() {
      this.creationId++;
      this.captureScroll();
      this.closed = true;
      this.clearFileDrag();
      if (this.frame !== void 0) this.contentEl.win.cancelAnimationFrame(this.frame);
      this.cancelEditor();
      this.plugin.flushSave();
    }
    onResize() {
      this.schedulePinReveal();
    }
    localize() {
      if (!this.tree) return;
      this.lastLanguage = this.plugin.language;
      this.containerLabels.forEach(({ el, key }) => el.setText(this.t(key)));
      this.buildToolbar();
      // 2026-10-22：侧栏标题来自 getDisplayText()，Obsidian 只在需要时才重算，
      // 语言一切换得主动喊它更新，否则标题栏还挂着旧语言的文字。
      try {
        this.leaf?.updateHeader?.();
      } catch (error) {
        console.debug("[Aio Explorer][\u7B14\u8BB0\u7F6E\u9876] \u6807\u9898\u5237\u65B0\u5931\u8D25", error);
      }
      this.sync();
    }
    sync() {
      var _a;
      if (!this.tree || this.closed) return;
      if (this.lastLanguage !== this.plugin.language) {
        this.localize();
        return;
      }
      this.validateSubfolder();
      if (this.renderedZone !== zoneKey(browsingPath(this.data)) && !((_a = this.editor) == null ? void 0 : _a.busy)) {
        this.creationId++;
        this.cancelEditor();
      }
      this.renderPins();
      this.renderTree(false);
    }
    tool(icon, key, handler) {
      const button = this.toolbar.createEl("button", { cls: "clickable-icon nav-action-button fpv-tool", attr: { type: "button" } });
      (0, import_obsidian4.setIcon)(button, icon);
      (0, import_obsidian4.setTooltip)(button, this.t(key));
      button.addEventListener("click", handler);
      return button;
    }
    buildToolbar() {
      this.toolbar.empty();
      this.tool("square-pen", "newNote", () => {
        void this.startCreate(false, this.rootPath());
      });
      this.tool("folder-plus", "newFolder", () => {
        void this.startCreate(true, this.rootPath());
      });
      const sort = this.tool("arrow-up-narrow-wide", "sort", () => {
        const menu = new import_obsidian4.Menu();
        SORT_ORDERS.forEach((order, index) => {
          if (index === 2 || index === 4) menu.addSeparator();
          menu.addItem((item) => item.setTitle(this.t(order)).setChecked(this.data.sortOrder === order).onClick(() => {
            this.data.sortOrder = order;
            this.plugin.persist();
            this.plugin.views().forEach((view) => view.renderTree());
          }));
        });
        const rect = sort.getBoundingClientRect();
        menu.showAtPosition({ x: rect.left, y: rect.bottom });
      });
      this.followButton = this.tool("gallery-vertical", "autoReveal", () => {
        this.data.autoReveal = !this.data.autoReveal;
        this.plugin.persist();
        this.plugin.views().forEach((view) => {
          view.updateToolbar();
          if (this.data.autoReveal) view.revealActive();
        });
      });
      this.collapseButton = this.tool("chevrons-up-down", "expand", () => this.toggleAll());
      this.searchButton = this.tool("search", "searchFolder", () => {
        void this.searchFolder();
      });
      this.updateToolbar();
    }
    updateToolbar() {
      if (!this.collapseButton) return;
      this.followButton.toggleClass("is-active", this.data.autoReveal);
      this.followButton.setAttribute("aria-pressed", String(this.data.autoReveal));
      const hasExpanded = getZone(this.data).expanded.length > 0;
      (0, import_obsidian4.setIcon)(this.collapseButton, hasExpanded ? "chevrons-down-up" : "chevrons-up-down");
      (0, import_obsidian4.setTooltip)(this.collapseButton, this.t(hasExpanded ? "collapse" : "expand"));
      const path = this.rootPath();
      this.searchButton.disabled = !path || !this.rootFolder();
      (0, import_obsidian4.setTooltip)(this.searchButton, path ? `${this.t("searchFolder")}: ${path}` : this.t("searchNoFolder"));
      this.updateSelectionBar();
    }
    async searchFolder() {
      const folder = this.rootFolder();
      if (!folder || folder.isRoot()) {
        new import_obsidian4.Notice(this.t("searchNoFolder"));
        return;
      }
      if (!searchAvailable(this.app)) {
        new import_obsidian4.Notice(this.t("searchUnavailable"));
        return;
      }
      try {
        await openFolderSearch(this.app, folder.path);
      } catch (error) {
        this.reportError(error);
      }
    }
    toggleSelectionMode(enabled = !this.selectionMode) {
      this.selectionMode = enabled;
      this.selectedPaths.clear();
      this.selectionAnchor = null;
      this.updateSelection();
      this.tree.focus({ preventScroll: true });
    }
    updateSelectionBar() {
      if (!this.selectionBar) return;
      this.selectionBar.hidden = !this.selectionMode && this.selectedPaths.size < 2;
      this.selectionLabel.setText(`${this.selectionMode ? this.t("selectionMode") + " \xB7 " : ""}${this.t("selectionCount")} ${this.selectedPaths.size}`);
      this.selectionDone.setText(this.t("selectionDone"));
    }
    selectionMenu(menu) {
      menu.addSeparator();
      return menu.addItem((item) => item.setTitle(this.t("selectionMode")).setIcon("list-checks").setChecked(this.selectionMode).onClick(() => this.toggleSelectionMode()));
    }
    rootPath() {
      var _a, _b;
      return (_b = (_a = this.scopeFolder()) == null ? void 0 : _a.path) != null ? _b : "";
    }
    rootFolder() {
      const root = this.rootPath() ? this.app.vault.getAbstractFileByPath(this.rootPath()) : this.app.vault.getRoot();
      return root instanceof import_obsidian4.TFolder ? root : null;
    }
    // With the unified tree there is no separate browsing region: creation and
    // search follow the focused row (or its parent folder), like the native explorer.
    scopeFolder() {
      const focused = this.focusedPath ? this.app.vault.getAbstractFileByPath(this.focusedPath) : null;
      const candidate = focused instanceof import_obsidian4.TFolder ? focused : focused == null ? void 0 : focused.parent;
      if (candidate instanceof import_obsidian4.TFolder && !candidate.isRoot()) return candidate;
      const first = this.data.pinnedFolders.length ? this.app.vault.getAbstractFileByPath(this.data.pinnedFolders[0]) : null;
      return first instanceof import_obsidian4.TFolder ? first : null;
    }
    renderPins() {
      var _a;
      const signature = JSON.stringify([this.data.pinnedFolders, this.plugin.language]);
      if (signature !== this.pinSignature) {
        const scroll = this.pinBar.scrollTop;
        const hadFocus = this.pinBar.contains(this.contentEl.doc.activeElement);
        this.pinBar.empty();
        this.pinSignature = signature;
        this.data.pinnedFolders.forEach((path) => {
          const button = this.pinBar.createEl("button", {
            cls: "fpv-pin",
            text: path.split("/").pop() || path,
            attr: { type: "button", role: "tab", draggable: "true", "data-path": path, "aria-label": path }
          });
          (0, import_obsidian4.setTooltip)(button, path);
          button.addEventListener("click", () => this.selectRegion(path));
          button.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            new import_obsidian4.Menu().addItem((item) => item.setTitle(this.t("unpin")).setIcon("pin-off").onClick(() => {
              void this.plugin.setPinned(path, false);
            })).showAtMouseEvent(event);
          });
          button.addEventListener("keydown", (event) => {
            var _a2;
            const pins = this.data.pinnedFolders;
            let index = pins.indexOf(path);
            if (event.key === "ArrowUp") index = (index + pins.length - 1) % pins.length;
            else if (event.key === "ArrowDown") index = (index + 1) % pins.length;
            else if (event.key === "Home") index = 0;
            else if (event.key === "End") index = pins.length - 1;
            else return;
            event.preventDefault();
            this.selectRegion(pins[index]);
            (_a2 = this.activePin()) == null ? void 0 : _a2.focus({ preventScroll: true });
          });
          button.addEventListener("dragstart", (event) => {
            var _a2;
            if (this.editor || this.moving) {
              event.preventDefault();
              return;
            }
            this.clearFileDrag();
            this.subfolderDrag = null;
            this.dragPath = path;
            button.addClass("is-dragging");
            (_a2 = event.dataTransfer) == null ? void 0 : _a2.setData("text/plain", path);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          });
          button.addEventListener("dragend", () => {
            this.dragPath = null;
            this.pinBar.querySelectorAll(".is-dragging, .drag-over").forEach((el) => el.classList.remove("is-dragging", "drag-over"));
          });
          button.addEventListener("dragover", (event) => {
            if (this.fileDrag) return;
            if (!this.dragPath || this.dragPath === path) return;
            event.preventDefault();
            button.addClass("drag-over");
          });
          button.addEventListener("dragleave", () => button.removeClass("drag-over"));
          button.addEventListener("drop", (event) => {
            var _a2;
            if (this.fileDrag) return;
            event.preventDefault();
            const from = this.data.pinnedFolders.indexOf((_a2 = this.dragPath) != null ? _a2 : "");
            const to = this.data.pinnedFolders.indexOf(path);
            this.dragPath = null;
            button.removeClass("drag-over");
            if (from < 0 || to < 0 || from === to) return;
            const [moved] = this.data.pinnedFolders.splice(from, 1);
            this.data.pinnedFolders.splice(to, 0, moved);
            this.plugin.persist();
            this.plugin.refreshViews();
          });
          this.attachMoveTarget(button, () => this.app.vault.getAbstractFileByPath(path));
        });
        this.pinBar.scrollTop = scroll;
        this.updatePinSelection();
        if (hadFocus) (_a = this.activePin()) == null ? void 0 : _a.focus({ preventScroll: true });
      } else this.updatePinSelection();
      this.pinBar.hidden = true;
      this.renderSubfolders();
    }
    validateSubfolder() {
      var _a;
      const path = this.data.activeSubfolderPath;
      if (path && (!this.data.showSubfolderBar || !this.data.activeFolderPath || !directChild(this.data.activeFolderPath, path) || !(this.app.vault.getAbstractFileByPath(path) instanceof import_obsidian4.TFolder))) {
        this.captureScroll();
        this.data.activeSubfolderPath = null;
        this.creationId++;
        if (!((_a = this.editor) == null ? void 0 : _a.busy)) this.cancelEditor();
        this.selectedPaths.clear();
        this.selectionMode = false;
        this.selectionAnchor = null;
        this.focusedPath = null;
        this.plugin.persist();
      }
    }
    renderSubfolders() {
      var _a, _b, _c;
      const parent = this.data.activeFolderPath;
      const folder = parent ? this.app.vault.getAbstractFileByPath(parent) : null;
      const children = folder instanceof import_obsidian4.TFolder ? folder.children.filter((file) => file instanceof import_obsidian4.TFolder) : [];
      const names = comparator("name-asc", this.plugin.language === "zh" ? "zh-CN" : "en");
      const paths2 = children.sort((a, b) => names({ name: a.name, folder: true }, { name: b.name, folder: true })).map((file) => file.path);
      const saved = parent ? (_a = this.data.subfolderOrders[zoneKey(parent)]) != null ? _a : [] : [];
      const order = [...saved.filter((path) => paths2.includes(path)), ...paths2.filter((path) => !saved.includes(path))];
      const signature = JSON.stringify([parent, this.data.showSubfolderBar, order, this.plugin.language]);
      if (signature !== this.subfolderSignature) {
        const sameParent = this.subfolderBar.dataset.parent === (parent != null ? parent : "");
        const scroll = sameParent ? this.subfolderBar.scrollTop : 0;
        const hadFocus = this.subfolderBar.contains(this.contentEl.doc.activeElement);
        const focusedTab = hadFocus && sameParent ? this.contentEl.doc.activeElement.dataset.path : null;
        this.subfolderBar.empty();
        this.subfolderBar.dataset.parent = parent != null ? parent : "";
        this.subfolderSignature = signature;
        if (this.data.showSubfolderBar && parent) for (const path of order) {
          const button = this.subfolderBar.createEl("button", {
            cls: "fpv-pin fpv-subfolder",
            text: path.split("/").pop(),
            attr: { type: "button", role: "tab", draggable: "true", "data-path": path }
          });
          (0, import_obsidian4.setTooltip)(button, path);
          button.addEventListener("click", () => this.selectSubfolder(path));
          button.addEventListener("keydown", (event) => {
            var _a2, _b2;
            let index = order.indexOf(path);
            if (event.key === "ArrowUp") index = (index + order.length - 1) % order.length;
            else if (event.key === "ArrowDown") index = (index + 1) % order.length;
            else if (event.key === "Home") index = 0;
            else if (event.key === "End") index = order.length - 1;
            else if (event.key === "Escape") {
              event.preventDefault();
              this.selectRegion(parent);
              (_a2 = this.activePin()) == null ? void 0 : _a2.focus();
              return;
            } else return;
            event.preventDefault();
            this.selectSubfolder(order[index]);
            (_b2 = this.subfolderBar.querySelector(".is-active")) == null ? void 0 : _b2.focus({ preventScroll: true });
          });
          button.addEventListener("dragstart", (event) => {
            var _a2;
            if (this.editor || this.moving) {
              event.preventDefault();
              return;
            }
            this.clearFileDrag();
            this.dragPath = null;
            this.subfolderDrag = { parent, path };
            button.addClass("is-dragging");
            (_a2 = event.dataTransfer) == null ? void 0 : _a2.setData("text/plain", path);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          });
          button.addEventListener("dragend", () => {
            this.subfolderDrag = null;
            this.subfolderBar.querySelectorAll(".is-dragging, .drag-over").forEach((el) => el.classList.remove("is-dragging", "drag-over"));
          });
          button.addEventListener("dragover", (event) => {
            var _a2;
            if (!this.fileDrag && ((_a2 = this.subfolderDrag) == null ? void 0 : _a2.parent) === parent && this.subfolderDrag.path !== path) {
              event.preventDefault();
              button.addClass("drag-over");
            }
          });
          button.addEventListener("dragleave", () => button.removeClass("drag-over"));
          button.addEventListener("drop", (event) => {
            if (this.fileDrag) return;
            const source = this.subfolderDrag;
            this.subfolderDrag = null;
            button.removeClass("drag-over");
            if (!source || source.parent !== parent || source.path === path) return;
            event.preventDefault();
            const from = order.indexOf(source.path), to = order.indexOf(path);
            if (from < 0 || to < 0) return;
            const next = [...order];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            this.data.subfolderOrders[zoneKey(parent)] = next;
            this.plugin.persist();
            this.plugin.views().forEach((view) => view.renderPins());
          });
          this.attachMoveTarget(button, () => this.app.vault.getAbstractFileByPath(path));
        }
        this.subfolderBar.scrollTop = scroll;
        if (hadFocus) (_c = (_b = Array.from(this.subfolderBar.querySelectorAll(".fpv-pin")).find((button) => button.dataset.path === (focusedTab != null ? focusedTab : this.data.activeSubfolderPath))) != null ? _b : this.activePin()) == null ? void 0 : _c.focus({ preventScroll: true });
      }
      this.subfolderBar.hidden = true;
      this.subfolderBar.querySelectorAll(".fpv-pin").forEach((button, index) => {
        const active = button.dataset.path === this.data.activeSubfolderPath;
        button.toggleClass("is-active", active);
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active || !this.data.activeSubfolderPath && index === 0 ? 0 : -1;
      });
    }
    selectSubfolder(path) {
      var _a;
      if (((_a = this.editor) == null ? void 0 : _a.busy) || this.moving || !this.data.showSubfolderBar || !this.data.activeFolderPath || !directChild(this.data.activeFolderPath, path) || !(this.app.vault.getAbstractFileByPath(path) instanceof import_obsidian4.TFolder)) return;
      this.creationId++;
      this.captureScroll();
      this.cancelEditor();
      this.data.activeSubfolderPath = path;
      this.focusedPath = null;
      this.selectedPaths.clear();
      this.selectionAnchor = null;
      this.selectionMode = false;
      this.plugin.persist();
      this.plugin.refreshViews();
    }
    updatePinSelection() {
      this.pinBar.querySelectorAll(".fpv-pin").forEach((button) => {
        const selected = button.dataset.path === this.data.activeFolderPath;
        button.toggleClass("is-active", selected);
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
    }
    activePin() {
      return this.pinBar.querySelector(".fpv-pin.is-active");
    }
    schedulePinReveal() {
      if (!this.pinBar || this.closed) return;
      if (this.frame !== void 0) this.contentEl.win.cancelAnimationFrame(this.frame);
      this.frame = this.contentEl.win.requestAnimationFrame(() => {
        this.frame = void 0;
        for (const container of [this.pinBar, this.subfolderBar]) {
          const button = container.querySelector(".is-active");
          if (!button || container.hidden) continue;
          const bar = container.getBoundingClientRect();
          const rect = button.getBoundingClientRect();
          if (rect.top < bar.top) container.scrollTop -= bar.top - rect.top + 8;
          else if (rect.bottom > bar.bottom) container.scrollTop += rect.bottom - bar.bottom + 8;
        }
      });
    }
    selectRegion(path) {
      var _a;
      if (((_a = this.editor) == null ? void 0 : _a.busy) || !this.data.pinnedFolders.includes(path)) return;
      this.creationId++;
      this.captureScroll();
      this.cancelEditor();
      this.data.activeFolderPath = path;
      this.data.activeSubfolderPath = null;
      this.focusedPath = null;
      this.selectedPaths.clear();
      this.selectionMode = false;
      this.selectionAnchor = null;
      this.plugin.persist();
      this.plugin.refreshViews();
    }
    captureScroll() {
      if (!this.tree || this.renderedZone === null) return;
      const zone = this.data.zones[this.renderedZone];
      if (zone) zone.scrollTop = this.tree.scrollTop;
    }
    renderTree(capture = true) {
      var _a, _b, _c;
      if (!this.tree || this.closed || this.editor) return;
      this.validateSubfolder();
      this.renderSubfolders();
      if (capture) this.captureScroll();
      const hadFocus = this.tree.contains(this.contentEl.doc.activeElement);
      const previousIndex = this.visible.findIndex((file) => file.path === this.focusedPath);
      this.tree.empty();
      this.rows.clear();
      this.visible = [];
      this.renderedZone = zoneKey(null);
      const expanded = new Set(getZone(this.data).expanded);
      const compare = comparator(this.data.sortOrder, this.plugin.language === "zh" ? "zh-CN" : "en");
      const sortInfo = (file) => ({
        name: file.name,
        folder: file instanceof import_obsidian4.TFolder,
        mtime: file instanceof import_obsidian4.TFile ? file.stat.mtime : 0,
        ctime: file instanceof import_obsidian4.TFile ? file.stat.ctime : 0
      });
      const stack = [];
      const pushChildren = (folder, depth) => {
        const sorted = [...folder.children].sort((a, b) => compare(sortInfo(a), sortInfo(b)));
        for (let index = sorted.length - 1; index >= 0; index--)
          stack.push({ file: sorted[index], depth, index, count: sorted.length });
      };
      const pins = this.data.pinnedFolders;
      for (let pinIndex = pins.length - 1; pinIndex >= 0; pinIndex--) {
        const folder = this.app.vault.getAbstractFileByPath(pins[pinIndex]);
        if (folder instanceof import_obsidian4.TFolder) stack.push({ file: folder, depth: 0, index: pinIndex, count: pins.length });
      }
      while (stack.length) {
        const { file, depth, index, count } = stack.pop();
        this.drawRow(file, depth, index, count, expanded.has(file.path));
        if (file instanceof import_obsidian4.TFolder && expanded.has(file.path)) pushChildren(file, depth + 1);
      }
      if (!this.visible.length && pins.length) this.tree.createDiv({ cls: "fpv-empty", text: this.t("empty") });
      const visiblePaths = new Set(this.visible.map((file) => file.path));
      this.selectedPaths = new Set([...this.selectedPaths].filter((path) => visiblePaths.has(path)));
      if (this.selectionAnchor && !visiblePaths.has(this.selectionAnchor)) this.selectionAnchor = null;
      if (!this.data.pinnedFolders.length) this.tree.createDiv({ cls: "fpv-empty fpv-hint", text: this.t("pinHint") });
      this.tree.scrollTop = getZone(this.data).scrollTop;
      if (!this.focusedPath || !this.rows.has(this.focusedPath)) {
        const active = (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path;
        this.focusedPath = active && this.rows.has(active) ? active : (_c = (_b = this.visible[Math.max(0, Math.min(previousIndex, this.visible.length - 1))]) == null ? void 0 : _b.path) != null ? _c : null;
      }
      this.updateHighlight();
      this.updateSelection();
      this.updateTabStops();
      if (hadFocus) this.focusRow(this.focusedPath, false);
      this.updateToolbar();
    }
    drawRow(file, depth, index, count, expanded) {
      const folder = file instanceof import_obsidian4.TFolder;
      const row = this.tree.createDiv({
        cls: "tree-item-self fpv-row" + (folder ? " fpv-folder" : " fpv-file"),
        attr: {
          role: "treeitem",
          tabindex: "-1",
          draggable: "true",
          "data-path": file.path,
          "aria-level": String(depth + 1),
          "aria-posinset": String(index + 1),
          "aria-setsize": String(count)
        }
      });
      row.style.setProperty("--fpv-depth", String(depth));
      const arrow = row.createSpan({ cls: "fpv-arrow", attr: { "aria-hidden": "true" } });
      if (folder) {
        (0, import_obsidian4.setIcon)(arrow, "chevron-right");
        row.setAttribute("aria-expanded", String(expanded));
        arrow.addEventListener("click", (event) => {
          event.stopPropagation();
          if (this.editor) return;
          this.focusedPath = file.path;
          row.focus({ preventScroll: true });
          this.toggleFolder(file.path);
        });
      }
      row.createSpan({ cls: "fpv-name", text: file instanceof import_obsidian4.TFile && file.extension.toLowerCase() === "md" ? file.basename : file.name });
      (0, import_obsidian4.setTooltip)(row, file.path);
      this.rows.set(file.path, row);
      this.visible.push(file);
      row.addEventListener("dragstart", (event) => {
        if (this.editor || this.moving || !event.dataTransfer) {
          event.preventDefault();
          return;
        }
        this.dragPath = null;
        this.subfolderDrag = null;
        this.fileDrag = this.selectedPaths.has(file.path) ? [...this.selectedPaths] : [file.path];
        event.dataTransfer.setData("application/x-folder-pin-view", file.path);
        event.dataTransfer.effectAllowed = "move";
        const files = this.fileDrag.map((path) => this.app.vault.getAbstractFileByPath(path)).filter((entry) => entry !== null);
        const elements = this.fileDrag.map((path) => this.rows.get(path)).filter((el) => !!el);
        try {
          this.endNativeDrag = startNativeDrag(this.app, event, files, elements);
        } catch (error) {
          this.clearFileDrag();
          event.preventDefault();
          this.reportError(error);
          return;
        }
        if (!this.endNativeDrag) new import_obsidian4.Notice(this.t("nativeDragUnavailable"));
        elements.forEach((el) => el.addClass("is-dragging"));
      });
      row.addEventListener("dragend", () => this.clearFileDrag());
      if (folder) this.attachMoveTarget(row, () => this.app.vault.getAbstractFileByPath(file.path));
      row.addEventListener("focus", () => {
        this.focusedPath = file.path;
        this.updateTabStops();
      });
      row.addEventListener("click", (event) => {
        if (this.editor) return;
        this.focusedPath = file.path;
        if (event.shiftKey) {
          this.selectRange(file.path, event.ctrlKey || event.metaKey);
          row.focus({ preventScroll: true });
          return;
        }
        if (this.selectionMode) {
          this.toggleSelection(file.path);
          row.focus({ preventScroll: true });
          return;
        }
        if (event.ctrlKey || event.metaKey) {
          if (file instanceof import_obsidian4.TFile) {
            this.selectOnly(file.path);
            void this.openFile(file, true);
          } else {
            this.selectionMode = true;
            this.toggleSelection(file.path);
            row.focus({ preventScroll: true });
          }
          return;
        }
        this.selectOnly(file.path);
        if (folder) {
          row.focus({ preventScroll: true });
          this.toggleFolder(file.path);
        } else if (file instanceof import_obsidian4.TFile) void this.openFile(file);
      });
      row.addEventListener("auxclick", (event) => {
        if (event.button === 1 && file instanceof import_obsidian4.TFile) {
          event.preventDefault();
          void this.openFile(file, true);
        }
      });
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!this.selectedPaths.has(file.path)) this.selectOnly(file.path);
        this.focusedPath = file.path;
        row.focus({ preventScroll: true });
        this.fileMenu(file).showAtMouseEvent(event);
      });
    }
    clearFileDrag() {
      var _a;
      (_a = this.endNativeDrag) == null ? void 0 : _a.call(this);
      this.endNativeDrag = null;
      this.fileDrag = null;
      this.contentEl.querySelectorAll(".fpv-drop-target, .fpv-drop-invalid, .fpv-row.is-dragging").forEach((el) => el.classList.remove("fpv-drop-target", "fpv-drop-invalid", "is-dragging"));
    }
    attachMoveTarget(element, getTarget) {
      element.addEventListener("dragover", (event) => {
        if (!this.fileDrag) return;
        event.preventDefault();
        const target = getTarget();
        const plan = target instanceof import_obsidian4.TFolder ? planMove(this.app.vault, this.fileDrag, target) : null;
        element.toggleClass("fpv-drop-target", !!plan && !plan.error && plan.moves.length > 0);
        element.toggleClass("fpv-drop-invalid", !plan || !!plan.error);
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      });
      element.addEventListener("dragleave", (event) => {
        if (event.relatedTarget && element.contains(event.relatedTarget)) return;
        element.removeClass("fpv-drop-target", "fpv-drop-invalid");
      });
      element.addEventListener("drop", (event) => {
        if (!this.fileDrag) return;
        event.preventDefault();
        event.stopPropagation();
        const paths2 = this.fileDrag;
        this.clearFileDrag();
        const target = getTarget();
        if (!(target instanceof import_obsidian4.TFolder)) {
          this.reportError(this.t("missing"));
          return;
        }
        void this.moveToFolder(paths2, target);
      });
    }
    async moveToFolder(paths2, target) {
      if (this.moving || this.closed) return;
      const id = this.creationId;
      const plan = planMove(this.app.vault, paths2, target);
      if (plan.error) {
        this.reportError(this.t(plan.error));
        return;
      }
      if (!plan.moves.length) return;
      this.moving = true;
      let completed = 0;
      try {
        for (const move of plan.moves) {
          const { file, from } = move;
          if (this.app.vault.getAbstractFileByPath(from) !== file) throw new Error(this.t("missing"));
          const current = planMove(this.app.vault, [from], target);
          if (current.error) throw new Error(this.t(current.error));
          if (!current.moves.length) {
            move.path = file.path;
            continue;
          }
          move.path = current.moves[0].path;
          await this.app.fileManager.renameFile(file, move.path);
          completed++;
        }
        if (this.closed) return;
        const zone = getZone(this.data);
        zone.expanded = [.../* @__PURE__ */ new Set([...zone.expanded, ...ancestorPaths(plan.moves[0].path, null), target.path])];
        if (this.data.pinnedFolders.includes(target.path) && this.creationId === id) this.data.activeFolderPath = target.path;
        this.focusedPath = plan.moves[0].path;
        this.selectedPaths = new Set(plan.moves.map((move) => move.path));
        this.selectionAnchor = plan.moves[0].path;
        this.plugin.persist();
        this.plugin.refreshViews();
        const row = this.rows.get(plan.moves[0].path);
        if (row) this.revealRow(row);
      } catch (error) {
        this.plugin.refreshViews();
        this.reportError(this.t("moveProgress") + `: ${completed}/${plan.moves.length}. ` + (error instanceof Error ? error.message : String(error)));
      } finally {
        this.moving = false;
      }
    }
    toggleFolder(path, open) {
      const zone = getZone(this.data);
      const expanded = new Set(zone.expanded);
      if (open != null ? open : !expanded.has(path)) expanded.add(path);
      else expanded.delete(path);
      zone.expanded = [...expanded];
      this.plugin.persist();
      this.plugin.refreshViews();
    }
    toggleAll() {
      if (this.editor) return;
      const zone = getZone(this.data);
      if (zone.expanded.length) zone.expanded = [];
      else {
        for (const pin of this.data.pinnedFolders) {
          zone.expanded.push(pin);
          const folder = this.app.vault.getAbstractFileByPath(pin);
          const stack = folder instanceof import_obsidian4.TFolder ? [...folder.children] : [];
          while (stack.length) {
            const file = stack.pop();
            if (file instanceof import_obsidian4.TFolder) {
              zone.expanded.push(file.path);
              for (const child of file.children) stack.push(child);
            }
          }
        }
      }
      this.plugin.persist();
      this.plugin.refreshViews();
    }
    activeFileChanged() {
      var _a, _b;
      if (!this.tree || this.closed) return;
      const current = (_b = (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path) != null ? _b : null;
      this.updateHighlight();
      if (!current || current === this.lastActive) return;
      if (current !== this.openingPath) this.creationId++;
      this.lastActive = current;
      if (this.data.autoReveal && !this.editor) this.revealActive();
    }
    revealActive() {
      const file = this.app.workspace.getActiveFile();
      if (!file || this.editor || this.closed) return;
      const target = revealZone(this.data.pinnedFolders, this.data.activeFolderPath, file.path);
      if (target === void 0) return;
      this.captureScroll();
      this.data.activeFolderPath = target;
      this.data.activeSubfolderPath = null;
      const zone = getZone(this.data);
      const expanded = new Set(zone.expanded);
      const size = expanded.size;
      if (target) expanded.add(target);
      ancestorPaths(file.path, target).forEach((path) => expanded.add(path));
      zone.expanded = [...expanded];
      if (size !== expanded.size) {
        this.renderPins();
        this.renderTree();
        this.plugin.views().forEach((view) => {
          if (view !== this) view.sync();
        });
      } else this.renderPins();
      this.updateHighlight();
      const row = this.rows.get(file.path);
      if (row) this.revealRow(row);
      this.lastActive = file.path;
      this.plugin.persist();
    }
    updateHighlight() {
      var _a;
      const path = (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path;
      this.rows.forEach((row, rowPath) => {
        row.toggleClass("is-active", rowPath === path);
      });
    }
    updateTabStops() {
      this.tree.tabIndex = this.rows.size ? -1 : 0;
      this.rows.forEach((row, path) => {
        row.tabIndex = path === this.focusedPath ? 0 : -1;
      });
    }
    revealRow(row) {
      const viewport = this.tree.getBoundingClientRect();
      const rect = row.getBoundingClientRect();
      if (rect.top < viewport.top) this.tree.scrollTop -= viewport.top - rect.top;
      else if (rect.bottom > viewport.bottom) this.tree.scrollTop += rect.bottom - viewport.bottom;
      this.captureScroll();
    }
    focusRow(path, reveal = true) {
      this.focusedPath = path;
      this.updateTabStops();
      const row = path ? this.rows.get(path) : null;
      (row != null ? row : this.tree).focus({ preventScroll: true });
      if (row && reveal) this.revealRow(row);
    }
    updateSelection() {
      this.rows.forEach((row, path) => {
        const selected = this.selectedPaths.has(path);
        row.toggleClass("is-selected", selected);
        row.setAttribute("aria-selected", String(selected));
      });
      this.updateSelectionBar();
    }
    selectOnly(path) {
      this.selectedPaths = /* @__PURE__ */ new Set([path]);
      this.selectionAnchor = path;
      this.updateSelection();
    }
    toggleSelection(path) {
      if (this.selectedPaths.has(path)) this.selectedPaths.delete(path);
      else this.selectedPaths.add(path);
      this.selectionAnchor = path;
      this.updateSelection();
    }
    selectRange(path, add = false) {
      const end = this.visible.findIndex((file) => file.path === path);
      const start = this.visible.findIndex((file) => file.path === this.selectionAnchor);
      if (start < 0 || end < 0) {
        this.selectOnly(path);
        return;
      }
      const selected = add ? new Set(this.selectedPaths) : /* @__PURE__ */ new Set();
      for (let index = Math.min(start, end); index <= Math.max(start, end); index++) selected.add(this.visible[index].path);
      this.selectedPaths = selected;
      this.updateSelection();
    }
    onTreeKey(event) {
      var _a;
      if (this.editor || event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        this.toggleSelectionMode(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        this.selectionMode = true;
        this.selectedPaths = new Set(this.visible.map((file2) => file2.path));
        this.updateSelection();
        return;
      }
      const index = this.visible.findIndex((file2) => file2.path === this.focusedPath);
      const file = this.visible[index];
      if (!file) return;
      let target;
      switch (event.key) {
        case "ArrowDown":
          target = this.visible[Math.min(index + 1, this.visible.length - 1)];
          break;
        case "ArrowUp":
          target = this.visible[Math.max(index - 1, 0)];
          break;
        case "Home":
          target = this.visible[0];
          break;
        case "End":
          target = this.visible[this.visible.length - 1];
          break;
        case "ArrowRight":
          if (file instanceof import_obsidian4.TFolder) {
            if (!getZone(this.data).expanded.includes(file.path)) this.toggleFolder(file.path, true);
            else if (((_a = this.visible[index + 1]) == null ? void 0 : _a.parent) === file) target = this.visible[index + 1];
          }
          break;
        case "ArrowLeft":
          if (file instanceof import_obsidian4.TFolder && getZone(this.data).expanded.includes(file.path)) this.toggleFolder(file.path, false);
          else if (file.parent && this.rows.has(file.parent.path)) target = file.parent;
          break;
        case "Enter":
          if (this.selectionMode && !(event.ctrlKey || event.metaKey)) this.toggleSelection(file.path);
          else if (file instanceof import_obsidian4.TFile) void this.openFile(file, event.ctrlKey || event.metaKey);
          else this.toggleFolder(file.path);
          break;
        case " ":
          if (this.selectionMode) this.toggleSelection(file.path);
          else return;
          break;
        case "F2":
          this.startRename(file);
          break;
        case "ContextMenu":
          this.showKeyboardMenu(file);
          break;
        case "F10":
          if (event.shiftKey) this.showKeyboardMenu(file);
          else return;
          break;
        default:
          return;
      }
      event.preventDefault();
      if (target) {
        if (event.shiftKey) this.selectRange(target.path, event.ctrlKey || event.metaKey);
        else if (!this.selectionMode) this.selectOnly(target.path);
        this.focusRow(target.path);
      }
    }
    showKeyboardMenu(file) {
      var _a;
      const rect = (_a = this.rows.get(file.path)) == null ? void 0 : _a.getBoundingClientRect();
      if (!this.selectedPaths.has(file.path)) this.selectOnly(file.path);
      if (rect) this.fileMenu(file).showAtPosition({ x: rect.left + 24, y: rect.bottom });
    }
    async openFile(file, newTab = false) {
      try {
        await this.app.workspace.getLeaf(newTab ? "tab" : false).openFile(file);
      } catch (error) {
        this.reportError(error);
      }
    }
    creationMenu(menu, parent) {
      return menu.addItem((item) => item.setTitle(this.t("newNote")).setIcon("square-pen").onClick(() => {
        void this.startCreate(false, parent);
      })).addItem((item) => item.setTitle(this.t("newFolder")).setIcon("folder-plus").onClick(() => {
        void this.startCreate(true, parent);
      }));
    }
    fileMenu(file) {
      const menu = new import_obsidian4.Menu();
      const selected = this.selectedPaths.size > 1 && this.selectedPaths.has(file.path);
      if (selected) {
        const paths2 = [...this.selectedPaths];
        const filePaths = paths2.filter((path) => this.app.vault.getAbstractFileByPath(path) instanceof import_obsidian4.TFile);
        if (filePaths.length) menu.addItem((item) => item.setTitle(`${this.t("openSelected")} (${filePaths.length})`).setIcon("files").onClick(() => {
          void this.openSelected(filePaths);
        }));
        menu.addItem((item) => item.setTitle(this.t("moveSelected") + ` (${paths2.length})\u2026`).setIcon("folder-input").onClick(() => {
          new MoveFolderModal(
            this.app,
            paths2,
            this.t("vault"),
            this.t("chooseFolder"),
            (target) => {
              void this.moveToFolder(paths2, target);
            }
          ).open();
        }));
        menu.addItem((item) => item.setTitle(this.t("deleteSelected") + ` (${this.selectedPaths.size})`).setIcon("trash-2").setWarning(true).onClick(() => {
          void this.deleteSelected(paths2);
        }));
        const files = paths2.map((path) => this.app.vault.getAbstractFileByPath(path)).filter((item) => item !== null);
        this.app.workspace.trigger("files-menu", menu, files, FILE_MENU_SOURCE);
        return this.selectionMenu(menu);
      }
      if (file instanceof import_obsidian4.TFolder) {
        this.creationMenu(menu, file.path);
        const pinned = this.data.pinnedFolders.includes(file.path);
        menu.addItem((item) => item.setTitle(this.t(pinned ? "unpin" : "pin")).setIcon(pinned ? "pin-off" : "pin").onClick(() => {
          void this.plugin.setPinned(file.path, !pinned);
        }));
      } else if (file instanceof import_obsidian4.TFile) {
        menu.addItem((item) => item.setTitle(this.t("openTab")).setIcon("file-plus").onClick(() => {
          void this.openFile(file, true);
        }));
      }
      menu.addSeparator();
      menu.addItem((item) => item.setTitle(this.t("rename")).setIcon("pencil").onClick(() => this.startRename(file)));
      menu.addItem((item) => item.setTitle(this.t("delete")).setIcon("trash-2").setWarning(true).onClick(() => {
        void this.deleteFile(file);
      }));
      this.plugin.extendFileMenu(menu, file);
      return this.selectionMenu(menu);
    }
    async openSelected(paths2) {
      for (const path of paths2) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof import_obsidian4.TFile) await this.openFile(file, true);
      }
    }
    async deleteFile(file) {
      if (this.deletingPaths.has(file.path)) return;
      this.deletingPaths.add(file.path);
      try {
        if (this.app.vault.getAbstractFileByPath(file.path) !== file) throw new Error(this.t("missing"));
        await this.app.fileManager.promptForDeletion(file);
      } catch (error) {
        this.reportError(error);
      } finally {
        this.deletingPaths.delete(file.path);
      }
    }
    async deleteSelected(paths2 = [...this.selectedPaths]) {
      for (const path of paths2) {
        if (paths2.some((other) => other !== path && containsPath(other, path))) continue;
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file) await this.deleteFile(file);
      }
    }
    reportError(error) {
      new import_obsidian4.Notice(this.t("operationFailed") + ": " + (error instanceof Error ? error.message : String(error)));
    }
    async startCreate(folder, parentPath) {
      var _a;
      if (this.closed || ((_a = this.editor) == null ? void 0 : _a.busy)) return;
      this.cancelEditor();
      this.renderTree();
      const parent = !parentPath || parentPath === "/" ? this.app.vault.getRoot() : this.app.vault.getAbstractFileByPath(parentPath);
      if (!(parent instanceof import_obsidian4.TFolder)) {
        this.reportError(this.t("missing"));
        return;
      }
      if (!containsPath(browsingPath(this.data), parent.path === "/" ? "" : parent.path)) return;
      const id = ++this.creationId;
      const region = browsingPath(this.data);
      try {
        const created = await createUntitled(this.app.vault, parent, folder, this.t(folder ? "untitledFolder" : "untitled"));
        if (this.closed || id !== this.creationId || region !== browsingPath(this.data)) return;
        if (this.app.vault.getAbstractFileByPath(created.path) !== created || !containsPath(region, created.path)) return;
        const zone = getZone(this.data);
        zone.expanded = [.../* @__PURE__ */ new Set([...zone.expanded, ...ancestorPaths(created.path, region)])];
        this.focusedPath = created.path;
        this.renderTree();
        const row = this.rows.get(created.path);
        if (row) this.revealRow(row);
        this.plugin.persist();
        if (created instanceof import_obsidian4.TFile) {
          const leaf = this.app.workspace.getLeaf(false);
          this.openingPath = created.path;
          try {
            await leaf.openFile(created, {
              active: true,
              state: { mode: "source" },
              eState: { rename: "all" }
            });
            if (id === this.creationId && this.app.workspace.getActiveFile() === created) {
              leaf.setEphemeralState({ rename: "all" });
            }
          } finally {
            this.openingPath = null;
          }
        } else this.startRename(created);
      } catch (error) {
        this.reportError(error);
      }
    }
    startRename(file) {
      var _a;
      if ((_a = this.editor) == null ? void 0 : _a.busy) return;
      this.creationId++;
      this.cancelEditor();
      this.renderTree();
      const row = this.rows.get(file.path);
      if (!row) return;
      const host = this.tree.createDiv("fpv-editor-row");
      host.style.setProperty("--fpv-depth", row.style.getPropertyValue("--fpv-depth"));
      row.after(host);
      row.hidden = true;
      const initial = file instanceof import_obsidian4.TFile && file.extension ? file.basename : file.name;
      this.beginEditor(host, initial, async (value) => {
        var _a2, _b;
        if (this.app.vault.getAbstractFileByPath(file.path) !== file) throw new Error(this.t("missing"));
        const path = entryPath((_b = (_a2 = file.parent) == null ? void 0 : _a2.path) != null ? _b : "", value, file instanceof import_obsidian4.TFile ? file.extension : "");
        if (path === file.path) return;
        const existing = this.app.vault.getAbstractFileByPath(path);
        if (existing && existing !== file) throw new Error(this.t("exists"));
        await this.app.fileManager.renameFile(file, path);
        this.focusedPath = path;
      });
    }
    beginEditor(host, initial, action) {
      const input = host.createEl("input", {
        cls: "fpv-input",
        type: "text",
        value: initial,
        attr: { "aria-label": this.t("rename"), spellcheck: "false" }
      });
      this.tree.querySelectorAll(".fpv-empty").forEach((el) => {
        el.hidden = true;
      });
      const error = host.createDiv({ cls: "fpv-input-message", text: this.t("editHint"), attr: { role: "status", "aria-live": "polite" } });
      const editor = { el: host, input, busy: false, commit: async () => {
        if (editor.busy || this.editor !== editor) return;
        const value = input.value.trim();
        if (!validName(value)) {
          error.setText(this.t("invalidName"));
          input.setAttribute("aria-invalid", "true");
          input.focus();
          return;
        }
        editor.busy = true;
        input.disabled = true;
        try {
          await action(value);
          if (this.editor !== editor || this.closed) return;
          this.editor = null;
          host.remove();
          this.renderTree();
          const row = this.focusedPath ? this.rows.get(this.focusedPath) : null;
          if (row) this.revealRow(row);
          this.focusRow(this.focusedPath, false);
          this.plugin.persist();
        } catch (failure) {
          if (this.editor !== editor || this.closed) return;
          editor.busy = false;
          input.disabled = false;
          error.setText(this.t("operationFailed") + ": " + (failure instanceof Error ? failure.message : String(failure)));
          input.setAttribute("aria-invalid", "true");
          input.focus();
        }
      } };
      this.editor = editor;
      input.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.isComposing || composing) return;
        if (event.key === "Enter") {
          event.preventDefault();
          void editor.commit();
        } else if (event.key === "Escape" && !editor.busy) {
          event.preventDefault();
          this.cancelEditor();
          this.renderTree();
          this.focusRow(this.focusedPath, false);
        }
      });
      let composing = false;
      input.addEventListener("compositionstart", () => {
        composing = true;
      });
      input.addEventListener("compositionend", () => {
        composing = false;
      });
      input.addEventListener("input", () => {
        input.removeAttribute("aria-invalid");
        error.setText(this.t("editHint"));
      });
      input.focus({ preventScroll: true });
      input.select();
      this.revealRow(host);
    }
    cancelEditor() {
      if (!this.editor) return;
      this.editor.el.remove();
      this.editor = null;
    }
  };

  // src/embed.ts
  var PIN_VIEW_TYPE = "000quiet-tree-note-pin";
  var disabledNotice = (zh2) => new import_obsidian5.Notice(
    zh2 ? "\u7B14\u8BB0\u7F6E\u9876\u5DF2\u5728\u6B64\u8BBE\u5907\u4E0A\u505C\u7528\uFF08\u53EF\u5728 Aio Explorer \u8BBE\u7F6E\u91CC\u6253\u5F00\uFF09" : "Note pin is disabled on this device (enable it in Aio Explorer settings)",
    3e3
  );
  var FolderPinModule = class {
    constructor(host) {
      this.host = host;
      this.data = normalizeData(null);
      this.writeQueue = Promise.resolve();
      this.stopping = false;
      this.ownMenus = /* @__PURE__ */ new WeakSet();
      this.t = (key) => translate(this.language, key);
      this.persist = () => {
        if (this.stopping) return;
        if (this.saveTimer !== void 0) window.clearTimeout(this.saveTimer);
        this.saveTimer = window.setTimeout(() => {
          this.saveTimer = void 0;
          this.flushSave();
        }, 200);
      };
    }
    get app() {
      return this.host.app;
    }
    get workspace() {
      return this.app.workspace;
    }
    get language() {
      // 2026-10-22 修复：面板语言必须跟随插件「通用」里的总语言设置。
      // 旧实现只看 this.data.language（默认 "auto" → 永远跟着 Obsidian 走），
      // 于是把插件语言设成 English、而 Obsidian 本身是中文时，
      // 文件置顶面板仍然整片中文 —— 用户看到的就是「切了语言没全变」。
      // 现在优先级：宿主设置（auto/zh/en）→ 本模块旧字段（兼容老数据）→ 跟随 Obsidian。
      const host = this.host && this.host.settings ? this.host.settings.language : void 0;
      const chosen = host && host !== "auto" ? host : this.data.language;
      return resolveLanguage(chosen || "auto", (0, import_obsidian5.getLanguage)());
    }
    /** 读取数据：优先宿主配置里的 pinData，否则从旧插件 data.json 一次性迁移。 */
    async attach() {
      await this.loadData();
      this.host.registerView(PIN_VIEW_TYPE, (leaf) => new FolderPinView(leaf, this, PIN_VIEW_TYPE));
      // 2026-10-22：命令注册抽成方法，语言切换时先删后建，命令面板才会跟着变语言。
      this.registerCommands();
      this.host.registerEvent(this.workspace.on("file-menu", (...args) => {
        const menu = args[0];
        const file = args[1];
        const source = args[2];
        if (!this.host.isPinEnabledHere()) return;
        if (source === PIN_VIEW_TYPE || this.ownMenus.has(menu) || !(file instanceof import_obsidian5.TFolder) || file.isRoot()) return;
        const pinned = this.data.pinnedFolders.includes(file.path);
        menu.addItem((item) => item.setTitle(this.t(pinned ? "unpin" : "pin")).setIcon("pin").onClick(() => {
          void this.setPinned(file.path, !pinned);
        }));
      }));
      this.host.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
      this.host.registerEvent(this.app.vault.on("delete", (file) => {
        this.views().forEach((view) => view.captureScroll());
        removePath(this.data, file.path);
        this.persist();
        this.refreshViews();
      }));
      this.host.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
        this.views().forEach((view) => view.captureScroll());
        remapData(this.data, oldPath, file.path);
        this.persist();
        this.refreshViews();
      }));
      this.host.registerEvent(this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian5.TFile && this.data.sortOrder.startsWith("mtime")) this.scheduleRefresh();
      }));
      this.host.registerEvent(this.workspace.on("file-open", () => this.views().forEach((view) => view.activeFileChanged())));
      this.host.registerEvent(this.workspace.on("active-leaf-change", () => this.views().forEach((view) => view.activeFileChanged())));
      this.app.workspace.onLayoutReady(() => {
        if (this.stopping || !this.host.isPinEnabledHere()) return;
        for (const path of [...this.data.pinnedFolders]) {
          if (!(this.app.vault.getAbstractFileByPath(path) instanceof import_obsidian5.TFolder)) removePath(this.data, path);
        }
        for (const zone of Object.values(this.data.zones))
          zone.expanded = zone.expanded.filter((path) => this.app.vault.getAbstractFileByPath(path) instanceof import_obsidian5.TFolder);
        this.refreshViews();
        if (!this.views().length) void this.activateView(false);
        this.persist();
      });
      this.host.register(() => this.teardown());
      console.debug("[Aio Explorer][\u7B14\u8BB0\u7F6E\u9876] module attached", PIN_VIEW_TYPE);
    }
    /** 把数据挂到宿主 settings.pinData；为空时从旧插件 data.json 一次性迁移。 */
    async loadData() {
      const stored = this.host.settings.pinData;
      if (stored && typeof stored === "object" && Array.isArray(stored.pinnedFolders)) {
        this.data = normalizeData(stored);
      } else {
        this.data = normalizeData(null);
        try {
          const adapter = this.app.vault.adapter;
          const path = `${this.host.manifest.dir}/../000folder-pin-view/data.json`;
          if (await adapter.exists(path)) {
            this.data = normalizeData(JSON.parse(await adapter.read(path)));
            console.debug("[Aio Explorer][\u7B14\u8BB0\u7F6E\u9876] \u5DF2\u4ECE 000folder-pin-view/data.json \u8FC1\u79FB\u7F6E\u9876\u914D\u7F6E");
          }
        } catch (error) {
          console.error("[Aio Explorer][\u7B14\u8BB0\u7F6E\u9876] \u8FC1\u79FB\u65E7\u7F6E\u9876\u914D\u7F6E\u5931\u8D25", error);
        }
      }
      this.host.settings.pinData = this.data;
    }
    extendFileMenu(menu, file) {
      this.ownMenus.add(menu);
      this.app.workspace.trigger("file-menu", menu, file, FILE_MENU_SOURCE);
    }
    views() {
      return this.workspace.getLeavesOfType(PIN_VIEW_TYPE).map((leaf) => leaf.view).filter((view) => view instanceof FolderPinView);
    }
    async activateView(reveal = true) {
      let leaf = this.workspace.getLeavesOfType(PIN_VIEW_TYPE)[0];
      if (!leaf) {
        const created = this.workspace.getLeftLeaf(true);
        if (!created) return;
        leaf = created;
        await leaf.setViewState({ type: PIN_VIEW_TYPE, active: reveal });
      }
      if (reveal) await this.workspace.revealLeaf(leaf);
    }
    /** 设备/总开关关闭时收掉所有本模块视图。 */
    closeViews() {
      this.views().forEach((view) => view.captureScroll());
      this.flushSave();
      for (const leaf of this.workspace.getLeavesOfType(PIN_VIEW_TYPE)) leaf.detach();
    }
    async setPinned(path, pinned) {
      var _a;
      if (pinned && !(this.app.vault.getAbstractFileByPath(path) instanceof import_obsidian5.TFolder)) return;
      this.views().forEach((view) => view.captureScroll());
      const index = this.data.pinnedFolders.indexOf(path);
      if (pinned) {
        if (index === -1) this.data.pinnedFolders.push(path);
        this.data.activeFolderPath = path;
        this.data.activeSubfolderPath = null;
      } else {
        if (index === -1) return;
        this.data.pinnedFolders.splice(index, 1);
        delete this.data.zones[zoneKey(path)];
        if (this.data.activeFolderPath === path)
          this.data.activeFolderPath = (_a = this.data.pinnedFolders[Math.min(index, this.data.pinnedFolders.length - 1)]) != null ? _a : null;
      }
      this.persist();
      this.refreshViews();
      if (pinned && this.host.isPinEnabledHere()) await this.activateView();
    }
    refreshViews() {
      this.views().forEach((view) => view.sync());
    }
    refreshLanguage() {
      // 语言变了：卡片/工具栏文案重画（view.localize 内部会比对 this.plugin.language），
      // 命令名是注册时固定的，必须删掉重建。
      this.views().forEach((view) => view.localize());
      this.registerCommands();
      this.persist();
    }
    /**
     * 本模块的命令注册。为什么要单独一个方法：
     * Obsidian 的命令名是「注册那一刻」算好存进命令表的，之后改语言不会自动更新，
     * 所以语言切换时要 removeCommand → addCommand 走一遍（先删后建，避免重复项）。
     */
    registerCommands() {
      const specs = [
        {
          id: "pin-open-view",
          name: () => this.t("openView"),
          run: () => {
            if (!this.host.isPinEnabledHere()) {
              disabledNotice(this.language === "zh");
              return;
            }
            void this.activateView();
          }
        },
        {
          id: "pin-reveal-active-file",
          name: () => this.t("reveal"),
          run: () => {
            if (!this.host.isPinEnabledHere()) {
              disabledNotice(this.language === "zh");
              return;
            }
            void this.activateView().then(() => this.views().forEach((view) => view.revealActive()));
          }
        },
        {
          id: "pin-toggle-selection-mode",
          name: () => this.t("selectionMode"),
          run: () => {
            if (!this.host.isPinEnabledHere()) {
              disabledNotice(this.language === "zh");
              return;
            }
            void this.activateView().then(() => {
              var _a;
              return (_a = this.views()[0]) == null ? void 0 : _a.toggleSelectionMode();
            });
          }
        }
      ];
      for (const spec of specs) {
        try {
          // 老版本 Obsidian 没有 Plugin.removeCommand，没有就跳过（下次重启自然更新）
          if (typeof this.host.removeCommand === "function") this.host.removeCommand(spec.id);
        } catch (error) {
          console.debug("[Aio Explorer][\u7B14\u8BB0\u7F6E\u9876] \u547D\u4EE4\u91CD\u5EFA\u5931\u8D25", error);
        }
        this.host.addCommand({ id: spec.id, name: spec.name(), callback: spec.run });
      }
    }
    scheduleRefresh() {
      if (this.refreshTimer !== void 0) window.clearTimeout(this.refreshTimer);
      this.refreshTimer = window.setTimeout(() => {
        this.refreshTimer = void 0;
        if (!this.stopping) this.views().forEach((view) => view.renderTree());
      }, 100);
    }
    // Serialize snapshots so a slow previous write cannot overwrite newer settings.
    flushSave() {
      if (this.saveTimer !== void 0) {
        window.clearTimeout(this.saveTimer);
        this.saveTimer = void 0;
      }
      const snapshot = JSON.parse(JSON.stringify(this.data));
      this.writeQueue = this.writeQueue.then(() => this.host.pinPersistSnapshot(snapshot)).catch((error) => {
        console.error("[Aio Explorer][\u7B14\u8BB0\u7F6E\u9876] \u914D\u7F6E\u4FDD\u5B58\u5931\u8D25", error);
        new import_obsidian5.Notice(this.t("saveFailed"));
      });
    }
    teardown() {
      this.stopping = true;
      if (this.refreshTimer !== void 0) window.clearTimeout(this.refreshTimer);
      if (this.saveTimer !== void 0) window.clearTimeout(this.saveTimer);
      this.views().forEach((view) => view.captureScroll());
      this.flushSave();
    }
  };
  function createFolderPinModule(host) {
    return new FolderPinModule(host);
  }
  return __toCommonJS(embed_exports);
})();

// —— 接线：把模块挂到 QuietTree000Plugin 上（原型注入，不改动类本体）——
QuietTree000Plugin.prototype.isPinEnabledHere = function() {
  return this.moduleOnHere("pinModuleEnabled", "pinDevices");
};
QuietTree000Plugin.prototype.pinPersistSnapshot = async function(snapshot) {
  try {
    await this.store.saveSettings({ pinData: snapshot });
  } catch (error) {
    console.error("[Aio Explorer] 笔记置顶配置保存失败", error);
  }
};
QuietTree000Plugin.prototype.initPinModule = async function() {
  try {
    this.pinModule = __qtPinEmbed.createFolderPinModule(this);
    await this.pinModule.attach();
    this.applyPinModuleSwitch();
  } catch (error) {
    console.error("[Aio Explorer] 笔记置顶模块挂载失败", error);
  }
};
QuietTree000Plugin.prototype.applyPinModuleSwitch = function() {
  const mod = this.pinModule;
  if (!mod) return;
  if (!this.isPinEnabledHere()) {
    if (this.pinRibbonIcon) {
      this.pinRibbonIcon.remove?.();
      this.pinRibbonIcon = null;
    }
    mod.closeViews();
    return;
  }
  if (!this.pinRibbonIcon || !this.pinRibbonIcon.isConnected) {
    this.pinRibbonIcon = this.addRibbonIcon("pin", mod.t("title"), () => void mod.activateView());
  }
  mod.refreshViews();
};
