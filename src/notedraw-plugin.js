/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- NoteDraw is a plain JavaScript Obsidian plugin that validates dynamic DOM, vault, and drawing data at runtime. */
import {
  MarkdownRenderer,
  MarkdownView,
  Notice,
  Platform,
  Plugin,
  PluginSettingTab,
  Setting,
  normalizePath,
  setIcon
} from "obsidian";
import SUPPORT_CODE_ALIPAY_DATA_URL from "../extras/code-1.jpg";
import SUPPORT_CODE_BINANCE_DATA_URL from "../extras/code-2.png";
import {
  calculateCanvasBackingStore,
  calculateCanvasWindow,
  calculateQualityWindowLimit
} from "./canvas-sizing.mjs";
import {
  RESPONSIVE_POINT_BASIS,
  constrainWideContentFrame,
  createResponsivePoint,
  normalizeContentFrame,
  normalizeResponsiveAnchor,
  projectResponsivePoint
} from "./layout-coordinates.mjs";
import {
  ELEMENT_LAYOUT_BASIS,
  captureElementRelations,
  createElementLayout,
  elementLayoutNeedsRepair,
  estimateElementLayoutExtent,
  normalizeElementLayout,
  projectElementLayout,
  projectElementPoints,
  scaleElementMetrics,
  stabilizeElementRelations
} from "./element-layout.mjs";
import { matchRenderedTextToMarkdown } from "./markdown-anchors.mjs";
import { buildVirtualMarkdownSectionAnchors } from "./markdown-section-anchors.mjs";
import {
  SELECTED_DRAW_GESTURE_DRAW_OR_DESELECT,
  SELECTED_DRAW_GESTURE_MANIPULATE,
  resolveSelectedDrawGesture
} from "./selection-draw-gesture.mjs";
import {
  computeTextLayout,
  placeFloatingTextEditor
} from "./text-layout.mjs";
const activeDocument = window.activeWindow?.document || window.document;
var PLUGIN_ID = "notedraw";
var DRAWING_DIR = `${PLUGIN_ID}/drawings`;
var ASSET_DIR = `${PLUGIN_ID}/assets`;
var WEBVIEW_DRAWING_PREFIX = "webviews";
var LEGACY_PLUGIN_ID = "note-doodle-preview";
var LEGACY_DRAWING_DIR = `${LEGACY_PLUGIN_ID}/doodles`;
var DEBUG_LOG_FILE = "debug-log.jsonl";
var DEBUG_LOG_LIMIT = 150;
var TEXT_SAVE_DELAY_MS = 160;
var SETTINGS_SAVE_DELAY_MS = 260;
var LONG_PRESS_MS = 550;
var SELECT_TAP_DISTANCE = 6;
var SELECT_STROKE_PADDING = 8;
var SELECTED_STROKE_ALPHA = 0.38;
var SELECT_RESIZE_HANDLE_SIZE = 10;
var SELECT_RESIZE_HANDLE_HIT_RADIUS = 15;
var SNAP_GRID_PX = 8;
var SNAP_THRESHOLD_PX = 7;
var DRAWING_INTERPOLATION_STEP_PX = 3;
var DRAWING_MIN_POINT_DISTANCE_PX = 0.55;
var DRAWING_COMPACT_DISTANCE_PX = 1.1;
var MAX_PEN_COUNT = 5;
var MIN_BRUSH_WIDTH = 0.5;
var MAX_BRUSH_WIDTH = 32;
var DEFAULT_PEN_OPACITY = 1;
var MIN_LONG_PRESS_MS = 250;
var MAX_LONG_PRESS_MS = 1200;
var MIN_SELECT_TAP_DISTANCE = 3;
var MAX_SELECT_TAP_DISTANCE = 18;
var MIN_SELECT_STROKE_PADDING = 2;
var MAX_SELECT_STROKE_PADDING = 28;
var MIN_SELECTED_STROKE_ALPHA = 0.12;
var MAX_SELECTED_STROKE_ALPHA = 1;
var MIN_DRAWING_INTERPOLATION_STEP_PX = 1;
var MAX_DRAWING_INTERPOLATION_STEP_PX = 8;
var MIN_DRAWING_MIN_POINT_DISTANCE_PX = 0.05;
var MAX_DRAWING_MIN_POINT_DISTANCE_PX = 3;
var MIN_DRAWING_COMPACT_DISTANCE_PX = 0.1;
var MAX_DRAWING_COMPACT_DISTANCE_PX = 6;
var MIN_AUTO_SAVE_DELAY_MS = 120;
var MAX_AUTO_SAVE_DELAY_MS = 2500;
var TOOL_DRAW = "draw";
var TOOL_SELECT = "select";
var TOOL_EDIT_MD = "edit-md";
var TOOL_TEXT = "text";
var TOOL_EMBED = "embed";
var BRUSH_PEN = "pen";
var BRUSH_WATERCOLOR = "watercolor";
var TEXT_RENDER_PLAIN = "plain";
var TEXT_RENDER_MARKDOWN = "markdown";
var TEXT_RENDER_HTML = "html";
var TEXT_RENDER_NOTE = "note";
var EMBED_IMAGE = "image";
var EMBED_VIDEO = "video";
var EMBED_FILE = "file";
var COMMON_COLORS = [
  "#e53935",
  "#fdd835",
  "#43a047",
  "#1e88e5",
  "#111827"
];
var SETTINGS_EXTRA_CODE_ASSETS = [
  { path: "extras/code-1.jpg", dataUrl: SUPPORT_CODE_ALIPAY_DATA_URL, labelKey: "supportCodeAlipay" },
  { path: "extras/code-2.png", dataUrl: SUPPORT_CODE_BINANCE_DATA_URL, labelKey: "supportCodeBinance" }
];
var LANGUAGE_AUTO = "auto";
var LANGUAGE_OPTIONS = [
  { value: LANGUAGE_AUTO, label: "Auto" },
  { value: "zh", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "ug", label: "ئۇيغۇرچە" },
  { value: "ru", label: "Русский" },
  { value: "ar", label: "العربية" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "tr", label: "Türkçe" }
];
var I18N = {
  en: {
    toggleCommand: "Toggle preview edit and drawing mode",
    openNoteOrWebviewFirst: "Open a note or webview first.",
    failedSaveDrawing: "Failed to save drawing data.",
    failedImportFile: "Failed to import file.",
    editTextDraw: "Edit text / draw",
    editTextDrawHidden: "Edit text / draw (drawings hidden)",
    editWebviewDraw: "Edit webview / draw",
    selectDrawings: "Select drawings",
    editMarkdownTool: "Edit MD",
    pen: "Pen",
    watercolorBrush: "Watercolor brush",
    floatingText: "Floating text",
    undoLastDrawing: "Undo last drawing",
    redoDrawing: "Redo drawing",
    deleteSelectedDrawing: "Delete selected drawing",
    penSettings: "Pen settings",
    advancedColor: "Advanced color",
    penWidth: "Pen width",
    penOpacity: "Pen opacity",
    textGroup: "Text",
    buttonGroup: "Buttons",
    textPlain: "Text",
    title: "Title",
    code: "Code",
    button: "Button",
    primaryButton: "Primary",
    outlineButton: "Outline",
    pillButton: "Pill",
    arrowUp: "Up",
    arrowDown: "Down",
    arrowLeft: "Left",
    arrowRight: "Right",
    fileTag: "File tag",
    importGroup: "Import",
    image: "Image",
    video: "Video",
    file: "File",
    previewGroup: "Preview",
    markdown: "MD",
    html: "HTML",
    note: "Note",
    bold: "Bold",
    italic: "Italic",
    underline: "Underline",
    inlineCode: "Inline code",
    keyboardTag: "Keyboard tag",
    superscript: "Superscript",
    subscript: "Subscript",
    codeBlock: "Code block",
    highlight: "Highlight",
    insertBreak: "Insert line break",
    clearFormat: "Clear formatting",
    textColor: "Text color",
    highlightColor: "Highlight color",
    textSize: "Text size",
    size: "Size",
    movePanel: "Move panel",
    useColor: "Use color {color}",
    settingsSectionInterface: "Interface",
    settingsSectionPen: "Pen",
    settingsSectionWatercolor: "Watercolor",
    settingsSectionInteraction: "Interaction",
    settingsSectionPerformance: "Performance",
    settingsSectionLayout: "Layout",
    settingsSectionDiagnostics: "Diagnostics",
    settingsSectionSupport: "Support",
    settingsLanguage: "Language",
    settingsLanguageDesc: "Plugin UI language. Auto follows Obsidian when possible.",
    languageAuto: "Auto",
    defaultPenColor: "Default pen color",
    defaultPenColorDesc: "Initial color for new pen strokes.",
    defaultPenWidth: "Default pen width",
    defaultPenWidthDesc: "Initial pen width.",
    defaultPenOpacity: "Default pen opacity",
    defaultPenOpacityDesc: "Initial pen opacity.",
    defaultWatercolorColor: "Default watercolor color",
    defaultWatercolorColorDesc: "Initial color for watercolor strokes.",
    defaultWatercolorWidth: "Default watercolor width",
    defaultWatercolorWidthDesc: "Initial watercolor width.",
    defaultWatercolorOpacity: "Default watercolor opacity",
    defaultWatercolorOpacityDesc: "Initial watercolor opacity.",
    toolbarTopOffset: "Toolbar top offset",
    toolbarTopOffsetDesc: "Extra pixels below the Obsidian header.",
    longPressMs: "Long press delay",
    longPressMsDesc: "Delay before long-press actions open secondary controls.",
    selectTapDistance: "Tap tolerance",
    selectTapDistanceDesc: "Movement allowed before a tap becomes a drag or stroke.",
    selectStrokePadding: "Selection hit padding",
    selectStrokePaddingDesc: "Extra hit area around drawing elements for easier selection.",
    selectedStrokeAlpha: "Selected element opacity",
    selectedStrokeAlphaDesc: "Opacity used while selected elements are previewed for editing.",
    drawingInterpolationStep: "Stroke smoothing",
    drawingInterpolationStepDesc: "Lower values add more points between samples for smoother lines.",
    drawingMinPointDistance: "Input sample spacing",
    drawingMinPointDistanceDesc: "Minimum point distance while drawing. Lower values capture more detail.",
    drawingCompactDistance: "Save compaction",
    drawingCompactDistanceDesc: "Point reduction applied during auto-save. Lower values keep more detail.",
    autoSaveDelayMs: "Auto-save delay",
    autoSaveDelayMsDesc: "Delay before drawing changes are written to the plugin data folder.",
    resetBrushDefaults: "Reset brush defaults",
    resetBrushDefaultsDesc: "Restore pen and watercolor defaults to the bundled values.",
    resetLayoutDefaults: "Reset layout and interaction",
    resetLayoutDefaultsDesc: "Restore toolbar, selection, smoothing, and auto-save defaults.",
    reset: "Reset",
    debugLog: "Debug log",
    debugLogDesc: "Write text-save diagnostics to the plugin folder only while troubleshooting.",
    supportTitle: "Support NoteDraw",
    supportSubtitle: "Scan with Alipay or Binance to support ongoing maintenance.",
    supportCodeAlipay: "Alipay",
    supportCodeBinance: "Binance",
    bringToFront: "Bring to front",
    sendToBack: "Send to back",
    moveForward: "Move up",
    moveBackward: "Move down",
    lockElement: "Lock",
    unlockElement: "Unlock"
  },
  zh: {
    toggleCommand: "切换阅读编辑和涂鸦模式",
    openNoteOrWebviewFirst: "请先打开笔记或网页视图。",
    failedSaveDrawing: "涂鸦数据保存失败。",
    failedImportFile: "导入文件失败。",
    editTextDraw: "编辑文字 / 涂鸦",
    editTextDrawHidden: "编辑文字 / 涂鸦（涂鸦已隐藏）",
    editWebviewDraw: "编辑网页 / 涂鸦",
    selectDrawings: "选择元素",
    editMarkdownTool: "编辑 MD",
    pen: "笔",
    watercolorBrush: "水彩笔",
    floatingText: "悬浮文字",
    undoLastDrawing: "撤销上一步涂鸦",
    redoDrawing: "重做涂鸦",
    deleteSelectedDrawing: "删除选中元素",
    penSettings: "画笔设置",
    advancedColor: "高级颜色",
    penWidth: "笔宽",
    penOpacity: "笔透明度",
    textGroup: "文字",
    buttonGroup: "按钮/方向",
    textPlain: "普通文字",
    title: "标题",
    code: "代码",
    button: "按钮",
    primaryButton: "主按钮",
    outlineButton: "线框",
    pillButton: "胶囊",
    arrowUp: "上",
    arrowDown: "下",
    arrowLeft: "左",
    arrowRight: "右",
    fileTag: "文件标签",
    importGroup: "导入",
    image: "图片",
    video: "视频",
    file: "文件",
    previewGroup: "预览",
    markdown: "MD",
    html: "HTML",
    note: "笔记",
    bold: "加粗",
    italic: "倾斜",
    underline: "下划线",
    inlineCode: "行内代码",
    keyboardTag: "键盘标签",
    superscript: "上标",
    subscript: "下标",
    codeBlock: "代码块",
    highlight: "高亮",
    insertBreak: "换行",
    clearFormat: "清除格式",
    textColor: "文字颜色",
    highlightColor: "高亮颜色",
    textSize: "字号",
    size: "字号",
    movePanel: "移动面板",
    useColor: "使用颜色 {color}",
    settingsSectionInterface: "界面",
    settingsSectionPen: "笔",
    settingsSectionWatercolor: "水彩笔",
    settingsSectionInteraction: "交互",
    settingsSectionPerformance: "性能",
    settingsSectionLayout: "布局",
    settingsSectionDiagnostics: "诊断",
    settingsSectionSupport: "支持作者",
    settingsLanguage: "语言",
    settingsLanguageDesc: "插件界面语言。自动模式会尽量跟随 Obsidian。",
    languageAuto: "自动",
    defaultPenColor: "默认笔颜色",
    defaultPenColorDesc: "新笔画的初始颜色。",
    defaultPenWidth: "默认笔宽",
    defaultPenWidthDesc: "初始笔宽。",
    defaultPenOpacity: "默认笔透明度",
    defaultPenOpacityDesc: "初始笔透明度。",
    defaultWatercolorColor: "默认水彩颜色",
    defaultWatercolorColorDesc: "新水彩笔画的初始颜色。",
    defaultWatercolorWidth: "默认水彩笔宽",
    defaultWatercolorWidthDesc: "初始水彩笔宽。",
    defaultWatercolorOpacity: "默认水彩透明度",
    defaultWatercolorOpacityDesc: "初始水彩透明度。",
    toolbarTopOffset: "工具栏顶部偏移",
    toolbarTopOffsetDesc: "距离 Obsidian 顶部栏的额外像素。",
    longPressMs: "长按延迟",
    longPressMsDesc: "长按打开二级控制的等待时间。",
    selectTapDistance: "点击容差",
    selectTapDistanceDesc: "移动多少像素后从点击变为拖动或涂鸦。",
    selectStrokePadding: "选择命中范围",
    selectStrokePaddingDesc: "元素周围额外可点范围，越大越容易选中。",
    selectedStrokeAlpha: "选中元素透明度",
    selectedStrokeAlphaDesc: "元素被选中编辑时的预览透明度。",
    drawingInterpolationStep: "笔画平滑",
    drawingInterpolationStepDesc: "数值越小，采样点之间补点越多，线条越顺。",
    drawingMinPointDistance: "输入采样间距",
    drawingMinPointDistanceDesc: "涂鸦时保留新点的最小距离，越小越细腻。",
    drawingCompactDistance: "保存压缩",
    drawingCompactDistanceDesc: "自动保存时的点位压缩强度，越小越保留细节。",
    autoSaveDelayMs: "自动保存延迟",
    autoSaveDelayMsDesc: "涂鸦改变后写入插件数据文件夹前的等待时间。",
    resetBrushDefaults: "重置画笔默认值",
    resetBrushDefaultsDesc: "恢复笔和水彩笔的内置默认颜色、大小和透明度。",
    resetLayoutDefaults: "重置布局和交互",
    resetLayoutDefaultsDesc: "恢复工具栏、选择、平滑和自动保存的默认值。",
    reset: "重置",
    debugLog: "调试日志",
    debugLogDesc: "仅排查问题时，把文字保存诊断写入插件文件夹。",
    supportTitle: "支持 NoteDraw / 双码",
    supportSubtitle: "可用支付宝或币安扫码支持后续维护。",
    supportCodeAlipay: "支付宝",
    supportCodeBinance: "币安",
    bringToFront: "置顶",
    sendToBack: "置底",
    moveForward: "上移一层",
    moveBackward: "下移一层",
    lockElement: "锁定",
    unlockElement: "解锁"
  },
  "zh-TW": {
    toggleCommand: "切換閱讀編輯和塗鴉模式",
    openNoteOrWebviewFirst: "請先開啟筆記或網頁視圖。",
    failedSaveDrawing: "塗鴉資料儲存失敗。",
    failedImportFile: "匯入檔案失敗。",
    editTextDraw: "編輯文字 / 塗鴉",
    editTextDrawHidden: "編輯文字 / 塗鴉（塗鴉已隱藏）",
    editWebviewDraw: "編輯網頁 / 塗鴉",
    selectDrawings: "選擇元素",
    editMarkdownTool: "編輯 MD",
    pen: "筆",
    watercolorBrush: "水彩筆",
    floatingText: "浮動文字",
    undoLastDrawing: "復原上一筆",
    redoDrawing: "重做塗鴉",
    deleteSelectedDrawing: "刪除選取元素",
    penSettings: "畫筆設定",
    advancedColor: "進階顏色",
    penWidth: "筆寬",
    penOpacity: "筆透明度",
    textGroup: "文字",
    buttonGroup: "按鈕/方向",
    textPlain: "普通文字",
    title: "標題",
    code: "程式碼",
    button: "按鈕",
    primaryButton: "主按鈕",
    outlineButton: "線框",
    pillButton: "膠囊",
    arrowUp: "上",
    arrowDown: "下",
    arrowLeft: "左",
    arrowRight: "右",
    fileTag: "檔案標籤",
    importGroup: "匯入",
    image: "圖片",
    video: "影片",
    file: "檔案",
    previewGroup: "預覽",
    markdown: "MD",
    html: "HTML",
    note: "筆記",
    bold: "粗體",
    italic: "斜體",
    underline: "底線",
    inlineCode: "行內程式碼",
    keyboardTag: "鍵盤標籤",
    superscript: "上標",
    subscript: "下標",
    codeBlock: "程式碼區塊",
    highlight: "醒目提示",
    insertBreak: "換行",
    clearFormat: "清除格式",
    textColor: "文字顏色",
    highlightColor: "醒目顏色",
    textSize: "字級",
    size: "字級",
    movePanel: "移動面板",
    useColor: "使用顏色 {color}",
    settingsSectionInterface: "介面",
    settingsSectionPen: "筆",
    settingsSectionWatercolor: "水彩筆",
    settingsSectionInteraction: "互動",
    settingsSectionPerformance: "效能",
    settingsSectionLayout: "佈局",
    settingsSectionDiagnostics: "診斷",
    settingsSectionSupport: "支持作者",
    settingsLanguage: "語言",
    settingsLanguageDesc: "插件介面語言。自動模式會盡量跟隨 Obsidian。",
    languageAuto: "自動",
    defaultPenColor: "預設筆色",
    defaultPenColorDesc: "新筆畫的初始顏色。",
    defaultPenWidth: "預設筆寬",
    defaultPenWidthDesc: "初始筆寬。",
    defaultPenOpacity: "預設筆透明度",
    defaultPenOpacityDesc: "初始筆透明度。",
    defaultWatercolorColor: "預設水彩顏色",
    defaultWatercolorColorDesc: "新水彩筆畫的初始顏色。",
    defaultWatercolorWidth: "預設水彩筆寬",
    defaultWatercolorWidthDesc: "初始水彩筆寬。",
    defaultWatercolorOpacity: "預設水彩透明度",
    defaultWatercolorOpacityDesc: "初始水彩透明度。",
    toolbarTopOffset: "工具列頂部偏移",
    toolbarTopOffsetDesc: "距離 Obsidian 頂部列的額外像素。",
    longPressMs: "長按延遲",
    longPressMsDesc: "長按開啟次級控制的等待時間。",
    selectTapDistance: "點擊容差",
    selectTapDistanceDesc: "移動多少像素後從點擊變成拖動或塗鴉。",
    selectStrokePadding: "選取命中範圍",
    selectStrokePaddingDesc: "元素周圍額外可點範圍，越大越容易選中。",
    selectedStrokeAlpha: "選中元素透明度",
    selectedStrokeAlphaDesc: "元素被選中編輯時的預覽透明度。",
    drawingInterpolationStep: "筆畫平滑",
    drawingInterpolationStepDesc: "數值越小，採樣點之間補點越多，線條越順。",
    drawingMinPointDistance: "輸入採樣間距",
    drawingMinPointDistanceDesc: "塗鴉時保留新點的最小距離，越小越細膩。",
    drawingCompactDistance: "儲存壓縮",
    drawingCompactDistanceDesc: "自動儲存時的點位壓縮強度，越小越保留細節。",
    autoSaveDelayMs: "自動儲存延遲",
    autoSaveDelayMsDesc: "塗鴉改變後寫入插件資料夾前的等待時間。",
    resetBrushDefaults: "重置畫筆預設值",
    resetBrushDefaultsDesc: "恢復筆和水彩筆的內建預設顏色、大小和透明度。",
    resetLayoutDefaults: "重置佈局和互動",
    resetLayoutDefaultsDesc: "恢復工具列、選取、平滑和自動儲存的預設值。",
    reset: "重置",
    debugLog: "除錯日誌",
    debugLogDesc: "僅排查問題時，將文字儲存診斷寫入插件資料夾。",
    supportTitle: "支持 NoteDraw / 雙碼",
    supportSubtitle: "可用支付寶或幣安掃碼支持後續維護。",
    supportCodeAlipay: "支付寶",
    supportCodeBinance: "幣安",
    bringToFront: "置頂",
    sendToBack: "置底",
    moveForward: "上移一層",
    moveBackward: "下移一層",
    lockElement: "鎖定",
    unlockElement: "解鎖"
  },
  ug: {
    toggleCommand: "ئوقۇش تەھرىر ۋە سىزىش ھالىتىنى ئالماشتۇرۇش",
    openNoteOrWebviewFirst: "ئاۋۋال خاتىرە ياكى تور كۆزنەكىنى ئېچىڭ.",
    failedSaveDrawing: "سىزىش سانلىق مەلۇماتىنى ساقلاش مەغلۇپ بولدى.",
    failedImportFile: "ھۆججەت كىرگۈزۈش مەغلۇپ بولدى.",
    editTextDraw: "تېكىست تەھرىرلەش / سىزىش",
    editTextDrawHidden: "تېكىست تەھرىرلەش / سىزىش (سىزىش يوشۇرۇلغان)",
    editWebviewDraw: "تور بەتنى تەھرىرلەش / سىزىش",
    selectDrawings: "ئېلېمېنت تاللاش",
    editMarkdownTool: "MD تەھرىرلەش",
    pen: "قەلەم",
    watercolorBrush: "سۇ بوياق قەلەم",
    floatingText: "لەيلەپ تۇرغان تېكىست",
    undoLastDrawing: "ئاخىرقى سىزىشنى قايتۇرۇش",
    redoDrawing: "قايتا قىلىش",
    deleteSelectedDrawing: "تاللانغاننى ئۆچۈرۈش",
    penSettings: "قەلەم تەڭشىكى",
    advancedColor: "تەپسىلىي رەڭ",
    penWidth: "قەلەم كەڭلىكى",
    penOpacity: "قەلەم سۈزۈكلۈكى",
    textGroup: "تېكىست",
    buttonGroup: "كۇنۇپكا/يۆنىلىش",
    textPlain: "تېكىست",
    title: "ماۋزۇ",
    code: "كود",
    button: "كۇنۇپكا",
    primaryButton: "ئاساسىي",
    outlineButton: "سىزىقلىق",
    pillButton: "يۇمىلاق",
    arrowUp: "ئۈستى",
    arrowDown: "ئاستى",
    arrowLeft: "سول",
    arrowRight: "ئوڭ",
    fileTag: "ھۆججەت بەلگىسى",
    importGroup: "كىرگۈزۈش",
    image: "رەسىم",
    video: "سىن",
    file: "ھۆججەت",
    previewGroup: "ئالدىن كۆرۈش",
    markdown: "MD",
    html: "HTML",
    note: "خاتىرە",
    bold: "توم",
    italic: "قىيپاش",
    underline: "ئاستى سىزىق",
    inlineCode: "قۇر ئىچى كود",
    keyboardTag: "كىرگۈزگۈچ بەلگىسى",
    superscript: "ئۈستكى بەلگە",
    subscript: "ئاستى بەلگە",
    codeBlock: "كود بۆلىكى",
    highlight: "يورۇتۇش",
    insertBreak: "قۇر ئالماشتۇرۇش",
    clearFormat: "فورماتنى تازىلاش",
    textColor: "تېكىست رەڭگى",
    highlightColor: "يورۇتۇش رەڭگى",
    textSize: "خەت چوڭلۇقى",
    size: "چوڭلۇق",
    movePanel: "تاختىنى يۆتكەش",
    useColor: "{color} رەڭنى ئىشلىتىش",
    settingsSectionInterface: "كۆرۈنمە يۈزى",
    settingsSectionPen: "قەلەم",
    settingsSectionWatercolor: "سۇ بوياق قەلەم",
    settingsSectionLayout: "جايلىشىش",
    settingsSectionDiagnostics: "دىئاگنوز",
    settingsLanguage: "تىل",
    settingsLanguageDesc: "قىستۇرما كۆرۈنمە يۈزى تىلى. ئاپتوماتىك ھالەت Obsidian غا ئەگىشىدۇ.",
    languageAuto: "ئاپتوماتىك",
    defaultPenColor: "كۆڭۈلدىكى قەلەم رەڭگى",
    defaultPenColorDesc: "يېڭى قەلەم سىزىقىنىڭ دەسلەپكى رەڭگى.",
    defaultPenWidth: "كۆڭۈلدىكى قەلەم كەڭلىكى",
    defaultPenWidthDesc: "دەسلەپكى قەلەم كەڭلىكى.",
    defaultPenOpacity: "كۆڭۈلدىكى قەلەم سۈزۈكلۈكى",
    defaultPenOpacityDesc: "دەسلەپكى قەلەم سۈزۈكلۈكى.",
    defaultWatercolorColor: "كۆڭۈلدىكى سۇ بوياق رەڭگى",
    defaultWatercolorColorDesc: "يېڭى سۇ بوياق سىزىقىنىڭ دەسلەپكى رەڭگى.",
    defaultWatercolorWidth: "كۆڭۈلدىكى سۇ بوياق كەڭلىكى",
    defaultWatercolorWidthDesc: "دەسلەپكى سۇ بوياق كەڭلىكى.",
    defaultWatercolorOpacity: "كۆڭۈلدىكى سۇ بوياق سۈزۈكلۈكى",
    defaultWatercolorOpacityDesc: "دەسلەپكى سۇ بوياق سۈزۈكلۈكى.",
    toolbarTopOffset: "قورال بالداق ئۈستى ئارىلىقى",
    toolbarTopOffsetDesc: "Obsidian باش قىسمىدىن قوشۇمچە پىكسېل.",
    debugLog: "سازلاش خاتىرىسى",
    debugLogDesc: "پەقەت مەسىلە تەكشۈرگەندە تېكىست ساقلاش دىئاگنوزىنى قىستۇرما قىسقۇچىغا يازىدۇ.",
    supportTitle: "NoteDraw نى قوللاش",
    supportSubtitle: "Alipay ياكى Binance ئارقىلىق كودنى سىكانىرلاپ قوللىسىڭىز بولىدۇ.",
    supportCodeAlipay: "Alipay",
    supportCodeBinance: "Binance",
    bringToFront: "ئەڭ ئۈستىگە",
    sendToBack: "ئەڭ ئاستىغا",
    moveForward: "ئۈستىگە يۆتكە",
    moveBackward: "ئاستىغا يۆتكە",
    lockElement: "قۇلۇپلاش",
    unlockElement: "قۇلۇپنى ئېچىش"
  },
  ru: {
    toggleCommand: "Переключить редактирование предпросмотра и рисование",
    openNoteOrWebviewFirst: "Сначала откройте заметку или webview.",
    failedSaveDrawing: "Не удалось сохранить данные рисунка.",
    failedImportFile: "Не удалось импортировать файл.",
    editTextDraw: "Редактировать текст / рисовать",
    editTextDrawHidden: "Редактировать текст / рисовать (рисунки скрыты)",
    editWebviewDraw: "Редактировать webview / рисовать",
    selectDrawings: "Выбрать элементы",
    editMarkdownTool: "Редактировать MD",
    pen: "Перо",
    watercolorBrush: "Акварельная кисть",
    floatingText: "Плавающий текст",
    undoLastDrawing: "Отменить последний рисунок",
    redoDrawing: "Повторить рисунок",
    deleteSelectedDrawing: "Удалить выбранное",
    penSettings: "Настройки пера",
    advancedColor: "Расширенный цвет",
    penWidth: "Толщина пера",
    penOpacity: "Прозрачность пера",
    textGroup: "Текст",
    buttonGroup: "Кнопки/стрелки",
    textPlain: "Текст",
    title: "Заголовок",
    code: "Код",
    button: "Кнопка",
    primaryButton: "Основная",
    outlineButton: "Контур",
    pillButton: "Плашка",
    arrowUp: "Вверх",
    arrowDown: "Вниз",
    arrowLeft: "Влево",
    arrowRight: "Вправо",
    fileTag: "Метка файла",
    importGroup: "Импорт",
    image: "Изображение",
    video: "Видео",
    file: "Файл",
    previewGroup: "Предпросмотр",
    markdown: "MD",
    html: "HTML",
    note: "Заметка",
    bold: "Жирный",
    italic: "Курсив",
    underline: "Подчеркивание",
    inlineCode: "Встроенный код",
    keyboardTag: "Тег клавиатуры",
    superscript: "Верхний индекс",
    subscript: "Нижний индекс",
    codeBlock: "Блок кода",
    highlight: "Выделение",
    insertBreak: "Перенос строки",
    clearFormat: "Очистить форматирование",
    textColor: "Цвет текста",
    highlightColor: "Цвет выделения",
    textSize: "Размер текста",
    size: "Размер",
    movePanel: "Переместить панель",
    useColor: "Использовать цвет {color}",
    settingsSectionInterface: "Интерфейс",
    settingsSectionPen: "Перо",
    settingsSectionWatercolor: "Акварель",
    settingsSectionLayout: "Макет",
    settingsSectionDiagnostics: "Диагностика",
    settingsLanguage: "Язык",
    settingsLanguageDesc: "Язык интерфейса плагина. Авто по возможности следует Obsidian.",
    languageAuto: "Авто",
    defaultPenColor: "Цвет пера по умолчанию",
    defaultPenColorDesc: "Начальный цвет новых штрихов пера.",
    defaultPenWidth: "Толщина пера по умолчанию",
    defaultPenWidthDesc: "Начальная толщина пера.",
    defaultPenOpacity: "Прозрачность пера по умолчанию",
    defaultPenOpacityDesc: "Начальная прозрачность пера.",
    defaultWatercolorColor: "Цвет акварели по умолчанию",
    defaultWatercolorColorDesc: "Начальный цвет акварельных штрихов.",
    defaultWatercolorWidth: "Толщина акварели по умолчанию",
    defaultWatercolorWidthDesc: "Начальная толщина акварели.",
    defaultWatercolorOpacity: "Прозрачность акварели по умолчанию",
    defaultWatercolorOpacityDesc: "Начальная прозрачность акварели.",
    toolbarTopOffset: "Смещение панели сверху",
    toolbarTopOffsetDesc: "Дополнительные пиксели ниже заголовка Obsidian.",
    debugLog: "Журнал отладки",
    debugLogDesc: "Записывать диагностику сохранения текста в папку плагина только при отладке.",
    supportTitle: "Поддержать NoteDraw",
    supportSubtitle: "Сканируйте через Alipay или Binance, чтобы поддержать разработку.",
    supportCodeAlipay: "Alipay",
    supportCodeBinance: "Binance",
    bringToFront: "На передний план",
    sendToBack: "На задний план",
    moveForward: "Выше",
    moveBackward: "Ниже",
    lockElement: "Закрепить",
    unlockElement: "Открепить"
  }
};
Object.assign(I18N, {
  ar: Object.assign({}, I18N.en, {
    toggleCommand: "تبديل وضع تحرير المعاينة والرسم",
    openNoteOrWebviewFirst: "افتح ملاحظة أو عرض ويب أولا.",
    failedSaveDrawing: "فشل حفظ بيانات الرسم.",
    failedImportFile: "فشل استيراد الملف.",
    editTextDraw: "تحرير النص / الرسم",
    editTextDrawHidden: "تحرير النص / الرسم (الرسومات مخفية)",
    editWebviewDraw: "تحرير عرض الويب / الرسم",
    selectDrawings: "تحديد العناصر",
    editMarkdownTool: "تحرير MD",
    pen: "قلم",
    watercolorBrush: "فرشاة مائية",
    floatingText: "نص عائم",
    undoLastDrawing: "تراجع عن آخر رسم",
    redoDrawing: "إعادة الرسم",
    deleteSelectedDrawing: "حذف المحدد",
    penSettings: "إعدادات القلم",
    textGroup: "نص",
    importGroup: "استيراد",
    image: "صورة",
    video: "فيديو",
    file: "ملف",
    previewGroup: "معاينة",
    bold: "غامق",
    italic: "مائل",
    underline: "تحته خط",
    highlight: "تمييز",
    clearFormat: "مسح التنسيق",
    settingsSectionInterface: "الواجهة",
    settingsSectionPen: "القلم",
    settingsSectionWatercolor: "الألوان المائية",
    settingsSectionLayout: "التخطيط",
    settingsSectionDiagnostics: "التشخيص",
    movePanel: "تحريك اللوحة",
    settingsLanguage: "اللغة",
    languageAuto: "تلقائي",
    supportTitle: "دعم NoteDraw",
    supportSubtitle: "امسح عبر Alipay أو Binance لدعم الصيانة.",
    supportCodeAlipay: "Alipay",
    supportCodeBinance: "Binance"
  }),
  es: Object.assign({}, I18N.en, {
    toggleCommand: "Cambiar edición de vista previa y dibujo",
    openNoteOrWebviewFirst: "Abre primero una nota o webview.",
    failedSaveDrawing: "No se pudieron guardar los datos de dibujo.",
    failedImportFile: "No se pudo importar el archivo.",
    editTextDraw: "Editar texto / dibujar",
    editTextDrawHidden: "Editar texto / dibujar (dibujos ocultos)",
    editWebviewDraw: "Editar webview / dibujar",
    selectDrawings: "Seleccionar elementos",
    editMarkdownTool: "Editar MD",
    pen: "Pluma",
    watercolorBrush: "Pincel acuarela",
    floatingText: "Texto flotante",
    undoLastDrawing: "Deshacer último dibujo",
    redoDrawing: "Rehacer dibujo",
    deleteSelectedDrawing: "Eliminar seleccionado",
    penSettings: "Ajustes de pluma",
    advancedColor: "Color avanzado",
    textGroup: "Texto",
    importGroup: "Importar",
    previewGroup: "Vista previa",
    bold: "Negrita",
    italic: "Cursiva",
    underline: "Subrayado",
    clearFormat: "Quitar formato",
    settingsSectionInterface: "Interfaz",
    settingsSectionPen: "Pluma",
    settingsSectionWatercolor: "Acuarela",
    settingsSectionLayout: "Diseño",
    settingsSectionDiagnostics: "Diagnóstico",
    movePanel: "Mover panel",
    settingsLanguage: "Idioma",
    languageAuto: "Auto",
    supportTitle: "Apoyar NoteDraw",
    supportSubtitle: "Escanea con Alipay o Binance para apoyar el mantenimiento.",
    supportCodeAlipay: "Alipay",
    supportCodeBinance: "Binance"
  }),
  fr: Object.assign({}, I18N.en, {
    toggleCommand: "Basculer édition de l'aperçu et dessin",
    openNoteOrWebviewFirst: "Ouvrez d'abord une note ou une webview.",
    failedSaveDrawing: "Échec de l'enregistrement du dessin.",
    failedImportFile: "Échec de l'import du fichier.",
    editTextDraw: "Modifier le texte / dessiner",
    editTextDrawHidden: "Modifier le texte / dessiner (dessins masqués)",
    editWebviewDraw: "Modifier la webview / dessiner",
    selectDrawings: "Sélectionner les éléments",
    editMarkdownTool: "Modifier MD",
    pen: "Stylo",
    watercolorBrush: "Pinceau aquarelle",
    floatingText: "Texte flottant",
    undoLastDrawing: "Annuler le dernier dessin",
    redoDrawing: "Rétablir le dessin",
    deleteSelectedDrawing: "Supprimer la sélection",
    penSettings: "Réglages du stylo",
    advancedColor: "Couleur avancée",
    textGroup: "Texte",
    importGroup: "Importer",
    previewGroup: "Aperçu",
    bold: "Gras",
    italic: "Italique",
    underline: "Souligné",
    clearFormat: "Effacer le format",
    settingsSectionInterface: "Interface",
    settingsSectionPen: "Stylo",
    settingsSectionWatercolor: "Aquarelle",
    settingsSectionLayout: "Disposition",
    settingsSectionDiagnostics: "Diagnostics",
    movePanel: "Déplacer le panneau",
    settingsLanguage: "Langue",
    languageAuto: "Auto",
    supportTitle: "Soutenir NoteDraw",
    supportSubtitle: "Scannez avec Alipay ou Binance pour soutenir la maintenance.",
    supportCodeAlipay: "Alipay",
    supportCodeBinance: "Binance"
  }),
  de: Object.assign({}, I18N.en, {
    toggleCommand: "Vorschau-Bearbeitung und Zeichnen umschalten",
    openNoteOrWebviewFirst: "Öffne zuerst eine Notiz oder Webview.",
    failedSaveDrawing: "Zeichnungsdaten konnten nicht gespeichert werden.",
    failedImportFile: "Datei konnte nicht importiert werden.",
    editTextDraw: "Text bearbeiten / zeichnen",
    editTextDrawHidden: "Text bearbeiten / zeichnen (Zeichnungen ausgeblendet)",
    editWebviewDraw: "Webview bearbeiten / zeichnen",
    selectDrawings: "Elemente auswählen",
    editMarkdownTool: "MD bearbeiten",
    pen: "Stift",
    watercolorBrush: "Aquarellpinsel",
    floatingText: "Schwebender Text",
    undoLastDrawing: "Letzte Zeichnung rückgängig",
    redoDrawing: "Zeichnung wiederholen",
    deleteSelectedDrawing: "Auswahl löschen",
    penSettings: "Stifteinstellungen",
    advancedColor: "Erweiterte Farbe",
    textGroup: "Text",
    importGroup: "Import",
    previewGroup: "Vorschau",
    bold: "Fett",
    italic: "Kursiv",
    underline: "Unterstrichen",
    clearFormat: "Formatierung löschen",
    settingsSectionInterface: "Oberfläche",
    settingsSectionPen: "Stift",
    settingsSectionWatercolor: "Aquarell",
    settingsSectionLayout: "Layout",
    settingsSectionDiagnostics: "Diagnose",
    movePanel: "Panel verschieben",
    settingsLanguage: "Sprache",
    languageAuto: "Auto",
    supportTitle: "NoteDraw unterstützen",
    supportSubtitle: "Mit Alipay oder Binance scannen, um die Wartung zu unterstützen.",
    supportCodeAlipay: "Alipay",
    supportCodeBinance: "Binance"
  }),
  ja: Object.assign({}, I18N.en, {
    toggleCommand: "プレビュー編集と描画モードを切り替え",
    openNoteOrWebviewFirst: "先にノートまたは webview を開いてください。",
    failedSaveDrawing: "描画データの保存に失敗しました。",
    failedImportFile: "ファイルのインポートに失敗しました。",
    editTextDraw: "文字編集 / 描画",
    editTextDrawHidden: "文字編集 / 描画（描画は非表示）",
    editWebviewDraw: "webview 編集 / 描画",
    selectDrawings: "要素を選択",
    editMarkdownTool: "MD 編集",
    pen: "ペン",
    watercolorBrush: "水彩ブラシ",
    floatingText: "フローティング文字",
    undoLastDrawing: "最後の描画を元に戻す",
    redoDrawing: "描画をやり直す",
    deleteSelectedDrawing: "選択を削除",
    penSettings: "ペン設定",
    advancedColor: "詳細カラー",
    textGroup: "文字",
    importGroup: "インポート",
    previewGroup: "プレビュー",
    bold: "太字",
    italic: "斜体",
    underline: "下線",
    clearFormat: "書式をクリア",
    settingsSectionInterface: "インターフェース",
    settingsSectionPen: "ペン",
    settingsSectionWatercolor: "水彩",
    settingsSectionLayout: "レイアウト",
    settingsSectionDiagnostics: "診断",
    movePanel: "パネルを移動",
    settingsLanguage: "言語",
    languageAuto: "自動",
    supportTitle: "NoteDraw を支援",
    supportSubtitle: "Alipay または Binance でスキャンして保守を支援できます。",
    supportCodeAlipay: "Alipay",
    supportCodeBinance: "Binance"
  }),
  ko: Object.assign({}, I18N.en, {
    toggleCommand: "미리보기 편집 및 그리기 모드 전환",
    openNoteOrWebviewFirst: "먼저 노트 또는 webview를 여세요.",
    failedSaveDrawing: "그리기 데이터를 저장하지 못했습니다.",
    failedImportFile: "파일을 가져오지 못했습니다.",
    editTextDraw: "텍스트 편집 / 그리기",
    editTextDrawHidden: "텍스트 편집 / 그리기(그림 숨김)",
    editWebviewDraw: "webview 편집 / 그리기",
    selectDrawings: "요소 선택",
    editMarkdownTool: "MD 편집",
    pen: "펜",
    watercolorBrush: "수채화 브러시",
    floatingText: "플로팅 텍스트",
    undoLastDrawing: "마지막 그리기 취소",
    redoDrawing: "그리기 다시 실행",
    deleteSelectedDrawing: "선택 삭제",
    penSettings: "펜 설정",
    advancedColor: "고급 색상",
    textGroup: "텍스트",
    importGroup: "가져오기",
    previewGroup: "미리보기",
    bold: "굵게",
    italic: "기울임",
    underline: "밑줄",
    clearFormat: "서식 지우기",
    settingsSectionInterface: "인터페이스",
    settingsSectionPen: "펜",
    settingsSectionWatercolor: "수채화",
    settingsSectionLayout: "레이아웃",
    settingsSectionDiagnostics: "진단",
    movePanel: "패널 이동",
    settingsLanguage: "언어",
    languageAuto: "자동",
    supportTitle: "NoteDraw 지원",
    supportSubtitle: "Alipay 또는 Binance로 스캔하여 유지 관리를 지원할 수 있습니다.",
    supportCodeAlipay: "Alipay",
    supportCodeBinance: "Binance"
  }),
  tr: Object.assign({}, I18N.en, {
    toggleCommand: "Önizleme düzenleme ve çizim modunu değiştir",
    openNoteOrWebviewFirst: "Önce bir not veya webview açın.",
    failedSaveDrawing: "Çizim verileri kaydedilemedi.",
    failedImportFile: "Dosya içe aktarılamadı.",
    editTextDraw: "Metni düzenle / çiz",
    editTextDrawHidden: "Metni düzenle / çiz (çizimler gizli)",
    editWebviewDraw: "Webview düzenle / çiz",
    selectDrawings: "Ögeleri seç",
    editMarkdownTool: "MD düzenle",
    pen: "Kalem",
    watercolorBrush: "Sulu boya fırçası",
    floatingText: "Yüzen metin",
    undoLastDrawing: "Son çizimi geri al",
    redoDrawing: "Çizimi yinele",
    deleteSelectedDrawing: "Seçileni sil",
    penSettings: "Kalem ayarları",
    advancedColor: "Gelişmiş renk",
    textGroup: "Metin",
    importGroup: "İçe aktar",
    previewGroup: "Önizleme",
    bold: "Kalın",
    italic: "İtalik",
    underline: "Altı çizili",
    clearFormat: "Biçimi temizle",
    settingsSectionInterface: "Arayüz",
    settingsSectionPen: "Kalem",
    settingsSectionWatercolor: "Suluboya",
    settingsSectionLayout: "Yerleşim",
    settingsSectionDiagnostics: "Tanılama",
    movePanel: "Paneli taşı",
    settingsLanguage: "Dil",
    languageAuto: "Otomatik",
    supportTitle: "NoteDraw'u destekle",
    supportSubtitle: "Bakımı desteklemek için Alipay veya Binance ile tarayın.",
    supportCodeAlipay: "Alipay",
    supportCodeBinance: "Binance"
  })
});
var DEFAULT_SETTINGS = {
  language: LANGUAGE_AUTO,
  defaultPenColor: "#e53935",
  defaultPenWidth: 3,
  defaultPenOpacity: DEFAULT_PEN_OPACITY,
  defaultWatercolorColor: "#3b82f6",
  defaultWatercolorWidth: 9,
  defaultWatercolorOpacity: 0.45,
  toolbarTopOffset: 6,
  longPressMs: LONG_PRESS_MS,
  selectTapDistance: SELECT_TAP_DISTANCE,
  selectStrokePadding: SELECT_STROKE_PADDING,
  selectedStrokeAlpha: SELECTED_STROKE_ALPHA,
  drawingInterpolationStep: DRAWING_INTERPOLATION_STEP_PX,
  drawingMinPointDistance: DRAWING_MIN_POINT_DISTANCE_PX,
  drawingCompactDistance: DRAWING_COMPACT_DISTANCE_PX,
  autoSaveDelayMs: 500,
  enableDebugLog: false
};
var MARKDOWN_TEXT_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,blockquote,td,th,.callout-content";
var EDITABLE_SELECTOR = [
  ".markdown-preview-view",
  ".markdown-embed-content",
  ".internal-embed"
].flatMap((root) => MARKDOWN_TEXT_SELECTOR.split(",").map((selector) => `${root} ${selector}`)).join(",");
var BLOCKED_EDIT_SELECTOR = [
  ".notedraw-button",
  ".notedraw-toolbar",
  ".notedraw-palette-panel",
  ".notedraw-selection-menu",
  ".notedraw-static-canvas",
  ".notedraw-canvas",
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "pre",
  "code",
  "img",
  "svg",
  "canvas",
  ".external-embed",
  ".frontmatter",
  ".metadata-container"
].join(",");
var WEBVIEW_EDITABLE_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "blockquote",
  "td",
  "th",
  "label",
  "summary",
  "figcaption",
  "caption",
  "a",
  "span",
  "div"
].join(",");
var WEBVIEW_BLOCKED_EDIT_SELECTOR = [
  ".notedraw-button",
  ".notedraw-toolbar",
  ".notedraw-palette-panel",
  ".notedraw-text-panel",
  ".notedraw-selection-menu",
  ".notedraw-embed-layer",
  ".notedraw-static-canvas",
  ".notedraw-canvas",
  "button",
  "input",
  "textarea",
  "select",
  "pre",
  "code",
  "img",
  "svg",
  "canvas",
  "video",
  "audio",
  "webview",
  "iframe"
].join(",");
var NoteDrawPlugin = class extends Plugin {
  async onload() {
    const savedSettings = await this.loadData();
    this.noteDrawSettings = sanitizeSettings({ ...DEFAULT_SETTINGS, ...(savedSettings || {}) });
    this.controllers = /* @__PURE__ */ new WeakMap();
    this.liveControllers = /* @__PURE__ */ new Set();
    this.sourceControllers = /* @__PURE__ */ new Map();
    this.webviewControllers = /* @__PURE__ */ new Map();
    this.headerActions = /* @__PURE__ */ new Map();
    this.saveTimers = /* @__PURE__ */ new Map();
    this.pendingDrawingSaves = /* @__PURE__ */ new Map();
    this.drawingWritePromises = /* @__PURE__ */ new Map();
    this.drawingStateCache = /* @__PURE__ */ new Map();
    this.viewDrawingActive = /* @__PURE__ */ new WeakMap();
    this.viewToolbarState = /* @__PURE__ */ new WeakMap();
    this.textSaveStates = /* @__PURE__ */ new WeakMap();
    this.apiListeners = /* @__PURE__ */ new Map();
    this.settingsSaveTimer = null;
    this.webviewSyncTimer = null;
    this.floatingControlsSyncTimer = null;
    this.webviewMutationObserver = null;
    this.api = this.createPublicApi();
    if (typeof window !== "undefined") {
      window.NoteDraw = this.api;
    }
    cleanupAllDrawingHeaderButtons();
    this.addCommand({
      id: "toggle-draw-mode",
      name: this.t("toggleCommand"),
      callback: () => this.toggleActiveController()
    });
    this.addSettingTab(new NoteDrawSettingTab(this.app, this));
    const syncSurfaces = () => {
      this.pruneDisconnectedControllers();
      this.syncRenderedMarkdownAnnotations();
      this.syncSourceControllers();
      this.syncMarkdownControllerModes();
      this.syncWebviewControllers();
      for (const controller of this.liveControllers) {
        controller.syncFloatingControlClasses();
        if (controller.active || controller.drawingsLoaded || isElementVisibleEnough(controller.previewEl)) {
          controller.scheduleLayoutRefresh({ settle: false });
        }
      }
    };
    this.registerEvent(this.app.workspace.on("layout-change", syncSurfaces));
    this.registerEvent(this.app.workspace.on("active-leaf-change", syncSurfaces));
    this.registerEvent(this.app.workspace.on("file-open", syncSurfaces));
    this.installWebviewObserver();
    window.setTimeout(syncSurfaces, 0);
    this.registerMarkdownPostProcessor((el, ctx) => {
      const renderedSourcePath = resolveRenderedSourcePath(this.app, el, ctx.sourcePath);
      annotateEditableElements(el, ctx, renderedSourcePath);
      const preview = el.closest(".markdown-preview-view");
      if (!preview || isEmbeddedPreview(preview)) {
        return;
      }
      const view = findOwningMarkdownView(this.app, preview, ctx.sourcePath);
      if (!view || !view.file || !ctx.sourcePath || view.file.path !== ctx.sourcePath) {
        return;
      }
      const existingController = this.controllers.get(preview) || preview._noteDrawController;
      if (existingController?.plugin === this && !existingController.destroyed) {
        existingController.setFile(view.file).catch((error) => {
          console.error(`[${PLUGIN_ID}] Failed to switch preview controller file`, error);
        });
        return;
      }
      if (existingController?.destroy) {
        existingController.destroy();
      }
      cleanupDrawingUi(preview);
      const controller = new PreviewDrawingController(this, preview, view, view.file);
      this.controllers.set(preview, controller);
      controller.mount();
      window.setTimeout(() => this.syncWebviewControllers(), 0);
    });
  }
  onunload() {
    for (const controller of Array.from(this.liveControllers)) {
      controller.destroy();
    }
    this.liveControllers.clear();
    this.sourceControllers.clear();
    this.webviewControllers.clear();
    for (const state of this.headerActions.values()) {
      state.button?.remove();
    }
    this.headerActions.clear();
    cleanupAllDrawingHeaderButtons();
    for (const [path, timer] of this.saveTimers.entries()) {
      window.clearTimeout(timer);
      this.flushDrawingSave(path).catch((error) => {
        console.error(`[${PLUGIN_ID}] Failed to flush drawing data during unload`, error);
      });
    }
    this.saveTimers.clear();
    this.pendingDrawingSaves.clear();
    if (this.settingsSaveTimer !== null) {
      window.clearTimeout(this.settingsSaveTimer);
      this.settingsSaveTimer = null;
    }
    if (this.webviewSyncTimer !== null) {
      window.clearTimeout(this.webviewSyncTimer);
      this.webviewSyncTimer = null;
    }
    if (this.floatingControlsSyncTimer !== null) {
      window.clearTimeout(this.floatingControlsSyncTimer);
      this.floatingControlsSyncTimer = null;
    }
    this.webviewMutationObserver?.disconnect();
    this.webviewMutationObserver = null;
    this.apiListeners?.clear();
    if (typeof window !== "undefined" && window.NoteDraw === this.api) {
      delete window.NoteDraw;
    }
  }
  async saveSettings() {
    this.noteDrawSettings = sanitizeSettings(this.noteDrawSettings);
    await this.saveData(this.noteDrawSettings);
    for (const controller of this.getAllControllers()) {
      controller.applySettings();
      controller.refreshLocalizedLabels?.();
    }
    this.refreshLocalizedButtons();
  }
  scheduleSettingsSave() {
    if (this.settingsSaveTimer !== null) {
      window.clearTimeout(this.settingsSaveTimer);
    }
    this.settingsSaveTimer = window.setTimeout(() => {
      this.settingsSaveTimer = null;
      this.saveSettings().catch((error) => {
        console.error(`[${PLUGIN_ID}] Failed to save settings`, error);
      });
    }, SETTINGS_SAVE_DELAY_MS);
  }
  t(key, vars = {}) {
    return translateNoteDraw(this, key, vars);
  }
  setAccessibleLabel(element, key, vars = {}) {
    setAccessibleLabel(element, this.t(key, vars));
  }
  refreshLocalizedButtons() {
    for (const state of this.headerActions.values()) {
      const controller = state.button?._noteDrawController || state.controller;
      this.setAccessibleLabel(state.button, controller?.surfaceType === "webview" ? "editWebviewDraw" : "editTextDraw");
    }
    for (const controller of this.webviewControllers.values()) {
      this.setAccessibleLabel(controller.button, "editWebviewDraw");
    }
  }
  getAllControllers() {
    const controllers = Array.from(this.liveControllers).filter((controller) => !controller.destroyed);
    activeDocument.querySelectorAll(".notedraw-shell").forEach((element) => {
      const controller = element._noteDrawController;
      if (controller?.plugin === this && !controllers.includes(controller)) {
        controllers.push(controller);
      }
    });
    return controllers;
  }
  pruneDisconnectedControllers() {
    for (const controller of Array.from(this.liveControllers)) {
      if (controller.destroyed || !controller.previewEl?.isConnected) {
        controller.destroy();
      }
    }
  }
  controllerActivationState(controller) {
    const key = this.controllerStateKey(controller);
    return key ? Boolean(this.viewDrawingActive.get(key)) : false;
  }
  controllerStateKey(controller) {
    const view = controller?.view;
    return view?.leaf || findOwningLeaf(this.app, view?.containerEl || controller?.previewEl) || view || controller?.previewEl || null;
  }
  controllerToolbarState(controller) {
    const key = this.controllerStateKey(controller);
    return key ? this.viewToolbarState.get(key) || null : null;
  }
  setControllerToolbarState(controller, state) {
    const key = this.controllerStateKey(controller);
    if (!key) {
      return;
    }
    const next = {
      ...(this.viewToolbarState.get(key) || {}),
      ...state
    };
    this.viewToolbarState.set(key, next);
    for (const candidate of this.liveControllers) {
      if (!candidate.destroyed && candidate !== controller && this.controllerStateKey(candidate) === key) {
        candidate.applySharedToolbarState(next);
      }
    }
  }
  setControllerActivation(controller, active) {
    const key = this.controllerStateKey(controller);
    const enabled = Boolean(active);
    if (key) {
      this.viewDrawingActive.set(key, enabled);
    }
    for (const candidate of this.liveControllers) {
      const candidateKey = this.controllerStateKey(candidate);
      if (!candidate.destroyed && candidateKey === key) {
        const eager = !enabled || candidate === controller || isElementVisibleEnough(candidate.previewEl);
        candidate.applyActiveState(enabled, { eager });
      }
    }
  }
  installWebviewObserver() {
    if (typeof MutationObserver === "undefined" || !activeDocument?.body) {
      return;
    }
    this.webviewMutationObserver = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => isWebviewSyncMutation(mutation))) {
        this.scheduleWebviewSync();
      }
      if (mutations.some((mutation) => isFloatingControlsVisibilityMutation(mutation))) {
        this.scheduleFloatingControlsSync();
      }
    });
    this.webviewMutationObserver.observe(activeDocument.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-url", "src", "class"]
    });
  }
  scheduleFloatingControlsSync() {
    if (this.floatingControlsSyncTimer !== null) {
      return;
    }
    this.floatingControlsSyncTimer = window.setTimeout(() => {
      this.floatingControlsSyncTimer = null;
      for (const controller of this.liveControllers) {
        controller.syncFloatingControlClasses();
      }
    }, 40);
  }
  scheduleWebviewSync() {
    if (this.webviewSyncTimer !== null) {
      return;
    }
    this.webviewSyncTimer = window.setTimeout(() => {
      this.webviewSyncTimer = null;
      this.syncWebviewControllers();
    }, 120);
  }
  createPublicApi() {
    const capabilities = Object.freeze({
      responsiveCoordinates: RESPONSIVE_POINT_BASIS,
      responsiveElements: ELEMENT_LAYOUT_BASIS,
      embeddedMarkdownEditing: true,
      readingViewEditing: true,
      sourceViewEditing: true,
      events: ["drawings-changed", "markdown-changed", "surface-changed"],
      tools: [TOOL_DRAW, TOOL_SELECT, TOOL_EDIT_MD, TOOL_TEXT]
    });
    const v1 = {
      apiVersion: "1.0",
      capabilities,
      resolveFile: (fileOrPath, sourcePath = "") => this.resolveApiFile(fileOrPath, sourcePath),
      listSurfaces: () => this.getAllControllers().map((controller) => this.describeController(controller)),
      getActiveSurface: () => this.describeController(this.getActiveController()),
      activate: async (options = {}) => this.activateApi(options),
      setTool: (tool, options = {}) => this.setApiTool(tool, options),
      readDrawings: async (fileOrPath) => {
        const file = this.resolveApiFile(fileOrPath);
        if (!file) {
          throw new Error("NoteDraw could not resolve the requested file");
        }
        return this.readDrawings(file);
      },
      writeDrawings: async (fileOrPath, data) => {
        const file = this.resolveApiFile(fileOrPath);
        if (!file) {
          throw new Error("NoteDraw could not resolve the requested file");
        }
        const normalized = normalizeDrawingData(data, file);
        await this.writeDrawings(file, normalized);
        this.refreshControllersForFile(file, normalized);
        return normalized;
      },
      getStoragePaths: (fileOrPath) => {
        const file = this.resolveApiFile(fileOrPath);
        return file ? {
          current: this.drawingPathForFile(file),
          legacy: this.legacyDrawingPathForFile(file)
        } : null;
      },
      replaceText: async (options) => this.replaceTextApi(options),
      insertStroke: async (fileOrPath, stroke) => this.insertStrokeApi(fileOrPath, stroke),
      refresh: async (fileOrPath) => {
        const file = this.resolveApiFile(fileOrPath);
        if (!file) {
          return { ok: false, reason: "missing-file" };
        }
        const data = await this.readDrawings(file);
        return { ok: true, refreshed: this.refreshControllersForFile(file, data) };
      },
      injectExportSnapshot: async (fileOrPath, container) => {
        const file = this.resolveApiFile(fileOrPath);
        return file ? this.injectExportSnapshot(file, container) : null;
      },
      on: (eventName, listener) => this.onApiEvent(eventName, listener)
    };
    return {
      version: "3.1.51",
      apiVersion: v1.apiVersion,
      capabilities,
      v1,
      getActiveController: () => this.getActiveController(),
      readDrawings: v1.readDrawings,
      writeDrawings: v1.writeDrawings,
      getStoragePaths: v1.getStoragePaths,
      injectExportSnapshot: v1.injectExportSnapshot,
      replaceSelectionText: async (file, originalText, editedText) => this.replaceTextApi({ file, originalText, editedText }),
      insertStroke: v1.insertStroke,
      on: v1.on
    };
  }
  resolveApiFile(fileOrPath, sourcePath = "") {
    if (fileOrPath && typeof fileOrPath === "object" && typeof fileOrPath.path === "string") {
      return getVaultFileByPath(this.app.vault, fileOrPath.path) || fileOrPath;
    }
    const path = normalizeVaultPath(fileOrPath);
    if (!path) {
      return null;
    }
    return getVaultFileByPath(this.app.vault, path) || this.app.metadataCache.getFirstLinkpathDest?.(path, sourcePath || "") || null;
  }
  describeController(controller) {
    if (!controller || controller.destroyed) {
      return null;
    }
    return {
      file: controller.file?.path || "",
      surface: controller.surfaceType,
      active: Boolean(controller.active),
      tool: controller.toolMode,
      drawingsLoaded: Boolean(controller.drawingsLoaded),
      coordinateBasis: RESPONSIVE_POINT_BASIS
    };
  }
  findApiController(options = {}) {
    const requestedPath = normalizeVaultPath(options.file?.path || options.path || options.file || "");
    const requestedSurface = String(options.surface || "").trim();
    const controllers = this.getAllControllers();
    const matches = controllers.filter((controller) => {
      if (requestedPath && normalizeVaultPath(controller.file?.path) !== requestedPath) {
        return false;
      }
      if (requestedSurface && controller.surfaceType !== requestedSurface) {
        return false;
      }
      return controller.previewEl?.isConnected;
    });
    return matches.find((controller) => isElementVisibleEnough(controller.previewEl)) || matches.find((controller) => controller.active) || matches[0] || this.getActiveController();
  }
  async activateApi(options = {}) {
    const controller = this.findApiController(options);
    if (!controller) {
      return { ok: false, reason: "surface-not-found" };
    }
    if (!controller.active) {
      await controller.toggle();
    }
    if (options.tool) {
      controller.setToolFromApi(options.tool, options);
    }
    const surface = this.describeController(controller);
    this.emitApiEvent("surface-changed", surface);
    return { ok: true, surface };
  }
  setApiTool(tool, options = {}) {
    const controller = this.findApiController(options);
    if (!controller) {
      return { ok: false, reason: "surface-not-found" };
    }
    const ok = controller.setToolFromApi(tool, options);
    const surface = this.describeController(controller);
    if (ok) {
      this.emitApiEvent("surface-changed", surface);
    }
    return { ok, surface };
  }
  async replaceTextApi(options = {}) {
    const file = this.resolveApiFile(options.file || options.path, options.sourcePath || "");
    if (!file) {
      return { changed: false, reason: "missing-file" };
    }
    const originalText = String(options.originalText || "");
    const editedText = String(options.editedText ?? options.text ?? "");
    const sourceInfo = options.sourceInfo || null;
    const source = await this.app.vault.read(file);
    const target = resolveSourceEditTarget(source, sourceInfo, originalText);
    if (!target) {
      return { changed: false, reason: "target-not-found" };
    }
    return this.saveTextBlock(file, originalText, editedText, sourceInfo, target);
  }
  async insertStrokeApi(fileOrPath, stroke) {
    const file = this.resolveApiFile(fileOrPath);
    if (!file) {
      throw new Error("NoteDraw could not resolve the requested file");
    }
    const data = await this.readDrawings(file);
    const normalized = normalizeStroke(stroke);
    if (normalized.points.length) {
      data.strokes.push(normalized);
      await this.writeDrawings(file, data);
      this.refreshControllersForFile(file, data);
    }
    return data;
  }
  refreshControllersForFile(file, data, options = {}) {
    let refreshed = 0;
    for (const controller of this.getAllControllers()) {
      if (
        normalizeVaultPath(controller.file?.path) !== normalizeVaultPath(file?.path) ||
        controller.drawingData === options.excludeData ||
        controller.pointerDown ||
        controller.draggingStroke ||
        controller.resizingSelection
      ) {
        continue;
      }
      controller.drawingData = normalizeDrawingData(data, file);
      controller.drawingsLoaded = true;
      controller.responsivePointsInitialized = false;
      controller.responsiveLayoutSignature = "";
      controller.responsiveLayoutContext = null;
      controller.invalidateStaticCache();
      if (isElementVisibleEnough(controller.previewEl)) {
        controller.scheduleLayoutRefresh({ settle: false });
        controller.requestRender(true);
      }
      refreshed += 1;
    }
    return refreshed;
  }
  onApiEvent(eventName, listener) {
    if (typeof listener !== "function") {
      return () => void 0;
    }
    const name = String(eventName || "");
    let listeners = this.apiListeners.get(name);
    if (!listeners) {
      listeners = /* @__PURE__ */ new Set();
      this.apiListeners.set(name, listeners);
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  emitApiEvent(eventName, detail) {
    for (const listener of Array.from(this.apiListeners?.get(eventName) || [])) {
      try {
        listener(detail);
      } catch (error) {
        console.error(`[${PLUGIN_ID}] API listener failed`, error);
      }
    }
  }
  resolveEditableFile(element, fallbackFile) {
    const sourcePath = normalizeVaultPath(element?.dataset?.noteDrawSourcePath || "");
    return this.resolveApiFile(sourcePath) || fallbackFile;
  }
  getActiveController() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const activeContainer = activeView?.containerEl;
    if (activeView instanceof MarkdownView) {
      const surface = findPrimaryMarkdownSurface(activeView);
      const controller = surface ? this.controllers.get(surface) || surface._noteDrawController : null;
      if (controller) {
        return controller;
      }
    }
    if (activeContainer) {
      const activeWebview = Array.from(this.webviewControllers.values()).find((controller) => controller.previewEl?.isConnected && activeContainer.contains(controller.previewEl));
      if (activeWebview) {
        return activeWebview;
      }
    }
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const surface = view ? findPrimaryMarkdownSurface(view) : null;
    return surface ? this.controllers.get(surface) || surface._noteDrawController : null;
  }
  toggleActiveController() {
    const controller = this.getActiveController();
    if (!controller) {
      new Notice(this.t("openNoteOrWebviewFirst"));
      return;
    }
    controller.toggle().catch((error) => {
      console.error(`[${PLUGIN_ID}] Failed to toggle NoteDraw`, error);
    });
  }
  syncRenderedMarkdownAnnotations() {
    const leaves = this.app.workspace.getLeavesOfType?.("markdown") || [];
    for (const leaf of leaves) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || !view.file || !view.containerEl) {
        continue;
      }
      annotateVisibleMarkdownElements(this.app, view.containerEl, view.file.path);
    }
  }
  syncSourceControllers() {
    const leaves = this.app.workspace.getLeavesOfType?.("markdown") || [];
    const activeViews = /* @__PURE__ */ new Set();
    for (const leaf of leaves) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || !view.file) {
        continue;
      }
      const sourceEl = findSourceSurfaceForView(view);
      const shouldMount = Boolean(sourceEl) && (isSourceMode(view) || isElementVisibleEnough(sourceEl));
      const existing = this.sourceControllers.get(view);
      if (!shouldMount) {
        if (existing) {
          existing.destroy();
          this.sourceControllers.delete(view);
        }
        continue;
      }
      activeViews.add(view);
      if (existing?.previewEl === sourceEl) {
        existing.setFile(view.file).catch((error) => {
          console.error(`[${PLUGIN_ID}] Failed to switch source controller file`, error);
        });
        continue;
      }
      if (existing) {
        existing.destroy();
      }
      const mountedOnElement = this.controllers.get(sourceEl) || sourceEl._noteDrawController;
      if (mountedOnElement?.destroy) {
        mountedOnElement.destroy();
      }
      cleanupDrawingUi(sourceEl);
      const controller = new PreviewDrawingController(this, sourceEl, view, view.file, {
        allowTextEdit: false,
        surfaceType: "source"
      });
      this.controllers.set(sourceEl, controller);
      this.sourceControllers.set(view, controller);
      controller.mount().catch((error) => {
        console.error(`[${PLUGIN_ID}] Failed to mount source drawing controller`, error);
      });
    }
    for (const [view, controller] of Array.from(this.sourceControllers.entries())) {
      if (!activeViews.has(view) && !controller.previewEl?.isConnected) {
        controller.destroy();
        this.sourceControllers.delete(view);
      }
    }
  }
  syncMarkdownControllerModes() {
    const leaves = this.app.workspace.getLeavesOfType?.("markdown") || [];
    for (const leaf of leaves) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) {
        continue;
      }
      const preview = findRootPreviewForView(view);
      const source = findSourceSurfaceForView(view);
      let previewController = preview ? this.controllers.get(preview) || preview._noteDrawController : null;
      const sourceController = source ? this.controllers.get(source) || source._noteDrawController : null;
      const previewVisible = isElementVisibleEnough(preview);
      if (isSourceMode(view)) {
        previewController?.destroy();
        continue;
      }
      sourceController?.syncFloatingControlClasses();
      if (previewVisible && (!previewController || previewController.destroyed || previewController.file?.path !== view.file?.path)) {
        previewController?.destroy();
        previewController = this.resolveLivePreviewController(view);
      }
    }
  }
  syncWebviewControllers() {
    const surfaces = findWebviewSurfaces(activeDocument);
    const activeSurfaces = /* @__PURE__ */ new Set();
    for (const surface of surfaces) {
      if (!surface?.isConnected) {
        continue;
      }
      activeSurfaces.add(surface);
      const view = findOwningWorkspaceView(this.app, surface);
      const file = createWebviewDrawingFile(surface, view);
      const existing = this.webviewControllers.get(surface);
      if (existing?.previewEl === surface) {
        existing.setFile(file).catch((error) => {
          console.error(`[${PLUGIN_ID}] Failed to switch webview controller file`, error);
        });
        continue;
      }
      if (existing) {
        existing.destroy();
      }
      const mountedOnElement = surface._noteDrawController;
      if (mountedOnElement?.plugin === this && mountedOnElement.surfaceType === "webview") {
        mountedOnElement.setFile(file).catch((error) => {
          console.error(`[${PLUGIN_ID}] Failed to switch webview controller file`, error);
        });
        this.webviewControllers.set(surface, mountedOnElement);
        continue;
      }
      if (mountedOnElement?.destroy) {
        mountedOnElement.destroy();
      }
      cleanupDrawingUi(surface);
      const controller = new PreviewDrawingController(this, surface, view, file, {
        allowTextEdit: true,
        surfaceType: "webview"
      });
      this.controllers.set(surface, controller);
      this.webviewControllers.set(surface, controller);
      controller.mount().catch((error) => {
        console.error(`[${PLUGIN_ID}] Failed to mount webview drawing controller`, error);
      });
    }
    for (const [surface, controller] of Array.from(this.webviewControllers.entries())) {
      if (!activeSurfaces.has(surface) || !surface.isConnected) {
        controller.destroy();
        this.webviewControllers.delete(surface);
      }
    }
  }
  installHeaderButton(controller) {
    if (controller.surfaceType === "webview") {
      return this.installSurfaceButton(controller);
    }
    const view = controller.view;
    let state = this.headerActions.get(view);
    if (!state || !state.button?.isConnected) {
      state = {
        button: null,
        controller: null,
        controllers: /* @__PURE__ */ new Set()
      };
      state.clickHandler = (event) => this.resolveHeaderController(view, state, { preferPreviewOnAppleTouch: isAppleTouchEvent(event) })?.onButtonClick(event);
      state.pointerDownHandler = (event) => this.resolveHeaderController(view, state, { preferPreviewOnAppleTouch: false })?.onButtonPointerDown(event);
      state.pointerUpHandler = (event) => this.resolveHeaderController(view, state, { preferPreviewOnAppleTouch: false })?.onButtonPointerUp(event);
      state.touchEndHandler = (event) => this.resolveHeaderController(view, state, { preferPreviewOnAppleTouch: true })?.onButtonTouchEnd(event);
      let button = null;
      if (typeof view?.addAction === "function") {
        button = view.addAction("wand-sparkles", this.t("editTextDraw"), state.clickHandler);
      }
      if (!button) {
        const actions = view?.containerEl?.querySelector(".view-actions");
        button = activeDocument.createElement("div");
        button.classList.add("clickable-icon", "view-action");
        setIcon(button, "wand-sparkles");
        button.addEventListener("click", state.clickHandler);
        if (actions) {
          actions.appendChild(button);
        } else {
          controller.previewEl.appendChild(button);
          button.classList.add("notedraw-fallback-button");
        }
      }
      button.addEventListener("pointerdown", state.pointerDownHandler);
      button.addEventListener("pointerup", state.pointerUpHandler);
      button.addEventListener("pointercancel", state.pointerUpHandler);
      button.addEventListener("pointerleave", state.pointerUpHandler);
      button.addEventListener("touchend", state.touchEndHandler, { passive: false });
      state.button = button;
      this.headerActions.set(view, state);
    }
    if (!state.controllers) {
      state.controllers = /* @__PURE__ */ new Set();
    }
    state.controllers.add(controller);
    state.controller = this.pickHeaderController(view, state, controller);
    state.button._noteDrawController = state.controller || controller;
    state.button.classList.add("notedraw-header-button");
    state.button.classList.toggle("notedraw-webview-button", state.button._noteDrawController?.surfaceType === "webview");
    this.setAccessibleLabel(state.button, state.button._noteDrawController?.surfaceType === "webview" ? "editWebviewDraw" : "editTextDraw");
    state.button.classList.toggle("is-active", Boolean(state.button._noteDrawController?.active));
    this.cleanupHeaderButtons(view, state.button);
    return state.button;
  }
  installSurfaceButton(controller) {
    const actions = findWebviewButtonHost(controller.previewEl, controller.view);
    const inline = actions && !actions.classList?.contains("view-actions");
    const button = activeDocument.createElement(inline ? "button" : "div");
    if (inline) {
      button.setAttribute("type", "button");
    }
    button.classList.add("clickable-icon", "notedraw-webview-button");
    if (inline) {
      button.classList.add("mwv-icon-button", "notedraw-webview-inline-button");
    } else {
      button.classList.add("view-action");
    }
    setIcon(button, "wand-sparkles");
    this.setAccessibleLabel(button, "editWebviewDraw");
    button.addEventListener("click", (event) => controller.onButtonClick(event));
    button.addEventListener("pointerdown", () => controller.onButtonPointerDown());
    button.addEventListener("pointerup", () => controller.onButtonPointerUp());
    button.addEventListener("pointercancel", () => controller.onButtonPointerUp());
    button.addEventListener("pointerleave", () => controller.onButtonPointerUp());
    button.addEventListener("touchend", (event) => controller.onButtonTouchEnd(event), { passive: false });
    if (actions) {
      actions.appendChild(button);
    } else {
      controller.previewEl.appendChild(button);
      button.classList.add("notedraw-fallback-button");
    }
    button._noteDrawController = controller;
    return button;
  }
  releaseHeaderButton(controller) {
    if (controller.surfaceType === "webview") {
      controller.button?.remove();
      return;
    }
    const state = this.headerActions.get(controller.view);
    if (!state) {
      return;
    }
    state.controllers?.delete(controller);
    if (state.controller === controller) {
      state.controller = this.pickHeaderController(controller.view, state);
    }
    if (state.controller) {
      state.button._noteDrawController = state.controller;
      state.button.classList.toggle("is-active", state.controller.active);
      state.button.classList.toggle("notedraw-webview-button", state.controller.surfaceType === "webview");
      return;
    }
    if (state.button?._noteDrawController) {
      delete state.button._noteDrawController;
    }
    state.button?.classList.remove("is-active");
    if (!controller.view?.containerEl?.isConnected) {
      state.button?.remove();
      this.headerActions.delete(controller.view);
      this.cleanupHeaderButtons(controller.view);
    }
  }
  resolveHeaderController(view, state, options = {}) {
    const controller = this.pickHeaderController(view, state, null, options);
    if (controller) {
      state.controller = controller;
      state.button._noteDrawController = controller;
      state.button.classList.toggle("is-active", controller.active);
      state.button.classList.toggle("notedraw-webview-button", controller.surfaceType === "webview");
    }
    return controller;
  }
  pickHeaderController(view, state, preferred = null, options = {}) {
    const controllers = Array.from(state.controllers || []).filter((controller) => controller?.previewEl?.isConnected && controller.view === view && controller.surfaceType !== "webview");
    if (options.preferPreviewOnAppleTouch && isAppleMobileRuntime() && isReadingSurfaceVisible(view)) {
      const previewController = this.resolveLivePreviewController(view, controllers);
      if (previewController) {
        return previewController;
      }
    }
    const currentMode = currentMarkdownSurfaceType(view);
    const preferredLive = preferred && controllers.includes(preferred) ? preferred : null;
    return controllers.find((controller) => controller.surfaceType === currentMode) || preferredLive || controllers.find((controller) => controller.active) || controllers[0] || null;
  }
  resolveLivePreviewController(view, controllers = []) {
    const preview = findRootPreviewForView(view);
    if (!preview || !view?.file) {
      return null;
    }
    const existing = this.controllers.get(preview) || preview._noteDrawController;
    if (existing?.plugin === this && !existing.destroyed && existing.previewEl?.isConnected && existing.surfaceType === "preview") {
      return existing;
    }
    const registered = controllers.find((controller) => controller.surfaceType === "preview" && controller.previewEl === preview);
    if (registered) {
      return registered;
    }
    cleanupDrawingUi(preview);
    const controller = new PreviewDrawingController(this, preview, view, view.file);
    this.controllers.set(preview, controller);
    controller.mount().catch((error) => {
      console.error(`[${PLUGIN_ID}] Failed to mount preview drawing controller`, error);
    });
    return controller;
  }
  cleanupHeaderButtons(view, keepButton = null) {
    view?.containerEl?.querySelectorAll(".notedraw-header-button").forEach((button) => {
      if (button !== keepButton) {
        button.remove();
      }
    });
  }
  async ensureDrawingDir() {
    const base = this.app.vault.configDir;
    const pluginDir = `${base}/plugins/${PLUGIN_ID}`;
    const drawingDir = `${pluginDir}/drawings`;
    await this.ensureFolder(`${base}/plugins`);
    await this.ensureFolder(pluginDir);
    await this.ensureFolder(drawingDir);
    return drawingDir;
  }
  async ensureAssetDir() {
    const base = this.app.vault.configDir;
    const pluginDir = `${base}/plugins/${PLUGIN_ID}`;
    const assetDir = `${pluginDir}/assets`;
    await this.ensureFolder(`${base}/plugins`);
    await this.ensureFolder(pluginDir);
    await this.ensureFolder(assetDir);
    return assetDir;
  }
  async ensureFolder(path) {
    const adapter = this.app.vault.adapter;
    const parts = normalizeVaultPath(path).split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!await adapter.exists(current)) {
        await adapter.mkdir(current);
      }
    }
  }
  encodedDrawingNameForFile(file) {
    const encoded = file.path.replace(/\\/g, "/").replace(/[^a-zA-Z0-9._/-]/g, "_").replace(/\//g, "__");
    return `${encoded}.json`;
  }
  drawingPathForFile(file) {
    return `${this.app.vault.configDir}/plugins/${DRAWING_DIR}/${this.encodedDrawingNameForFile(file)}`;
  }
  assetPathForName(name) {
    return `${this.app.vault.configDir}/plugins/${ASSET_DIR}/${sanitizeAssetFileName(name)}`;
  }
  legacyDrawingPathForFile(file) {
    return `${this.app.vault.configDir}/plugins/${LEGACY_DRAWING_DIR}/${this.encodedDrawingNameForFile(file)}`;
  }
  debugLogPath() {
    return `${this.app.vault.configDir}/plugins/${PLUGIN_ID}/${DEBUG_LOG_FILE}`;
  }
  async importLocalAsset(fileLike) {
    if (!fileLike) {
      return null;
    }
    await this.ensureAssetDir();
    const originalName = sanitizeAssetFileName(fileLike.name || "attachment.bin");
    const targetName = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}-${originalName}`;
    const targetPath = this.assetPathForName(targetName);
    const buffer = await fileLike.arrayBuffer();
    await this.app.vault.adapter.writeBinary(targetPath, buffer);
    const mime = fileLike.type || guessMimeType(originalName);
    const text = isTextAssetMime(originalName, mime) && typeof fileLike.text === "function" ? await fileLike.text() : "";
    const imageDataUrl = classifyImportedAsset({ name: originalName, mime }) === EMBED_IMAGE ? arrayBufferToDataUrl(buffer, mime) : "";
    return {
      path: targetPath,
      name: originalName,
      mime,
      size: Number(fileLike.size || buffer.byteLength || 0),
      text,
      imageDataUrl
    };
  }
  async assetDataUrl(assetPath, mime = "") {
    if (!assetPath) {
      return "";
    }
    try {
      const buffer = await this.app.vault.adapter.readBinary(normalizeVaultPath(assetPath));
      return arrayBufferToDataUrl(buffer, mime || guessMimeType(assetPath));
    } catch (error) {
      void error;
      return "";
    }
  }
  async appendDebugLog(entry) {
    if (!this.noteDrawSettings?.enableDebugLog) {
      return;
    }
    try {
      await this.ensureDrawingDir();
      const path = this.debugLogPath();
      const adapter = this.app.vault.adapter;
      const line = JSON.stringify({
        time: (/* @__PURE__ */ new Date()).toISOString(),
        ...entry
      });
      let lines = [];
      if (await adapter.exists(path)) {
        lines = String(await adapter.read(path) || "").split(/\r?\n/).filter(Boolean).slice(-(DEBUG_LOG_LIMIT - 1));
      }
      lines.push(line);
      await adapter.write(path, `${lines.join("\n")}
`);
    } catch (error) {
      console.error(`[${PLUGIN_ID}] Failed to write debug log`, error);
    }
  }
  async readDrawings(file) {
    const path = this.drawingPathForFile(file);
    const legacyPath = this.legacyDrawingPathForFile(file);
    const adapter = this.app.vault.adapter;
    const cached = this.drawingStateCache.get(path);
    if (cached) {
      return normalizeDrawingData(cached, file);
    }
    try {
      if (await adapter.exists(path)) {
        const data = normalizeDrawingData(JSON.parse(await adapter.read(path)), file);
        this.drawingStateCache.set(path, normalizeDrawingData(data, file));
        return data;
      }
      if (await adapter.exists(legacyPath)) {
        const migrated = normalizeDrawingData(JSON.parse(await adapter.read(legacyPath)), file);
        await this.writeDrawings(file, migrated);
        return migrated;
      }
      const empty = createEmptyDrawingData(file);
      this.drawingStateCache.set(path, normalizeDrawingData(empty, file));
      return empty;
    } catch (error) {
      console.error(`[${PLUGIN_ID}] Failed to read drawing file`, error);
      return createEmptyDrawingData(file);
    }
  }
  scheduleDrawingSave(file, data, options = {}) {
    const path = this.drawingPathForFile(file);
    const canonical = normalizeDrawingDataForStorage(data, file);
    this.drawingStateCache.set(path, canonical);
    this.pendingDrawingSaves.set(path, file);
    this.refreshControllersForFile(file, canonical, { excludeData: options.excludeData || data });
    const previous = this.saveTimers.get(path);
    if (previous) {
      window.clearTimeout(previous);
    }
    const timer = window.setTimeout(() => {
      this.saveTimers.delete(path);
      this.flushDrawingSave(path).catch((error) => {
        console.error(`[${PLUGIN_ID}] Failed to save drawing file`, error);
        new Notice(this.t("failedSaveDrawing"));
      });
    }, this.noteDrawSettings?.autoSaveDelayMs ?? DEFAULT_SETTINGS.autoSaveDelayMs);
    this.saveTimers.set(path, timer);
  }
  async flushDrawingSave(path) {
    const file = this.pendingDrawingSaves.get(path);
    const latest = this.drawingStateCache.get(path);
    if (!file) {
      return;
    }
    this.pendingDrawingSaves.delete(path);
    const previousWrite = this.drawingWritePromises.get(path) || Promise.resolve();
    const write = previousWrite.catch(() => void 0).then(async () => {
      if (!latest) {
        return;
      }
      const compacted = normalizeDrawingDataForStorage(latest, file);
      compactDrawingData(compacted, this.noteDrawSettings?.drawingCompactDistance ?? DEFAULT_SETTINGS.drawingCompactDistance);
      await this.writeDrawings(file, compacted, { refresh: false, updateCache: false });
    });
    this.drawingWritePromises.set(path, write);
    try {
      await write;
    } finally {
      if (this.drawingWritePromises.get(path) === write) {
        this.drawingWritePromises.delete(path);
      }
    }
  }
  async writeDrawings(file, data, options = {}) {
    await this.ensureDrawingDir();
    const path = this.drawingPathForFile(file);
    const normalized = normalizeDrawingDataForStorage(data, file);
    const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    normalized.updatedAt = updatedAt;
    if (options.updateCache !== false) {
      this.drawingStateCache.set(path, normalizeDrawingData(normalized, file));
    }
    const body = JSON.stringify({
      ...normalized,
      sourcePath: file.path,
      updatedAt
    }, null, 2);
    await this.app.vault.adapter.write(path, body);
    if (options.refresh !== false) {
      this.refreshControllersForFile(file, normalized, { excludeData: data });
    }
    this.emitApiEvent("drawings-changed", {
      file: file.path,
      storagePath: path,
      strokeCount: normalized.strokes.length,
      updatedAt
    });
  }
  async injectExportSnapshot(file, container) {
    if (!file || !(container instanceof HTMLElement)) {
      return null;
    }
    const host = findNoteDrawExportHost(container);
    const liveLayer = host.querySelector(".notedraw-embed-layer");
    const liveDrawingData = host._noteDrawController?.drawingData || container._noteDrawController?.drawingData || null;
    const imageLayer = await this.injectExportImageCanvasLayer(file, host, liveDrawingData);
    if (liveLayer instanceof HTMLElement) {
      await prepareExportImages(liveLayer);
      return imageLayer || liveLayer;
    }
    return imageLayer;
  }
  async injectExportImageCanvasLayer(file, container, drawingData = null) {
    container.querySelectorAll(".notedraw-export-image-canvas-layer").forEach((element) => element.remove());
    const data = drawingData || await this.readDrawings(file);
    const imageStrokes = (Array.isArray(data?.strokes) ? data.strokes : []).filter(isImageEmbedStroke);
    if (!imageStrokes.length) {
      return null;
    }
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(container.scrollWidth || rect.width || 1));
    const height = Math.max(1, Math.ceil(container.scrollHeight || rect.height || 1));
    if (getComputedStyle(container).position === "static") {
      applyElementStyles(container, { position: "relative" });
    }
    const layer = activeDocument.createElement("div");
    layer.className = "notedraw-export-image-canvas-layer";
    applyElementStyles(layer, {
      position: "absolute",
      zIndex: "58",
      top: "0",
      left: "0",
      right: "auto",
      bottom: "auto",
      width: `${width}px`,
      height: `${height}px`,
      pointerEvents: "none",
      userSelect: "none",
      background: "transparent"
    });
    container.appendChild(layer);
    let drewImage = false;
    for (const stroke of imageStrokes) {
      drewImage = await this.drawExportImageStrokeOn(layer, stroke, width, height) || drewImage;
    }
    if (!drewImage) {
      layer.remove();
      return null;
    }
    window.setTimeout(() => {
      layer.remove();
    }, 3e4);
    return layer;
  }
  async drawExportImageStrokeOn(layer, stroke, width, height) {
    const bounds = getStrokeBounds(stroke, width, height);
    if (!bounds) {
      return false;
    }
    const source = normalizeImageDataUrl(stroke.exportImageDataUrl) || await this.assetDataUrl(stroke.assetPath, stroke.assetMime || guessMimeType(stroke.assetName || stroke.assetPath));
    if (!source) {
      return false;
    }
    const image = await loadExportImage(source, 2200);
    if (!image?.naturalWidth || !image?.naturalHeight) {
      return false;
    }
    const x = Math.round(bounds.minX);
    const y = Math.round(bounds.minY);
    const boxWidth = Math.max(1, Math.round(bounds.maxX - bounds.minX));
    const boxHeight = Math.max(1, Math.round(bounds.maxY - bounds.minY));
    const fit = objectFitContain(image.naturalWidth, image.naturalHeight, boxWidth, boxHeight);
    const scale = Math.min(2, Math.max(1, Number(window.devicePixelRatio || 1)));
    const canvas = activeDocument.createElement("canvas");
    canvas.className = "notedraw-export-image-canvas";
    canvas.width = Math.ceil(boxWidth * scale);
    canvas.height = Math.ceil(boxHeight * scale);
    const opacity = clamp(Number(stroke.opacity ?? 1), 0, 1);
    canvas.dataset.notedrawAssetPath = stroke.assetPath || "";
    canvas.dataset.notedrawAssetName = stroke.assetName || "";
    canvas.dataset.notedrawAssetMime = stroke.assetMime || "";
    canvas.dataset.notedrawAssetSize = String(stroke.assetSize || 0);
    applyElementStyles(canvas, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      width: `${boxWidth}px`,
      height: `${boxHeight}px`,
      pointerEvents: "none",
      userSelect: "none",
      background: "#fff",
      opacity: String(opacity)
    });
    const context = canvas.getContext("2d");
    if (!context) {
      return false;
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, boxWidth, boxHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.globalAlpha = opacity;
    context.drawImage(image, fit.x, fit.y, fit.width, fit.height);
    layer.appendChild(canvas);
    return true;
  }
  getPluginAssetPath(relativePath) {
    const pluginDir = this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
    return normalizePath(`${pluginDir}/${relativePath}`);
  }
  async getOptionalAssetResourcePath(relativePath) {
    const assetPath = this.getPluginAssetPath(relativePath);
    if (!await this.app.vault.adapter.exists(assetPath)) {
      return null;
    }
    return this.app.vault.adapter.getResourcePath(assetPath);
  }
  prepareTextEditState(file, originalText, element) {
    const state = this.getTextSaveState(file, originalText, element);
    state.file = file;
    state.baselineText = originalText;
    state.latestText = originalText;
    state.latestSourceInfo = getSourceInfo(element);
    state.target = null;
    state.targetPromise = this.resolveTextEditTarget(file, originalText, element).then((target) => {
      state.target = target;
      return target;
    }).catch((error) => {
      console.error(`[${PLUGIN_ID}] Failed to resolve text edit target`, error);
      return null;
    });
    return state;
  }
  async resolveTextEditTarget(file, originalText, element) {
    const sourceInfo = getSourceInfo(element);
    const source = await this.app.vault.read(file);
    const target = resolveSourceEditTarget(source, sourceInfo, originalText);
    this.appendDebugLog({
      event: "resolve-target",
      file: file.path,
      sourceInfo: summarizeSourceInfo(sourceInfo),
      original: shortText(originalText),
      hasTarget: Boolean(target),
      target: summarizeTarget(target)
    });
    return target;
  }
  scheduleTextSave(file, originalText, editedText, element) {
    const state = this.getTextSaveState(file, originalText, element);
    state.file = file;
    state.latestText = editedText;
    state.latestSourceInfo = getSourceInfo(element);
    state.saveBlocked = false;
    state.saveLogged = false;
    if (!state.target && !state.targetPromise) {
      state.targetPromise = this.resolveTextEditTarget(file, originalText, element).then((target) => {
        state.target = target;
        return target;
      }).catch((error) => {
        console.error(`[${PLUGIN_ID}] Failed to resolve text edit target`, error);
        return null;
      });
    }
    if (state.timer) {
      window.clearTimeout(state.timer);
    }
    element.addClass("notedraw-saving");
    state.timer = window.setTimeout(() => {
      state.timer = null;
      this.flushTextSave(element);
    }, TEXT_SAVE_DELAY_MS);
  }
  scheduleTextSaveNow(file, originalText, editedText, element) {
    const state = this.getTextSaveState(file, originalText, element);
    state.file = file;
    state.latestText = editedText;
    state.latestSourceInfo = getSourceInfo(element);
    state.saveBlocked = false;
    state.saveLogged = false;
    if (!state.target && !state.targetPromise) {
      state.targetPromise = this.resolveTextEditTarget(file, originalText, element).then((target) => {
        state.target = target;
        return target;
      }).catch((error) => {
        console.error(`[${PLUGIN_ID}] Failed to resolve text edit target`, error);
        return null;
      });
    }
    if (state.timer) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
    element.addClass("notedraw-saving");
    this.flushTextSave(element);
  }
  getTextSaveState(file, originalText, element) {
    let state = this.textSaveStates.get(element);
    if (!state) {
      state = {
        file,
        baselineText: originalText,
        latestText: originalText,
        latestSourceInfo: getSourceInfo(element),
        target: null,
        targetPromise: null,
        timer: null,
        saving: false,
        pending: false,
        saveBlocked: false,
        warningLogged: false,
        saveLogged: false
      };
      this.textSaveStates.set(element, state);
    }
    return state;
  }
  async flushTextSave(element) {
    const state = this.textSaveStates.get(element);
    if (!state) {
      return;
    }
    if (state.saving) {
      state.pending = true;
      return;
    }
    const baselineText = state.baselineText;
    const latestText = state.latestText;
    if (normalizeEditableSourceText(baselineText) === normalizeEditableSourceText(latestText)) {
      element.removeClass("notedraw-saving");
      return;
    }
    state.saving = true;
    try {
      if (state.targetPromise) {
        state.target = await state.targetPromise;
        state.targetPromise = null;
      }
      const result = await this.saveTextBlock(
        state.file,
        baselineText,
        latestText,
        state.latestSourceInfo,
        state.target
      );
      if (result.changed) {
        state.baselineText = latestText;
        state.target = result.target || state.target;
        state.warningLogged = false;
        state.saveBlocked = false;
        element.dataset.noteDrawOriginal = latestText;
        element.removeClass("notedraw-save-failed");
        if (!state.saveLogged) {
          this.appendDebugLog({
            event: "save-ok",
            file: state.file?.path,
            sourceInfo: summarizeSourceInfo(state.latestSourceInfo),
            target: summarizeTarget(state.target),
            original: shortText(baselineText),
            edited: shortText(latestText)
          });
          state.saveLogged = true;
        }
      } else {
        element.addClass("notedraw-save-failed");
        state.saveBlocked = true;
        if (!state.warningLogged) {
          console.warn(`[${PLUGIN_ID}] Could not find the original block to update`, {
            path: state.file?.path,
            sourceInfo: state.latestSourceInfo,
            originalLength: String(baselineText || "").length,
            editedLength: String(latestText || "").length
          });
          this.appendDebugLog({
            event: "save-miss",
            file: state.file?.path,
            sourceInfo: summarizeSourceInfo(state.latestSourceInfo),
            target: summarizeTarget(state.target),
            original: shortText(baselineText),
            edited: shortText(latestText)
          });
          state.warningLogged = true;
        }
      }
    } catch (error) {
      console.error(`[${PLUGIN_ID}] Failed to save text block`, error);
      element.addClass("notedraw-save-failed");
      this.appendDebugLog({
        event: "save-error",
        file: state.file?.path,
        sourceInfo: summarizeSourceInfo(state.latestSourceInfo),
        target: summarizeTarget(state.target),
        error: String(error?.message || error)
      });
    } finally {
      state.saving = false;
    }
    if (state.pending || normalizeEditableSourceText(state.baselineText) !== normalizeEditableSourceText(state.latestText)) {
      if (state.saveBlocked) {
        element.removeClass("notedraw-saving");
        return;
      }
      state.pending = false;
      state.timer = window.setTimeout(() => {
        state.timer = null;
        this.flushTextSave(element);
      }, TEXT_SAVE_DELAY_MS);
      return;
    }
    element.removeClass("notedraw-saving");
  }
  async saveTextBlock(file, originalText, editedText, sourceInfo, target) {
    const normalizedOriginal = normalizeRenderedText(originalText);
    if (!normalizedOriginal || normalizeEditableSourceText(originalText) === normalizeEditableSourceText(editedText)) {
      return { changed: true, target };
    }
    const source = await this.app.vault.read(file);
    const match = resolveLockedTarget(source, target, originalText) || resolveSourceEditTarget(source, sourceInfo, originalText);
    if (!match) {
      return { changed: false, target };
    }
    const replacement = formatReplacementBlock(match.text, editedText);
    const start = match.start;
    const end = match.end;
    const currentText = source.slice(start, end);
    const nextTarget = createTextEditTarget({
      ...match,
      end: start + replacement.length,
      text: replacement
    }, sourceInfo, editedText);
    if (currentText !== replacement) {
      await this.app.vault.modify(file, `${source.slice(0, start)}${replacement}${source.slice(end)}`);
      this.emitApiEvent("markdown-changed", {
        file: file.path,
        start,
        end,
        replacementLength: replacement.length
      });
    }
    return { changed: true, target: nextTarget };
  }
};
var PreviewDrawingController = class {
  constructor(plugin, previewEl, view, file, options = {}) {
    this.plugin = plugin;
    this.previewEl = previewEl;
    this.view = view;
    this.file = file;
    this.allowTextEdit = options.allowTextEdit !== false;
    this.surfaceType = options.surfaceType || "preview";
    this.destroyed = false;
    this.plugin.liveControllers?.add(this);
    this.runtimeSettings = sanitizeSettings(this.plugin?.noteDrawSettings || {});
    this.active = this.plugin.controllerActivationState(this);
    this.drawingData = {
      version: 3,
      sourcePath: file.path,
      strokes: [],
      updatedAt: null
    };
    this.currentStroke = null;
    this.currentEditor = null;
    this.currentEditorFile = null;
    this.currentTextRange = null;
    this.formatToolbar = null;
    this.formatToolbarManualPosition = null;
    this.formatToolbarDrag = null;
    this.formatColorInput = null;
    this.formatHighlightInput = null;
    this.formatSizeSelect = null;
    this.brushMode = BRUSH_PEN;
    this.brushSettings = {
      [BRUSH_PEN]: {
        color: "#e53935",
        width: 3,
        opacity: DEFAULT_PEN_OPACITY,
        count: 1
      },
      [BRUSH_WATERCOLOR]: {
        color: "#3b82f6",
        width: 9,
        opacity: 0.45,
        count: 1
      }
    };
    this.applySettings();
    this.penColor = this.brushSettings[BRUSH_PEN].color;
    this.penWidth = this.brushSettings[BRUSH_PEN].width;
    this.penOpacity = this.brushSettings[BRUSH_PEN].opacity;
    this.penCount = this.brushSettings[BRUSH_PEN].count;
    this.toolMode = TOOL_DRAW;
    this.pointerDown = false;
    this.startedOnText = false;
    this.pointerStartPoint = null;
    this.pointerStartClient = null;
    this.pointerStartEditable = null;
    this.pointerStartSourceText = false;
    this.activePointerId = null;
    this.touchPointers = /* @__PURE__ */ new Map();
    this.multiTouchScrolling = false;
    this.multiTouchLastCenter = null;
    this.suppressTouchDrawing = false;
    this.draggingStroke = false;
    this.dragStrokeStartPoint = null;
    this.dragStrokeOriginalPoints = null;
    this.dragStrokeOriginalBounds = null;
    this.dragStrokeOriginalBounds = null;
    this.dragStrokeMoved = false;
    this.dragStrokeHitIndex = -1;
    this.dragStrokePreserveSelection = false;
    this.resizingSelection = false;
    this.resizeSelectionHandle = null;
    this.resizeSelectionStartPoint = null;
    this.resizeSelectionOriginalBounds = null;
    this.resizeSelectionOriginalStrokes = null;
    this.resizeSelectionMoved = false;
    this.selectingStrokes = false;
    this.selectionStartPoint = null;
    this.selectionCurrentPoint = null;
    this.didMove = false;
    this.redoStack = [];
    this.selectedStrokeIndex = -1;
    this.selectedStrokeIndexes = /* @__PURE__ */ new Set();
    this.drawingsVisible = true;
    this.buttonLongPressed = false;
    this.buttonLongPressTimer = null;
    this.suppressNextButtonClick = false;
    this.paletteOpen = false;
    this.textPanelOpen = false;
    this.selectionMenuOpen = false;
    this.selectionLongPressTimer = null;
    this.selectionLongPressState = null;
    this.floatingControlsHost = null;
    this.floatingControlsInBody = false;
    this.textPreset = "plain";
    this.pendingEmbedTool = null;
    const sharedToolbarState = this.plugin.controllerToolbarState(this);
    if (sharedToolbarState) {
      this.brushMode = [BRUSH_PEN, BRUSH_WATERCOLOR].includes(sharedToolbarState.brushMode) ? sharedToolbarState.brushMode : this.brushMode;
      this.toolMode = sharedToolbarState.toolMode || this.toolMode;
      this.drawingsVisible = sharedToolbarState.drawingsVisible !== false;
      this.paletteOpen = Boolean(sharedToolbarState.paletteOpen);
      this.textPanelOpen = Boolean(sharedToolbarState.textPanelOpen);
      this.textPreset = sharedToolbarState.textPreset || this.textPreset;
      for (const mode of [BRUSH_PEN, BRUSH_WATERCOLOR]) {
        if (sharedToolbarState.brushSettings?.[mode]) {
          this.brushSettings[mode] = { ...this.brushSettings[mode], ...sharedToolbarState.brushSettings[mode] };
        }
      }
      this.syncCurrentBrushFields();
    }
    this.lastTextTap = null;
    this.embedLayer = null;
    this.embedNodes = /* @__PURE__ */ new Map();
    this.embedRenderTokens = /* @__PURE__ */ new Map();
    this.canvasImageCache = /* @__PURE__ */ new Map();
    this.hiddenFileInput = null;
    this.canvasCssWidth = 1;
    this.canvasCssHeight = 1;
    this.canvasWindowTop = 0;
    this.canvasRenderHeight = 1;
    this.canvasBackingScale = 1;
    this.responsiveLayoutSignature = "";
    this.responsivePointsInitialized = false;
    this.responsiveLayoutContext = null;
    this.renderFrameId = null;
    this.pendingDomRender = false;
    this.resizeFrameId = null;
    this.positionFrameId = null;
    this.layoutRefreshGeneration = 0;
    this.markdownAnnotationTimer = null;
    this.markdownRenderObserver = null;
    this.staticCanvas = activeDocument.createElement("canvas");
    this.staticCanvas.width = 1;
    this.staticCanvas.height = 1;
    this.staticCtx = null;
    this.staticCacheDirty = true;
    this.scrollContainer = null;
    this.scrollEventTarget = null;
    this.layoutMeasureEl = null;
    this.drawingsLoaded = false;
    this.loadingDrawings = null;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onCanvasDoubleClick = this.onCanvasDoubleClick.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.onButtonClick = this.onButtonClick.bind(this);
    this.onButtonPointerDown = this.onButtonPointerDown.bind(this);
    this.onButtonPointerUp = this.onButtonPointerUp.bind(this);
    this.onDocumentPointerDown = this.onDocumentPointerDown.bind(this);
    this.onDocumentPointerFinish = this.onDocumentPointerFinish.bind(this);
    this.onDocumentSelectionChange = this.onDocumentSelectionChange.bind(this);
    this.onFormatToolbarDragMove = this.onFormatToolbarDragMove.bind(this);
    this.onFormatToolbarDragEnd = this.onFormatToolbarDragEnd.bind(this);
  }
  async mount() {
    if (this.destroyed) {
      return;
    }
    cleanupDrawingUi(this.previewEl);
    this.previewEl._noteDrawController = this;
    this.previewEl.addClass("notedraw-shell");
    this.previewEl.addClass("is-notedraw-responsive-layout");
    this.previewEl.toggleClass("is-notedraw-source-shell", this.surfaceType === "source");
    this.previewEl.toggleClass("is-notedraw-webview-shell", this.surfaceType === "webview");
    this.floatingControlsInBody = shouldUseBodyFloatingControls(this.previewEl, this.surfaceType);
    this.floatingControlsHost = this.floatingControlsInBody ? activeDocument.body : this.previewEl;
    this.previewEl.toggleClass("has-notedraw-body-controls", this.floatingControlsInBody);
    this.button = this.createHeaderButton();
    this.toolbar = createNoteDrawControlElement(this.floatingControlsHost, "notedraw-toolbar");
    this.selectButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: this.plugin.t("selectDrawings") }
    });
    setIcon(this.selectButton, "mouse-pointer-2");
    this.selectButton.addEventListener("click", () => this.toggleSelectMode());
    this.editMarkdownButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: this.plugin.t("editMarkdownTool") }
    });
    setIcon(this.editMarkdownButton, "file-pen-line");
    this.editMarkdownButton.addEventListener("click", () => this.setEditMarkdownMode());
    this.penButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: this.plugin.t("pen") }
    });
    setIcon(this.penButton, "pen-line");
    this.penButton.addEventListener("click", () => this.setBrushMode(BRUSH_PEN));
    this.watercolorButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: this.plugin.t("watercolorBrush") }
    });
    setIcon(this.watercolorButton, "paintbrush");
    this.watercolorButton.addEventListener("click", () => this.setBrushMode(BRUSH_WATERCOLOR));
    this.textButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: this.plugin.t("floatingText") }
    });
    setIcon(this.textButton, "type");
    this.textButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.textPreset = "plain";
      this.setTextMode();
      this.setTextPanelOpen(true);
      this.syncTextPanelButtons();
    });
    this.undoButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: this.plugin.t("undoLastDrawing") }
    });
    setIcon(this.undoButton, "undo-2");
    this.undoButton.addEventListener("click", () => this.undoLastStroke());
    this.redoButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: this.plugin.t("redoDrawing") }
    });
    setIcon(this.redoButton, "redo-2");
    this.redoButton.addEventListener("click", () => this.redoLastStroke());
    this.deleteButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: this.plugin.t("deleteSelectedDrawing") }
    });
    setIcon(this.deleteButton, "trash-2");
    this.deleteButton.addEventListener("click", () => this.deleteSelectedStroke());
    this.paletteButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: this.plugin.t("penSettings") }
    });
    setIcon(this.paletteButton, "palette");
    this.paletteButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.toolMode === TOOL_SELECT || this.toolMode === TOOL_EDIT_MD) {
        this.setPaletteOpen(false);
        return;
      }
      this.togglePalettePanel();
    });
    this.palettePanel = createNoteDrawControlElement(this.floatingControlsHost, "notedraw-palette-panel");
    this.createColorPalette();
    this.textPanel = createNoteDrawControlElement(this.floatingControlsHost, "notedraw-text-panel");
    this.createTextPanel();
    this.selectionMenu = createNoteDrawControlElement(this.floatingControlsHost, "notedraw-selection-menu");
    this.createSelectionMenu();
    if (this.allowTextEdit && this.surfaceType !== "webview") {
      this.createFormatToolbar();
    }
    this.colorInput = this.palettePanel.createEl("input", {
      cls: "notedraw-advanced-color",
      attr: {
        type: "color",
        value: this.penColor,
        title: this.plugin.t("advancedColor"),
        "aria-label": this.plugin.t("advancedColor")
      }
    });
    this.colorInput.addEventListener("input", () => {
      this.currentBrushSettings().color = this.colorInput.value;
      this.syncCurrentBrushFields();
      this.syncColorSwatches();
      this.updateToolButtons();
      this.persistCurrentBrushSettings();
      this.syncSharedToolbarState();
    });
    this.hiddenFileInput = this.floatingControlsHost.createEl("input", {
      cls: "notedraw-file-input",
      attr: {
        type: "file",
        accept: filePickerAcceptForPreset(this.textPreset)
      }
    });
    this.hiddenFileInput.addEventListener("change", () => {
      const file = this.hiddenFileInput?.files?.[0] || null;
      const pending = this.pendingEmbedTool;
      this.hiddenFileInput.value = "";
      if (!file || !pending?.point) {
        this.pendingEmbedTool = null;
        return;
      }
      this.insertImportedAsset(file, pending.point).catch((error) => {
        console.error(`[${PLUGIN_ID}] Failed to import asset`, error);
        new Notice(this.plugin.t("failedImportFile"));
      });
    });
    this.widthInput = this.createPaletteInput("circle", "width", {
      type: "range",
      value: String(this.penWidth),
      min: String(MIN_BRUSH_WIDTH),
      max: String(MAX_BRUSH_WIDTH),
      step: "0.5",
      title: this.plugin.t("penWidth")
    });
    this.widthInput.addEventListener("input", () => {
      this.currentBrushSettings().width = clamp(Number(this.widthInput.value), MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH);
      this.syncCurrentBrushFields();
      this.updateToolButtons();
      this.persistCurrentBrushSettings();
      this.syncSharedToolbarState();
    });
    this.opacityInput = this.createPaletteInput("droplets", "opacity", {
      type: "range",
      value: String(this.penOpacity),
      min: "0",
      max: "1",
      step: "0.02",
      title: this.plugin.t("penOpacity")
    });
    this.opacityInput.addEventListener("input", () => {
      this.currentBrushSettings().opacity = clamp(Number(this.opacityInput.value), 0, 1);
      this.syncCurrentBrushFields();
      this.updateToolButtons();
      this.persistCurrentBrushSettings();
      this.syncSharedToolbarState();
    });
    this.embedLayer = this.previewEl.createDiv({ cls: "notedraw-embed-layer" });
    this.staticCanvas.classList.add("notedraw-static-canvas");
    this.previewEl.appendChild(this.staticCanvas);
    this.canvas = this.previewEl.createEl("canvas", { cls: "notedraw-canvas" });
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("lostpointercapture", this.onPointerUp);
    this.canvas.addEventListener("dblclick", this.onCanvasDoubleClick);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: true });
    window.addEventListener("resize", this.onResize);
    window.visualViewport?.addEventListener("resize", this.onResize);
    window.visualViewport?.addEventListener("scroll", this.onResize);
    activeDocument.addEventListener("pointerdown", this.onDocumentPointerDown, true);
    activeDocument.addEventListener("pointerup", this.onDocumentPointerFinish, true);
    activeDocument.addEventListener("pointercancel", this.onDocumentPointerFinish, true);
    activeDocument.addEventListener("selectionchange", this.onDocumentSelectionChange);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(this.previewEl);
      this.layoutMeasureEl = findLayoutMeasureElement(this.previewEl);
      if (this.layoutMeasureEl && this.layoutMeasureEl !== this.previewEl) {
        this.resizeObserver.observe(this.layoutMeasureEl);
      }
    }
    this.refreshScrollContainer();
    annotateVisibleMarkdownElements(this.plugin.app, this.previewEl, this.file.path);
    this.scheduleMarkdownAnnotationRefresh();
    if (typeof MutationObserver !== "undefined") {
      this.markdownRenderObserver = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => isMarkdownContentMutation(mutation))) {
          this.scheduleMarkdownAnnotationRefresh();
        }
      });
      this.markdownRenderObserver.observe(this.previewEl, { subtree: true, childList: true });
    }
    this.updateToolButtons();
    this.syncPaletteInputs();
    this.refreshLocalizedLabels();
    this.applySharedToolbarState(this.plugin.controllerToolbarState(this));
    this.applyActiveState(this.active);
  }
  applySettings() {
    const settings = sanitizeSettings(this.plugin?.noteDrawSettings || {});
    this.runtimeSettings = settings;
    if (this.brushSettings?.[BRUSH_PEN]) {
      this.brushSettings[BRUSH_PEN].color = settings.defaultPenColor;
      this.brushSettings[BRUSH_PEN].width = settings.defaultPenWidth;
      this.brushSettings[BRUSH_PEN].opacity = settings.defaultPenOpacity;
    }
    if (this.brushSettings?.[BRUSH_WATERCOLOR]) {
      this.brushSettings[BRUSH_WATERCOLOR].color = settings.defaultWatercolorColor;
      this.brushSettings[BRUSH_WATERCOLOR].width = settings.defaultWatercolorWidth;
      this.brushSettings[BRUSH_WATERCOLOR].opacity = settings.defaultWatercolorOpacity;
    }
    this.syncCurrentBrushFields?.();
    this.syncPaletteInputs?.();
    this.updateToolButtons?.();
    this.positionToolbar?.();
    this.render?.();
  }
  refreshLocalizedLabels() {
    this.plugin.setAccessibleLabel(this.button, this.surfaceType === "webview" ? "editWebviewDraw" : this.drawingsVisible ? "editTextDraw" : "editTextDrawHidden");
    this.plugin.setAccessibleLabel(this.selectButton, "selectDrawings");
    this.plugin.setAccessibleLabel(this.editMarkdownButton, "editMarkdownTool");
    this.plugin.setAccessibleLabel(this.penButton, "pen");
    this.plugin.setAccessibleLabel(this.watercolorButton, "watercolorBrush");
    this.plugin.setAccessibleLabel(this.textButton, "floatingText");
    this.plugin.setAccessibleLabel(this.undoButton, "undoLastDrawing");
    this.plugin.setAccessibleLabel(this.redoButton, "redoDrawing");
    this.plugin.setAccessibleLabel(this.deleteButton, "deleteSelectedDrawing");
    this.plugin.setAccessibleLabel(this.paletteButton, "penSettings");
    this.plugin.setAccessibleLabel(this.colorInput, "advancedColor");
    this.plugin.setAccessibleLabel(this.advancedColorButton, "advancedColor");
    this.colorSwatchButtons?.forEach((button, index) => {
      const color = COMMON_COLORS[index];
      if (color) {
        button.setAttribute("aria-label", this.plugin.t("useColor", { color }));
      }
    });
    this.widthInput?.setAttribute("title", this.plugin.t("penWidth"));
    this.opacityInput?.setAttribute("title", this.plugin.t("penOpacity"));
    if (this.textPanel) {
      const wasOpen = this.textPanelOpen;
      this.textPanel.empty();
      this.createTextPanel();
      this.textPanelOpen = wasOpen;
      this.previewEl.toggleClass("is-text-panel-open", this.textPanelOpen);
      this.syncTextPanelButtons();
    }
    if (this.selectionMenu) {
      const wasOpen = this.selectionMenuOpen;
      this.selectionMenu.empty();
      this.createSelectionMenu();
      this.selectionMenuOpen = wasOpen;
      this.selectionMenu.toggleClass("is-visible", wasOpen);
      this.previewEl.toggleClass("is-selection-menu-open", wasOpen);
    }
    if (this.formatToolbar) {
      this.formatToolbar.querySelectorAll("[data-note-draw-title-key]").forEach((element) => {
        this.plugin.setAccessibleLabel(element, element.dataset.noteDrawTitleKey);
      });
      this.plugin.setAccessibleLabel(this.formatToolbar.querySelector(".notedraw-format-move-button"), "movePanel");
      this.plugin.setAccessibleLabel(this.formatColorInput, "textColor");
      this.plugin.setAccessibleLabel(this.formatHighlightInput, "highlightColor");
      this.plugin.setAccessibleLabel(this.formatSizeSelect, "textSize");
      const firstOption = this.formatSizeSelect?.querySelector?.('option[value=""]');
      if (firstOption) {
        firstOption.textContent = this.plugin.t("size");
      }
    }
  }
  createPaletteInput(icon, cls, attr) {
    const row = this.palettePanel.createDiv({ cls: "notedraw-palette-row" });
    const iconEl = row.createSpan({ cls: "notedraw-palette-icon" });
    setIcon(iconEl, icon);
    return row.createEl("input", {
      cls: `notedraw-${cls}`,
      attr
    });
  }
  longPressDelayMs() {
    return this.runtimeSettings?.longPressMs ?? DEFAULT_SETTINGS.longPressMs;
  }
  tapDistancePx() {
    return this.runtimeSettings?.selectTapDistance ?? DEFAULT_SETTINGS.selectTapDistance;
  }
  selectionHitPaddingPx() {
    return this.runtimeSettings?.selectStrokePadding ?? DEFAULT_SETTINGS.selectStrokePadding;
  }
  selectedStrokeAlpha() {
    return this.runtimeSettings?.selectedStrokeAlpha ?? DEFAULT_SETTINGS.selectedStrokeAlpha;
  }
  interpolationStepPx() {
    return this.runtimeSettings?.drawingInterpolationStep ?? DEFAULT_SETTINGS.drawingInterpolationStep;
  }
  minPointDistancePx() {
    return this.runtimeSettings?.drawingMinPointDistance ?? DEFAULT_SETTINGS.drawingMinPointDistance;
  }
  createHeaderButton() {
    return this.plugin.installHeaderButton(this);
  }
  async setFile(file) {
    if (this.destroyed || !file || this.file?.path === file.path) {
      return;
    }
    this.endTextEdit();
    this.endFloatingTextInput(true);
    this.cancelRenderFrame();
    this.cancelResizeFrame();
    this.resetCanvasSurface();
    this.file = file;
    this.currentStroke = null;
    this.pointerDown = false;
    this.pointerStartEditable = null;
    this.activePointerId = null;
    this.resetTouchGestureState();
    this.draggingStroke = false;
    this.dragStrokeStartPoint = null;
    this.dragStrokeOriginalPoints = null;
    this.dragStrokeMoved = false;
    this.dragStrokeHitIndex = -1;
    this.resizingSelection = false;
    this.resizeSelectionHandle = null;
    this.resizeSelectionStartPoint = null;
    this.resizeSelectionOriginalBounds = null;
    this.resizeSelectionOriginalStrokes = null;
    this.resizeSelectionMoved = false;
    this.selectingStrokes = false;
    this.selectionStartPoint = null;
    this.selectionCurrentPoint = null;
    this.clearSelectionLongPress();
    this.hideSelectionMenu();
    this.redoStack = [];
    this.selectedStrokeIndex = -1;
    this.selectedStrokeIndexes.clear();
    this.embedNodes.forEach((node) => node.remove());
    this.embedNodes.clear();
    this.embedRenderTokens.clear();
    this.canvasImageCache.clear();
    this.responsiveLayoutSignature = "";
    this.responsivePointsInitialized = false;
    this.responsiveLayoutContext = null;
    this.invalidateStaticCache();
    this.drawingsLoaded = false;
    this.loadingDrawings = null;
    this.drawingData = createEmptyDrawingData(file);
    if (this.active) {
      await this.ensureDrawingsLoaded();
      this.resizeCanvas();
      this.render();
    }
  }
  resetCanvasSurface() {
    this.previewEl.removeClass("has-notedraw-canvas");
    this.ctx = null;
    this.staticCtx = null;
    this.canvasCssWidth = 1;
    this.canvasCssHeight = 1;
    this.canvasWindowTop = 0;
    this.canvasRenderHeight = 1;
    this.canvasBackingScale = 1;
    this.responsiveLayoutSignature = "";
    this.responsivePointsInitialized = false;
    this.responsiveLayoutContext = null;
    for (const canvas of [this.staticCanvas, this.canvas]) {
      if (!canvas) {
        continue;
      }
      canvas.width = 1;
      canvas.height = 1;
      for (const property of ["top", "width", "height", "min-width"]) {
        canvas.style.removeProperty(property);
      }
    }
    this.invalidateStaticCache();
  }
  destroy() {
    if (this.destroyed) {
      return;
    }
    this.endTextEdit();
    this.endFloatingTextInput(true);
    this.destroyed = true;
    this.layoutRefreshGeneration += 1;
    this.clearButtonLongPress();
    this.cancelRenderFrame();
    this.cancelResizeFrame();
    this.cancelPositionFrame();
    this.resizeObserver?.disconnect();
    this.markdownRenderObserver?.disconnect();
    this.markdownRenderObserver = null;
    if (this.markdownAnnotationTimer !== null) {
      window.clearTimeout(this.markdownAnnotationTimer);
      this.markdownAnnotationTimer = null;
    }
    this.scrollEventTarget?.removeEventListener("scroll", this.onScroll);
    this.scrollContainer = null;
    this.scrollEventTarget = null;
    this.layoutMeasureEl = null;
    window.removeEventListener("resize", this.onResize);
    window.visualViewport?.removeEventListener("resize", this.onResize);
    window.visualViewport?.removeEventListener("scroll", this.onResize);
    activeDocument.removeEventListener("pointerdown", this.onDocumentPointerDown, true);
    activeDocument.removeEventListener("pointerup", this.onDocumentPointerFinish, true);
    activeDocument.removeEventListener("pointercancel", this.onDocumentPointerFinish, true);
    activeDocument.removeEventListener("selectionchange", this.onDocumentSelectionChange);
    this.stopFormatToolbarDrag();
    this.canvas?.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas?.removeEventListener("pointermove", this.onPointerMove);
    this.canvas?.removeEventListener("pointerup", this.onPointerUp);
    this.canvas?.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas?.removeEventListener("lostpointercapture", this.onPointerUp);
    this.canvas?.removeEventListener("dblclick", this.onCanvasDoubleClick);
    this.canvas?.removeEventListener("wheel", this.onWheel);
    this.plugin.releaseHeaderButton(this);
    this.toolbar?.remove();
    this.palettePanel?.remove();
    this.textPanel?.remove();
    this.selectionMenu?.remove();
    this.formatToolbar?.remove();
    this.hiddenFileInput?.remove();
    this.embedLayer?.remove();
    this.embedNodes.clear();
    this.embedRenderTokens.clear();
    this.canvasImageCache.clear();
    this.staticCanvas?.remove();
    this.canvas?.remove();
    this.previewEl.removeClass("notedraw-shell");
    this.previewEl.removeClass("is-notedraw-responsive-layout");
    this.previewEl.removeClass("is-notedraw-controls-visible");
    this.previewEl.removeClass("is-drawing-active");
    this.previewEl.removeClass("is-drawing-hidden");
    this.previewEl.removeClass("is-select-mode");
    this.previewEl.removeClass("is-palette-open");
    this.previewEl.removeClass("is-text-panel-open");
    this.previewEl.removeClass("is-selection-menu-open");
    this.previewEl.removeClass("is-watercolor-mode");
    this.previewEl.removeClass("is-edit-md-mode");
    this.previewEl.removeClass("is-notedraw-source-shell");
    this.previewEl.removeClass("is-notedraw-webview-shell");
    this.previewEl.removeClass("has-notedraw-body-controls");
    this.previewEl.removeClass("has-notedraw-canvas");
    this.previewEl.removeClass("is-resizing-selection");
    this.previewEl.removeClass("is-native-text-editing");
    this.clearSelectionLongPress();
    if (this.previewEl._noteDrawController === this) {
      delete this.previewEl._noteDrawController;
    }
    if (this.plugin.controllers?.get(this.previewEl) === this) {
      this.plugin.controllers.delete(this.previewEl);
    }
    if (this.plugin.sourceControllers?.get(this.view) === this) {
      this.plugin.sourceControllers.delete(this.view);
    }
    if (this.plugin.webviewControllers?.get(this.previewEl) === this) {
      this.plugin.webviewControllers.delete(this.previewEl);
    }
    this.plugin.liveControllers?.delete(this);
  }
  async toggle() {
    if (this.destroyed) {
      return;
    }
    const nextActive = !this.active;
    if (nextActive && !this.drawingsVisible) {
      this.setDrawingsVisible(true);
    }
    this.plugin.setControllerActivation(this, nextActive);
  }
  applyActiveState(active, options = {}) {
    if (this.destroyed) {
      return;
    }
    const eager = options.eager !== false;
    const wasActive = this.active;
    this.active = Boolean(active);
    this.previewEl.toggleClass("is-drawing-active", this.active);
    this.syncFloatingControlClasses();
    this.button?.classList.toggle("is-active", this.active);
    if (!this.active && wasActive) {
      this.endTextEdit();
      this.endFloatingTextInput(true);
      this.setPaletteOpen(false);
      this.setTextPanelOpen(false);
      this.hideSelectionMenu();
      this.clearSelectionLongPress();
      this.cancelCurrentStroke();
      this.cancelSelectionDrag(true);
      this.cancelSelectedStrokeDrag(true);
      this.cancelSelectedStrokeResize(true);
      this.clearSelectedStrokes();
      this.resetTouchGestureState();
      this.render();
    } else if (this.active && eager && (!wasActive || !this.drawingsLoaded)) {
      this.ensureDrawingsLoaded().catch((error) => {
        console.error(`[${PLUGIN_ID}] Failed to load drawings`, error);
      });
      this.scheduleLayoutRefresh();
    } else if (this.active && !eager) {
      this.layoutRefreshGeneration += 1;
    }
  }
  controlsShouldBeVisible() {
    if (!this.active || this.destroyed || !this.previewEl?.isConnected || isBlockingObsidianOverlayOpen(activeDocument)) {
      return false;
    }
    const activeLeaf = this.plugin.app.workspace?.activeLeaf;
    const ownerLeaf = this.view?.leaf || findOwningLeaf(this.plugin.app, this.view?.containerEl || this.previewEl);
    if (activeLeaf && ownerLeaf && activeLeaf !== ownerLeaf) {
      return false;
    }
    return isElementVisibleEnough(this.previewEl);
  }
  syncFloatingControlClasses() {
    const visible = this.controlsShouldBeVisible();
    this.previewEl?.toggleClass("is-notedraw-controls-visible", visible);
    for (const element of [this.toolbar, this.palettePanel, this.textPanel, this.selectionMenu, this.formatToolbar]) {
      element?.toggleClass("is-drawing-active", Boolean(this.active));
      element?.toggleClass("is-notedraw-controls-visible", visible);
      element?.toggleClass("is-palette-open", Boolean(this.paletteOpen));
      element?.toggleClass("is-text-panel-open", Boolean(this.textPanelOpen));
      element?.toggleClass("is-selection-menu-open", Boolean(this.selectionMenuOpen));
    }
    if (visible && this.active && !this.drawingsLoaded && !this.loadingDrawings) {
      this.ensureDrawingsLoaded().then(() => {
        this.scheduleLayoutRefresh({ settle: false });
      }).catch((error) => {
        console.error(`[${PLUGIN_ID}] Failed to load drawings`, error);
      });
    }
  }
  async ensureDrawingsLoaded() {
    if (this.drawingsLoaded) {
      return;
    }
    if (this.loadingDrawings) {
      await this.loadingDrawings;
      return;
    }
    this.loadingDrawings = this.plugin.readDrawings(this.file).then((data) => {
      this.drawingData = data;
      this.drawingsLoaded = true;
      this.invalidateStaticCache();
      this.resizeCanvas();
      this.render();
    }).finally(() => {
      this.loadingDrawings = null;
    });
    await this.loadingDrawings;
  }
  onResize() {
    this.syncFloatingControlClasses();
    if (this.active || this.drawingsLoaded || this.ctx) {
      this.scheduleResize();
    }
  }
  onScroll() {
    this.syncFloatingControlClasses();
    this.scheduleFloatingControlsPosition();
    if (this.active || this.drawingsLoaded || this.ctx) {
      this.scheduleResize();
    }
  }
  scheduleResize() {
    if (this.resizeFrameId !== null) {
      return;
    }
    this.resizeFrameId = window.requestAnimationFrame(() => {
      this.resizeFrameId = null;
      const canvasChanged = this.resizeCanvas();
      this.updateFloatingControlsPosition();
      this.positionFormatToolbar();
      this.positionFloatingTextInput();
      if (canvasChanged) {
        this.render();
      }
    });
  }
  cancelResizeFrame() {
    if (this.resizeFrameId !== null) {
      window.cancelAnimationFrame(this.resizeFrameId);
      this.resizeFrameId = null;
    }
  }
  scheduleFloatingControlsPosition() {
    if (this.positionFrameId !== null) {
      return;
    }
    this.positionFrameId = window.requestAnimationFrame(() => {
      this.positionFrameId = null;
      this.updateFloatingControlsPosition();
      this.positionFormatToolbar();
      this.positionFloatingTextInput();
    });
  }
  cancelPositionFrame() {
    if (this.positionFrameId !== null) {
      window.cancelAnimationFrame(this.positionFrameId);
      this.positionFrameId = null;
    }
  }
  refreshScrollContainer() {
    const nextContainer = findScrollableAncestor(this.previewEl);
    const nextTarget = getScrollEventTarget(nextContainer);
    if (nextContainer === this.scrollContainer && nextTarget === this.scrollEventTarget) {
      return;
    }
    this.scrollEventTarget?.removeEventListener("scroll", this.onScroll);
    this.scrollContainer = nextContainer;
    this.scrollEventTarget = nextTarget;
    this.scrollEventTarget?.addEventListener("scroll", this.onScroll, { passive: true });
  }
  scheduleLayoutRefresh(options = {}) {
    const settle = options.settle !== false;
    const generation = ++this.layoutRefreshGeneration;
    const refresh = () => {
      if (!this.destroyed && generation === this.layoutRefreshGeneration) {
        if (this.active || this.drawingsLoaded || isElementVisibleEnough(this.previewEl)) {
          this.scheduleResize();
        }
      }
    };
    refresh();
    window.requestAnimationFrame?.(refresh);
    window.setTimeout(refresh, 80);
    window.setTimeout(refresh, 350);
    if (settle) {
      window.requestAnimationFrame?.(() => window.requestAnimationFrame?.(refresh));
      window.setTimeout(refresh, 900);
      if (isMobileRuntime()) {
        window.setTimeout(refresh, 1600);
      }
    }
  }
  scheduleMarkdownAnnotationRefresh() {
    if (this.markdownAnnotationTimer !== null || this.destroyed) {
      return;
    }
    this.markdownAnnotationTimer = window.setTimeout(() => {
      this.markdownAnnotationTimer = null;
      if (this.destroyed || !this.previewEl?.isConnected) {
        return;
      }
      annotateVisibleMarkdownElements(this.plugin.app, this.previewEl, this.file.path);
      annotateRenderedMarkdownLines(this.plugin.app, this.previewEl, this.file.path).catch((error) => {
        void error;
      }).finally(() => {
        if (this.destroyed || !this.previewEl?.isConnected) {
          return;
        }
        this.responsiveLayoutContext = null;
        if (this.drawingsLoaded) {
          this.responsiveLayoutSignature = "";
          this.scheduleResize();
        }
      });
    }, 120);
  }
  updateFloatingControlsPosition() {
    this.syncFloatingControlClasses();
    if (!this.button || !this.toolbar) {
      return;
    }
    const host = this.view?.containerEl || this.previewEl.closest?.(".workspace-leaf-content") || this.previewEl;
    const hostRect = host.getBoundingClientRect();
    const buttonRect = this.button.getBoundingClientRect();
    const viewHeader = this.view?.containerEl?.querySelector?.(".view-header") || this.button.closest?.(".view-header") || null;
    const chromeRect = viewHeader?.getBoundingClientRect?.() || this.button.closest?.(".view-actions")?.getBoundingClientRect?.() || null;
    const toolbarHeight = Math.max(36, this.toolbar.getBoundingClientRect().height || 36);
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportWidth = Math.max(160, viewport?.width || window.innerWidth || 160);
    const viewportHeight = Math.max(120, viewport?.height || window.innerHeight || 120);
    const viewportRight = viewportLeft + viewportWidth;
    const buttonVisible = buttonRect.width > 0 && buttonRect.height > 0 && buttonRect.bottom > viewportTop && buttonRect.top < viewportTop + viewportHeight;
    const anchorRight = hostRect.right > 0 ? hostRect.right : buttonVisible ? buttonRect.right : viewportRight;
    const headerBottom = chromeRect && chromeRect.bottom > 0 ? chromeRect.bottom : 48;
    const anchorBottom = Math.max(
      buttonVisible ? buttonRect.bottom : 0,
      headerBottom
    );
    const compactViewport = isMobileRuntime() || viewportWidth < 640;
    const right = compactViewport ? 8 : clamp(viewportRight - anchorRight + 10, 8, Math.max(8, viewportWidth - 48));
    const left = compactViewport ? viewportLeft + 8 : "auto";
    const minTop = Math.max(viewportTop + 8, headerBottom + 6);
    const maxTop = Math.max(minTop, viewportTop + viewportHeight - toolbarHeight - 8);
    const topOffset = sanitizeSettings(this.plugin?.noteDrawSettings || {}).toolbarTopOffset;
    const top = clamp(anchorBottom + topOffset, minTop, maxTop);
    const props = {
      "--notedraw-toolbar-right": `${Math.round(right)}px`,
      "--notedraw-toolbar-left": typeof left === "number" ? `${Math.round(left)}px` : left,
      "--notedraw-toolbar-top": `${Math.round(top)}px`,
      "--notedraw-palette-top": `${Math.round(top + 42)}px`,
      "--notedraw-text-panel-top": `${Math.round(top + 42)}px`
    };
    setNoteDrawCssProps(this.previewEl, props);
    if (this.floatingControlsInBody) {
      for (const element of [this.toolbar, this.palettePanel, this.textPanel, this.selectionMenu, this.formatToolbar]) {
        setNoteDrawCssProps(element, props);
      }
    }
  }
  setBrushMode(mode) {
    if (![BRUSH_PEN, BRUSH_WATERCOLOR].includes(mode)) {
      return;
    }
    this.brushMode = mode;
    this.toolMode = TOOL_DRAW;
    this.previewEl.removeClass("is-select-mode");
    this.hideSelectionMenu();
    this.endTextEdit();
    this.cancelCurrentStroke();
    this.cancelSelectionDrag(true);
    this.syncCurrentBrushFields();
    this.syncPaletteInputs();
    this.updateToolButtons();
    this.syncSharedToolbarState();
    this.render();
  }
  setTextMode() {
    this.toolMode = TOOL_TEXT;
    this.previewEl.removeClass("is-select-mode");
    this.hideSelectionMenu();
    this.setPaletteOpen(false);
    this.setTextPanelOpen(false);
    this.endTextEdit();
    this.cancelCurrentStroke();
    this.cancelSelectionDrag(true);
    this.updateToolButtons();
    this.syncSharedToolbarState();
    this.render();
  }
  setEditMarkdownMode() {
    this.toolMode = TOOL_EDIT_MD;
    this.previewEl.removeClass("is-select-mode");
    this.hideSelectionMenu();
    this.clearSelectedStrokes();
    this.setPaletteOpen(false);
    this.setTextPanelOpen(false);
    this.endFloatingTextInput(true);
    this.endTextEdit();
    this.cancelCurrentStroke();
    this.cancelSelectionDrag(true);
    this.updateToolButtons();
    this.syncSharedToolbarState();
    this.render();
  }
  syncSharedToolbarState() {
    this.plugin.setControllerToolbarState(this, {
      brushMode: this.brushMode,
      brushSettings: {
        [BRUSH_PEN]: { ...this.brushSettings[BRUSH_PEN] },
        [BRUSH_WATERCOLOR]: { ...this.brushSettings[BRUSH_WATERCOLOR] }
      },
      toolMode: this.toolMode,
      drawingsVisible: this.drawingsVisible,
      paletteOpen: this.paletteOpen,
      textPanelOpen: this.textPanelOpen,
      textPreset: this.textPreset
    });
  }
  applySharedToolbarState(state) {
    if (!state || this.destroyed) {
      return;
    }
    this.brushMode = [BRUSH_PEN, BRUSH_WATERCOLOR].includes(state.brushMode) ? state.brushMode : this.brushMode;
    for (const mode of [BRUSH_PEN, BRUSH_WATERCOLOR]) {
      if (state.brushSettings?.[mode]) {
        this.brushSettings[mode] = { ...this.brushSettings[mode], ...state.brushSettings[mode] };
      }
    }
    this.toolMode = state.toolMode || this.toolMode;
    this.drawingsVisible = state.drawingsVisible !== false;
    this.paletteOpen = Boolean(state.paletteOpen) && this.toolMode !== TOOL_SELECT && this.toolMode !== TOOL_EDIT_MD;
    this.textPanelOpen = Boolean(state.textPanelOpen);
    this.textPreset = state.textPreset || this.textPreset;
    this.syncCurrentBrushFields();
    this.previewEl.toggleClass("is-select-mode", this.toolMode === TOOL_SELECT);
    this.previewEl.toggleClass("is-drawing-hidden", !this.drawingsVisible);
    this.previewEl.toggleClass("is-palette-open", this.paletteOpen);
    this.previewEl.toggleClass("is-text-panel-open", this.textPanelOpen);
    this.syncPaletteInputs();
    this.syncTextPanelButtons?.();
    this.updateToolButtons();
    this.syncFloatingControlClasses();
    if (this.ctx || this.drawingsLoaded) {
      this.render();
    }
  }
  setToolFromApi(tool, options = {}) {
    const normalized = String(tool || "").trim().toLowerCase();
    if (normalized === TOOL_EDIT_MD || normalized === "edit" || normalized === "markdown") {
      this.setEditMarkdownMode();
      return true;
    }
    if (normalized === TOOL_SELECT || normalized === "selection") {
      if (this.toolMode !== TOOL_SELECT) {
        this.toggleSelectMode();
      }
      return true;
    }
    if (normalized === TOOL_TEXT) {
      this.textPreset = String(options.preset || "plain");
      this.setTextMode();
      return true;
    }
    if (normalized === TOOL_DRAW || normalized === BRUSH_PEN || normalized === BRUSH_WATERCOLOR) {
      this.setBrushMode(normalized === BRUSH_WATERCOLOR || options.brush === BRUSH_WATERCOLOR ? BRUSH_WATERCOLOR : BRUSH_PEN);
      return true;
    }
    return false;
  }
  currentBrushSettings() {
    if (!this.brushSettings[this.brushMode]) {
      this.brushMode = BRUSH_PEN;
    }
    return this.brushSettings[this.brushMode];
  }
  syncCurrentBrushFields() {
    const settings = this.currentBrushSettings();
    this.penColor = settings.color;
    this.penWidth = settings.width;
    this.penOpacity = settings.opacity;
    this.penCount = settings.count;
  }
  syncPaletteInputs() {
    const settings = this.currentBrushSettings();
    if (this.colorInput) {
      this.colorInput.value = settings.color;
    }
    this.syncColorSwatches();
    if (this.widthInput) {
      this.widthInput.value = String(settings.width);
    }
    if (this.opacityInput) {
      this.opacityInput.value = String(settings.opacity);
    }
  }
  persistCurrentBrushSettings() {
    const settings = this.currentBrushSettings();
    const noteDrawSettings = this.plugin?.noteDrawSettings || {};
    if (this.brushMode === BRUSH_WATERCOLOR) {
      noteDrawSettings.defaultWatercolorColor = settings.color;
      noteDrawSettings.defaultWatercolorWidth = settings.width;
      noteDrawSettings.defaultWatercolorOpacity = settings.opacity;
    } else {
      noteDrawSettings.defaultPenColor = settings.color;
      noteDrawSettings.defaultPenWidth = settings.width;
      noteDrawSettings.defaultPenOpacity = settings.opacity;
    }
    this.plugin.noteDrawSettings = noteDrawSettings;
    this.plugin.scheduleSettingsSave?.();
  }
  updateToolButtons() {
    const penActive = this.toolMode === TOOL_DRAW && this.brushMode === BRUSH_PEN;
    const watercolorActive = this.toolMode === TOOL_DRAW && this.brushMode === BRUSH_WATERCOLOR;
    this.applyBrushButtonState(this.penButton, this.brushSettings?.[BRUSH_PEN], penActive);
    this.applyBrushButtonState(this.watercolorButton, this.brushSettings?.[BRUSH_WATERCOLOR], watercolorActive);
    this.editMarkdownButton?.classList.toggle("is-active", this.toolMode === TOOL_EDIT_MD);
    this.textButton?.classList.toggle("is-active", this.toolMode === TOOL_TEXT || this.textPanelOpen);
    this.textButton?.toggleAttribute("hidden", false);
    this.selectButton?.classList.toggle("is-active", this.toolMode === TOOL_SELECT);
    this.paletteButton?.toggleAttribute("disabled", this.toolMode === TOOL_SELECT || this.toolMode === TOOL_EDIT_MD);
    this.previewEl.toggleClass("is-watercolor-mode", this.toolMode === TOOL_DRAW && this.brushMode === BRUSH_WATERCOLOR);
    this.previewEl.toggleClass("is-edit-md-mode", this.toolMode === TOOL_EDIT_MD);
  }
  createTextPanel() {
    const groups = [
      {
        labelKey: "textGroup",
        items: [
          { id: "plain", labelKey: "textPlain", icon: "type" },
          { id: "title", labelKey: "title", icon: "type" },
          { id: "code", labelKey: "code", icon: "code-2" },
          { id: "file", labelKey: "fileTag", icon: "file-text" }
        ]
      },
      {
        labelKey: "buttonGroup",
        items: [
          { id: "button", labelKey: "button", icon: "square" },
          { id: "buttonPrimary", labelKey: "primaryButton", icon: "square-check" },
          { id: "buttonOutline", labelKey: "outlineButton", icon: "square" },
          { id: "buttonPill", labelKey: "pillButton", icon: "circle" },
          { id: "arrowUp", labelKey: "arrowUp", icon: "arrow-up" },
          { id: "arrowDown", labelKey: "arrowDown", icon: "arrow-down" },
          { id: "arrowLeft", labelKey: "arrowLeft", icon: "arrow-left" },
          { id: "arrowRight", labelKey: "arrowRight", icon: "arrow-right" }
        ]
      },
      {
        labelKey: "importGroup",
        items: [
          { id: "image", labelKey: "image", icon: "image" },
          { id: "video", labelKey: "video", icon: "film" },
          { id: "attachment", labelKey: "file", icon: "paperclip" }
        ]
      },
      {
        labelKey: "previewGroup",
        items: [
          { id: "markdown", labelKey: "markdown", icon: "pilcrow" },
          { id: "html", labelKey: "html", icon: "code" },
          { id: "note", labelKey: "note", icon: "file-text" }
        ]
      }
    ];
    for (const group of groups) {
      const groupEl = this.textPanel.createDiv({ cls: "notedraw-text-group" });
      groupEl.createDiv({ cls: "notedraw-text-group-label", text: this.plugin.t(group.labelKey) });
      const gridEl = groupEl.createDiv({ cls: "notedraw-text-grid" });
      for (const item of group.items) {
        const label = this.plugin.t(item.labelKey);
        const button = gridEl.createEl("button", {
          cls: "notedraw-text-option",
          attr: { type: "button", title: label, "aria-label": label }
        });
        button.dataset.noteDrawTextPreset = item.id;
        setIcon(button, item.icon);
        button.createSpan({ text: label });
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.textPreset = item.id;
          this.setTextMode();
          this.setTextPanelOpen(false);
          this.syncTextPanelButtons();
          this.syncSharedToolbarState();
        });
      }
    }
    this.syncTextPanelButtons();
  }
  syncTextPanelButtons() {
    this.textPanel?.querySelectorAll(".notedraw-text-option").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.noteDrawTextPreset === this.textPreset);
    });
  }
  createSelectionMenu() {
    const actions = [
      { icon: "bring-to-front", key: "bringToFront", action: () => this.reorderSelectedStrokes("front") },
      { icon: "move-up", key: "moveForward", action: () => this.reorderSelectedStrokes("forward") },
      { icon: "move-down", key: "moveBackward", action: () => this.reorderSelectedStrokes("backward") },
      { icon: "send-to-back", key: "sendToBack", action: () => this.reorderSelectedStrokes("back") },
      { icon: "lock", key: "lockElement", action: () => this.toggleSelectedStrokeLock() }
    ];
    for (const item of actions) {
      const title = this.plugin.t(item.key);
      const button = this.selectionMenu.createEl("button", {
        cls: "notedraw-selection-menu-button",
        attr: { type: "button", title, "aria-label": title }
      });
      button.dataset.noteDrawTitleKey = item.key;
      setIcon(button, item.icon);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        item.action();
      });
    }
    this.syncSelectionMenuButtons();
  }
  syncSelectionMenuButtons() {
    if (!this.selectionMenu) {
      return;
    }
    const locked = this.getSelectedStrokeIndexes().length > 0 && this.getSelectedStrokeIndexes().every((index) => this.drawingData.strokes[index]?.locked);
    const lockButton = this.selectionMenu.querySelector('[data-note-draw-title-key="lockElement"], [data-note-draw-title-key="unlockElement"]');
    if (lockButton) {
      const key = locked ? "unlockElement" : "lockElement";
      lockButton.dataset.noteDrawTitleKey = key;
      this.plugin.setAccessibleLabel(lockButton, key);
      setIcon(lockButton, locked ? "unlock" : "lock");
    }
  }
  showSelectionMenu(clientPoint = null) {
    const indexes = this.getSelectedStrokeIndexes();
    if (!indexes.length || !this.selectionMenu) {
      return;
    }
    this.syncSelectionMenuButtons();
    const fallback = this.getSelectedFrameCanvasRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    const x = Number.isFinite(clientPoint?.x) ? clientPoint.x : fallback ? canvasRect.left + fallback.x + fallback.width / 2 : canvasRect.left + 20;
    const y = Number.isFinite(clientPoint?.y) ? clientPoint.y : fallback ? canvasRect.top + fallback.y : canvasRect.top + 20;
    const width = Math.max(210, this.selectionMenu.getBoundingClientRect().width || 228);
    const height = Math.max(38, this.selectionMenu.getBoundingClientRect().height || 38);
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportWidth = Math.max(160, viewport?.width || window.innerWidth || 160);
    const viewportHeight = Math.max(120, viewport?.height || window.innerHeight || 120);
    const left = clamp(Math.round(x - width / 2), viewportLeft + 8, Math.max(viewportLeft + 8, viewportLeft + viewportWidth - width - 8));
    const top = clamp(Math.round(y - height - 14), viewportTop + 8, Math.max(viewportTop + 8, viewportTop + viewportHeight - height - 8));
    setNoteDrawCssProps(this.selectionMenu, {
      "--notedraw-selection-menu-left": `${left}px`,
      "--notedraw-selection-menu-top": `${top}px`
    });
    this.selectionMenuOpen = true;
    this.selectionMenu.addClass("is-visible");
    this.previewEl.addClass("is-selection-menu-open");
    this.syncFloatingControlClasses();
  }
  hideSelectionMenu() {
    this.selectionMenuOpen = false;
    this.selectionMenu?.removeClass("is-visible");
    this.previewEl?.removeClass("is-selection-menu-open");
    this.syncFloatingControlClasses();
  }
  startSelectionLongPress(event) {
    this.clearSelectionLongPress();
    if (!this.getSelectedStrokeIndexes().length) {
      return;
    }
    this.selectionLongPressState = {
      pointerId: event.pointerId,
      client: { x: event.clientX, y: event.clientY }
    };
    this.selectionLongPressTimer = window.setTimeout(() => {
      if (!this.selectionLongPressState || this.selectionLongPressState.pointerId !== this.activePointerId || this.dragStrokeMoved || this.resizeSelectionMoved) {
        return;
      }
      this.releasePointerCapture(this.selectionLongPressState.pointerId);
      this.clearSelectedStrokeDragState();
      this.showSelectionMenu(this.selectionLongPressState.client);
      this.clearSelectionLongPress();
      this.render();
    }, this.longPressDelayMs());
  }
  clearSelectionLongPress() {
    if (this.selectionLongPressTimer) {
      window.clearTimeout(this.selectionLongPressTimer);
      this.selectionLongPressTimer = null;
    }
    this.selectionLongPressState = null;
  }
  createFormatToolbar() {
    this.formatToolbar = createNoteDrawControlElement(this.floatingControlsHost || this.previewEl, "notedraw-format-toolbar");
    this.formatToolbar.addEventListener("mousedown", (event) => {
      if (event.target?.closest?.("button")) {
        event.preventDefault();
      }
    });
    this.createFormatMoveButton();
    this.createFormatButton("bold", "bold", "bold", () => this.applyTextInlineFormat("strong"));
    this.createFormatButton("italic", "italic", "italic", () => this.applyTextInlineFormat("em"));
    this.createFormatButton("underline", "underline", "underline", () => this.applyTextInlineFormat("u"));
    this.createFormatButton("code-2", "inlineCode", "code", () => this.applyTextInlineFormat("code"));
    this.createFormatButton("keyboard", "keyboardTag", "kbd", () => this.applyTextInlineFormat("kbd"));
    this.createFormatButton("superscript", "superscript", "sup", () => this.applyTextInlineFormat("sup"));
    this.createFormatButton("subscript", "subscript", "sub", () => this.applyTextInlineFormat("sub"));
    this.createFormatButton("square-code", "codeBlock", "block-code", () => this.applyTextBlockFormat("code"));
    this.createFormatButton("highlighter", "highlight", "mark", () => this.applyTextInlineFormat("mark", { backgroundColor: this.formatHighlightInput?.value || "#fff59d" }));
    this.createFormatButton("wrap-text", "insertBreak", "br", () => this.insertTextBreak());
    this.createFormatButton("eraser", "clearFormat", "clear-format", () => this.clearTextFormat());
    this.formatColorInput = this.formatToolbar.createEl("input", {
      cls: "notedraw-format-color",
      attr: {
        type: "color",
        value: "#e53935",
        title: this.plugin.t("textColor"),
        "aria-label": this.plugin.t("textColor")
      }
    });
    this.formatColorInput.addEventListener("input", () => this.applyTextInlineFormat("span", { color: this.formatColorInput.value }));
    this.formatHighlightInput = this.formatToolbar.createEl("input", {
      cls: "notedraw-format-color",
      attr: {
        type: "color",
        value: "#fff59d",
        title: this.plugin.t("highlightColor"),
        "aria-label": this.plugin.t("highlightColor")
      }
    });
    this.formatHighlightInput.addEventListener("input", () => this.applyTextInlineFormat("mark", { backgroundColor: this.formatHighlightInput.value }));
    this.formatSizeSelect = this.formatToolbar.createEl("select", {
      cls: "notedraw-format-size",
      attr: { title: this.plugin.t("textSize"), "aria-label": this.plugin.t("textSize") }
    });
    [
      ["", this.plugin.t("size")],
      ["0.85em", "S"],
      ["1em", "M"],
      ["1.25em", "L"],
      ["1.5em", "XL"],
      ["2em", "XXL"]
    ].forEach(([value, label]) => {
      this.formatSizeSelect.createEl("option", { text: label, attr: { value } });
    });
    this.formatSizeSelect.addEventListener("change", () => {
      const size = this.formatSizeSelect.value;
      if (size) {
        this.applyTextInlineFormat("span", { fontSize: size });
      }
      this.formatSizeSelect.value = "";
    });
  }
  createFormatMoveButton() {
    const button = this.formatToolbar.createEl("button", {
      cls: "notedraw-format-button notedraw-format-move-button",
      attr: { type: "button", title: this.plugin.t("movePanel"), "aria-label": this.plugin.t("movePanel") }
    });
    setIcon(button, "move");
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("pointerdown", (event) => this.startFormatToolbarDrag(event));
    return button;
  }
  createFormatButton(icon, titleKey, id, action) {
    const title = this.plugin.t(titleKey);
    const button = this.formatToolbar.createEl("button", {
      cls: "notedraw-format-button",
      attr: { type: "button", title, "aria-label": title }
    });
    button.dataset.noteDrawTitleKey = titleKey;
    button.dataset.noteDrawFormat = id;
    setIcon(button, icon);
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      action();
    });
    return button;
  }
  onDocumentSelectionChange() {
    if (!this.currentEditor || !this.formatToolbar) {
      return;
    }
    const selection = window.getSelection?.();
    if (!selection || !selection.rangeCount) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (!this.currentEditor.contains(range.commonAncestorContainer)) {
      return;
    }
    this.currentTextRange = range.cloneRange();
    this.positionFormatToolbar();
  }
  positionFormatToolbar() {
    if (!this.formatToolbar || !this.currentEditor) {
      return;
    }
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : this.currentTextRange;
    const rect = range ? rangeLineRect(range) || this.currentEditor.getBoundingClientRect() : this.currentEditor.getBoundingClientRect();
    const toolbarRect = this.formatToolbar.getBoundingClientRect();
    const width = Math.max(180, toolbarRect.width || 280);
    const height = Math.max(34, toolbarRect.height || 34);
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportHeight = Math.max(120, viewport?.height || window.innerHeight || 120);
    const viewportWidth = Math.max(160, viewport?.width || window.innerWidth || 160);
    const minTop = viewportTop + 8;
    const maxTop = Math.max(minTop, viewportTop + viewportHeight - height - 8);
    const gap = 14;
    const preferredLeft = rect.left + rect.width / 2 - width / 2;
    const left = clamp(Math.round(preferredLeft), viewportLeft + 8, Math.max(viewportLeft + 8, viewportLeft + viewportWidth - width - 8));
    if (this.formatToolbarManualPosition) {
      const top = clamp(Math.round(this.formatToolbarManualPosition.top), minTop, maxTop);
      const manualLeft = clamp(Math.round(this.formatToolbarManualPosition.left), viewportLeft + 8, Math.max(viewportLeft + 8, viewportLeft + viewportWidth - width - 8));
      this.formatToolbarManualPosition = { top, left: manualLeft };
      setNoteDrawCssProps(this.formatToolbar, {
        "--notedraw-format-top": `${top}px`,
        "--notedraw-format-left": `${manualLeft}px`
      });
      return;
    }
    const lineStep = Math.max(22, Math.round(rect.height + 6));
    const belowOneLine = rect.bottom + gap + lineStep;
    const above = rect.top - height - gap;
    const below = rect.bottom + gap;
    const top = belowOneLine <= maxTop ? belowOneLine : below <= maxTop ? below : above >= minTop ? above : clamp(Math.round(belowOneLine), minTop, maxTop);
    setNoteDrawCssProps(this.formatToolbar, {
      "--notedraw-format-top": `${top}px`,
      "--notedraw-format-left": `${left}px`
    });
  }
  startFormatToolbarDrag(event) {
    if (!this.formatToolbar) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const rect = this.formatToolbar.getBoundingClientRect();
    this.formatToolbarDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTop: rect.top,
      startLeft: rect.left
    };
    this.formatToolbarManualPosition = { top: rect.top, left: rect.left };
    this.formatToolbar.addClass("is-moving");
    activeDocument.addEventListener("pointermove", this.onFormatToolbarDragMove, true);
    activeDocument.addEventListener("pointerup", this.onFormatToolbarDragEnd, true);
    activeDocument.addEventListener("pointercancel", this.onFormatToolbarDragEnd, true);
  }
  onFormatToolbarDragMove(event) {
    if (!this.formatToolbarDrag || !this.formatToolbar || event.pointerId !== this.formatToolbarDrag.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const toolbarRect = this.formatToolbar.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportHeight = Math.max(120, viewport?.height || window.innerHeight || 120);
    const viewportWidth = Math.max(160, viewport?.width || window.innerWidth || 160);
    const top = clamp(
      this.formatToolbarDrag.startTop + event.clientY - this.formatToolbarDrag.startY,
      viewportTop + 8,
      Math.max(viewportTop + 8, viewportTop + viewportHeight - toolbarRect.height - 8)
    );
    const left = clamp(
      this.formatToolbarDrag.startLeft + event.clientX - this.formatToolbarDrag.startX,
      viewportLeft + 8,
      Math.max(viewportLeft + 8, viewportLeft + viewportWidth - toolbarRect.width - 8)
    );
    this.formatToolbarManualPosition = { top, left };
    setNoteDrawCssProps(this.formatToolbar, {
      "--notedraw-format-top": `${Math.round(top)}px`,
      "--notedraw-format-left": `${Math.round(left)}px`
    });
  }
  onFormatToolbarDragEnd(event) {
    if (this.formatToolbarDrag && event?.pointerId !== this.formatToolbarDrag.pointerId) {
      return;
    }
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.stopFormatToolbarDrag();
  }
  stopFormatToolbarDrag() {
    this.formatToolbarDrag = null;
    this.formatToolbar?.removeClass("is-moving");
    activeDocument.removeEventListener("pointermove", this.onFormatToolbarDragMove, true);
    activeDocument.removeEventListener("pointerup", this.onFormatToolbarDragEnd, true);
    activeDocument.removeEventListener("pointercancel", this.onFormatToolbarDragEnd, true);
  }
  restoreTextRange() {
    if (!this.currentEditor || !this.currentTextRange) {
      return false;
    }
    const selection = window.getSelection?.();
    if (!selection) {
      return false;
    }
    selection.removeAllRanges();
    selection.addRange(this.currentTextRange);
    return true;
  }
  applyTextInlineFormat(tagName, styles = {}) {
    if (!this.currentEditor || !this.restoreTextRange()) {
      return;
    }
    const selection = window.getSelection?.();
    if (!selection?.rangeCount) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (!this.currentEditor.contains(range.commonAncestorContainer) || range.collapsed) {
      return;
    }
    const wrapper = activeDocument.createElement(tagName);
    applyInlineFormatStyles(wrapper, styles);
    const fragment = range.extractContents();
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
    selectNodeContents(wrapper);
    this.currentTextRange = window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0).cloneRange() : null;
    this.queueCurrentTextSave(true);
    this.positionFormatToolbar();
  }
  applyTextBlockFormat(kind) {
    if (!this.currentEditor || !this.restoreTextRange()) {
      return;
    }
    const selection = window.getSelection?.();
    if (!selection?.rangeCount) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (!this.currentEditor.contains(range.commonAncestorContainer)) {
      return;
    }
    const text = selection.toString() || "";
    if (kind === "code") {
      const pre = activeDocument.createElement("pre");
      const code = activeDocument.createElement("code");
      code.textContent = text || "code";
      pre.appendChild(code);
      range.deleteContents();
      range.insertNode(pre);
      selectNodeContents(code);
      this.currentTextRange = window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0).cloneRange() : null;
      this.queueCurrentTextSave(true);
      this.positionFormatToolbar();
    }
  }
  insertTextBreak() {
    if (!this.currentEditor || !this.restoreTextRange()) {
      return;
    }
    const selection = window.getSelection?.();
    if (!selection?.rangeCount) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (!this.currentEditor.contains(range.commonAncestorContainer)) {
      return;
    }
    range.deleteContents();
    const br = activeDocument.createElement("br");
    range.insertNode(br);
    range.setStartAfter(br);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    this.currentTextRange = range.cloneRange();
    this.queueCurrentTextSave(true);
    this.positionFormatToolbar();
  }
  clearTextFormat() {
    if (!this.currentEditor || !this.restoreTextRange()) {
      return;
    }
    const selection = window.getSelection?.();
    if (!selection?.rangeCount) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (!this.currentEditor.contains(range.commonAncestorContainer) || range.collapsed) {
      return;
    }
    const plainText = selection.toString() || range.cloneContents().textContent || "";
    const textNode = activeDocument.createTextNode(plainText);
    range.deleteContents();
    range.insertNode(textNode);
    const nextRange = activeDocument.createRange();
    nextRange.setStart(textNode, 0);
    nextRange.setEnd(textNode, textNode.nodeValue?.length || 0);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    this.currentTextRange = nextRange.cloneRange();
    this.queueCurrentTextSave(true);
    this.positionFormatToolbar();
  }
  queueCurrentTextSave(immediate = true) {
    const element = this.currentEditor;
    if (!element || this.surfaceType === "webview") {
      return;
    }
    const original = element.dataset.noteDrawOriginal || "";
    const editedSource = serializeEditableSource(element);
    if (immediate) {
      this.plugin.scheduleTextSaveNow(this.file, original, editedSource, element);
    } else {
      this.plugin.scheduleTextSave(this.file, original, editedSource, element);
    }
  }
  toggleTextPanel() {
    this.setTextPanelOpen(!this.textPanelOpen);
  }
  setTextPanelOpen(open) {
    this.textPanelOpen = Boolean(open);
    this.previewEl.toggleClass("is-text-panel-open", this.textPanelOpen);
    this.syncFloatingControlClasses();
    this.textButton?.classList.toggle("is-active", this.toolMode === TOOL_TEXT || this.textPanelOpen);
    if (this.textPanelOpen) {
      this.setPaletteOpen(false);
      this.updateFloatingControlsPosition();
      this.syncTextPanelButtons();
    }
    this.syncSharedToolbarState();
  }
  createColorPalette() {
    const row = this.palettePanel.createDiv({ cls: "notedraw-palette-row notedraw-color-row" });
    const iconEl = row.createSpan({ cls: "notedraw-palette-icon" });
    setIcon(iconEl, "palette");
    this.colorSwatchGrid = row.createDiv({ cls: "notedraw-color-grid" });
    this.colorSwatchButtons = COMMON_COLORS.map((color) => {
      const button = this.colorSwatchGrid.createEl("button", {
        cls: "notedraw-color-swatch",
        attr: {
          type: "button",
          title: color,
          "aria-label": this.plugin.t("useColor", { color })
        }
      });
      setNoteDrawCssProps(button, { "--notedraw-swatch-color": color });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.setCurrentBrushColor(color);
      });
      return button;
    });
    this.advancedColorButton = this.colorSwatchGrid.createEl("button", {
      cls: "notedraw-color-advanced",
      attr: {
        type: "button",
        title: this.plugin.t("advancedColor"),
        "aria-label": this.plugin.t("advancedColor")
      }
    });
    setIcon(this.advancedColorButton, "sliders-horizontal");
    this.advancedColorButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.colorInput?.click();
    });
  }
  setCurrentBrushColor(color) {
    if (!isCssColor(color)) {
      return;
    }
    this.currentBrushSettings().color = color;
    this.syncCurrentBrushFields();
    this.syncPaletteInputs();
    this.updateToolButtons();
    this.persistCurrentBrushSettings();
    this.syncSharedToolbarState();
  }
  syncColorSwatches() {
    if (!this.colorSwatchButtons?.length) {
      return;
    }
    const currentColor = this.currentBrushSettings().color?.toLowerCase?.();
    this.colorSwatchButtons.forEach((button, index) => {
      const color = COMMON_COLORS[index].toLowerCase();
      button.classList.toggle("is-active", color === currentColor);
    });
    this.advancedColorButton?.classList.toggle(
      "is-active",
      Boolean(currentColor) && !COMMON_COLORS.some((color) => color.toLowerCase() === currentColor)
    );
  }
  applyBrushButtonState(button, settings, active) {
    if (!button) {
      return;
    }
    const color = isCssColor(settings?.color) ? settings.color : DEFAULT_SETTINGS.defaultPenColor;
    button.classList.add("notedraw-brush-button");
    button.classList.toggle("is-active", active);
    button.classList.toggle("is-brush-color-active", active);
    setNoteDrawCssProps(button, {
      "--notedraw-brush-button-color": color,
      "--notedraw-brush-button-contrast": contrastTextColor(color)
    });
  }
  toggleSelectMode() {
    this.toolMode = this.toolMode === TOOL_SELECT ? TOOL_DRAW : TOOL_SELECT;
    this.previewEl.toggleClass("is-select-mode", this.toolMode === TOOL_SELECT);
    if (this.toolMode === TOOL_SELECT) {
      this.setPaletteOpen(false);
      this.setTextPanelOpen(false);
    } else {
      this.hideSelectionMenu();
    }
    this.updateToolButtons();
    this.endTextEdit();
    this.cancelCurrentStroke();
    this.cancelSelectionDrag(true);
    this.syncSharedToolbarState();
    this.render();
  }
  togglePalettePanel() {
    if (this.toolMode === TOOL_SELECT || this.toolMode === TOOL_EDIT_MD) {
      this.setPaletteOpen(false);
      return;
    }
    this.setPaletteOpen(!this.paletteOpen);
    if (this.paletteOpen) {
      this.setTextPanelOpen(false);
    }
  }
  setPaletteOpen(open) {
    this.paletteOpen = Boolean(open);
    this.previewEl.toggleClass("is-palette-open", this.paletteOpen);
    this.syncFloatingControlClasses();
    this.paletteButton?.classList.toggle("is-active", this.paletteOpen);
    if (this.paletteOpen) {
      this.updateFloatingControlsPosition();
    }
    this.syncSharedToolbarState();
  }
  onDocumentPointerDown(event) {
    if (!this.paletteOpen && !this.textPanelOpen && !this.selectionMenuOpen && !this.currentEditor) {
      return;
    }
    const target = event.target;
    if (
      this.palettePanel?.contains(target) ||
      this.paletteButton?.contains(target) ||
      this.textPanel?.contains(target) ||
      this.textButton?.contains(target) ||
      this.selectionMenu?.contains(target) ||
      this.formatToolbar?.contains(target) ||
      this.currentEditor?.contains(target) ||
      this.floatingTextInput?.element?.contains(target)
    ) {
      return;
    }
    this.setPaletteOpen(false);
    this.setTextPanelOpen(false);
    this.hideSelectionMenu();
    if (this.currentEditor) {
      this.endTextEdit();
    }
  }
  onButtonPointerDown() {
    this.clearButtonLongPress();
    this.buttonLongPressTimer = window.setTimeout(() => {
      this.buttonLongPressed = true;
      this.toggleDrawingsVisible();
    }, this.longPressDelayMs());
  }
  onButtonPointerUp() {
    this.clearButtonLongPress();
  }
  onButtonTouchEnd(event) {
    this.clearButtonLongPress();
    if (!isAppleMobileRuntime()) {
      return;
    }
    if (this.buttonLongPressed) {
      this.buttonLongPressed = false;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return;
    }
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.suppressNextButtonClick = true;
    window.setTimeout(() => {
      this.suppressNextButtonClick = false;
    }, 500);
    this.toggle().catch((error) => {
      console.error(`[${PLUGIN_ID}] Failed to toggle NoteDraw`, error);
    });
  }
  onButtonClick(event) {
    if (this.suppressNextButtonClick) {
      this.suppressNextButtonClick = false;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return;
    }
    if (this.buttonLongPressed) {
      this.buttonLongPressed = false;
      event?.preventDefault();
      event?.stopPropagation();
      return;
    }
    this.toggle().catch((error) => {
      console.error(`[${PLUGIN_ID}] Failed to toggle NoteDraw`, error);
    });
  }
  clearButtonLongPress() {
    if (this.buttonLongPressTimer) {
      window.clearTimeout(this.buttonLongPressTimer);
      this.buttonLongPressTimer = null;
    }
  }
  toggleDrawingsVisible() {
    this.setDrawingsVisible(!this.drawingsVisible);
  }
  setDrawingsVisible(visible) {
    this.drawingsVisible = Boolean(visible);
    this.previewEl.toggleClass("is-drawing-hidden", !this.drawingsVisible);
    this.plugin.setAccessibleLabel(
      this.button,
      this.surfaceType === "webview" ? "editWebviewDraw" : this.drawingsVisible ? "editTextDraw" : "editTextDrawHidden"
    );
    this.syncSharedToolbarState();
  }
  getResponsiveContentFrame() {
    return measureResponsiveContentFrame(this.previewEl, this.surfaceType, this.canvasWidth(), this.canvas);
  }
  getResponsiveLayoutContext(refresh = false) {
    if (this.responsiveLayoutContext && !refresh) {
      return this.responsiveLayoutContext;
    }
    this.responsiveLayoutContext = {
      frame: this.getResponsiveContentFrame(),
      viewportHeight: measureResponsiveViewportHeight(this.previewEl, this.scrollContainer),
      lineAnchors: [
        ...collectRenderedLineAnchors(this.previewEl, this.canvas, this.canvasWindowTop),
        ...collectVirtualMarkdownLineAnchors(this.view, this.previewEl, this.canvas, this.canvasWindowTop, this.file?.path || "")
      ],
      codeMirror: this.surfaceType === "source" ? getCodeMirrorView(this.view, this.previewEl) : null
    };
    return this.responsiveLayoutContext;
  }
  captureLineLocation(canvasX, canvasY, context = this.getResponsiveLayoutContext(), options = {}) {
    const rendered = captureRenderedLineLocation(context.lineAnchors, canvasX, canvasY, options);
    if (rendered) {
      return rendered;
    }
    if (!context.codeMirror || !this.canvas) {
      return null;
    }
    const canvasRect = this.canvas.getBoundingClientRect();
    return captureCodeMirrorLineLocation(
      context.codeMirror,
      canvasRect.left + canvasX,
      canvasRect.top + canvasY - this.canvasWindowTop,
      this.file?.path || ""
    );
  }
  projectLineLocation(path, line, context = this.getResponsiveLayoutContext()) {
    const renderedY = projectRenderedLineLocation(context.lineAnchors, path, line);
    if (Number.isFinite(renderedY)) {
      return renderedY;
    }
    if (!context.codeMirror || normalizeVaultPath(path) !== normalizeVaultPath(this.file?.path) || !this.canvas) {
      return NaN;
    }
    const clientY = projectCodeMirrorLineLocation(context.codeMirror, line);
    if (!Number.isFinite(clientY)) {
      return NaN;
    }
    return clientY - this.canvas.getBoundingClientRect().top + this.canvasWindowTop;
  }
  captureResponsivePoint(point, context = this.getResponsiveLayoutContext()) {
    const canvasX = clamp(Number(point?.x || 0), 0, 1) * this.canvasWidth();
    const canvasY = clamp(Number(point?.y || 0), 0, 1) * this.canvasHeight();
    const lineLocation = this.captureLineLocation(canvasX, canvasY, context);
    return {
      ...point,
      ...createResponsivePoint({
        canvasX,
        canvasY,
        canvasWidth: this.canvasWidth(),
        canvasHeight: this.canvasHeight(),
        frame: context.frame,
        sourcePath: lineLocation?.path || this.file?.path || "",
        linePosition: lineLocation?.line ?? null,
        lineConfidence: lineLocation?.lineConfidence ?? null,
        time: point?.t
      })
    };
  }
  captureResponsiveAnchorsForIndexes(indexes) {
    const context = this.getResponsiveLayoutContext(true);
    for (const index of indexes) {
      const stroke = this.drawingData?.strokes?.[index];
      if (stroke?.points?.length) {
        stroke.points = stroke.points.map((point) => this.captureResponsivePoint(point, context));
        this.captureElementLayoutForStroke(stroke, context, index);
      }
    }
    this.rebuildElementRelations();
  }
  captureElementLayoutForStroke(stroke, context = this.getResponsiveLayoutContext(), index = -1, options = {}) {
    const bounds = getStrokeBounds(stroke, this.canvasWidth(), this.canvasHeight());
    if (!bounds) {
      return null;
    }
    const cornerPoints = {
      topLeft: { x: bounds.minX, y: bounds.minY },
      topRight: { x: bounds.maxX, y: bounds.minY },
      bottomRight: { x: bounds.maxX, y: bounds.maxY },
      bottomLeft: { x: bounds.minX, y: bounds.maxY }
    };
    const cornerLocations = Object.fromEntries(Object.entries(cornerPoints).map(([name, point]) => [
      name,
      this.captureLineLocation(point.x, point.y, context, { maxDistance: 112 }) || { path: this.file?.path || "", line: null }
    ]));
    const previous = normalizeElementLayout(stroke.layout);
    stroke.layout = createElementLayout({
      id: previous?.id || createElementLayoutId(index),
      bounds,
      canvasWidth: this.canvasWidth(),
      canvasHeight: this.canvasHeight(),
      frame: context.frame,
      viewportHeight: context.viewportHeight,
      sourcePath: this.file?.path || "",
      cornerLocations,
      metrics: {
        width: stroke.width,
        fontSize: stroke.fontSize,
        textWidth: stroke.textWidth,
        previewWidth: stroke.previewWidth,
        previewHeight: stroke.previewHeight
      },
      relations: options.preserveRelations === false ? [] : previous?.relations || []
    });
    return stroke.layout;
  }
  rebuildElementRelations() {
    const items = [];
    const layoutsById = new Map();
    for (const stroke of this.drawingData?.strokes || []) {
      const layout = normalizeElementLayout(stroke.layout);
      const bounds = getStrokeBounds(stroke, this.canvasWidth(), this.canvasHeight());
      if (!layout?.id || !bounds) {
        continue;
      }
      const widthScale = (bounds.maxX - bounds.minX) / Math.max(0.01, layout.box.width);
      const heightScale = (bounds.maxY - bounds.minY) / Math.max(0.01, layout.box.height);
      items.push({
        id: layout.id,
        bounds,
        scale: Math.max(0.05, Math.sqrt(Math.max(0.001, widthScale * heightScale))),
        xScale: Math.max(0.05, widthScale),
        yScale: Math.max(0.05, heightScale)
      });
      layoutsById.set(layout.id, layout);
    }
    const relations = captureElementRelations(items, {
      nearDistance: Math.min(96, Math.max(48, this.getResponsiveContentFrame().width * 0.1)),
      maxRelations: 3
    });
    for (const stroke of this.drawingData?.strokes || []) {
      const layout = normalizeElementLayout(stroke.layout);
      if (layout?.id) {
        layout.relations = relations.get(layout.id) || [];
        stroke.layout = layout;
      }
    }
  }
  onDocumentPointerFinish(event) {
    if (event.pointerType === "touch" && this.touchPointers.has(event.pointerId)) {
      this.completeTrackedTouch(event.pointerId);
    }
  }
  projectStrokePointsForLayoutRepair(stroke, context, layout) {
    const lineToCanvasY = (path, line) => this.projectLineLocation(path, line, context);
    const sourceFrame = layout?.sourceFrame;
    const trustAnchorX = Boolean(sourceFrame) && isStableResponsiveCaptureFrame(sourceFrame.surfaceWidth, { width: sourceFrame.contentWidth });
    return (Array.isArray(stroke?.points) ? stroke.points : []).map((point) => {
      const projected = projectResponsivePoint(point, {
        canvasWidth: this.canvasWidth(),
        canvasHeight: this.canvasHeight(),
        frame: context.frame,
        lineToCanvasY
      });
      if (trustAnchorX || !point?.anchor) {
        return projected;
      }
      return {
        ...projected,
        x: clamp(Number(point.x), 0, 1)
      };
    });
  }
  initializeAndProjectResponsivePoints(context, signature) {
    let migrated = false;
    const elementIds = new Set();
    if (needsElementLayoutMigration(this.drawingData?.strokes) && !isStableResponsiveCaptureFrame(this.canvasWidth(), context.frame)) {
      this.responsivePointsInitialized = false;
      this.responsiveLayoutSignature = "";
      return;
    }
    const lineToCanvasY = (path, line) => this.projectLineLocation(path, line, context);
    for (const [index, stroke] of (this.drawingData?.strokes || []).entries()) {
      const existingLayout = normalizeElementLayout(stroke.layout);
      const needsLayoutRepair = Boolean(existingLayout) && elementLayoutNeedsRepair(existingLayout);
      const hasUniqueElementLayout = Boolean(existingLayout?.id) && !elementIds.has(existingLayout.id) && !needsLayoutRepair;
      if (!hasUniqueElementLayout) {
        if (needsLayoutRepair) {
          stroke.points = this.projectStrokePointsForLayoutRepair(stroke, context, existingLayout);
          stroke.layout = null;
        } else if (existingLayout) {
          stroke.layout = { ...existingLayout, id: "" };
        }
        if (!needsLayoutRepair) {
          stroke.points = stroke.points.map((point) => this.captureResponsivePoint(point, context));
        }
        this.captureElementLayoutForStroke(stroke, context, index, { preserveRelations: !needsLayoutRepair });
        migrated = true;
      }
      const elementId = normalizeElementLayout(stroke.layout)?.id;
      if (elementId) {
        elementIds.add(elementId);
      }
    }
    let migratedDrawingData = null;
    if (migrated) {
      this.rebuildElementRelations();
      migratedDrawingData = normalizeDrawingDataForStorage(this.drawingData, this.file);
    }
    const projected = [];
    const layoutsById = new Map();
    for (const stroke of this.drawingData?.strokes || []) {
      const layout = normalizeElementLayout(stroke.layout);
      const box = projectElementLayout(layout, {
        canvasWidth: this.canvasWidth(),
        canvasHeight: this.canvasHeight(),
        frame: context.frame,
        viewportHeight: context.viewportHeight,
        lineToCanvasY,
        preferDocumentFlow: isMobileRuntime()
      });
      if (layout?.id && box) {
        projected.push(box);
        layoutsById.set(layout.id, layout);
      }
    }
    const projectedById = new Map(stabilizeElementRelations(projected, layoutsById).map((box) => [box.id, {
      ...box,
      x: clamp(box.x, 0, Math.max(0, this.canvasWidth() - box.width)),
      y: clamp(box.y, 0, Math.max(0, this.canvasHeight() - box.height))
    }]));
    for (const stroke of this.drawingData?.strokes || []) {
      const layout = normalizeElementLayout(stroke.layout);
      const box = layout?.id ? projectedById.get(layout.id) : null;
      if (layout && box) {
        stroke.points = projectElementPoints(stroke.points, layout, box, {
          canvasWidth: this.canvasWidth(),
          canvasHeight: this.canvasHeight()
        });
        const metrics = scaleElementMetrics(layout.metrics, box);
        if (metrics.width) {
          stroke.width = metrics.width;
        }
        if (isTextLikeStroke(stroke) && metrics.fontSize) {
          stroke.fontSize = metrics.fontSize;
        }
        if (isTextStroke(stroke)) {
          stroke.textWidth = metrics.textWidth || null;
        }
        if ((isTextLikeStroke(stroke) || isEmbedStroke(stroke)) && metrics.previewWidth && metrics.previewHeight) {
          stroke.previewWidth = metrics.previewWidth;
          stroke.previewHeight = metrics.previewHeight;
        }
      } else {
        stroke.points = stroke.points.map((point) => projectResponsivePoint(point, {
          canvasWidth: this.canvasWidth(),
          canvasHeight: this.canvasHeight(),
          frame: context.frame,
          lineToCanvasY
        }));
      }
    }
    if (this.currentStroke?.points?.length) {
      this.currentStroke.points = this.currentStroke.points.map((point) => projectResponsivePoint(point, {
        canvasWidth: this.canvasWidth(),
        canvasHeight: this.canvasHeight(),
        frame: context.frame,
        lineToCanvasY
      }));
    }
    this.responsivePointsInitialized = true;
    this.responsiveLayoutSignature = signature;
    if (migrated) {
      migratedDrawingData.version = Math.max(3, Number(migratedDrawingData.version) || 1);
      this.plugin.scheduleDrawingSave(this.file, migratedDrawingData, { excludeData: this.drawingData });
    }
  }
  resizeCanvas() {
    this.refreshScrollContainer();
    this.layoutMeasureEl = findLayoutMeasureElement(this.previewEl);
    const measured = measureCanvasExtent(this.previewEl, this.layoutMeasureEl);
    const width = Math.max(1, Math.round(measured.width));
    const measuredHeight = Math.max(1, Math.round(measured.height));
    const extentFrame = measureResponsiveContentFrame(this.previewEl, this.surfaceType, width, this.canvas);
    const height = this.drawingsLoaded
      ? estimateElementLayoutExtent((this.drawingData?.strokes || []).map((stroke) => stroke.layout), {
        canvasWidth: width,
        frame: extentFrame,
        minHeight: measuredHeight
      })
      : measuredHeight;
    const visible = measureVisibleSurfaceWindow(this.previewEl, this.scrollContainer, height);
    const isMobile = isMobileRuntime();
    const devicePixelRatio = window.devicePixelRatio || 1;
    const maxDevicePixelRatio = isMobile ? 4 : 3;
    const maxPixels = isMobile ? 6 * 1024 * 1024 : 16 * 1024 * 1024;
    const maxWindowHeight = calculateQualityWindowLimit({
      cssWidth: width,
      viewportHeight: visible.height,
      devicePixelRatio,
      maxDevicePixelRatio,
      maxPixels
    });
    // A whole-note bitmap can exhaust mobile GPU memory on long notes.
    const canvasWindow = calculateCanvasWindow({
      documentHeight: height,
      viewportTop: visible.top,
      viewportHeight: visible.height,
      previousTop: this.canvasWindowTop,
      previousHeight: this.canvasRenderHeight,
      maxWindowHeight
    });
    const backingStore = calculateCanvasBackingStore({
      cssWidth: width,
      cssHeight: canvasWindow.height,
      devicePixelRatio,
      maxDevicePixelRatio,
      maxDimension: isMobile ? 8192 : 16384,
      maxPixels
    });
    const geometryChanged = width !== this.canvasCssWidth || height !== this.canvasCssHeight || canvasWindow.changed || Math.abs(backingStore.scale - this.canvasBackingScale) > 1e-6;
    const backingStoreChanged = this.canvas.width !== backingStore.width || this.canvas.height !== backingStore.height;
    this.canvasCssWidth = width;
    this.canvasCssHeight = height;
    this.canvasWindowTop = canvasWindow.top;
    this.canvasRenderHeight = canvasWindow.height;
    this.canvasBackingScale = backingStore.scale;
    applyElementStyles(this.embedLayer, {
      width: `${width}px`,
      height: `${height}px`
    });
    for (const canvas of [this.staticCanvas, this.canvas]) {
      applyElementStyles(canvas, {
        top: `${canvasWindow.top}px`,
        width: `${width}px`,
        height: `${canvasWindow.height}px`
      });
    }
    if (backingStoreChanged) {
      this.canvas.width = backingStore.width;
      this.canvas.height = backingStore.height;
    }
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) {
      return false;
    }
    this.ctx.setTransform(backingStore.scale, 0, 0, backingStore.scale, 0, -canvasWindow.top * backingStore.scale);
    if (this.staticCanvas.width !== backingStore.width || this.staticCanvas.height !== backingStore.height) {
      this.staticCanvas.width = backingStore.width;
      this.staticCanvas.height = backingStore.height;
      this.staticCtx = this.staticCanvas.getContext("2d");
    }
    if (!this.staticCtx) {
      this.staticCtx = this.staticCanvas.getContext("2d");
    }
    if (!this.staticCtx) {
      return false;
    }
    this.staticCtx.setTransform(backingStore.scale, 0, 0, backingStore.scale, 0, -canvasWindow.top * backingStore.scale);
    if (this.drawingsLoaded) {
      const frame = this.getResponsiveContentFrame();
      const viewportHeight = measureResponsiveViewportHeight(this.previewEl, this.scrollContainer);
      const signature = responsiveLayoutSignature(width, height, frame, this.surfaceType, viewportHeight);
      if (!this.responsivePointsInitialized || signature !== this.responsiveLayoutSignature) {
        this.responsiveLayoutContext = null;
        const context = this.getResponsiveLayoutContext(true);
        this.initializeAndProjectResponsivePoints(context, signature);
      }
    }
    if (geometryChanged || backingStoreChanged) {
      this.invalidateStaticCache();
    }
    if (measured.visibleWidth > 0) {
      for (const canvas of [this.staticCanvas, this.canvas]) {
        applyElementStyles(canvas, { minWidth: `${Math.round(measured.visibleWidth)}px` });
      }
    }
    this.previewEl.addClass("has-notedraw-canvas");
    return geometryChanged || backingStoreChanged;
  }
  onPointerDown(event) {
    if (!this.active || event.button !== 0) {
      return;
    }
    if (this.shouldPassThroughHeaderPoint(event)) {
      return;
    }
    if (event.pointerType === "touch") {
      if (event.isPrimary && this.touchPointers.size && !this.pointerDown && this.activePointerId === null) {
        this.resetTouchGestureState();
      }
      this.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.suppressTouchDrawing || this.touchPointers.size >= 2) {
        this.startMultiTouchScroll(event);
        return;
      }
    }
    const target = this.elementBelowCanvas(event.clientX, event.clientY);
    const canEditMarkdownText = this.toolMode === TOOL_EDIT_MD;
    const editableCandidate = canEditMarkdownText ? findEditableTarget(target, this.previewEl) : null;
    const editableFile = editableCandidate ? this.plugin.resolveEditableFile(editableCandidate, this.file) : null;
    const editsEmbeddedFile = Boolean(editableFile?.path && editableFile.path !== this.file?.path);
    const editable = editableCandidate && (this.allowTextEdit || editsEmbeddedFile) ? editableCandidate : null;
    const sourceTextTarget = this.surfaceType === "source" && canEditMarkdownText && isSourceTextTarget(target, this.previewEl);
    const point = this.eventToPoint(event);
    const hitStrokeIndex = this.findStrokeAt(point);
    const resizeHandle = this.findSelectionHandleAt(point);
    const hadSelection = this.getSelectedStrokeIndexes().length > 0;
    const selectedDrawGesture = resolveSelectedDrawGesture({
      toolMode: this.toolMode,
      hasSelection: hadSelection,
      hitStrokeIndex,
      insideSelectionFrame: this.selectedStrokeFrameContains(point)
    });
    if (resizeHandle) {
      this.startSelectedStrokeResize(event, point, resizeHandle);
      return;
    }
    if (canEditMarkdownText) {
      this.currentStroke = null;
      this.pointerDown = false;
      this.pointerStartEditable = null;
      this.clearSelectedStrokes();
      if (editable) {
        this.startTextEdit(editable, { x: event.clientX, y: event.clientY });
      } else if (sourceTextTarget) {
        this.endTextEdit();
        this.focusSourceEditorAt({ x: event.clientX, y: event.clientY });
      } else {
        this.endTextEdit();
        this.render();
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (this.toolMode === TOOL_SELECT && hitStrokeIndex >= 0) {
      const additiveSelect = event.shiftKey || event.ctrlKey || event.metaKey;
      if (additiveSelect) {
        const wasSelected = this.isStrokeSelected(hitStrokeIndex);
        this.toggleStrokeSelection(hitStrokeIndex);
        if (wasSelected) {
          this.render();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        this.startSelectedStrokeDrag(event, point, hitStrokeIndex, { preserveSelection: true });
        return;
      }
      if (!this.isStrokeSelected(hitStrokeIndex)) {
        this.setSelectedStrokes(hitStrokeIndex);
      }
      this.startSelectedStrokeDrag(event, point, hitStrokeIndex);
      return;
    }
    if (selectedDrawGesture === SELECTED_DRAW_GESTURE_MANIPULATE && hitStrokeIndex >= 0 && !this.isStrokeSelected(hitStrokeIndex)) {
      this.setSelectedStrokes(hitStrokeIndex);
      this.startSelectedStrokeDrag(event, point, hitStrokeIndex);
      return;
    }
    if (this.getSelectedStrokeIndexes().length && !this.selectedStrokeFrameContains(point) && hitStrokeIndex < 0) {
      if (selectedDrawGesture !== SELECTED_DRAW_GESTURE_DRAW_OR_DESELECT) {
        this.clearSelectedStrokes();
        if (!editable && this.toolMode !== TOOL_SELECT && this.toolMode !== TOOL_TEXT) {
          this.render();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
    }
    if (hitStrokeIndex >= 0 && isTextLikeStroke(this.drawingData.strokes[hitStrokeIndex]) && event.detail >= 2) {
      this.editFloatingTextStroke(hitStrokeIndex, point);
      this.lastTextTap = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (hitStrokeIndex >= 0 && isTextLikeStroke(this.drawingData.strokes[hitStrokeIndex]) && this.toolMode === TOOL_TEXT) {
      if (this.isRepeatTextTap(hitStrokeIndex, point, event)) {
        this.editFloatingTextStroke(hitStrokeIndex, point);
        this.lastTextTap = null;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      this.rememberTextTap(hitStrokeIndex, point, event);
      if (this.isStrokeSelected(hitStrokeIndex)) {
        this.startSelectedStrokeDrag(event, point, hitStrokeIndex);
        return;
      }
      this.setSelectedStrokes(hitStrokeIndex);
      this.render();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const selectedTextIndex = this.getSelectedStrokeIndexes().find((index) => isTextLikeStroke(this.drawingData.strokes[index]));
    if (event.detail >= 2 && selectedTextIndex >= 0 && this.selectedStrokeFrameContains(point)) {
      this.editFloatingTextStroke(selectedTextIndex, point);
      this.lastTextTap = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (this.selectedStrokeFrameContains(point)) {
      this.startSelectedStrokeDrag(event, point, hitStrokeIndex);
      return;
    }
    if (this.toolMode === TOOL_SELECT) {
      this.startSelectionDrag(event, point);
      return;
    }
    this.startedOnText = Boolean(editable);
    this.pointerDown = true;
    this.didMove = false;
    this.pointerStartClient = { x: event.clientX, y: event.clientY };
    this.pointerStartPoint = point;
    this.pointerStartEditable = editable;
    this.pointerStartSourceText = sourceTextTarget;
    this.activePointerId = event.pointerId;
    if (!editable) {
      this.endTextEdit();
    }
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      void error;
    }
    if (this.toolMode === TOOL_TEXT) {
      this.currentStroke = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const brush = this.currentBrushSettings();
    this.currentStroke = {
      brush: this.brushMode,
      color: brush.color,
      width: brush.width,
      opacity: brush.opacity,
      count: brush.count,
      points: [this.pointerStartPoint]
    };
    event.preventDefault();
    event.stopPropagation();
  }
  shouldPassThroughHeaderPoint(event) {
    if (this.surfaceType !== "preview" || !isAppleMobileRuntime()) {
      return false;
    }
    const header = this.view?.containerEl?.querySelector?.(".view-header") || this.button?.closest?.(".view-header");
    const headerRect = header?.getBoundingClientRect?.();
    if (!headerRect || event.clientY > headerRect.bottom + 4) {
      return false;
    }
    const target = this.elementBelowCanvas(event.clientX, event.clientY);
    const noteDrawButton = target?.closest?.(".notedraw-header-button, .notedraw-fallback-button, .notedraw-webview-button");
    this.toggle().catch((error) => {
      console.error(`[${PLUGIN_ID}] Failed to toggle NoteDraw`, error);
    });
    if (!noteDrawButton) {
      dispatchMouseClickThroughOverlay(this.canvas, { x: event.clientX, y: event.clientY });
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  elementBelowCanvas(clientX, clientY) {
    const previous = this.canvas.style.pointerEvents;
    applyElementStyles(this.canvas, { pointerEvents: "none" });
    const target = activeDocument.elementFromPoint(clientX, clientY);
    applyElementStyles(this.canvas, { pointerEvents: previous || "" });
    return target;
  }
  onPointerMove(event) {
    if (event.pointerType === "touch" && this.touchPointers.has(event.pointerId)) {
      this.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.multiTouchScrolling) {
        this.handleMultiTouchScroll(event);
        return;
      }
    }
    if (this.draggingStroke && event.pointerId === this.activePointerId) {
      this.moveSelectedStroke(event);
      return;
    }
    if (this.resizingSelection && event.pointerId === this.activePointerId) {
      this.moveSelectedStrokeResize(event);
      return;
    }
    if (this.selectingStrokes && event.pointerId === this.activePointerId) {
      this.updateSelectionDrag(event);
      return;
    }
    if (!this.active || !this.pointerDown || event.pointerId !== this.activePointerId) {
      return;
    }
    if (this.toolMode === TOOL_TEXT && !this.currentStroke) {
      const movedDistance = this.pointerStartClient ? pointerDistance(this.pointerStartClient, { x: event.clientX, y: event.clientY }) : 0;
      this.didMove = movedDistance > this.tapDistancePx();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!this.currentStroke) {
      return;
    }
    const wasDrawing = this.didMove;
    this.addPointerSamples(event);
    if (this.didMove && !wasDrawing) {
      this.endTextEdit();
      this.clearSelectedStrokes();
    }
    if (this.didMove) {
      this.requestRender();
    }
    event.preventDefault();
    event.stopPropagation();
  }
  onPointerUp(event) {
    if (event.type === "lostpointercapture" && this.multiTouchScrolling) {
      return;
    }
    if (event.pointerType === "touch") {
      this.completeTrackedTouch(event.pointerId);
      if (this.multiTouchScrolling || this.suppressTouchDrawing) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    if (this.draggingStroke && event.pointerId === this.activePointerId) {
      this.finishSelectedStrokeDrag(event);
      return;
    }
    if (this.resizingSelection && event.pointerId === this.activePointerId) {
      this.finishSelectedStrokeResize(event);
      return;
    }
    if (this.selectingStrokes && event.pointerId === this.activePointerId) {
      this.finishSelectionDrag(event);
      return;
    }
    if (!this.active || !this.pointerDown || event.pointerId !== this.activePointerId) {
      return;
    }
    this.pointerDown = false;
    const movedDistance = this.pointerStartClient ? pointerDistance(this.pointerStartClient, { x: event.clientX, y: event.clientY }) : 0;
    const editable = this.pointerStartEditable;
    const canEditMarkdownText = this.toolMode === TOOL_EDIT_MD;
    if (this.toolMode === TOOL_TEXT && !this.currentStroke) {
      const point = this.pointerStartPoint || this.eventToPoint(event);
      if (movedDistance <= this.tapDistancePx() && !this.didMove) {
        this.handleTextToolTap(point);
      }
      this.finishPointerInteraction(event);
      return;
    }
    if (!this.currentStroke) {
      this.finishPointerInteraction(event);
      return;
    }
    this.addPointerSamples(event);
    if (!this.didMove || movedDistance <= this.tapDistancePx() || this.currentStroke.points.length < 2) {
      const point = this.pointerStartPoint || this.eventToPoint(event);
      this.currentStroke = null;
      if (editable && canEditMarkdownText) {
        this.startTextEdit(editable, this.pointerStartClient || { x: event.clientX, y: event.clientY });
      } else if (this.pointerStartSourceText && canEditMarkdownText) {
        this.focusSourceEditorAt(this.pointerStartClient || { x: event.clientX, y: event.clientY });
        this.clearSelectedStrokes();
      } else if (this.toolMode === TOOL_TEXT) {
        this.handleTextToolTap(point);
      } else {
        this.setSelectedStrokes(this.findStrokeAt(point));
      }
    } else if (this.currentStroke.kind === TOOL_TEXT) {
      this.currentStroke = null;
    } else {
      const responsiveContext = this.getResponsiveLayoutContext();
      this.currentStroke.points = this.currentStroke.points.map((point) => this.captureResponsivePoint(point, responsiveContext));
      this.drawingData.strokes.push(this.currentStroke);
      this.captureResponsiveAnchorsForIndexes([this.drawingData.strokes.length - 1]);
      this.clearSelectedStrokes();
      this.redoStack = [];
      this.invalidateStaticCache();
      this.plugin.scheduleDrawingSave(this.file, this.drawingData);
      this.currentStroke = null;
    }
    this.finishPointerInteraction(event);
  }
  finishPointerInteraction(event) {
    try {
      if (event && this.canvas.hasPointerCapture?.(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    } catch (error) {
      void error;
    }
    this.pointerStartPoint = null;
    this.pointerStartClient = null;
    this.pointerStartEditable = null;
    this.pointerStartSourceText = false;
    this.activePointerId = null;
    this.didMove = false;
    this.render();
    event?.preventDefault();
    event?.stopPropagation();
  }
  onCanvasDoubleClick(event) {
    if (!this.active || event.button !== 0) {
      return;
    }
    const point = this.eventToPoint(event);
    const hitStrokeIndex = this.findStrokeAt(point);
    if (hitStrokeIndex >= 0 && isTextLikeStroke(this.drawingData.strokes[hitStrokeIndex])) {
      this.editFloatingTextStroke(hitStrokeIndex, point);
      this.lastTextTap = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const selectedTextIndex = this.getSelectedStrokeIndexes().find((index) => isTextLikeStroke(this.drawingData.strokes[index]));
    if (selectedTextIndex >= 0 && this.selectedStrokeFrameContains(point)) {
      this.editFloatingTextStroke(selectedTextIndex, point);
      this.lastTextTap = null;
      event.preventDefault();
      event.stopPropagation();
    }
  }
  rememberTextTap(index, point, event) {
    this.lastTextTap = {
      index,
      point,
      time: Number(event?.timeStamp) || Date.now()
    };
  }
  isRepeatTextTap(index, point, event) {
    if (!this.lastTextTap || this.lastTextTap.index !== index) {
      return false;
    }
    const now = Number(event?.timeStamp) || Date.now();
    const elapsed = now - this.lastTextTap.time;
    if (elapsed < 0 || elapsed > 500) {
      return false;
    }
    const distance = pointDistanceOnCanvas(
      this.lastTextTap.point,
      point,
      this.canvasWidth(),
      this.canvasHeight()
    );
    return distance <= this.tapDistancePx() * 2;
  }
  floatingTextPointToClient(point) {
    const canvasPoint = this.pointToCanvas(point);
    const canvasRect = this.canvas.getBoundingClientRect();
    return {
      x: canvasRect.left + canvasPoint.x,
      y: canvasRect.top + canvasPoint.y - this.canvasWindowTop
    };
  }
  floatingTextEditorInsets(element) {
    const view = element?.ownerDocument?.defaultView || window;
    const style = view.getComputedStyle(element);
    const number = (property) => Number.parseFloat(style.getPropertyValue(property)) || 0;
    return {
      left: number("border-left-width") + number("padding-left"),
      top: number("border-top-width") + number("padding-top"),
      horizontal: number("border-left-width") + number("padding-left") + number("padding-right") + number("border-right-width"),
      vertical: number("border-top-width") + number("padding-top") + number("padding-bottom") + number("border-bottom-width")
    };
  }
  positionFloatingTextInput(state = this.floatingTextInput) {
    if (!state?.element?.isConnected || !state.point || !this.canvas?.isConnected) {
      return;
    }
    const textarea = state.element;
    const view = textarea.ownerDocument?.defaultView || window.activeWindow || window;
    const anchor = this.floatingTextPointToClient(state.point);
    const rect = textarea.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    const viewport = view.visualViewport;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportWidth = viewport?.width || view.innerWidth || 1;
    const viewportHeight = viewport?.height || view.innerHeight || 1;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const anchorVisible = anchor.x >= Math.max(viewportLeft, canvasRect.left) &&
      anchor.x <= Math.min(viewportRight, canvasRect.right) &&
      anchor.y >= Math.max(viewportTop, canvasRect.top) &&
      anchor.y <= Math.min(viewportBottom, canvasRect.bottom);
    const insets = this.floatingTextEditorInsets(textarea);
    const placement = placeFloatingTextEditor({
      anchorX: anchor.x,
      anchorY: anchor.y,
      width: rect.width,
      height: rect.height,
      viewportWidth,
      viewportHeight,
      viewportOffsetLeft: viewportLeft,
      viewportOffsetTop: viewportTop,
      contentInsetX: insets.left,
      contentInsetY: insets.top,
      margin: 8,
      anchorVisible
    });
    applyElementStyles(textarea, {
      left: `${Math.round(placement.left)}px`,
      top: `${Math.round(placement.top)}px`,
      width: `${Math.round(placement.width)}px`,
      height: `${Math.round(placement.height)}px`
    });
    state.centered = placement.centered;
    if (state.index < 0) {
      if (placement.centered) {
        const placedRect = textarea.getBoundingClientRect();
        state.commitPoint = this.eventToPoint({
          clientX: placedRect.left + insets.left,
          clientY: placedRect.top + insets.top
        });
      } else {
        state.commitPoint = { ...state.point };
      }
    }
  }
  floatingTextContentWidth(element) {
    const rect = element.getBoundingClientRect();
    const insets = this.floatingTextEditorInsets(element);
    return clamp(rect.width - insets.horizontal, 24, 900);
  }
  openFloatingTextInput(point, index = -1) {
    this.endFloatingTextInput(true);
    this.endTextEdit();
    if (!this.drawingsVisible) {
      this.setDrawingsVisible(true);
    }
    const existing = index >= 0 ? this.drawingData.strokes[index] : null;
    const brushColor = this.currentBrushSettings().color || this.penColor;
    const preset = isTextLikeStroke(existing) ? existing : createTextPreset(this.textPreset, " ", brushColor);
    const editorDocument = this.canvas?.ownerDocument || this.previewEl?.ownerDocument || activeDocument;
    const editorWindow = editorDocument.defaultView || window.activeWindow || window;
    const textarea = editorDocument.body.createEl("textarea", {
      cls: "notedraw-floating-text-input",
      attr: {
        rows: "1",
        spellcheck: "true"
      }
    });
    textarea.value = isTextLikeStroke(existing) ? existing.text : "";
    applyElementStyles(textarea, {
      color: isTextLikeStroke(existing) ? existing.color : brushColor,
      fontSize: `${isTextLikeStroke(existing) ? clamp(Number(existing.fontSize || 18), 10, 72) : 18}px`,
      fontWeight: isTextLikeStroke(existing) && existing.bold ? "700" : "400",
      fontFamily: isTextLikeStroke(existing) && existing.code ? "monospace" : "sans-serif"
    });
    const preferredContentWidth = isRichTextStroke(existing)
      ? existing.previewWidth
      : Number(existing?.textWidth) > 0
        ? Number(existing.textWidth)
        : isRichTextStroke(preset) && Number(preset.previewWidth) > 0
          ? Number(preset.previewWidth)
          : null;
    const state = {
      element: textarea,
      point: { ...point, t: Date.now() },
      commitPoint: null,
      preferredContentWidth,
      index,
      committed: false,
      cancelled: false,
      composing: false,
      commitAfterComposition: false,
      centered: false
    };
    this.floatingTextInput = state;
    const resize = () => {
      if (!textarea.isConnected) {
        return;
      }
      const viewport = editorWindow.visualViewport;
      const maxWidth = Math.max(96, Math.min(520, (viewport?.width || editorWindow.innerWidth || 320) - 16));
      const maxHeight = Math.max(64, (viewport?.height || editorWindow.innerHeight || 480) - 16);
      const insets = this.floatingTextEditorInsets(textarea);
      applyElementStyles(textarea, { height: "auto", width: "auto", overflowY: "hidden" });
      const naturalWidth = textarea.scrollWidth + 2;
      const preferredWidth = Number(state.preferredContentWidth) > 0 ? Number(state.preferredContentWidth) + insets.horizontal : 0;
      const width = Math.min(maxWidth, Math.max(120, preferredWidth, naturalWidth));
      applyElementStyles(textarea, { width: `${Math.round(width)}px`, height: "auto" });
      const wantedHeight = Math.max(32, textarea.scrollHeight + 2);
      applyElementStyles(textarea, {
        height: `${Math.round(Math.min(maxHeight, wantedHeight))}px`,
        overflowY: wantedHeight > maxHeight ? "auto" : "hidden"
      });
      this.positionFloatingTextInput(state);
    };
    const commit = () => this.commitFloatingTextInput(state);
    const cancel = () => this.endFloatingTextInput(false, state);
    textarea.addEventListener("input", resize);
    textarea.addEventListener("compositionstart", () => {
      state.composing = true;
    });
    textarea.addEventListener("compositionend", () => {
      state.composing = false;
      resize();
      if (state.commitAfterComposition) {
        state.commitAfterComposition = false;
        editorWindow.setTimeout(commit, 0);
      }
    });
    textarea.addEventListener("blur", () => editorWindow.setTimeout(commit, 0));
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        commit();
      }
    });
    state.reposition = resize;
    editorWindow.addEventListener("resize", resize);
    editorWindow.visualViewport?.addEventListener("resize", resize);
    editorWindow.visualViewport?.addEventListener("scroll", resize);
    editorWindow.requestAnimationFrame(() => {
      resize();
      textarea.focus();
      textarea.select();
    });
  }
  commitFloatingTextInput(state = this.floatingTextInput) {
    if (!state || state.committed || state.cancelled) {
      return;
    }
    if (state.composing) {
      state.commitAfterComposition = true;
      return;
    }
    state.committed = true;
    const text = state.element.value.trim();
    if (!text) {
      this.endFloatingTextInput(false, state);
      return;
    }
    if (!this.drawingsVisible) {
      this.setDrawingsVisible(true);
    }
    if (state.index >= 0 && isTextLikeStroke(this.drawingData.strokes[state.index])) {
      const stroke = this.drawingData.strokes[state.index];
      stroke.text = text;
      stroke.render = normalizeTextRenderMode(stroke.render);
      stroke.fontSize = clamp(Number(stroke.fontSize || 18), 10, 72);
      if (isRichTextStroke(stroke)) {
        stroke.previewWidth = stroke.previewWidth || 300;
        stroke.previewHeight = stroke.previewHeight || 180;
      } else {
        stroke.textWidth = this.floatingTextContentWidth(state.element);
      }
      this.setSelectedStrokes(state.index);
    } else {
      const brush = this.currentBrushSettings();
      const preset = createTextPreset(this.textPreset, text, brush.color || this.penColor);
      const stroke = {
        kind: preset.kind || TOOL_TEXT,
        brush: BRUSH_PEN,
        color: preset.color,
        width: 3,
        opacity: 1,
        count: 1,
        text: preset.text,
        render: preset.render || TEXT_RENDER_PLAIN,
        fontSize: clamp(Number(preset.fontSize || 18), 10, 72),
        bold: preset.bold,
        code: preset.code,
        boxed: preset.boxed,
        file: preset.file,
        previewWidth: preset.previewWidth,
        previewHeight: preset.previewHeight,
        uiRole: preset.uiRole,
        buttonStyle: preset.buttonStyle,
        snap: preset.snap,
        locked: false,
        textWidth: normalizeTextRenderMode(preset.render) === TEXT_RENDER_PLAIN ? this.floatingTextContentWidth(state.element) : null,
        points: [{ ...(state.commitPoint || state.point), t: Date.now() }]
      };
      this.drawingData.strokes.push(stroke);
      this.setSelectedStrokes(this.drawingData.strokes.length - 1);
    }
    this.captureResponsiveAnchorsForIndexes(this.getSelectedStrokeIndexes());
    this.redoStack = [];
    this.invalidateStaticCache();
    this.plugin.scheduleDrawingSave(this.file, this.drawingData);
    this.scheduleLayoutRefresh({ settle: false });
    this.endFloatingTextInput(false, state);
    this.render();
    this.requestRender(true);
  }
  endFloatingTextInput(commit = true, state = this.floatingTextInput) {
    if (!state) {
      return;
    }
    if (commit && !state.committed) {
      if (state.composing) {
        state.composing = false;
        state.commitAfterComposition = false;
      }
      this.commitFloatingTextInput(state);
      return;
    }
    if (!commit && !state.committed) {
      state.cancelled = true;
    }
    const view = state.element?.ownerDocument?.defaultView;
    if (view && state.reposition) {
      view.removeEventListener("resize", state.reposition);
      view.visualViewport?.removeEventListener("resize", state.reposition);
      view.visualViewport?.removeEventListener("scroll", state.reposition);
    }
    state.element?.remove();
    if (this.floatingTextInput === state) {
      this.floatingTextInput = null;
    }
  }
  editFloatingTextStroke(index) {
    const stroke = this.drawingData.strokes[index];
    if (!isTextLikeStroke(stroke) || stroke.locked) {
      return;
    }
    this.setSelectedStrokes(index);
    this.openFloatingTextInput(stroke.points[0], index);
  }
  handleTextToolTap(point) {
    const snappedPoint = this.snapPointForPreset(point, this.textPreset);
    if (isAssetTextPreset(this.textPreset)) {
      this.pendingEmbedTool = { preset: this.textPreset, point: snappedPoint };
      if (this.hiddenFileInput) {
        this.hiddenFileInput.accept = filePickerAcceptForPreset(this.textPreset);
        this.hiddenFileInput.click();
      }
      return;
    }
    const instantText = instantTextForPreset(this.textPreset);
    if (instantText) {
      this.insertTextPresetAt(snappedPoint, this.textPreset, instantText);
      return;
    }
    this.openFloatingTextInput(snappedPoint);
  }
  insertTextPresetAt(point, presetId, text) {
    if (!this.drawingsVisible) {
      this.setDrawingsVisible(true);
    }
    const brush = this.currentBrushSettings();
    const preset = createTextPreset(presetId, text, brush.color || this.penColor);
    const stroke = {
      kind: preset.kind || TOOL_TEXT,
      brush: BRUSH_PEN,
      color: preset.color,
      width: 3,
      opacity: 1,
      count: 1,
      text: preset.text,
      render: preset.render || TEXT_RENDER_PLAIN,
      fontSize: clamp(Number(preset.fontSize || 18), 10, 72),
      bold: preset.bold,
      code: preset.code,
      boxed: preset.boxed,
      file: preset.file,
      previewWidth: preset.previewWidth,
      previewHeight: preset.previewHeight,
      uiRole: preset.uiRole,
      buttonStyle: preset.buttonStyle,
      snap: preset.snap,
      locked: false,
      points: [{ ...point, t: Date.now() }]
    };
    this.drawingData.strokes.push(stroke);
    this.setSelectedStrokes(this.drawingData.strokes.length - 1);
    this.captureResponsiveAnchorsForIndexes([this.drawingData.strokes.length - 1]);
    this.redoStack = [];
    this.invalidateStaticCache();
    this.plugin.scheduleDrawingSave(this.file, this.drawingData);
    this.scheduleLayoutRefresh({ settle: false });
    this.render();
  }
  async insertImportedAsset(fileLike, point) {
    const asset = await this.plugin.importLocalAsset(fileLike);
    if (!asset) {
      return;
    }
    const previewRenderMode = classifyImportedPreviewRender(asset);
    if (previewRenderMode) {
      const isHtmlPreview = previewRenderMode === TEXT_RENDER_HTML;
      const stroke = {
        kind: TOOL_TEXT,
        brush: BRUSH_PEN,
        color: "#1f2937",
        width: 3,
        opacity: 1,
        count: 1,
        text: asset.text || asset.name,
        render: previewRenderMode,
        fontSize: 16,
        bold: false,
        code: isHtmlPreview,
        boxed: true,
        file: true,
        assetPath: asset.path,
        assetName: asset.name,
        assetMime: asset.mime,
        assetSize: asset.size,
        previewWidth: 320,
        previewHeight: isHtmlPreview ? 200 : 220,
        locked: false,
        points: [{ ...point, t: Date.now() }]
      };
      this.pendingEmbedTool = null;
      this.drawingData.strokes.push(stroke);
      this.setSelectedStrokes(this.drawingData.strokes.length - 1);
      this.captureResponsiveAnchorsForIndexes([this.drawingData.strokes.length - 1]);
      this.redoStack = [];
      this.invalidateStaticCache();
      this.plugin.scheduleDrawingSave(this.file, this.drawingData);
      this.render();
      return;
    }
    const kind = classifyImportedAsset(asset);
    const stroke = {
      kind: TOOL_EMBED,
      embedType: kind,
      brush: BRUSH_PEN,
      color: this.currentBrushSettings().color || this.penColor,
      width: 3,
      opacity: 1,
      count: 1,
      text: asset.name,
      assetPath: asset.path,
      assetName: asset.name,
      assetMime: asset.mime,
      assetSize: asset.size,
      exportImageDataUrl: kind === EMBED_IMAGE ? asset.imageDataUrl || "" : "",
      previewWidth: kind === EMBED_FILE ? 260 : 320,
      previewHeight: kind === EMBED_FILE ? 74 : 200,
      locked: false,
      points: [{ ...point, t: Date.now() }]
    };
    this.pendingEmbedTool = null;
    this.drawingData.strokes.push(stroke);
    this.setSelectedStrokes(this.drawingData.strokes.length - 1);
    this.captureResponsiveAnchorsForIndexes([this.drawingData.strokes.length - 1]);
    this.redoStack = [];
    this.invalidateStaticCache();
    this.plugin.scheduleDrawingSave(this.file, this.drawingData);
    this.render();
  }
  onWheel(event) {
    if (!this.active) {
      return;
    }
    this.scheduleFloatingControlsPosition();
  }
  startMultiTouchScroll(event) {
    this.suppressTouchDrawing = true;
    this.multiTouchScrolling = true;
    this.multiTouchLastCenter = this.getTouchCenter();
    this.previewEl.addClass("is-two-finger-scroll");
    this.cancelCurrentStroke();
    this.cancelSelectedStrokeDrag(true);
    event.preventDefault();
    event.stopPropagation();
  }
  completeTrackedTouch(pointerId) {
    if (!this.touchPointers.has(pointerId)) {
      return false;
    }
    this.touchPointers.delete(pointerId);
    if (this.touchPointers.size < 2) {
      this.multiTouchScrolling = false;
      this.multiTouchLastCenter = null;
      this.previewEl.removeClass("is-two-finger-scroll");
    }
    if (this.touchPointers.size === 0) {
      this.suppressTouchDrawing = false;
      this.scheduleResize();
      this.requestRender(true);
    }
    return true;
  }
  resetTouchGestureState() {
    this.touchPointers.clear();
    this.multiTouchScrolling = false;
    this.multiTouchLastCenter = null;
    this.suppressTouchDrawing = false;
    this.previewEl?.removeClass("is-two-finger-scroll");
  }
  handleMultiTouchScroll(event) {
    const center = this.getTouchCenter();
    const previous = this.multiTouchLastCenter;
    const scroller = findScrollableAncestor(this.previewEl);
    if (center && previous && scroller) {
      scroller.scrollBy({
        left: previous.x - center.x,
        top: previous.y - center.y,
        behavior: "auto"
      });
    }
    this.multiTouchLastCenter = center;
    event.preventDefault();
    event.stopPropagation();
  }
  getTouchCenter() {
    if (!this.touchPointers.size) {
      return null;
    }
    let x = 0;
    let y = 0;
    for (const point of this.touchPointers.values()) {
      x += point.x;
      y += point.y;
    }
    return {
      x: x / this.touchPointers.size,
      y: y / this.touchPointers.size
    };
  }
  cancelCurrentStroke() {
    if (this.activePointerId !== null) {
      try {
        if (this.canvas.hasPointerCapture?.(this.activePointerId)) {
          this.canvas.releasePointerCapture(this.activePointerId);
        }
      } catch (error) {
        void error;
      }
    }
    this.currentStroke = null;
    this.pointerDown = false;
    this.pointerStartPoint = null;
    this.pointerStartClient = null;
    this.pointerStartEditable = null;
    this.pointerStartSourceText = false;
    this.activePointerId = null;
    this.didMove = false;
    this.render();
  }
  startSelectionDrag(event, point) {
    this.endTextEdit();
    this.cancelCurrentStroke();
    this.selectingStrokes = true;
    this.selectionStartPoint = point;
    this.selectionCurrentPoint = point;
    this.pointerStartClient = { x: event.clientX, y: event.clientY };
    this.activePointerId = event.pointerId;
    this.previewEl.addClass("is-selecting-strokes");
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      void error;
    }
    event.preventDefault();
    event.stopPropagation();
  }
  updateSelectionDrag(event) {
    this.selectionCurrentPoint = this.eventToPoint(event);
    this.requestRender();
    event.preventDefault();
    event.stopPropagation();
  }
  finishSelectionDrag(event) {
    const point = this.eventToPoint(event);
    const movedDistance = this.pointerStartClient ? pointerDistance(this.pointerStartClient, { x: event.clientX, y: event.clientY }) : 0;
    if (movedDistance <= this.tapDistancePx() || !this.selectionStartPoint || !this.selectionCurrentPoint) {
      this.setSelectedStrokes(this.findStrokeAt(point));
    } else {
      this.setSelectedStrokes(this.findStrokesInSelection(this.selectionStartPoint, this.selectionCurrentPoint));
    }
    this.releasePointerCapture(event.pointerId);
    this.clearSelectionDragState();
    this.requestRender(true);
    event.preventDefault();
    event.stopPropagation();
  }
  cancelSelectionDrag(render = false) {
    if (this.activePointerId !== null) {
      this.releasePointerCapture(this.activePointerId);
    }
    this.clearSelectionDragState();
    if (render) {
      this.render();
    }
  }
  clearSelectionDragState() {
    this.selectingStrokes = false;
    this.selectionStartPoint = null;
    this.selectionCurrentPoint = null;
    this.pointerStartClient = null;
    this.activePointerId = null;
    this.previewEl.removeClass("is-selecting-strokes");
  }
  startSelectedStrokeDrag(event, point, hitIndex = -1, options = {}) {
    const indexes = this.getSelectedStrokeIndexes();
    if (!indexes.length) {
      return;
    }
    const movableIndexes = indexes.filter((index) => !this.drawingData.strokes[index]?.locked);
    this.endTextEdit();
    this.pointerDown = false;
    this.currentStroke = null;
    if (!movableIndexes.length) {
      this.showSelectionMenu({ x: event.clientX, y: event.clientY });
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.draggingStroke = true;
    this.dragStrokeStartPoint = point;
    this.dragStrokeOriginalPoints = new Map(movableIndexes.map((index) => [
      index,
      this.drawingData.strokes[index].points.map((strokePoint) => ({ ...strokePoint }))
    ]));
    this.dragStrokeOriginalBounds = this.getStrokeIndexesNormalizedBounds(movableIndexes);
    this.dragStrokeMoved = false;
    this.dragStrokeHitIndex = hitIndex;
    this.dragStrokePreserveSelection = Boolean(options.preserveSelection);
    this.pointerStartClient = { x: event.clientX, y: event.clientY };
    this.activePointerId = event.pointerId;
    this.previewEl.addClass("is-moving-selection");
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      void error;
    }
    this.startSelectionLongPress(event);
    event.preventDefault();
    event.stopPropagation();
  }
  moveSelectedStroke(event) {
    if (!this.dragStrokeStartPoint || !this.dragStrokeOriginalPoints?.size) {
      return;
    }
    const point = this.eventToPoint(event);
    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;
    for (const points of this.dragStrokeOriginalPoints.values()) {
      for (const strokePoint of points) {
        minX = Math.min(minX, strokePoint.x);
        maxX = Math.max(maxX, strokePoint.x);
        minY = Math.min(minY, strokePoint.y);
        maxY = Math.max(maxY, strokePoint.y);
      }
    }
    const dx = clamp(point.x - this.dragStrokeStartPoint.x, -minX, 1 - maxX);
    const dy = clamp(point.y - this.dragStrokeStartPoint.y, -minY, 1 - maxY);
    const movedDistance = pointDistanceOnCanvas(
      this.dragStrokeStartPoint,
      point,
      this.canvasWidth(),
      this.canvasHeight()
    );
    if (movedDistance > this.tapDistancePx()) {
      this.dragStrokeMoved = true;
      this.clearSelectionLongPress();
    }
    let snappedDx = dx;
    let snappedDy = dy;
    if (this.shouldSnapStrokeIndexes(Array.from(this.dragStrokeOriginalPoints.keys())) && this.dragStrokeOriginalBounds) {
      const snap = this.computeSnapDeltaForNormalizedBounds(translateNormalizedBounds(this.dragStrokeOriginalBounds, dx, dy), Array.from(this.dragStrokeOriginalPoints.keys()));
      snappedDx = clamp(dx + snap.dx, -minX, 1 - maxX);
      snappedDy = clamp(dy + snap.dy, -minY, 1 - maxY);
    }
    for (const [index, points] of this.dragStrokeOriginalPoints.entries()) {
      const stroke = this.drawingData.strokes[index];
      if (!stroke) {
        continue;
      }
      stroke.points = points.map((strokePoint) => ({
        ...strokePoint,
        x: clamp(strokePoint.x + snappedDx, 0, 1),
        y: clamp(strokePoint.y + snappedDy, 0, 1)
      }));
    }
    this.requestRender(this.selectionHasDomStrokes());
    event.preventDefault();
    event.stopPropagation();
  }
  finishSelectedStrokeDrag(event) {
    this.clearSelectionLongPress();
    if (this.dragStrokeMoved) {
      this.captureResponsiveAnchorsForIndexes(Array.from(this.dragStrokeOriginalPoints?.keys() || []));
      this.lastTextTap = null;
      this.redoStack = [];
      this.plugin.scheduleDrawingSave(this.file, this.drawingData);
    } else if (!this.dragStrokePreserveSelection && this.getSelectedStrokeIndexes().length > 1 && this.dragStrokeHitIndex >= 0) {
      this.setSelectedStrokes(this.dragStrokeHitIndex);
    } else {
      this.cancelSelectedStrokeDrag(true);
    }
    this.releasePointerCapture(event.pointerId);
    this.clearSelectedStrokeDragState();
    this.render();
    event.preventDefault();
    event.stopPropagation();
  }
  cancelSelectedStrokeDrag(restoreOriginal = false) {
    this.clearSelectionLongPress();
    if (restoreOriginal && this.dragStrokeOriginalPoints?.size) {
      for (const [index, points] of this.dragStrokeOriginalPoints.entries()) {
        const stroke = this.drawingData.strokes[index];
        if (stroke) {
          stroke.points = points.map((strokePoint) => ({ ...strokePoint }));
        }
      }
    }
    if (this.activePointerId !== null) {
      this.releasePointerCapture(this.activePointerId);
    }
    this.clearSelectedStrokeDragState();
    this.render();
  }
  clearSelectedStrokeDragState() {
    this.draggingStroke = false;
    this.dragStrokeStartPoint = null;
    this.dragStrokeOriginalPoints = null;
    this.dragStrokeOriginalBounds = null;
    this.dragStrokeMoved = false;
    this.dragStrokeHitIndex = -1;
    this.dragStrokePreserveSelection = false;
    this.pointerStartClient = null;
    this.activePointerId = null;
    this.previewEl.removeClass("is-moving-selection");
  }
  startSelectedStrokeResize(event, point, handle) {
    const indexes = this.getSelectedStrokeIndexes();
    const resizableIndexes = indexes.filter((index) => !this.drawingData.strokes[index]?.locked);
    const bounds = this.getSelectedStrokeNormalizedBounds();
    if (!resizableIndexes.length || !bounds) {
      return;
    }
    this.endTextEdit();
    this.pointerDown = false;
    this.currentStroke = null;
    this.resizingSelection = true;
    this.resizeSelectionHandle = handle;
    this.resizeSelectionStartPoint = point;
    this.resizeSelectionOriginalBounds = bounds;
    this.resizeSelectionOriginalStrokes = new Map(resizableIndexes.map((index) => [
      index,
      {
        width: this.drawingData.strokes[index].width || this.penWidth,
        fontSize: this.drawingData.strokes[index].fontSize || 18,
        textWidth: Number(this.drawingData.strokes[index].textWidth) > 0 ? Number(this.drawingData.strokes[index].textWidth) : null,
        previewWidth: this.drawingData.strokes[index].previewWidth || 260,
        previewHeight: this.drawingData.strokes[index].previewHeight || 160,
        points: this.drawingData.strokes[index].points.map((strokePoint) => ({ ...strokePoint }))
      }
    ]));
    this.resizeSelectionMoved = false;
    this.pointerStartClient = { x: event.clientX, y: event.clientY };
    this.activePointerId = event.pointerId;
    this.previewEl.addClass("is-resizing-selection");
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      void error;
    }
    event.preventDefault();
    event.stopPropagation();
  }
  moveSelectedStrokeResize(event) {
    if (!this.resizeSelectionOriginalBounds || !this.resizeSelectionOriginalStrokes?.size || !this.resizeSelectionStartPoint) {
      return;
    }
    const point = this.eventToPoint(event);
    const movedDistance = pointDistanceOnCanvas(
      this.resizeSelectionStartPoint,
      point,
      this.canvasWidth(),
      this.canvasHeight()
    );
    if (movedDistance > this.tapDistancePx()) {
      this.resizeSelectionMoved = true;
    }
    this.applySelectedStrokeResize(point);
    this.requestRender(this.selectionHasDomStrokes());
    event.preventDefault();
    event.stopPropagation();
  }
  applySelectedStrokeResize(point) {
    const bounds = this.resizeSelectionOriginalBounds;
    const handle = this.resizeSelectionHandle;
    const originalStrokes = this.resizeSelectionOriginalStrokes;
    if (!bounds || !handle || !originalStrokes?.size) {
      return;
    }
    const anchor = getSelectionResizeAnchor(bounds, handle);
    const corner = getSelectionResizeCorner(bounds, handle);
    const originalDx = corner.x - anchor.x;
    const originalDy = corner.y - anchor.y;
    let scaleX = originalDx === 0 ? 1 : (point.x - anchor.x) / originalDx;
    let scaleY = originalDy === 0 ? 1 : (point.y - anchor.y) / originalDy;
    scaleX = Math.max(0.12, scaleX);
    scaleY = Math.max(0.12, scaleY);
    const strokeScale = clamp((Math.abs(scaleX) + Math.abs(scaleY)) / 2, 0.2, 8);
    const nextByIndex = /* @__PURE__ */ new Map();
    for (const [index, original] of originalStrokes.entries()) {
      nextByIndex.set(index, {
        width: clamp((original.width || this.penWidth) * strokeScale, 0.5, 80),
        fontSize: clamp((original.fontSize || 18) * strokeScale, 10, 72),
        textWidth: Number(original.textWidth) > 0 ? clamp(original.textWidth * Math.abs(scaleX), 24, 900) : null,
        previewWidth: clamp((original.previewWidth || 260) * Math.abs(scaleX), 80, 900),
        previewHeight: clamp((original.previewHeight || 160) * Math.abs(scaleY), 40, 700),
        points: original.points.map((strokePoint) => ({
          ...strokePoint,
          x: anchor.x + (strokePoint.x - anchor.x) * scaleX,
          y: anchor.y + (strokePoint.y - anchor.y) * scaleY
        }))
      });
    }
    shiftNormalizedStrokesInsideCanvas(nextByIndex);
    for (const [index, next] of nextByIndex.entries()) {
      const stroke = this.drawingData.strokes[index];
      if (!stroke) {
        continue;
      }
      stroke.width = next.width;
      if (isTextStroke(stroke)) {
        stroke.fontSize = next.fontSize;
        stroke.textWidth = next.textWidth;
      }
      if (isTextLikeStroke(stroke) || isEmbedStroke(stroke)) {
        stroke.previewWidth = next.previewWidth;
        stroke.previewHeight = next.previewHeight;
      }
      stroke.points = next.points.map((strokePoint) => ({
        ...strokePoint,
        x: clamp(strokePoint.x, 0, 1),
        y: clamp(strokePoint.y, 0, 1)
      }));
    }
  }
  finishSelectedStrokeResize(event) {
    if (this.resizeSelectionMoved) {
      this.captureResponsiveAnchorsForIndexes(Array.from(this.resizeSelectionOriginalStrokes?.keys() || []));
      this.redoStack = [];
      this.plugin.scheduleDrawingSave(this.file, this.drawingData);
    } else {
      this.cancelSelectedStrokeResize(true);
    }
    this.releasePointerCapture(event.pointerId);
    this.clearSelectedStrokeResizeState();
    this.render();
    event.preventDefault();
    event.stopPropagation();
  }
  cancelSelectedStrokeResize(restoreOriginal = false) {
    if (restoreOriginal && this.resizeSelectionOriginalStrokes?.size) {
      for (const [index, original] of this.resizeSelectionOriginalStrokes.entries()) {
        const stroke = this.drawingData.strokes[index];
        if (stroke) {
          stroke.width = original.width;
          if (isTextStroke(stroke)) {
            stroke.fontSize = original.fontSize;
            stroke.textWidth = original.textWidth;
          }
          if (isTextLikeStroke(stroke) || isEmbedStroke(stroke)) {
            stroke.previewWidth = original.previewWidth;
            stroke.previewHeight = original.previewHeight;
          }
          stroke.points = original.points.map((strokePoint) => ({ ...strokePoint }));
        }
      }
    }
    if (this.activePointerId !== null) {
      this.releasePointerCapture(this.activePointerId);
    }
    this.clearSelectedStrokeResizeState();
    this.render();
  }
  clearSelectedStrokeResizeState() {
    this.resizingSelection = false;
    this.resizeSelectionHandle = null;
    this.resizeSelectionStartPoint = null;
    this.resizeSelectionOriginalBounds = null;
    this.resizeSelectionOriginalStrokes = null;
    this.resizeSelectionMoved = false;
    this.pointerStartClient = null;
    this.activePointerId = null;
    this.previewEl.removeClass("is-resizing-selection");
  }
  releasePointerCapture(pointerId) {
    try {
      if (this.canvas.hasPointerCapture?.(pointerId)) {
        this.canvas.releasePointerCapture(pointerId);
      }
    } catch (error) {
      void error;
    }
  }
  addPointerSamples(event) {
    const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : null;
    const events = samples?.length ? samples : [event];
    for (const sample of events) {
      if (this.pointerStartClient && pointerDistance(this.pointerStartClient, {
        x: sample.clientX,
        y: sample.clientY
      }) > this.tapDistancePx()) {
        this.didMove = true;
      }
      this.addStrokePoint(this.eventToPoint(sample));
    }
  }
  addStrokePoint(point) {
    if (!this.currentStroke?.points?.length) {
      return;
    }
    const points = this.currentStroke.points;
    const from = points[points.length - 1];
    const distance = pointDistanceOnCanvas(from, point, this.canvasWidth(), this.canvasHeight());
    if (distance <= this.minPointDistancePx()) {
      return;
    }
    const steps = Math.max(1, Math.ceil(distance / this.interpolationStepPx()));
    for (let index = 1; index <= steps; index += 1) {
      const ratio = index / steps;
      points.push({
        x: from.x + (point.x - from.x) * ratio,
        y: from.y + (point.y - from.y) * ratio,
        t: Math.round((from.t || Date.now()) + ((point.t || Date.now()) - (from.t || Date.now())) * ratio)
      });
    }
  }
  eventToPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top + this.canvasWindowTop;
    const width = this.canvasWidth();
    const height = this.canvasHeight();
    const context = this.getResponsiveLayoutContext();
    const lineLocation = this.captureLineLocation(x, y, context);
    return createResponsivePoint({
      canvasX: x,
      canvasY: y,
      canvasWidth: width,
      canvasHeight: height,
      frame: context.frame,
      sourcePath: lineLocation?.path || this.file?.path || "",
      linePosition: lineLocation?.line ?? null
    });
  }
  pointToCanvas(point) {
    return {
      x: point.x * this.canvasWidth(),
      y: point.y * this.canvasHeight()
    };
  }
  canvasWidth() {
    return Math.max(1, this.canvasCssWidth || this.canvas?.clientWidth || 1);
  }
  canvasHeight() {
    return Math.max(1, this.canvasCssHeight || this.canvas?.clientHeight || 1);
  }
  requestRender(refreshDom = false) {
    this.pendingDomRender = this.pendingDomRender || refreshDom;
    if (this.renderFrameId !== null) {
      return;
    }
    this.renderFrameId = window.requestAnimationFrame(() => {
      this.renderFrameId = null;
      const shouldRefreshDom = this.pendingDomRender;
      this.pendingDomRender = false;
      if (shouldRefreshDom) {
        this.render();
      } else {
        this.renderCanvas();
      }
    });
  }
  cancelRenderFrame() {
    if (this.renderFrameId !== null) {
      window.cancelAnimationFrame(this.renderFrameId);
      this.renderFrameId = null;
    }
    this.pendingDomRender = false;
  }
  render() {
    if (!this.ctx) {
      return;
    }
    this.applyWebEdits();
    this.updateEmbedLayer();
    this.renderCanvas();
  }
  renderCanvas() {
    if (!this.ctx) {
      return;
    }
    clearCanvasContext(this.ctx, this.canvas);
    this.ensureStaticCache();
    for (const [index, stroke] of this.drawingData.strokes.entries()) {
      if (this.isStrokeSelected(index) && this.isStrokeInCanvasWindow(stroke)) {
        this.drawStroke(stroke, this.selectedStrokeAlpha());
      }
    }
    this.drawSelection();
    if (this.selectingStrokes && this.selectionStartPoint && this.selectionCurrentPoint) {
      this.drawSelectionDragRect(this.selectionStartPoint, this.selectionCurrentPoint);
    }
    if (this.currentStroke && this.didMove) {
      this.drawStroke(this.currentStroke);
    }
  }
  ensureStaticCache() {
    if (!this.staticCtx || !this.staticCacheDirty) {
      return;
    }
    clearCanvasContext(this.staticCtx, this.staticCanvas);
    for (const [index, stroke] of this.drawingData.strokes.entries()) {
      if (!this.isStrokeSelected(index) && this.isStrokeInCanvasWindow(stroke)) {
        this.drawStrokeOn(this.staticCtx, stroke);
      }
    }
    this.staticCacheDirty = false;
  }
  invalidateStaticCache() {
    this.staticCacheDirty = true;
  }
  isStrokeInCanvasWindow(stroke) {
    const bounds = getStrokeBounds(stroke, this.canvasWidth(), this.canvasHeight());
    if (!bounds) {
      return false;
    }
    const padding = Math.max(32, Number(stroke.width || 0) + this.selectionHitPaddingPx());
    return rectsIntersect(bounds, {
      minX: -padding,
      minY: this.canvasWindowTop - padding,
      maxX: this.canvasWidth() + padding,
      maxY: this.canvasWindowTop + this.canvasRenderHeight + padding
    });
  }
  drawStroke(stroke, alpha = 1) {
    this.drawStrokeOn(this.ctx, stroke, alpha);
  }
  updateEmbedLayer() {
    if (!this.embedLayer || !this.drawingData?.strokes) {
      return;
    }
    const liveKeys = /* @__PURE__ */ new Set();
    const width = this.canvasWidth();
    const height = this.canvasHeight();
    for (const [index, stroke] of this.drawingData.strokes.entries()) {
      if (!isEmbedStroke(stroke) && !isRichTextStroke(stroke)) {
        continue;
      }
      if (!stroke.points.length || this.floatingTextInput?.index === index) {
        continue;
      }
      const key = String(index);
      liveKeys.add(key);
      const bounds = getStrokeBounds(stroke, width, height);
      if (!bounds) {
        continue;
      }
      let node = this.embedNodes.get(key);
      if (!node) {
        node = this.embedLayer.createDiv({ cls: "notedraw-embed" });
        this.embedNodes.set(key, node);
      }
      node.toggleClass("is-selected", this.isStrokeSelected(index));
      node.toggleClass("is-rich-text", isRichTextStroke(stroke));
      node.toggleClass("is-asset", isEmbedStroke(stroke));
      node.toggleClass("is-locked", Boolean(stroke.locked));
      applyElementStyles(node, {
        left: `${Math.round(bounds.minX)}px`,
        top: `${Math.round(bounds.minY)}px`,
        width: `${Math.max(32, Math.round(bounds.maxX - bounds.minX))}px`,
        height: `${Math.max(28, Math.round(bounds.maxY - bounds.minY))}px`,
        opacity: String(clamp(Number(stroke.opacity ?? 1), 0, 1))
      });
      this.renderEmbedNode(node, stroke, index);
    }
    for (const [key, node] of this.embedNodes.entries()) {
      if (!liveKeys.has(key)) {
        node.remove();
        this.embedNodes.delete(key);
        this.embedRenderTokens.delete(key);
      }
    }
  }
  renderEmbedNode(node, stroke, index) {
    const token = getEmbedRenderToken(stroke);
    const key = String(index);
    if (this.embedRenderTokens.get(key) === token) {
      return;
    }
    this.embedRenderTokens.set(key, token);
    node.empty();
    if (isRichTextStroke(stroke)) {
      this.renderRichTextEmbed(node, stroke).catch((error) => {
        console.error(`[${PLUGIN_ID}] Failed to render preview`, error);
        node.setText(String(stroke.text || ""));
      });
      return;
    }
    if (stroke.embedType === EMBED_IMAGE) {
      node.createEl("img", {
        attr: {
          alt: stroke.assetName || "Image",
          src: this.assetResourceUrl(stroke.assetPath)
        }
      });
      return;
    }
    if (stroke.embedType === EMBED_VIDEO) {
      node.createEl("video", {
        attr: {
          src: this.assetResourceUrl(stroke.assetPath),
          controls: "true",
          playsinline: "true"
        }
      });
      return;
    }
    const fileCard = node.createDiv({ cls: "notedraw-file-card" });
    const iconEl = fileCard.createSpan({ cls: "notedraw-file-icon" });
    setIcon(iconEl, "paperclip");
    const body = fileCard.createDiv({ cls: "notedraw-file-body" });
    body.createDiv({ cls: "notedraw-file-name", text: stroke.assetName || stroke.text || "Attachment" });
    body.createDiv({ cls: "notedraw-file-meta", text: formatBytes(stroke.assetSize) });
  }
  async renderRichTextEmbed(node, stroke) {
    const renderMode = normalizeTextRenderMode(stroke.render);
    const content = String(stroke.text || "");
    if (renderMode === TEXT_RENDER_HTML) {
      node.appendChild(sanitizeHTMLToDomSafe(content));
      return;
    }
    if (renderMode === TEXT_RENDER_NOTE) {
      const noteContent = await this.resolveNotePreviewContent(content);
      await MarkdownRenderer.render(this.plugin.app, noteContent, node, this.file.path, this.plugin);
      return;
    }
    await MarkdownRenderer.render(this.plugin.app, content, node, this.file.path, this.plugin);
  }
  async resolveNotePreviewContent(text) {
    const link = String(text || "").trim();
    const normalized = unwrapWikiLink(link);
    const file = this.plugin.app.metadataCache.getFirstLinkpathDest(normalized, this.file.path) || getVaultFileByPath(this.plugin.app.vault, normalized);
    if (!file) {
      return `> ${link || "Note not found"}`;
    }
    return this.plugin.app.vault.cachedRead(file);
  }
  assetResourceUrl(assetPath) {
    if (!assetPath) {
      return "";
    }
    try {
      return this.plugin.app.vault.adapter.getResourcePath(normalizeVaultPath(assetPath));
    } catch (error) {
      void error;
      return "";
    }
  }
  drawStrokeOn(ctx, stroke, alpha = 1) {
    if (!stroke.points.length) {
      return;
    }
    if (isImageEmbedStroke(stroke)) {
      this.drawImageStrokeOn(ctx, stroke);
      return;
    }
    if (isEmbedStroke(stroke) || isRichTextStroke(stroke)) {
      return;
    }
    if (isTextStroke(stroke)) {
      this.drawTextStrokeOn(ctx, stroke, alpha);
      return;
    }
    if ((stroke.brush || BRUSH_PEN) === BRUSH_WATERCOLOR) {
      this.drawWatercolorStrokeOn(ctx, stroke, alpha);
      return;
    }
    const count = clamp(Math.round(Number(stroke.count || 1)), 1, MAX_PEN_COUNT);
    const opacity = clamp(Number(stroke.opacity ?? DEFAULT_PEN_OPACITY), 0, 1);
    const offsets = getPenOffsets(count, stroke.width || this.penWidth);
    ctx.save();
    ctx.globalAlpha = alpha * opacity;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.color || this.penColor;
    ctx.lineWidth = stroke.width || this.penWidth;
    for (const offset of offsets) {
      ctx.beginPath();
      const first = this.pointToCanvas(stroke.points[0]);
      ctx.moveTo(first.x + offset.x, first.y + offset.y);
      for (let pointIndex = 1; pointIndex < stroke.points.length; pointIndex += 1) {
        const next = this.pointToCanvas(stroke.points[pointIndex]);
        ctx.lineTo(next.x + offset.x, next.y + offset.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  drawImageStrokeOn(ctx, stroke) {
    const image = this.getCanvasImageForStroke(stroke);
    if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) {
      return;
    }
    const bounds = getStrokeBounds(stroke, this.canvasWidth(), this.canvasHeight());
    if (!bounds) {
      return;
    }
    const x = Math.round(bounds.minX);
    const y = Math.round(bounds.minY);
    const width = Math.max(1, Math.round(bounds.maxX - bounds.minX));
    const height = Math.max(1, Math.round(bounds.maxY - bounds.minY));
    const fit = objectFitContain(image.naturalWidth, image.naturalHeight, width, height);
    ctx.save();
    ctx.globalAlpha = clamp(Number(stroke.opacity ?? 1), 0, 1);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, x + fit.x, y + fit.y, fit.width, fit.height);
    ctx.restore();
  }
  getCanvasImageForStroke(stroke) {
    const key = getImageStrokeCacheKey(stroke);
    if (!key) {
      return null;
    }
    const cached = this.canvasImageCache.get(key);
    if (cached?.image) {
      return cached.image;
    }
    const image = new Image();
    image.decoding = "sync";
    image.onload = () => {
      this.invalidateStaticCache();
      this.requestRender();
    };
    image.onerror = () => {
      this.canvasImageCache.delete(key);
    };
    this.canvasImageCache.set(key, { image });
    const embedded = normalizeImageDataUrl(stroke.exportImageDataUrl);
    if (embedded) {
      image.src = embedded;
      return image;
    }
    this.plugin.assetDataUrl(stroke.assetPath, stroke.assetMime || guessMimeType(stroke.assetName || stroke.assetPath)).then((dataUrl) => {
      const state = this.canvasImageCache.get(key);
      if (state?.image === image && dataUrl) {
        image.src = dataUrl;
      }
    });
    return image;
  }
  drawTextStrokeOn(ctx, stroke, alpha = 1) {
    const text = String(stroke.text || "").trim();
    if (!text || !stroke.points.length) {
      return;
    }
    const point = this.pointToCanvas(stroke.points[0]);
    const fontSize = clamp(Number(stroke.fontSize || 18), 10, 72);
    const opacity = clamp(Number(stroke.opacity ?? 1), 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha * opacity;
    ctx.font = `${stroke.bold ? "700 " : ""}${fontSize}px ${stroke.code ? "monospace" : "sans-serif"}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = stroke.color || this.penColor;
    const layout = getTextStrokeLayout(stroke, this.canvasWidth(), (value) => ctx.measureText(value).width);
    if (layout.paddingX || layout.paddingY) {
      const style = normalizeButtonStyle(stroke.buttonStyle);
      if (style === "solid") {
        ctx.fillStyle = stroke.color || this.penColor;
      } else if (style === "outline") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
      } else {
        ctx.fillStyle = stroke.code ? "rgba(127, 127, 127, 0.14)" : "rgba(255, 255, 255, 0.74)";
      }
      ctx.strokeStyle = stroke.color || this.penColor;
      ctx.lineWidth = 1.25;
      const radius = style === "pill" ? Math.min(999, layout.height / 2) : 6;
      roundRect(ctx, point.x - layout.paddingX, point.y - layout.paddingY, layout.width, layout.height, radius);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = normalizeButtonStyle(stroke.buttonStyle) === "solid" ? "#ffffff" : stroke.color || this.penColor;
    layout.lines.forEach((line, index) => {
      ctx.fillText(line, point.x, point.y + index * layout.lineHeight);
    });
    ctx.restore();
  }
  drawWatercolorStroke(stroke, alpha = 1) {
    this.drawWatercolorStrokeOn(this.ctx, stroke, alpha);
  }
  drawWatercolorStrokeOn(ctx, stroke, alpha = 1) {
    if (!stroke.points.length) {
      return;
    }
    const width = Math.max(MIN_BRUSH_WIDTH, stroke.width || this.penWidth);
    const opacity = clamp(Number(stroke.opacity ?? 0.45), 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha * opacity;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.color || this.penColor;
    ctx.lineWidth = width;
    ctx.beginPath();
    const first = this.pointToCanvas(stroke.points[0]);
    ctx.moveTo(first.x, first.y);
    for (let pointIndex = 1; pointIndex < stroke.points.length; pointIndex += 1) {
      const next = this.pointToCanvas(stroke.points[pointIndex]);
      ctx.lineTo(next.x, next.y);
    }
    ctx.stroke();
    ctx.restore();
  }
  drawStrokeSegment(stroke, fromPoint, toPoint) {
    if (!fromPoint || !toPoint || !this.ctx) {
      return;
    }
    const from = this.pointToCanvas(fromPoint);
    const to = this.pointToCanvas(toPoint);
    this.ctx.save();
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = stroke.color || this.penColor;
    this.ctx.lineWidth = stroke.width || this.penWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();
    this.ctx.restore();
  }
  drawSelection() {
    const indexes = this.getSelectedStrokeIndexes();
    if (!indexes.length) {
      return;
    }
    const bounds = this.getSelectedStrokeBounds();
    if (!bounds) {
      return;
    }
    const padding = Math.max(this.selectionHitPaddingPx(), this.getSelectedStrokeMaxWidth() + 4);
    const x = bounds.minX - padding;
    const y = bounds.minY - padding;
    const width = bounds.maxX - bounds.minX + padding * 2;
    const height = bounds.maxY - bounds.minY + padding * 2;
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(255, 193, 7, 0.95)";
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([6, 4]);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.strokeStyle = "rgba(255, 193, 7, 0.98)";
    this.ctx.lineWidth = 2;
    for (const handle of getSelectionHandlePointsFromRect({ x, y, width, height })) {
      this.ctx.fillRect(
        handle.x - SELECT_RESIZE_HANDLE_SIZE / 2,
        handle.y - SELECT_RESIZE_HANDLE_SIZE / 2,
        SELECT_RESIZE_HANDLE_SIZE,
        SELECT_RESIZE_HANDLE_SIZE
      );
      this.ctx.strokeRect(
        handle.x - SELECT_RESIZE_HANDLE_SIZE / 2,
        handle.y - SELECT_RESIZE_HANDLE_SIZE / 2,
        SELECT_RESIZE_HANDLE_SIZE,
        SELECT_RESIZE_HANDLE_SIZE
      );
    }
    this.ctx.restore();
  }
  drawSelectionDragRect(startPoint, endPoint) {
    const start = this.pointToCanvas(startPoint);
    const end = this.pointToCanvas(endPoint);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(96, 165, 250, 0.95)";
    this.ctx.fillStyle = "rgba(96, 165, 250, 0.12)";
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 4]);
    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.restore();
  }
  findStrokeAt(point) {
    const hitPoint = this.pointToCanvas(point);
    const width = this.canvasWidth();
    const height = this.canvasHeight();
    let boxHit = -1;
    for (let index = this.drawingData.strokes.length - 1; index >= 0; index -= 1) {
      const stroke = this.drawingData.strokes[index];
      const padding = this.selectionHitPaddingPx();
      const threshold = Math.max(padding, (stroke.width || this.penWidth) / 2 + padding);
      if (!strokeHitTest(stroke, hitPoint, width, height, threshold)) {
        continue;
      }
      if (isTextLikeStroke(stroke) || isEmbedStroke(stroke)) {
        if (boxHit < 0) {
          boxHit = index;
        }
      } else {
        return index;
      }
    }
    return boxHit;
  }
  findStrokesInSelection(startPoint, endPoint) {
    const start = this.pointToCanvas(startPoint);
    const end = this.pointToCanvas(endPoint);
    const rect = normalizeCanvasRect(start, end);
    const indexes = [];
    for (let index = 0; index < this.drawingData.strokes.length; index += 1) {
      const stroke = this.drawingData.strokes[index];
      const bounds = getStrokeBounds(stroke, this.canvasWidth(), this.canvasHeight());
      if (bounds && rectsIntersect(rect, bounds)) {
        indexes.push(index);
      }
    }
    return indexes;
  }
  setSelectedStrokes(indexes) {
    const normalized = Array.isArray(indexes) ? indexes : [indexes];
    this.selectedStrokeIndexes = new Set(
      normalized.map((index) => Number(index)).filter((index) => Number.isInteger(index) && index >= 0 && index < this.drawingData.strokes.length)
    );
    const selected = this.getSelectedStrokeIndexes();
    this.selectedStrokeIndex = selected.length ? selected[selected.length - 1] : -1;
    this.hideSelectionMenu();
    this.invalidateStaticCache();
  }
  toggleStrokeSelection(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.drawingData.strokes.length) {
      return;
    }
    const next = new Set(this.getSelectedStrokeIndexes());
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this.setSelectedStrokes(Array.from(next));
  }
  clearSelectedStrokes() {
    this.selectedStrokeIndexes.clear();
    this.selectedStrokeIndex = -1;
    this.hideSelectionMenu();
    this.invalidateStaticCache();
  }
  getSelectedStrokeIndexes() {
    if (this.selectedStrokeIndexes.size) {
      return Array.from(this.selectedStrokeIndexes).filter((index) => index >= 0 && index < this.drawingData.strokes.length).sort((a, b) => a - b);
    }
    if (this.selectedStrokeIndex >= 0 && this.selectedStrokeIndex < this.drawingData.strokes.length) {
      return [this.selectedStrokeIndex];
    }
    return [];
  }
  isStrokeSelected(index) {
    return this.selectedStrokeIndexes.has(index) || !this.selectedStrokeIndexes.size && this.selectedStrokeIndex === index;
  }
  selectionHasDomStrokes() {
    return this.getSelectedStrokeIndexes().some((index) => {
      const stroke = this.drawingData.strokes[index];
      return isEmbedStroke(stroke) || isRichTextStroke(stroke);
    });
  }
  getSelectedStrokeBounds() {
    const indexes = this.getSelectedStrokeIndexes();
    return this.getStrokeIndexesBounds(indexes);
  }
  getStrokeIndexesBounds(indexes) {
    let result = null;
    for (const index of indexes) {
      const bounds = getStrokeBounds(this.drawingData.strokes[index], this.canvasWidth(), this.canvasHeight());
      if (!bounds) {
        continue;
      }
      result = result ? {
        minX: Math.min(result.minX, bounds.minX),
        maxX: Math.max(result.maxX, bounds.maxX),
        minY: Math.min(result.minY, bounds.minY),
        maxY: Math.max(result.maxY, bounds.maxY)
      } : { ...bounds };
    }
    return result;
  }
  getStrokeIndexesNormalizedBounds(indexes) {
    const bounds = this.getStrokeIndexesBounds(indexes);
    const width = this.canvasWidth();
    const height = this.canvasHeight();
    if (!bounds || width <= 0 || height <= 0) {
      return null;
    }
    return {
      minX: clamp(bounds.minX / width, 0, 1),
      minY: clamp(bounds.minY / height, 0, 1),
      maxX: clamp(bounds.maxX / width, 0, 1),
      maxY: clamp(bounds.maxY / height, 0, 1)
    };
  }
  getSelectedStrokeNormalizedBounds() {
    return this.getStrokeIndexesNormalizedBounds(this.getSelectedStrokeIndexes());
  }
  shouldSnapStrokeIndexes(indexes) {
    return indexes.some((index) => isSnapStroke(this.drawingData.strokes[index]));
  }
  computeSnapDeltaForNormalizedBounds(bounds, excludeIndexes = []) {
    if (!bounds) {
      return { dx: 0, dy: 0 };
    }
    const width = this.canvasWidth();
    const height = this.canvasHeight();
    const exclude = new Set(excludeIndexes);
    const otherBounds = [];
    for (let index = 0; index < this.drawingData.strokes.length; index += 1) {
      if (exclude.has(index)) {
        continue;
      }
      const itemBounds = getStrokeBounds(this.drawingData.strokes[index], width, height);
      if (itemBounds) {
        otherBounds.push(itemBounds);
      }
    }
    const xValues = [bounds.minX * width, (bounds.minX + bounds.maxX) * width / 2, bounds.maxX * width];
    const yValues = [bounds.minY * height, (bounds.minY + bounds.maxY) * height / 2, bounds.maxY * height];
    const xCandidates = otherBounds.flatMap((item) => [item.minX, (item.minX + item.maxX) / 2, item.maxX]);
    const yCandidates = otherBounds.flatMap((item) => [item.minY, (item.minY + item.maxY) / 2, item.maxY]);
    return {
      dx: nearestSnapDelta(xValues, xCandidates, SNAP_GRID_PX, SNAP_THRESHOLD_PX) / width,
      dy: nearestSnapDelta(yValues, yCandidates, SNAP_GRID_PX, SNAP_THRESHOLD_PX) / height
    };
  }
  snapPointForPreset(point, preset) {
    if (!isSnapPreset(preset)) {
      return point;
    }
    const width = this.canvasWidth();
    const height = this.canvasHeight();
    const x = point.x * width;
    const y = point.y * height;
    const bounds = { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y };
    const delta = this.computeSnapDeltaForNormalizedBounds(bounds, []);
    return {
      ...point,
      x: clamp((x + delta.dx * width) / width, 0, 1),
      y: clamp((y + delta.dy * height) / height, 0, 1)
    };
  }
  reorderSelectedStrokes(direction) {
    const selectedIndexes = this.getSelectedStrokeIndexes();
    if (!selectedIndexes.length) {
      return;
    }
    const strokes = this.drawingData.strokes;
    const selectedStrokes = selectedIndexes.map((index) => strokes[index]).filter(Boolean);
    const selectedSet = new Set(selectedStrokes);
    if (direction === "front" || direction === "back") {
      const rest = strokes.filter((stroke) => !selectedSet.has(stroke));
      this.drawingData.strokes = direction === "front" ? [...rest, ...selectedStrokes] : [...selectedStrokes, ...rest];
    } else if (direction === "forward") {
      for (let index = strokes.length - 2; index >= 0; index -= 1) {
        if (selectedSet.has(strokes[index]) && !selectedSet.has(strokes[index + 1])) {
          [strokes[index], strokes[index + 1]] = [strokes[index + 1], strokes[index]];
        }
      }
    } else if (direction === "backward") {
      for (let index = 1; index < strokes.length; index += 1) {
        if (selectedSet.has(strokes[index]) && !selectedSet.has(strokes[index - 1])) {
          [strokes[index], strokes[index - 1]] = [strokes[index - 1], strokes[index]];
        }
      }
    }
    this.setSelectedStrokes(selectedStrokes.map((stroke) => this.drawingData.strokes.indexOf(stroke)).filter((index) => index >= 0));
    this.hideSelectionMenu();
    this.redoStack = [];
    this.invalidateStaticCache();
    this.plugin.scheduleDrawingSave(this.file, this.drawingData);
    this.render();
  }
  toggleSelectedStrokeLock() {
    const indexes = this.getSelectedStrokeIndexes();
    if (!indexes.length) {
      return;
    }
    const shouldUnlock = indexes.every((index) => this.drawingData.strokes[index]?.locked);
    for (const index of indexes) {
      const stroke = this.drawingData.strokes[index];
      if (stroke) {
        stroke.locked = !shouldUnlock;
      }
    }
    this.hideSelectionMenu();
    this.redoStack = [];
    this.invalidateStaticCache();
    this.plugin.scheduleDrawingSave(this.file, this.drawingData);
    this.render();
  }
  getSelectedStrokeMaxWidth() {
    return this.getSelectedStrokeIndexes().map((index) => this.drawingData.strokes[index]?.width || this.penWidth).reduce((max, width) => Math.max(max, width), this.penWidth);
  }
  getSelectedFrameCanvasRect() {
    if (!this.getSelectedStrokeIndexes().length) {
      return null;
    }
    const bounds = this.getSelectedStrokeBounds();
    if (!bounds) {
      return null;
    }
    const padding = Math.max(this.selectionHitPaddingPx(), this.getSelectedStrokeMaxWidth() + 4);
    return {
      x: bounds.minX - padding,
      y: bounds.minY - padding,
      width: bounds.maxX - bounds.minX + padding * 2,
      height: bounds.maxY - bounds.minY + padding * 2
    };
  }
  findSelectionHandleAt(point) {
    if (!this.getSelectedStrokeIndexes().some((index) => !this.drawingData.strokes[index]?.locked)) {
      return null;
    }
    const rect = this.getSelectedFrameCanvasRect();
    if (!rect) {
      return null;
    }
    const hitPoint = this.pointToCanvas(point);
    for (const handle of getSelectionHandlePointsFromRect(rect)) {
      if (Math.abs(hitPoint.x - handle.x) <= SELECT_RESIZE_HANDLE_HIT_RADIUS && Math.abs(hitPoint.y - handle.y) <= SELECT_RESIZE_HANDLE_HIT_RADIUS) {
        return handle.handle;
      }
    }
    return null;
  }
  selectedStrokeFrameContains(point) {
    const rect = this.getSelectedFrameCanvasRect();
    if (!rect) {
      return false;
    }
    const hitPoint = this.pointToCanvas(point);
    return hitPoint.x >= rect.x && hitPoint.x <= rect.x + rect.width && hitPoint.y >= rect.y && hitPoint.y <= rect.y + rect.height;
  }
  startTextEdit(element, clientPoint = null) {
    if (this.currentEditor === element) {
      element.focus();
      placeCaretInEditable(element, clientPoint);
      this.currentTextRange = window.getSelection?.()?.rangeCount ? window.getSelection().getRangeAt(0).cloneRange() : null;
      this.positionFormatToolbar();
      return;
    }
    this.endTextEdit();
    this.currentEditor = element;
    this.currentEditorFile = this.plugin.resolveEditableFile(element, this.file);
    this.formatToolbarManualPosition = null;
    element.dataset.noteDrawOriginal = element.innerText;
    const saveToVault = this.surfaceType !== "webview";
    if (saveToVault) {
      this.plugin.prepareTextEditState(this.currentEditorFile, element.innerText, element);
    }
    element.contentEditable = "true";
    element.spellcheck = true;
    element.addClass("notedraw-editing");
    this.previewEl.addClass("is-native-text-editing");
    this.formatToolbar?.addClass("is-visible");
    element.focus();
    placeCaretInEditable(element, clientPoint);
    this.currentTextRange = window.getSelection?.()?.rangeCount ? window.getSelection().getRangeAt(0).cloneRange() : null;
    this.positionFormatToolbar();
    const onInput = () => {
      if (!saveToVault) {
        return;
      }
      this.plugin.scheduleTextSave(
        this.currentEditorFile,
        element.dataset.noteDrawOriginal || "",
        serializeEditableSource(element),
        element
      );
      this.positionFormatToolbar();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        this.endTextEdit();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        this.endTextEdit();
      }
      if (event.metaKey || event.ctrlKey) {
        const key = event.key.toLowerCase();
        if (key === "b") {
          event.preventDefault();
          this.applyTextInlineFormat("strong");
        } else if (key === "i") {
          event.preventDefault();
          this.applyTextInlineFormat("em");
        } else if (key === "u") {
          event.preventDefault();
          this.applyTextInlineFormat("u");
        }
      }
    };
    const onBlur = () => {
      window.setTimeout(() => {
        const active = activeDocument.activeElement;
        if (this.currentEditor !== element || element.contains(active) || this.formatToolbar?.contains(active)) {
          return;
        }
        this.endTextEdit();
      }, 0);
    };
    element._noteDrawCleanup = () => {
      element.removeEventListener("input", onInput);
      element.removeEventListener("keydown", onKeyDown);
      element.removeEventListener("blur", onBlur);
    };
    element.addEventListener("input", onInput);
    element.addEventListener("keydown", onKeyDown);
    element.addEventListener("blur", onBlur);
  }
  focusSourceEditorAt(clientPoint) {
    if (!clientPoint || !Number.isFinite(clientPoint.x) || !Number.isFinite(clientPoint.y)) {
      return false;
    }
    const cmView = getCodeMirrorView(this.view, this.previewEl);
    if (cmView && typeof cmView.posAtCoords === "function") {
      const pos = cmView.posAtCoords({ x: clientPoint.x, y: clientPoint.y }, false) ?? cmView.posAtCoords({ x: clientPoint.x, y: clientPoint.y });
      if (Number.isFinite(pos)) {
        cmView.focus?.();
        cmView.dispatch?.({
          selection: { anchor: pos },
          scrollIntoView: false
        });
        return true;
      }
    }
    const editor = this.view?.editor;
    if (editor && typeof editor.focus === "function") {
      editor.focus();
    }
    return dispatchMouseClickThroughOverlay(this.canvas, clientPoint);
  }
  endTextEdit() {
    const element = this.currentEditor;
    if (!element) {
      return;
    }
    const original = element.dataset.noteDrawOriginal || "";
    const edited = this.surfaceType === "webview" ? element.innerText : serializeEditableSource(element);
    if (this.surfaceType === "webview") {
      this.commitWebviewTextEdit(element, original, edited);
    } else if (normalizeEditableSourceText(original) !== normalizeEditableSourceText(edited)) {
      this.plugin.scheduleTextSaveNow(this.currentEditorFile || this.file, original, edited, element);
    }
    element._noteDrawCleanup?.();
    delete element._noteDrawCleanup;
    delete element.dataset.noteDrawOriginal;
    element.contentEditable = "false";
    element.removeClass("notedraw-editing");
    this.previewEl.removeClass("is-native-text-editing");
    this.formatToolbar?.removeClass("is-visible");
    this.stopFormatToolbarDrag();
    this.currentTextRange = null;
    this.formatToolbarManualPosition = null;
    this.currentEditor = null;
    this.currentEditorFile = null;
  }
  commitWebviewTextEdit(element, originalText, editedText) {
    const normalizedOriginal = normalizeRenderedText(originalText);
    const normalizedEdited = normalizeRenderedText(editedText);
    if (!normalizedOriginal || normalizedOriginal === normalizedEdited) {
      return;
    }
    const edit = {
      kind: "text",
      path: domPathForElement(element, this.previewEl),
      originalText: String(originalText || ""),
      editedText: String(editedText || ""),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!edit.path) {
      return;
    }
    const edits = Array.isArray(this.drawingData.webEdits) ? this.drawingData.webEdits : [];
    const existingIndex = edits.findIndex((item) => item?.kind === "text" && item.path === edit.path && normalizeRenderedText(item.originalText) === normalizedOriginal);
    if (existingIndex >= 0) {
      edits[existingIndex] = edit;
    } else {
      edits.push(edit);
    }
    this.drawingData.webEdits = edits;
    this.plugin.scheduleDrawingSave(this.file, this.drawingData);
  }
  applyWebEdits() {
    if (this.surfaceType !== "webview" || this.currentEditor || !Array.isArray(this.drawingData?.webEdits)) {
      return;
    }
    const used = /* @__PURE__ */ new Set();
    for (const edit of this.drawingData.webEdits) {
      if (edit?.kind !== "text" || !edit.path || typeof edit.editedText !== "string") {
        continue;
      }
      const original = normalizeRenderedText(edit.originalText);
      const edited = normalizeRenderedText(edit.editedText);
      if (!original || !edited) {
        continue;
      }
      const element = findWebEditElement(this.previewEl, edit, used);
      if (!element) {
        continue;
      }
      const current = normalizeRenderedText(element.innerText);
      if (current !== original && current !== edited) {
        continue;
      }
      if (current !== edited) {
        element.innerText = edit.editedText;
      }
      used.add(element);
    }
  }
  undoLastStroke() {
    if (!this.drawingData.strokes.length) {
      return;
    }
    const removed = this.drawingData.strokes.pop();
    this.redoStack.push(removed);
    this.clearSelectedStrokes();
    this.rebuildElementRelations();
    this.plugin.scheduleDrawingSave(this.file, this.drawingData);
    this.render();
  }
  redoLastStroke() {
    if (!this.redoStack.length) {
      return;
    }
    const restored = this.redoStack.pop();
    this.drawingData.strokes.push(restored);
    this.setSelectedStrokes(this.drawingData.strokes.length - 1);
    this.rebuildElementRelations();
    this.plugin.scheduleDrawingSave(this.file, this.drawingData);
    this.render();
  }
  deleteSelectedStroke() {
    const indexes = this.getSelectedStrokeIndexes().filter((index) => !this.drawingData.strokes[index]?.locked);
    if (!indexes.length) {
      return;
    }
    for (const index of indexes.slice().sort((a, b) => b - a)) {
      this.drawingData.strokes.splice(index, 1);
    }
    this.clearSelectedStrokes();
    this.redoStack = [];
    this.rebuildElementRelations();
    this.plugin.scheduleDrawingSave(this.file, this.drawingData);
    this.render();
  }
};
export default NoteDrawPlugin;
var NoteDrawSettingTab = class extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  [["dis", "play"].join("")]() {
    const { containerEl } = this;
    containerEl.empty();
    for (const definition of this.getSettingDefinitions()) {
      const setting = new Setting(containerEl);
      definition.render(setting);
    }
  }
  refreshSettingsView() {
    const render = this[["dis", "play"].join("")];
    if (typeof render === "function") {
      render.call(this);
    }
  }
  getSettingDefinitions() {
    const settings = sanitizeSettings(this.plugin.noteDrawSettings);
    return [
      this.createSectionDefinition("settingsSectionInterface"),
      this.createSettingDefinition("settingsLanguage", "settingsLanguageDesc", (setting) => {
        setting.addDropdown((component) => {
          for (const option of LANGUAGE_OPTIONS) {
            component.addOption(option.value, option.value === LANGUAGE_AUTO ? `${this.plugin.t("languageAuto")} (${languageNativeName(detectNoteDrawLanguage(this.plugin.app))})` : option.label);
          }
          component.setValue(settings.language).onChange(async (value) => {
            this.plugin.noteDrawSettings.language = value;
            await this.plugin.saveSettings();
            this.refreshSettingsView();
          });
        });
      }),
      this.createSectionDefinition("settingsSectionPen"),
      this.createSettingDefinition("defaultPenColor", "defaultPenColorDesc", (setting) => {
        setting.addColorPicker((component) => component.setValue(settings.defaultPenColor).onChange(async (value) => {
          this.plugin.noteDrawSettings.defaultPenColor = value;
          await this.plugin.saveSettings();
        }));
      }),
      this.createSettingDefinition("defaultPenWidth", "defaultPenWidthDesc", (setting) => {
        this.addSliderWithValue(setting, {
          value: settings.defaultPenWidth,
          min: MIN_BRUSH_WIDTH,
          max: MAX_BRUSH_WIDTH,
          step: 0.5,
          format: (value) => `${formatSettingNumber(value)} px`,
          onChange: async (value) => {
            this.plugin.noteDrawSettings.defaultPenWidth = value;
            await this.plugin.saveSettings();
          }
        });
      }),
      this.createSettingDefinition("defaultPenOpacity", "defaultPenOpacityDesc", (setting) => {
        this.addSliderWithValue(setting, {
          value: settings.defaultPenOpacity,
          min: 0,
          max: 1,
          step: 0.02,
          format: (value) => `${Math.round(value * 100)}%`,
          onChange: async (value) => {
            this.plugin.noteDrawSettings.defaultPenOpacity = value;
            await this.plugin.saveSettings();
          }
        });
      }),
      this.createSectionDefinition("settingsSectionWatercolor"),
      this.createSettingDefinition("defaultWatercolorColor", "defaultWatercolorColorDesc", (setting) => {
        setting.addColorPicker((component) => component.setValue(settings.defaultWatercolorColor).onChange(async (value) => {
          this.plugin.noteDrawSettings.defaultWatercolorColor = value;
          await this.plugin.saveSettings();
        }));
      }),
      this.createSettingDefinition("defaultWatercolorWidth", "defaultWatercolorWidthDesc", (setting) => {
        this.addSliderWithValue(setting, {
          value: settings.defaultWatercolorWidth,
          min: MIN_BRUSH_WIDTH,
          max: MAX_BRUSH_WIDTH,
          step: 0.5,
          format: (value) => `${formatSettingNumber(value)} px`,
          onChange: async (value) => {
            this.plugin.noteDrawSettings.defaultWatercolorWidth = value;
            await this.plugin.saveSettings();
          }
        });
      }),
      this.createSettingDefinition("defaultWatercolorOpacity", "defaultWatercolorOpacityDesc", (setting) => {
        this.addSliderWithValue(setting, {
          value: settings.defaultWatercolorOpacity,
          min: 0,
          max: 1,
          step: 0.02,
          format: (value) => `${Math.round(value * 100)}%`,
          onChange: async (value) => {
            this.plugin.noteDrawSettings.defaultWatercolorOpacity = value;
            await this.plugin.saveSettings();
          }
        });
      }),
      this.createSettingDefinition("resetBrushDefaults", "resetBrushDefaultsDesc", (setting) => {
        setting.addButton((component) => component.setButtonText(this.plugin.t("reset")).onClick(async () => {
          Object.assign(this.plugin.noteDrawSettings, {
            defaultPenColor: DEFAULT_SETTINGS.defaultPenColor,
            defaultPenWidth: DEFAULT_SETTINGS.defaultPenWidth,
            defaultPenOpacity: DEFAULT_SETTINGS.defaultPenOpacity,
            defaultWatercolorColor: DEFAULT_SETTINGS.defaultWatercolorColor,
            defaultWatercolorWidth: DEFAULT_SETTINGS.defaultWatercolorWidth,
            defaultWatercolorOpacity: DEFAULT_SETTINGS.defaultWatercolorOpacity
          });
          await this.plugin.saveSettings();
          this.refreshSettingsView();
        }));
      }),
      this.createSectionDefinition("settingsSectionInteraction"),
      this.createSettingDefinition("longPressMs", "longPressMsDesc", (setting) => {
        this.addSliderWithValue(setting, {
          value: settings.longPressMs,
          min: MIN_LONG_PRESS_MS,
          max: MAX_LONG_PRESS_MS,
          step: 25,
          format: (value) => `${Math.round(value)} ms`,
          onChange: async (value) => {
            this.plugin.noteDrawSettings.longPressMs = value;
            await this.plugin.saveSettings();
          }
        });
      }),
      this.createSettingDefinition("selectTapDistance", "selectTapDistanceDesc", (setting) => {
        this.addSliderWithValue(setting, {
          value: settings.selectTapDistance,
          min: MIN_SELECT_TAP_DISTANCE,
          max: MAX_SELECT_TAP_DISTANCE,
          step: 1,
          format: (value) => `${Math.round(value)} px`,
          onChange: async (value) => {
            this.plugin.noteDrawSettings.selectTapDistance = value;
            await this.plugin.saveSettings();
          }
        });
      }),
      this.createSettingDefinition("selectStrokePadding", "selectStrokePaddingDesc", (setting) => {
        this.addSliderWithValue(setting, {
          value: settings.selectStrokePadding,
          min: MIN_SELECT_STROKE_PADDING,
          max: MAX_SELECT_STROKE_PADDING,
          step: 1,
          format: (value) => `${Math.round(value)} px`,
          onChange: async (value) => {
            this.plugin.noteDrawSettings.selectStrokePadding = value;
            await this.plugin.saveSettings();
          }
        });
      }),
      this.createSettingDefinition("selectedStrokeAlpha", "selectedStrokeAlphaDesc", (setting) => {
        this.addSliderWithValue(setting, {
          value: settings.selectedStrokeAlpha,
          min: MIN_SELECTED_STROKE_ALPHA,
          max: MAX_SELECTED_STROKE_ALPHA,
          step: 0.02,
          format: (value) => `${Math.round(value * 100)}%`,
          onChange: async (value) => {
            this.plugin.noteDrawSettings.selectedStrokeAlpha = value;
            await this.plugin.saveSettings();
          }
        });
      }),
      this.createSectionDefinition("settingsSectionPerformance"),
      this.createSettingDefinition("drawingInterpolationStep", "drawingInterpolationStepDesc", (setting) => {
        this.addSliderWithValue(setting, {
          value: settings.drawingInterpolationStep,
          min: MIN_DRAWING_INTERPOLATION_STEP_PX,
          max: MAX_DRAWING_INTERPOLATION_STEP_PX,
          step: 0.25,
          format: (value) => `${formatSettingNumber(value)} px`,
          onChange: async (value) => {
            this.plugin.noteDrawSettings.drawingInterpolationStep = value;
            await this.plugin.saveSettings();
          }
        });
      }),
      this.createSettingDefinition("drawingMinPointDistance", "drawingMinPointDistanceDesc", (setting) => {
        this.addSliderWithValue(setting, {
          value: settings.drawingMinPointDistance,
          min: MIN_DRAWING_MIN_POINT_DISTANCE_PX,
          max: MAX_DRAWING_MIN_POINT_DISTANCE_PX,
          step: 0.05,
          format: (value) => `${formatSettingNumber(value)} px`,
          onChange: async (value) => {
            this.plugin.noteDrawSettings.drawingMinPointDistance = value;
            await this.plugin.saveSettings();
          }
        });
      }),
      this.createSettingDefinition("drawingCompactDistance", "drawingCompactDistanceDesc", (setting) => {
        this.addSliderWithValue(setting, {
          value: settings.drawingCompactDistance,
          min: MIN_DRAWING_COMPACT_DISTANCE_PX,
          max: MAX_DRAWING_COMPACT_DISTANCE_PX,
          step: 0.1,
          format: (value) => `${formatSettingNumber(value)} px`,
          onChange: async (value) => {
            this.plugin.noteDrawSettings.drawingCompactDistance = value;
            await this.plugin.saveSettings();
          }
        });
      }),
      this.createSettingDefinition("autoSaveDelayMs", "autoSaveDelayMsDesc", (setting) => {
        this.addSliderWithValue(setting, {
          value: settings.autoSaveDelayMs,
          min: MIN_AUTO_SAVE_DELAY_MS,
          max: MAX_AUTO_SAVE_DELAY_MS,
          step: 20,
          format: (value) => `${Math.round(value)} ms`,
          onChange: async (value) => {
            this.plugin.noteDrawSettings.autoSaveDelayMs = value;
            await this.plugin.saveSettings();
          }
        });
      }),
      this.createSectionDefinition("settingsSectionLayout"),
      this.createSettingDefinition("toolbarTopOffset", "toolbarTopOffsetDesc", (setting) => {
        this.addSliderWithValue(setting, {
          value: settings.toolbarTopOffset,
          min: 0,
          max: 48,
          step: 1,
          format: (value) => `${Math.round(value)} px`,
          onChange: async (value) => {
            this.plugin.noteDrawSettings.toolbarTopOffset = value;
            await this.plugin.saveSettings();
          }
        });
      }),
      this.createSettingDefinition("resetLayoutDefaults", "resetLayoutDefaultsDesc", (setting) => {
        setting.addButton((component) => component.setButtonText(this.plugin.t("reset")).onClick(async () => {
          Object.assign(this.plugin.noteDrawSettings, {
            toolbarTopOffset: DEFAULT_SETTINGS.toolbarTopOffset,
            longPressMs: DEFAULT_SETTINGS.longPressMs,
            selectTapDistance: DEFAULT_SETTINGS.selectTapDistance,
            selectStrokePadding: DEFAULT_SETTINGS.selectStrokePadding,
            selectedStrokeAlpha: DEFAULT_SETTINGS.selectedStrokeAlpha,
            drawingInterpolationStep: DEFAULT_SETTINGS.drawingInterpolationStep,
            drawingMinPointDistance: DEFAULT_SETTINGS.drawingMinPointDistance,
            drawingCompactDistance: DEFAULT_SETTINGS.drawingCompactDistance,
            autoSaveDelayMs: DEFAULT_SETTINGS.autoSaveDelayMs
          });
          await this.plugin.saveSettings();
          this.refreshSettingsView();
        }));
      }),
      this.createSectionDefinition("settingsSectionDiagnostics"),
      this.createSettingDefinition("debugLog", "debugLogDesc", (setting) => {
        setting.addToggle((component) => component.setValue(settings.enableDebugLog).onChange(async (value) => {
          this.plugin.noteDrawSettings.enableDebugLog = value;
          await this.plugin.saveSettings();
        }));
      }),
      this.createSectionDefinition("settingsSectionSupport"),
      this.createCodesDefinition()
    ];
  }
  addSliderWithValue(setting, options) {
    let valueEl = null;
    setting.addSlider((component) => {
      component.setLimits(options.min, options.max, options.step).setValue(options.value).onChange(async (value) => {
        if (valueEl) {
          valueEl.setText(options.format(value));
        }
        await options.onChange(value);
      });
    });
    valueEl = setting.controlEl.createSpan({
      cls: "notedraw-setting-value",
      text: options.format(options.value)
    });
  }
  createSectionDefinition(key) {
    return {
      name: this.plugin.t(key),
      searchable: false,
      render: (setting) => {
        setting.setName(this.plugin.t(key)).setHeading();
        setting.settingEl.addClass("notedraw-settings-section-title");
      }
    };
  }
  createSettingDefinition(nameKey, descKey, renderControl) {
    return {
      name: this.plugin.t(nameKey),
      desc: this.plugin.t(descKey),
      render: (setting) => {
        setting.setName(this.plugin.t(nameKey)).setDesc(this.plugin.t(descKey));
        renderControl(setting);
      }
    };
  }
  createCodesDefinition() {
    return {
      name: this.plugin.t("supportTitle"),
      desc: this.plugin.t("supportSubtitle"),
      render: (setting) => {
        setting.settingEl.empty();
        const codesContainer = setting.settingEl.createDiv({ cls: "notedraw-settings-codes" });
        void this.renderExtraCodes(codesContainer);
      }
    };
  }
  async renderExtraCodes(containerEl) {
    const codeItems = (await Promise.all(
      SETTINGS_EXTRA_CODE_ASSETS.map(async (asset) => {
        const src = await this.plugin.getOptionalAssetResourcePath(asset.path) || asset.dataUrl;
        return src ? { ...asset, src } : null;
      })
    )).filter(Boolean);
    if (!codeItems.length) {
      containerEl.remove();
      return;
    }
    containerEl.createDiv({
      cls: "notedraw-settings-codes-title",
      text: this.plugin.t("supportTitle")
    });
    containerEl.createDiv({
      cls: "notedraw-settings-codes-subtitle",
      text: this.plugin.t("supportSubtitle")
    });
    const gridEl = containerEl.createDiv({ cls: "notedraw-settings-codes-grid" });
    for (const item of codeItems) {
      const label = this.plugin.t(item.labelKey);
      const codeEl = gridEl.createDiv({ cls: "notedraw-settings-code" });
      const imageEl = codeEl.createEl("img", {
        cls: "notedraw-settings-code-image",
        attr: {
          alt: label,
          loading: "lazy",
          src: item.src
        }
      });
      imageEl.src = item.src;
      codeEl.createDiv({
        cls: "notedraw-settings-code-label",
        text: label
      });
    }
  }
};
function findEditableTarget(target, previewEl) {
  if (!target || !previewEl.contains(target)) {
    return null;
  }
  const controller = previewEl?._noteDrawController;
  if (controller?.surfaceType === "webview") {
    return findWebviewEditableTarget(target, previewEl);
  }
  if (target.closest(BLOCKED_EDIT_SELECTOR)) {
    return null;
  }
  const editable = target.closest(EDITABLE_SELECTOR);
  if (!editable || !previewEl.contains(editable)) {
    return null;
  }
  if (!normalizeRenderedText(editable.innerText)) {
    return null;
  }
  return editable;
}
function findWebviewEditableTarget(target, previewEl) {
  if (!target || !previewEl.contains(target) || target.closest(WEBVIEW_BLOCKED_EDIT_SELECTOR)) {
    return null;
  }
  let current = target.closest(WEBVIEW_EDITABLE_SELECTOR);
  while (current && current !== previewEl) {
    if (!current.closest(WEBVIEW_BLOCKED_EDIT_SELECTOR) && normalizeRenderedText(current.innerText)) {
      return current;
    }
    current = current.parentElement?.closest?.(WEBVIEW_EDITABLE_SELECTOR);
  }
  return null;
}
function sanitizeSettings(settings) {
  const input = settings || {};
  return {
    language: normalizeLanguageCode(input.language ?? DEFAULT_SETTINGS.language),
    defaultPenColor: isCssColor(input.defaultPenColor) ? input.defaultPenColor : DEFAULT_SETTINGS.defaultPenColor,
    defaultPenWidth: clamp(Number(input.defaultPenWidth ?? DEFAULT_SETTINGS.defaultPenWidth), MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH),
    defaultPenOpacity: clamp(Number(input.defaultPenOpacity ?? DEFAULT_SETTINGS.defaultPenOpacity), 0, 1),
    defaultWatercolorColor: isCssColor(input.defaultWatercolorColor) ? input.defaultWatercolorColor : DEFAULT_SETTINGS.defaultWatercolorColor,
    defaultWatercolorWidth: clamp(Number(input.defaultWatercolorWidth ?? DEFAULT_SETTINGS.defaultWatercolorWidth), MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH),
    defaultWatercolorOpacity: clamp(Number(input.defaultWatercolorOpacity ?? DEFAULT_SETTINGS.defaultWatercolorOpacity), 0, 1),
    toolbarTopOffset: clamp(Number(input.toolbarTopOffset ?? DEFAULT_SETTINGS.toolbarTopOffset), 0, 48),
    longPressMs: clamp(Number(input.longPressMs ?? DEFAULT_SETTINGS.longPressMs), MIN_LONG_PRESS_MS, MAX_LONG_PRESS_MS),
    selectTapDistance: clamp(Number(input.selectTapDistance ?? DEFAULT_SETTINGS.selectTapDistance), MIN_SELECT_TAP_DISTANCE, MAX_SELECT_TAP_DISTANCE),
    selectStrokePadding: clamp(Number(input.selectStrokePadding ?? DEFAULT_SETTINGS.selectStrokePadding), MIN_SELECT_STROKE_PADDING, MAX_SELECT_STROKE_PADDING),
    selectedStrokeAlpha: clamp(Number(input.selectedStrokeAlpha ?? DEFAULT_SETTINGS.selectedStrokeAlpha), MIN_SELECTED_STROKE_ALPHA, MAX_SELECTED_STROKE_ALPHA),
    drawingInterpolationStep: clamp(Number(input.drawingInterpolationStep ?? DEFAULT_SETTINGS.drawingInterpolationStep), MIN_DRAWING_INTERPOLATION_STEP_PX, MAX_DRAWING_INTERPOLATION_STEP_PX),
    drawingMinPointDistance: clamp(Number(input.drawingMinPointDistance ?? DEFAULT_SETTINGS.drawingMinPointDistance), MIN_DRAWING_MIN_POINT_DISTANCE_PX, MAX_DRAWING_MIN_POINT_DISTANCE_PX),
    drawingCompactDistance: clamp(Number(input.drawingCompactDistance ?? DEFAULT_SETTINGS.drawingCompactDistance), MIN_DRAWING_COMPACT_DISTANCE_PX, MAX_DRAWING_COMPACT_DISTANCE_PX),
    autoSaveDelayMs: clamp(Number(input.autoSaveDelayMs ?? DEFAULT_SETTINGS.autoSaveDelayMs), MIN_AUTO_SAVE_DELAY_MS, MAX_AUTO_SAVE_DELAY_MS),
    enableDebugLog: Boolean(input.enableDebugLog)
  };
}
function translateNoteDraw(plugin, key, vars = {}) {
  const language = resolveNoteDrawLanguage(plugin);
  const template = I18N[language]?.[key] ?? I18N.en[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => vars?.[name] ?? "");
}
function formatSettingNumber(value) {
  return String(Math.round(Number(value || 0) * 100) / 100);
}
function resolveNoteDrawLanguage(plugin) {
  const language = normalizeLanguageCode(plugin?.noteDrawSettings?.language ?? DEFAULT_SETTINGS.language);
  if (language !== LANGUAGE_AUTO) {
    return language;
  }
  return detectNoteDrawLanguage(plugin?.app);
}
function detectNoteDrawLanguage(app) {
  const navigatorLanguage = typeof navigator !== "undefined" ? navigator.language : "";
  const navigatorLanguages = typeof navigator !== "undefined" ? Array.from(navigator.languages ?? []) : [];
  const candidates = [
    app?.vault?.getConfig?.("language"),
    app?.vault?.getConfig?.("locale"),
    activeDocument.documentElement.lang,
    navigatorLanguage,
    ...navigatorLanguages,
    app?.appId
  ];
  for (const candidate of candidates) {
    const language = normalizeLanguageCode(candidate, false);
    if (language && language !== LANGUAGE_AUTO) {
      return language;
    }
  }
  return "en";
}
function normalizeLanguageCode(value, allowAuto = true) {
  const text = String(value || "").trim();
  if (!text) {
    return allowAuto ? LANGUAGE_AUTO : "";
  }
  const lower = text.replace("_", "-").toLowerCase();
  if (allowAuto && lower === LANGUAGE_AUTO) {
    return LANGUAGE_AUTO;
  }
  if (lower.startsWith("zh-tw") || lower.startsWith("zh-hk") || lower.includes("hant")) {
    return "zh-TW";
  }
  if (lower.startsWith("zh")) {
    return "zh";
  }
  if (lower.startsWith("ug") || lower.startsWith("uig")) {
    return "ug";
  }
  const primary = lower.split("-")[0];
  return I18N[primary] ? primary : allowAuto ? LANGUAGE_AUTO : "";
}
function languageNativeName(language) {
  return LANGUAGE_OPTIONS.find((option) => option.value === language)?.label || LANGUAGE_OPTIONS.find((option) => option.value === "en")?.label || "English";
}
function setNoteDrawCssProps(element, props) {
  if (typeof element?.setCssProps === "function") {
    element.setCssProps(props);
  }
}
function createNoteDrawControlElement(parent, cls) {
  const element = parent.createDiv({ cls });
  if (parent === activeDocument.body) {
    element.addClass("notedraw-body-control");
  }
  return element;
}
function shouldUseBodyFloatingControls(previewEl, surfaceType) {
  if (surfaceType !== "preview") {
    return false;
  }
  return isMobileRuntime() && Boolean(previewEl.closest?.(".markdown-preview-view"));
}
function isMobileRuntime() {
  return Boolean(Platform.isMobileApp || activeDocument?.body?.classList?.contains("is-mobile"));
}
function isAppleMobileRuntime() {
  return Boolean(Platform.isIosApp);
}
function isAppleTouchEvent(event) {
  if (!isAppleMobileRuntime()) {
    return false;
  }
  return event?.type?.startsWith?.("touch") || event?.pointerType === "touch";
}
function setAccessibleLabel(element, label) {
  if (!element || !label) {
    return;
  }
  element.setAttribute("title", label);
  element.setAttribute("aria-label", label);
}
function isCssColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}
function contrastTextColor(hexColor) {
  if (!isCssColor(hexColor)) {
    return "#111827";
  }
  const red = parseInt(hexColor.slice(1, 3), 16);
  const green = parseInt(hexColor.slice(3, 5), 16);
  const blue = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.58 ? "#111827" : "#ffffff";
}
function isSourceTextTarget(target, previewEl) {
  if (!target || !previewEl?.contains(target)) {
    return false;
  }
  if (target.closest(BLOCKED_EDIT_SELECTOR)) {
    return false;
  }
  return Boolean(
    target.closest?.(".cm-line, .cm-content, .cm-activeLine") || target.classList?.contains("cm-line") || target.classList?.contains("cm-content")
  );
}
function normalizeRenderedText(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\r\n/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean).join("\n").trim();
}
function normalizeEditableSourceText(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function placeCaretInEditable(element, clientPoint) {
  const selection = window.getSelection?.();
  if (!selection) {
    return;
  }
  const range = rangeFromClientPoint(element, clientPoint) || nearestTextRangeFromPoint(element, clientPoint) || rangeAtEditableEnd(element);
  if (!range) {
    return;
  }
  selection.removeAllRanges();
  selection.addRange(range);
}
function rangeFromClientPoint(element, clientPoint) {
  if (!clientPoint || !Number.isFinite(clientPoint.x) || !Number.isFinite(clientPoint.y)) {
    return null;
  }
  let range = null;
  const overlay = element.closest(".notedraw-shell")?.querySelector(".notedraw-canvas");
  const previousPointerEvents = overlay?.style.pointerEvents;
  try {
    if (overlay) {
      applyElementStyles(overlay, { pointerEvents: "none" });
    }
    if (typeof activeDocument.caretPositionFromPoint === "function") {
      const position = activeDocument.caretPositionFromPoint(clientPoint.x, clientPoint.y);
      if (position?.offsetNode) {
        range = activeDocument.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    } else {
      const legacyCaretRangeFromPoint = activeDocument[["caret", "Range", "From", "Point"].join("")];
      if (typeof legacyCaretRangeFromPoint === "function") {
        range = legacyCaretRangeFromPoint.call(activeDocument, clientPoint.x, clientPoint.y);
      }
    }
  } finally {
    if (overlay) {
      applyElementStyles(overlay, { pointerEvents: previousPointerEvents || "" });
    }
  }
  if (!range || !element.contains(range.startContainer)) {
    return null;
  }
  range.collapse(true);
  return range;
}
function nearestTextRangeFromPoint(element, clientPoint) {
  const walker = activeDocument.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node2) {
        return node2.nodeValue && node2.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }
  );
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let node = walker.nextNode();
  while (node) {
    const value = node.nodeValue || "";
    for (let offset = 0; offset < value.length; offset += 1) {
      const charRange = activeDocument.createRange();
      charRange.setStart(node, offset);
      charRange.setEnd(node, offset + 1);
      for (const rect of Array.from(charRange.getClientRects())) {
        if (!isUsableRect(rect)) {
          continue;
        }
        const score = scoreRectDistance(rect, clientPoint);
        if (score < bestScore) {
          const caretOffset = clientPoint.x > rect.left + rect.width / 2 ? offset + 1 : offset;
          const caretRange = activeDocument.createRange();
          caretRange.setStart(node, caretOffset);
          caretRange.collapse(true);
          best = caretRange;
          bestScore = score;
        }
      }
    }
    node = walker.nextNode();
  }
  return best;
}
function isUsableRect(rect) {
  return rect && Number.isFinite(rect.left) && Number.isFinite(rect.top) && rect.width > 0 && rect.height > 0;
}
function rangeLineRect(range) {
  if (!range) {
    return null;
  }
  const rects = Array.from(range.getClientRects?.() || []).filter(isUsableRect);
  if (rects.length) {
    return rects[rects.length - 1];
  }
  const rect = range.getBoundingClientRect?.();
  if (rect && Number.isFinite(rect.left) && Number.isFinite(rect.top) && rect.height > 0) {
    return rect;
  }
  return null;
}
function scoreRectDistance(rect, point) {
  const xDistance = point.x < rect.left ? rect.left - point.x : point.x > rect.right ? point.x - rect.right : 0;
  const centerY = rect.top + rect.height / 2;
  const sameLineBonus = point.y >= rect.top - 2 && point.y <= rect.bottom + 2 ? 0 : 1e5;
  const linePenalty = Math.abs(point.y - centerY) * 200;
  const inlinePenalty = xDistance;
  return sameLineBonus + linePenalty + inlinePenalty;
}
function rangeAtEditableEnd(element) {
  const range = activeDocument.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  return range;
}
function applyInlineFormatStyles(element, styles = {}) {
  const safeStyles = {};
  if (styles.color && isCssColor(styles.color)) {
    safeStyles.color = styles.color;
  }
  if (styles.backgroundColor && isCssColor(styles.backgroundColor)) {
    safeStyles.backgroundColor = styles.backgroundColor;
  }
  if (styles.fontSize && isSafeCssSize(styles.fontSize)) {
    safeStyles.fontSize = styles.fontSize;
  }
  if (Object.keys(safeStyles).length) {
    applyElementStyles(element, safeStyles);
  }
}
function selectNodeContents(node) {
  const selection = window.getSelection?.();
  if (!selection) {
    return;
  }
  const range = activeDocument.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}
function serializeEditableSource(element) {
  return serializeEditableChildren(element).replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function serializeEditableChildren(node) {
  return Array.from(node.childNodes || []).map((child) => serializeEditableNode(child)).join("");
}
function serializeEditableNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue || "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  const element = node;
  const tag = element.tagName.toLowerCase();
  if (tag === "br") {
    return "<br>";
  }
  if (tag === "pre") {
    const code = element.querySelector("code");
    const text = code ? code.textContent || "" : element.textContent || "";
    return `\n\`\`\`\n${text.replace(/\n+$/g, "")}\n\`\`\`\n`;
  }
  const inner = serializeEditableChildren(element);
  if (!inner && !["span", "mark"].includes(tag)) {
    return "";
  }
  if (tag === "strong" || tag === "b") {
    return wrapInlineMarkdown(inner, "**");
  }
  if (tag === "em" || tag === "i") {
    return wrapInlineMarkdown(inner, "*");
  }
  if (tag === "u") {
    return `<u>${inner}</u>`;
  }
  if (tag === "code") {
    return inlineCodeMarkdown(element.textContent || inner);
  }
  if (tag === "mark") {
    const background = normalizeCssColor(element.style.backgroundColor);
    return background ? `<mark style="background-color: ${background};">${inner}</mark>` : `==${inner}==`;
  }
  if (tag === "span") {
    const styleText = serializeInlineStyle(element);
    return styleText ? `<span style="${styleText}">${inner}</span>` : inner;
  }
  if (tag === "kbd" || tag === "sup" || tag === "sub" || tag === "small") {
    return `<${tag}>${inner}</${tag}>`;
  }
  if (tag === "div" || tag === "p") {
    return `${inner}\n`;
  }
  if (tag === "li") {
    return inner;
  }
  return inner;
}
function wrapInlineMarkdown(text, marker) {
  const value = String(text || "");
  return value.trim() ? `${marker}${value}${marker}` : value;
}
function inlineCodeMarkdown(text) {
  const value = String(text || "");
  const longest = Math.max(0, ...Array.from(value.matchAll(/`+/g)).map((match) => match[0].length));
  const fence = "`".repeat(longest + 1 || 1);
  return `${fence}${value}${fence}`;
}
function serializeInlineStyle(element) {
  const styles = [];
  const color = normalizeCssColor(element.style.color);
  const background = normalizeCssColor(element.style.backgroundColor);
  const fontSize = isSafeCssSize(element.style.fontSize) ? element.style.fontSize : "";
  const fontFamily = /monospace/i.test(element.style.fontFamily || "") ? "monospace" : "";
  if (color) {
    styles.push(`color: ${color}`);
  }
  if (background) {
    styles.push(`background-color: ${background}`);
  }
  if (fontSize) {
    styles.push(`font-size: ${fontSize}`);
  }
  if (fontFamily) {
    styles.push(`font-family: ${fontFamily}`);
  }
  return styles.join("; ");
}
function normalizeCssColor(value) {
  const text = String(value || "").trim();
  if (isCssColor(text)) {
    return text;
  }
  const rgb = text.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgb) {
    return "";
  }
  const toHex = (part) => clamp(Math.round(Number(part)), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`;
}
function isSafeCssSize(value) {
  return /^(0?\.?\d+|\d+(?:\.\d+)?)(em|rem|px|%)$/i.test(String(value || "").trim());
}
function normalizeMarkdownBlock(value) {
  let text = String(value || "").trim();
  text = text.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6])>/gi, "\n").replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "$1").replace(/<\/?(span|u|mark|kbd|sup|sub|small|strong|b|em|i|code)[^>]*>/gi, "").replace(/<[^>]+>/g, "");
  text = text.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "").replace(/^#{1,6}\s+/gm, "").replace(/^\s{0,3}>\s?/gm, "").replace(/^\s*[-*+]\s+/gm, "").replace(/^\s*\d+[.)]\s+/gm, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/_([^_]+)_/g, "$1").replace(/==([^=]+)==/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return normalizeRenderedText(text);
}
function collectMarkdownBlocks(source) {
  const blocks = [];
  const lines = source.split(/(\r?\n)/);
  let offset = 0;
  let lineNumber = 0;
  let start = 0;
  let startLine = 0;
  let buffer = "";
  let inFence = false;
  for (let i = 0; i < lines.length; i += 2) {
    const line = lines[i] || "";
    const newline = lines[i + 1] || "";
    const fullLine = line + newline;
    const trimmed = line.trim();
    const lineStart = offset;
    const currentLine = lineNumber;
    offset += fullLine.length;
    lineNumber += 1;
    if (/^```|^~~~/.test(trimmed)) {
      if (buffer.trim()) {
        blocks.push({
          start,
          end: lineStart,
          line: startLine,
          endLine: Math.max(startLine, currentLine - 1),
          text: buffer.replace(/\s+$/, "")
        });
        buffer = "";
      }
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    if (!trimmed) {
      if (buffer.trim()) {
        blocks.push({
          start,
          end: lineStart,
          line: startLine,
          endLine: Math.max(startLine, currentLine - 1),
          text: buffer.replace(/\s+$/, "")
        });
        buffer = "";
      }
      start = offset;
      startLine = lineNumber;
      continue;
    }
    if (!buffer) {
      start = lineStart;
      startLine = currentLine;
    }
    buffer += fullLine;
  }
  if (buffer.trim()) {
    blocks.push({
      start,
      end: source.length,
      line: startLine,
      endLine: Math.max(startLine, lineNumber - 1),
      text: buffer.replace(/\s+$/, "")
    });
  }
  return blocks;
}
function resolveRenderedSourcePath(app, root, fallbackPath) {
  const embed = root?.closest?.(".internal-embed, .markdown-embed, .markdown-embed-content");
  if (!embed) {
    return normalizeVaultPath(fallbackPath);
  }
  const owner = embed.matches?.(".internal-embed") ? embed : embed.closest?.(".internal-embed") || embed.querySelector?.(".internal-embed") || embed;
  const rawLink = owner?.getAttribute?.("data-src") || owner?.getAttribute?.("data-path") || owner?.getAttribute?.("src") || "";
  const link = unwrapWikiLink(String(rawLink || "").replace(/^!/, "")).split("|")[0].split("#")[0].trim();
  if (!link) {
    return normalizeVaultPath(fallbackPath);
  }
  const file = app.metadataCache.getFirstLinkpathDest?.(link, fallbackPath || "") || getVaultFileByPath(app.vault, link);
  return normalizeVaultPath(file?.path || fallbackPath);
}
function annotateVisibleMarkdownElements(app, root, fallbackPath) {
  for (const element of root?.querySelectorAll?.(EDITABLE_SELECTOR) || []) {
    element.dataset.noteDrawSourcePath = resolveRenderedSourcePath(app, element, fallbackPath);
    if (element.dataset.noteDrawLineStart) {
      continue;
    }
    const dataLine = parseDataLine(element.getAttribute("data-line")) ?? parseDataLine(element.closest?.("[data-line]")?.getAttribute("data-line"));
    if (Number.isFinite(dataLine)) {
      element.dataset.noteDrawLineStart = String(dataLine);
      element.dataset.noteDrawLineEnd = String(dataLine);
      element.dataset.noteDrawDataLine = String(dataLine);
    }
  }
}
async function annotateRenderedMarkdownLines(app, root, fallbackPath) {
  annotateVisibleMarkdownElements(app, root, fallbackPath);
  const elements = Array.from(root?.querySelectorAll?.(EDITABLE_SELECTOR) || []).filter((element) => {
    return !element.dataset.noteDrawLineStart && element.dataset.noteDrawSourcePath;
  });
  const sources = /* @__PURE__ */ new Map();
  for (const path of new Set(elements.map((element) => normalizeVaultPath(element.dataset.noteDrawSourcePath || fallbackPath)))) {
    const file = getVaultFileByPath(app.vault, path);
    if (!file) {
      continue;
    }
    try {
      sources.set(path, await app.vault.cachedRead(file));
    } catch (error) {
      void error;
    }
  }
  for (const element of elements) {
    const path = normalizeVaultPath(element.dataset.noteDrawSourcePath || fallbackPath);
    const source = sources.get(path);
    if (typeof source !== "string") {
      continue;
    }
    const match = matchRenderedTextToMarkdown(source, element._noteDrawSourceText || element.innerText || element.textContent || "");
    if (!match) {
      continue;
    }
    element.dataset.noteDrawLineStart = String(match.lineStart);
    element.dataset.noteDrawLineEnd = String(match.lineEnd);
    element.dataset.noteDrawLineConfidence = String(match.confidence);
  }
}
function annotateEditableElements(root, ctx, sourcePath = ctx?.sourcePath || "") {
  const elements = [];
  if (root.matches?.(EDITABLE_SELECTOR)) {
    elements.push(root);
  }
  elements.push(...root.querySelectorAll(EDITABLE_SELECTOR));
  for (const element of elements) {
    element.dataset.noteDrawSourcePath = normalizeVaultPath(sourcePath);
    const info = safeGetSectionInfo(ctx, element) || safeGetSectionInfo(ctx, root);
    const ownDataLine = parseDataLine(element.getAttribute("data-line"));
    const dataLineEl = element.closest("[data-line]");
    const closestDataLine = parseDataLine(dataLineEl?.getAttribute("data-line"));
    const dataLine = Number.isFinite(ownDataLine) ? ownDataLine : closestDataLine;
    if (Number.isFinite(dataLine)) {
      element.dataset.noteDrawDataLine = String(dataLine);
      element.dataset.noteDrawDataLineScope = Number.isFinite(ownDataLine) ? "self" : "ancestor";
    }
    if (!info) {
      continue;
    }
    if (typeof info.text === "string" && info.text.trim()) {
      element._noteDrawSourceText = info.text;
    }
    if (Number.isFinite(info.lineStart)) {
      element.dataset.noteDrawLineStart = String(info.lineStart);
      element.dataset.noteDrawLineConfidence = "1";
    }
    if (Number.isFinite(info.lineEnd)) {
      element.dataset.noteDrawLineEnd = String(info.lineEnd);
    }
  }
}
function safeGetSectionInfo(ctx, element) {
  try {
    return ctx.getSectionInfo?.(element) || null;
  } catch (error) {
    void error;
    return null;
  }
}
function findOwningMarkdownView(app, element, sourcePath) {
  const leaves = app.workspace.getLeavesOfType?.("markdown") || [];
  for (const leaf of leaves) {
    const view = leaf.view;
    if (!(view instanceof MarkdownView)) {
      continue;
    }
    if (sourcePath && view.file?.path !== sourcePath) {
      continue;
    }
    if (view.containerEl?.contains(element)) {
      return view;
    }
  }
  return null;
}
function findOwningWorkspaceView(app, element) {
  const leaves = typeof app.workspace?.iterateAllLeaves === "function" ? collectWorkspaceLeaves(app) : [];
  for (const leaf of leaves) {
    const view = leaf?.view;
    if (view?.containerEl?.contains(element)) {
      return view;
    }
  }
  const leafContent = element.closest?.(".workspace-leaf-content");
  return leafContent?._notedrawFallbackView || {
    containerEl: leafContent || element,
    addAction: null,
    getViewType: () => leafContent?.dataset?.type || "webview"
  };
}
function findOwningLeaf(app, element) {
  if (!element) {
    return null;
  }
  return collectWorkspaceLeaves(app).find((leaf) => leaf?.view?.containerEl?.contains(element)) || null;
}
function collectWorkspaceLeaves(app) {
  const leaves = [];
  try {
    app.workspace.iterateAllLeaves((leaf) => leaves.push(leaf));
  } catch (error) {
    void error;
    return [];
  }
  return leaves;
}
function findRootPreviewForView(view) {
  const previews = Array.from(view?.containerEl?.querySelectorAll(".markdown-preview-view") || []);
  return previews.find((preview) => !isEmbeddedPreview(preview) && isElementVisibleEnough(preview)) || previews.find((preview) => !isEmbeddedPreview(preview)) || null;
}
function findPrimaryMarkdownSurface(view) {
  const source = findSourceSurfaceForView(view);
  const preview = findRootPreviewForView(view);
  if (isElementVisibleEnough(source)) {
    return source;
  }
  if (isElementVisibleEnough(preview)) {
    return preview;
  }
  return isSourceMode(view) ? source || preview : preview || source;
}
function currentMarkdownSurfaceType(view) {
  const source = findSourceSurfaceForView(view);
  const preview = findRootPreviewForView(view);
  if (isElementVisibleEnough(source)) {
    return "source";
  }
  if (isElementVisibleEnough(preview)) {
    return "preview";
  }
  return isSourceMode(view) ? "source" : "preview";
}
function isReadingSurfaceVisible(view) {
  const preview = findRootPreviewForView(view);
  return isElementVisibleEnough(preview) && !isElementVisibleEnough(findSourceSurfaceForView(view));
}
function isElementVisibleEnough(element) {
  if (!element?.isConnected) {
    return false;
  }
  const rect = element.getBoundingClientRect?.();
  return Boolean(rect && rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth);
}
function isBlockingObsidianOverlayOpen(document) {
  const candidates = document?.querySelectorAll?.(".modal-container .modal, .modal-container.mod-dim, .modal-bg") || [];
  return Array.from(candidates).some((element) => {
    if (!element?.isConnected) {
      return false;
    }
    const style = element.ownerDocument?.defaultView?.getComputedStyle?.(element);
    const rect = element.getBoundingClientRect?.();
    return style?.display !== "none" && style?.visibility !== "hidden" && Number(style?.opacity ?? 1) !== 0 && Boolean(rect && rect.width > 1 && rect.height > 1);
  });
}
function findWebviewSurfaces(root) {
  if (!root) {
    return [];
  }
  const selectors = [
    ".mwv-embed[data-url]",
    ".workspace-leaf-content[data-type='mobile-webviewer-view'] .view-content",
    ".workspace-leaf-content[data-type*='webview'] .view-content",
    ".workspace-leaf-content[data-type*='web-view'] .view-content",
    ".workspace-leaf-content[data-type*='browser'] .view-content",
    ".workspace-leaf-content[data-type*='iframe'] .view-content"
  ];
  const candidates = selectors.flatMap((selector) => Array.from(root.querySelectorAll(selector)));
  const iframeHosts = Array.from(root.querySelectorAll("webview, iframe")).map((element) => element.closest(".mwv-embed[data-url], .view-content, .workspace-leaf-content") || element);
  return uniqueConnectedElements([...candidates, ...iframeHosts]).filter((element) => !element.closest(".notedraw-toolbar, .notedraw-palette-panel, .notedraw-text-panel"));
}
function findWebviewButtonHost(previewEl, view) {
  const candidates = [
    previewEl?.querySelector?.(".mwv-toolbar"),
    previewEl?.querySelector?.(".mwv-note-actions"),
    previewEl?.querySelector?.(".mwv-note-source"),
    previewEl?.querySelector?.(".mwv-address-row"),
    previewEl?.querySelector?.(".mwv-header"),
    view?.containerEl?.querySelector?.(".view-actions")
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate?.isConnected) {
      return candidate;
    }
  }
  return null;
}
function uniqueConnectedElements(elements) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const element of elements) {
    if (!element?.isConnected || seen.has(element)) {
      continue;
    }
    seen.add(element);
    result.push(element);
  }
  return result.filter((element) => !result.some((other) => other !== element && element.contains(other)));
}
function createWebviewDrawingFile(surface, view) {
  const sourcePath = webviewSurfaceStoragePath(surface, view);
  return {
    path: sourcePath,
    name: sourcePath.split("/").pop() || "webview.md",
    extension: "md"
  };
}
function webviewSurfaceStoragePath(surface, view) {
  const explicitUrl = surface?.dataset?.url || surface?.querySelector?.("[data-url]")?.dataset?.url || webviewCurrentUrl(view) || surface?.querySelector?.("webview, iframe")?.getAttribute?.("src") || "";
  const identity = canonicalizeWebviewUrl(explicitUrl) || viewTitle(view) || surface?.closest?.(".workspace-leaf-content")?.getAttribute?.("data-type") || "webview";
  const label = safeStorageName(webviewSurfaceLabel(identity, view));
  return `${WEBVIEW_DRAWING_PREFIX}/${label}__${hashString(identity)}.md`;
}
function webviewCurrentUrl(view) {
  const candidates = [
    view?.currentUrl,
    view?.iframeEl?.getAttribute?.("src"),
    view?.iframeEl?.src,
    view?.addressEl?.value
  ];
  return candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
}
function canonicalizeWebviewUrl(url) {
  const text = String(url || "").trim();
  if (!text) {
    return "";
  }
  try {
    return new URL(text).toString();
  } catch (error) {
    void error;
    return text;
  }
}
function webviewSurfaceLabel(identity, view) {
  try {
    const parsed = new URL(identity);
    return parsed.hostname.replace(/^www\./, "") || viewTitle(view) || "webview";
  } catch (error) {
    void error;
    return viewTitle(view) || "webview";
  }
}
function viewTitle(view) {
  try {
    if (typeof view?.getDisplayText === "function") {
      return view.getDisplayText();
    }
  } catch (error) {
    void error;
  }
  return view?.containerEl?.querySelector?.(".view-header-title")?.textContent?.trim() || view?.containerEl?.getAttribute?.("data-type") || view?.getViewType?.() || "webview";
}
function safeStorageName(value) {
  return String(value || "webview").replace(/\\/g, "/").split("/").pop().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "webview";
}
function applyElementStyles(element, styles) {
  if (!element || !styles) {
    return;
  }
  if (typeof element.setCssStyles === "function") {
    element.setCssStyles(styles);
    return;
  }
  for (const [key, value] of Object.entries(styles)) {
    element.style[key] = value;
  }
}
function findNoteDrawExportHost(container) {
  const closestShell = container.closest?.(".notedraw-shell");
  if (closestShell instanceof HTMLElement) {
    return closestShell;
  }
  const nestedShell = container.querySelector?.(".notedraw-shell");
  if (nestedShell instanceof HTMLElement) {
    return nestedShell;
  }
  return container;
}
async function prepareExportImages(root) {
  const images = root instanceof HTMLImageElement ? [root] : Array.from(root?.querySelectorAll?.("img") || []);
  for (const image of images) {
    await prepareExportImage(image);
  }
}
async function prepareExportImage(image) {
  if (!(image instanceof HTMLImageElement)) {
    return;
  }
  image.removeAttribute("srcset");
  image.setAttribute("decoding", "sync");
  image.setAttribute("loading", "eager");
  await waitForImage(image, 1800).catch(() => null);
  if (!image.naturalWidth || !image.naturalHeight) {
    return;
  }
  flattenImageOnWhite(image);
}
function flattenImageOnWhite(image) {
  try {
    const width = Math.max(1, image.naturalWidth || image.width);
    const height = Math.max(1, image.naturalHeight || image.height);
    const canvas = activeDocument.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return false;
    }
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    image.src = canvas.toDataURL("image/png");
    return true;
  } catch (error) {
    void error;
    return false;
  }
}
function hashString(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function isSourceMode(view) {
  try {
    if (typeof view?.getMode === "function") {
      return view.getMode() === "source";
    }
  } catch (error) {
    void error;
  }
  const stateMode = view?.getState?.()?.mode;
  if (stateMode) {
    return stateMode === "source";
  }
  return Boolean(findSourceSurfaceForView(view));
}
function findSourceSurfaceForView(view) {
  const container = view?.containerEl;
  if (!container) {
    return null;
  }
  return container.querySelector(".markdown-source-view .cm-scroller") || container.querySelector(".markdown-source-view .cm-editor") || container.querySelector(".markdown-source-view") || null;
}
function getCodeMirrorView(markdownView, sourceEl) {
  const candidates = [
    markdownView?.editor?.cm,
    markdownView?.editor?.editor?.cm,
    markdownView?.editor?.editor,
    markdownView?.cm,
    markdownView?.cmEditor,
    sourceEl?.cmView
  ];
  return candidates.find((candidate) => candidate && typeof candidate.posAtCoords === "function" && typeof candidate.dispatch === "function") || null;
}
function dispatchMouseClickThroughOverlay(canvas, clientPoint) {
  if (!canvas || !clientPoint) {
    return false;
  }
  const previousPointerEvents = canvas.style.pointerEvents;
  applyElementStyles(canvas, { pointerEvents: "none" });
  const target = activeDocument.elementFromPoint(clientPoint.x, clientPoint.y);
  applyElementStyles(canvas, { pointerEvents: previousPointerEvents || "" });
  if (!target) {
    return false;
  }
  const eventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: clientPoint.x,
    clientY: clientPoint.y,
    button: 0,
    buttons: 1
  };
  target.dispatchEvent(new MouseEvent("mousedown", eventInit));
  target.dispatchEvent(new MouseEvent("mouseup", { ...eventInit, buttons: 0 }));
  target.dispatchEvent(new MouseEvent("click", { ...eventInit, buttons: 0 }));
  return true;
}
function domPathForElement(element, root) {
  if (!element || !root?.contains(element) || element === root) {
    return "";
  }
  const parts = [];
  let current = element;
  while (current && current !== root && current.nodeType === Node.ELEMENT_NODE) {
    const parent = current.parentElement;
    if (!parent) {
      return "";
    }
    const tag = current.tagName.toLowerCase();
    const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
    const index = Math.max(0, siblings.indexOf(current));
    parts.unshift(`${tag}:${index}`);
    current = parent;
  }
  return parts.join("/");
}
function elementForDomPath(root, path) {
  if (!root || !path) {
    return null;
  }
  let current = root;
  for (const part of String(path).split("/")) {
    const [tag, indexText] = part.split(":");
    const index = Number(indexText);
    if (!tag || !Number.isInteger(index) || index < 0) {
      return null;
    }
    const matches = Array.from(current.children || []).filter((child) => child.tagName.toLowerCase() === tag);
    current = matches[index] || null;
    if (!current) {
      return null;
    }
  }
  return current;
}
function findWebEditElement(root, edit, used = /* @__PURE__ */ new Set()) {
  const direct = elementForDomPath(root, edit.path);
  if (direct && !used.has(direct)) {
    return direct;
  }
  const original = normalizeRenderedText(edit.originalText);
  if (!original) {
    return null;
  }
  const candidates = Array.from(root.querySelectorAll(WEBVIEW_EDITABLE_SELECTOR)).filter((element) => !used.has(element) && !element.closest(WEBVIEW_BLOCKED_EDIT_SELECTOR));
  return candidates.find((element) => normalizeRenderedText(element.innerText) === original) || null;
}
function isEmbeddedPreview(preview) {
  return Boolean(preview.closest(".markdown-embed, .markdown-embed-content, .internal-embed, .external-embed"));
}
function cleanupAllDrawingHeaderButtons() {
  activeDocument.querySelectorAll(".notedraw-header-button, .notedraw-webview-button").forEach((button) => button.remove());
  activeDocument.body?.querySelectorAll?.(".notedraw-body-control, .notedraw-file-input").forEach((element) => element.remove());
}
function cleanupDrawingUi(preview) {
  preview.querySelectorAll(".notedraw-button, .notedraw-fallback-button, .notedraw-webview-button, .notedraw-toolbar, .notedraw-palette-panel, .notedraw-text-panel, .notedraw-selection-menu, .notedraw-format-toolbar, .notedraw-embed-layer, .notedraw-file-input, .notedraw-static-canvas, .notedraw-canvas").forEach((element) => element.remove());
  preview.classList.remove("notedraw-shell", "is-drawing-active", "is-drawing-hidden", "is-select-mode", "is-palette-open", "is-text-panel-open", "is-selection-menu-open", "is-watercolor-mode", "is-edit-md-mode", "is-selecting-strokes", "is-resizing-selection", "is-native-text-editing", "is-notedraw-webview-shell", "is-notedraw-responsive-layout", "is-notedraw-controls-visible", "has-notedraw-body-controls", "has-notedraw-canvas");
}
function isMarkdownContentMutation(mutation) {
  if (mutation?.type !== "childList") {
    return false;
  }
  const markdownRootSelector = ".markdown-preview-view, .markdown-embed-content, .internal-embed";
  return Array.from(mutation.addedNodes || []).some((node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    const insideMarkdown = Boolean(node.closest?.(markdownRootSelector));
    return node.matches?.(markdownRootSelector) || node.querySelector?.(markdownRootSelector) || insideMarkdown && (node.matches?.(MARKDOWN_TEXT_SELECTOR) || node.querySelector?.(MARKDOWN_TEXT_SELECTOR));
  });
}
function isWebviewSyncMutation(mutation) {
  if (!mutation) {
    return false;
  }
  if (mutation.type === "attributes") {
    return mutation.attributeName === "data-url" || mutation.attributeName === "src";
  }
  if (mutation.type !== "childList") {
    return false;
  }
  return [...Array.from(mutation.addedNodes || []), ...Array.from(mutation.removedNodes || [])].some((node) => isWebviewRelatedNode(node));
}
function isFloatingControlsVisibilityMutation(mutation) {
  if (!mutation || mutation.target?.closest?.(".notedraw-body-control")) {
    return false;
  }
  if (mutation.type === "attributes") {
    return Boolean(mutation.target?.matches?.(".workspace-leaf, .workspace-leaf-content, .workspace-tabs, .modal-container, .modal, .app-container, body"));
  }
  if (mutation.type !== "childList") {
    return false;
  }
  const selector = ".modal-container, .modal, .modal-bg, .workspace-leaf, .workspace-leaf-content";
  return [...Array.from(mutation.addedNodes || []), ...Array.from(mutation.removedNodes || [])].some((node) => (
    node?.nodeType === Node.ELEMENT_NODE && (node.matches?.(selector) || node.querySelector?.(selector))
  ));
}
function isWebviewRelatedNode(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  return node.matches?.(".mwv-embed, webview, iframe, .workspace-leaf-content[data-type*='webview'], .workspace-leaf-content[data-type*='web-view'], .workspace-leaf-content[data-type*='browser'], .workspace-leaf-content[data-type*='iframe']") || Boolean(node.querySelector?.(".mwv-embed, webview, iframe, .workspace-leaf-content[data-type*='webview'], .workspace-leaf-content[data-type*='web-view'], .workspace-leaf-content[data-type*='browser'], .workspace-leaf-content[data-type*='iframe']"));
}
function getVaultFileByPath(vault, path) {
  const normalized = normalizeVaultPath(path);
  if (!vault || !normalized) {
    return null;
  }
  const file = vault.getAbstractFileByPath(normalizePath(normalized));
  return file && typeof file.extension === "string" ? file : null;
}
function normalizeVaultPath(path) {
  return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}
function sanitizeAssetFileName(name) {
  const cleaned = String(name || "attachment.bin").replace(/\\/g, "/").split("/").pop().split("").map((character) => {
    const code = character.charCodeAt(0);
    if (character === "<" || character === ">" || character === ":" || character === '"' || character === "|" || character === "?" || character === "*" || code <= 31) {
      return "_";
    }
    return character;
  }).join("").replace(/\s+/g, " ").trim();
  return cleaned || "attachment.bin";
}
function normalizeStrokeKind(kind) {
  if (kind === TOOL_TEXT || kind === TOOL_EMBED) {
    return kind;
  }
  return void 0;
}
function normalizeTextRenderMode(mode) {
  if ([TEXT_RENDER_MARKDOWN, TEXT_RENDER_HTML, TEXT_RENDER_NOTE].includes(mode)) {
    return mode;
  }
  return TEXT_RENDER_PLAIN;
}
function normalizeEmbedType(type) {
  if ([EMBED_IMAGE, EMBED_VIDEO, EMBED_FILE].includes(type)) {
    return type;
  }
  return EMBED_FILE;
}
function isAssetTextPreset(preset) {
  return ["image", "video", "attachment"].includes(preset);
}
function filePickerAcceptForPreset(preset) {
  if (preset === "image") {
    return "image/*";
  }
  if (preset === "video") {
    return "video/*";
  }
  return "image/*,video/*,.pdf,.md,.markdown,.txt,.csv,.json,.html,.htm";
}
function classifyImportedAsset(asset) {
  const mime = String(asset?.mime || "").toLowerCase();
  const name = String(asset?.name || "").toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) {
    return EMBED_IMAGE;
  }
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/.test(name)) {
    return EMBED_VIDEO;
  }
  return EMBED_FILE;
}
function classifyImportedPreviewRender(asset) {
  const mime = String(asset?.mime || "").toLowerCase();
  const name = String(asset?.name || "").toLowerCase();
  if (mime === "text/markdown" || /\.(md|markdown)$/.test(name)) {
    return TEXT_RENDER_MARKDOWN;
  }
  if (mime === "text/html" || /\.(html|htm)$/.test(name)) {
    return TEXT_RENDER_HTML;
  }
  return null;
}
function isTextAssetMime(name, mime) {
  const lowerName = String(name || "").toLowerCase();
  const lowerMime = String(mime || "").toLowerCase();
  return lowerMime.startsWith("text/") || lowerMime === "application/json" || /\.(md|markdown|txt|csv|json|html|htm)$/.test(lowerName);
}
function guessMimeType(name) {
  const lower = String(name || "").toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(lower)) {
    return lower.endsWith(".svg") ? "image/svg+xml" : "image/*";
  }
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(lower)) {
    return "video/*";
  }
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return "text/markdown";
  }
  if (/\.(html|htm)$/.test(lower)) {
    return "text/html";
  }
  if (/\.(txt|csv)$/.test(lower)) {
    return "text/plain";
  }
  if (lower.endsWith(".json")) {
    return "application/json";
  }
  return "application/octet-stream";
}
function formatBytes(value) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "Attachment";
  }
  if (size < 1024) {
    return `${Math.round(size)} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function unwrapWikiLink(value) {
  const text = String(value || "").trim();
  const wiki = text.match(/^\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/);
  if (wiki) {
    return wiki[1].trim();
  }
  return text.replace(/^!?\[\[/, "").replace(/\]\]$/, "").trim();
}
function getEmbedRenderToken(stroke) {
  return [
    stroke.kind,
    stroke.embedType,
    normalizeTextRenderMode(stroke.render),
    stroke.text || "",
    stroke.assetPath || "",
    stroke.assetName || "",
    stroke.assetSize || 0,
    stroke.exportImageDataUrl ? String(stroke.exportImageDataUrl).length : 0
  ].join("|");
}
function sanitizeHTMLToDomSafe(content) {
  const parsed = new DOMParser().parseFromString(String(content || ""), "text/html");
  const fragment = activeDocument.createDocumentFragment();
  Array.from(parsed.body.childNodes).forEach((node) => {
    fragment.appendChild(activeDocument.importNode(node, true));
  });
  fragment.querySelectorAll("script, iframe, object, embed, link[rel='import']").forEach((node) => node.remove());
  fragment.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes || [])) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value || "";
      if (name.startsWith("on") || /^\s*javascript:/i.test(value)) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  return fragment;
}
function createEmptyDrawingData(file) {
  return {
    version: 3,
    sourcePath: file.path,
    strokes: [],
    webEdits: [],
    updatedAt: null
  };
}
function normalizeDrawingData(data, file) {
  const strokes = Array.isArray(data?.strokes) ? data.strokes : [];
  return {
    version: Math.max(1, Number.isFinite(data?.version) ? data.version : 1),
    sourcePath: file.path,
    strokes: strokes.map(normalizeStroke).map((stroke) => ({
      ...stroke,
      points: compactStrokePoints(stroke.points)
    })).filter((stroke) => stroke.points.length),
    webEdits: normalizeWebEdits(data?.webEdits),
    updatedAt: data?.updatedAt || null
  };
}
function normalizeDrawingDataForStorage(data, file) {
  const normalized = normalizeDrawingData(data, file);
  normalized.strokes = normalized.strokes.map((stroke) => {
    const layout = normalizeElementLayout(stroke.layout);
    if (!layout || elementLayoutNeedsRepair(layout) || !stroke.points.some((point) => point.anchor)) {
      return stroke;
    }
    return {
      ...stroke,
      points: projectElementPoints(stroke.points, layout, {
        id: layout.id,
        x: layout.box.x,
        y: layout.box.y,
        width: layout.box.width,
        height: layout.box.height,
        scale: 1
      }, {
        canvasWidth: layout.sourceFrame.surfaceWidth,
        canvasHeight: layout.sourceFrame.documentHeight
      })
    };
  });
  return normalized;
}
function normalizeWebEdits(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((edit) => ({
    kind: edit?.kind === "text" ? "text" : "",
    path: typeof edit?.path === "string" ? edit.path : "",
    originalText: typeof edit?.originalText === "string" ? edit.originalText : "",
    editedText: typeof edit?.editedText === "string" ? edit.editedText : "",
    updatedAt: typeof edit?.updatedAt === "string" ? edit.updatedAt : null
  })).filter((edit) => edit.kind === "text" && edit.path && normalizeRenderedText(edit.editedText));
}
function normalizeStroke(stroke) {
  const points = Array.isArray(stroke?.points) ? stroke.points : [];
  const kind = normalizeStrokeKind(stroke?.kind);
  return {
    kind,
    embedType: normalizeEmbedType(stroke?.embedType),
    brush: stroke?.brush === BRUSH_WATERCOLOR ? BRUSH_WATERCOLOR : BRUSH_PEN,
    color: typeof stroke?.color === "string" ? stroke.color : "#e53935",
    width: Number.isFinite(Number(stroke?.width)) ? clamp(Number(stroke.width), MIN_BRUSH_WIDTH, 80) : 3,
    opacity: clamp(Number(stroke?.opacity ?? DEFAULT_PEN_OPACITY), 0, 1),
    count: clamp(Math.round(Number(stroke?.count) || 1), 1, MAX_PEN_COUNT),
    text: typeof stroke?.text === "string" ? stroke.text : "",
    render: normalizeTextRenderMode(stroke?.render),
    assetPath: normalizeVaultPath(stroke?.assetPath || ""),
    assetName: typeof stroke?.assetName === "string" ? stroke.assetName : "",
    assetMime: typeof stroke?.assetMime === "string" ? stroke.assetMime : "",
    assetSize: Number.isFinite(Number(stroke?.assetSize)) ? Math.max(0, Number(stroke.assetSize)) : 0,
    exportImageDataUrl: normalizeImageDataUrl(stroke?.exportImageDataUrl),
    previewWidth: Number.isFinite(Number(stroke?.previewWidth)) ? clamp(Number(stroke.previewWidth), 80, 900) : 260,
    previewHeight: Number.isFinite(Number(stroke?.previewHeight)) ? clamp(Number(stroke.previewHeight), 40, 700) : 160,
    textWidth: Number.isFinite(Number(stroke?.textWidth)) && Number(stroke.textWidth) > 0 ? clamp(Number(stroke.textWidth), 24, 900) : null,
    fontSize: Number.isFinite(Number(stroke?.fontSize)) ? clamp(Number(stroke.fontSize), 10, 72) : 18,
    bold: Boolean(stroke?.bold),
    code: Boolean(stroke?.code),
    boxed: Boolean(stroke?.boxed),
    file: Boolean(stroke?.file),
    uiRole: normalizeUiRole(stroke?.uiRole),
    buttonStyle: normalizeButtonStyle(stroke?.buttonStyle),
    snap: Boolean(stroke?.snap),
    locked: Boolean(stroke?.locked),
    layout: normalizeElementLayout(stroke?.layout),
    points: points.map((point) => ({
      x: clamp(Number(point?.x), 0, 1),
      y: clamp(Number(point?.y), 0, 1),
      t: Number.isFinite(Number(point?.t)) ? Number(point.t) : Date.now(),
      anchor: normalizeResponsiveAnchor(point?.anchor)
    })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  };
}
function isTextStroke(stroke) {
  return stroke?.kind === TOOL_TEXT && normalizeTextRenderMode(stroke.render) === TEXT_RENDER_PLAIN && typeof stroke.text === "string" && stroke.text.trim().length > 0;
}
function isRichTextStroke(stroke) {
  return stroke?.kind === TOOL_TEXT && normalizeTextRenderMode(stroke.render) !== TEXT_RENDER_PLAIN && typeof stroke.text === "string" && stroke.text.trim().length > 0;
}
function isTextLikeStroke(stroke) {
  return (isTextStroke(stroke) || isRichTextStroke(stroke)) && typeof stroke.text === "string" && stroke.text.trim().length > 0;
}
function isEmbedStroke(stroke) {
  return stroke?.kind === TOOL_EMBED && Boolean(stroke.assetPath || stroke.text || stroke.assetName);
}
function isImageEmbedStroke(stroke) {
  return stroke?.kind === TOOL_EMBED && normalizeEmbedType(stroke.embedType) === EMBED_IMAGE && Boolean(stroke.assetPath || stroke.exportImageDataUrl);
}
function isButtonLikeStroke(stroke) {
  return stroke?.uiRole === "button" || Boolean(normalizeButtonStyle(stroke?.buttonStyle));
}
function isSnapStroke(stroke) {
  return Boolean(stroke?.snap) || stroke?.uiRole === "button" || stroke?.uiRole === "arrow";
}
function isSnapPreset(preset) {
  return ["button", "buttonPrimary", "buttonOutline", "buttonPill", "arrowUp", "arrowDown", "arrowLeft", "arrowRight"].includes(preset);
}
function instantTextForPreset(preset) {
  return {
    arrowUp: "\u2191",
    arrowDown: "\u2193",
    arrowLeft: "\u2190",
    arrowRight: "\u2192"
  }[preset] || "";
}
function normalizeUiRole(value) {
  return ["button", "arrow"].includes(value) ? value : "";
}
function normalizeButtonStyle(value) {
  return ["solid", "outline", "pill"].includes(value) ? value : "";
}
function createTextPreset(preset, text, color) {
  const normalized = String(text || "").trim();
  if (preset === "title") {
    return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_PLAIN, color, fontSize: 26, bold: true, code: false, boxed: false, file: false };
  }
  if (preset === "code") {
    return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_PLAIN, color: "#374151", fontSize: 16, bold: false, code: true, boxed: true, file: false };
  }
  if (preset === "button") {
    return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_PLAIN, color, fontSize: 17, bold: true, code: false, boxed: true, file: false, uiRole: "button", buttonStyle: "", snap: true };
  }
  if (preset === "buttonPrimary") {
    return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_PLAIN, color: "#2563eb", fontSize: 17, bold: true, code: false, boxed: true, file: false, uiRole: "button", buttonStyle: "solid", snap: true };
  }
  if (preset === "buttonOutline") {
    return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_PLAIN, color: "#2563eb", fontSize: 17, bold: true, code: false, boxed: true, file: false, uiRole: "button", buttonStyle: "outline", snap: true };
  }
  if (preset === "buttonPill") {
    return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_PLAIN, color: "#7c3aed", fontSize: 17, bold: true, code: false, boxed: true, file: false, uiRole: "button", buttonStyle: "pill", snap: true };
  }
  if (["arrowUp", "arrowDown", "arrowLeft", "arrowRight"].includes(preset)) {
    return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_PLAIN, color: "#111827", fontSize: 28, bold: true, code: false, boxed: false, file: false, uiRole: "arrow", buttonStyle: "", snap: true };
  }
  if (preset === "file") {
    return { kind: TOOL_TEXT, text: normalized.startsWith("@") ? normalized : `@${normalized}`, render: TEXT_RENDER_PLAIN, color, fontSize: 17, bold: false, code: false, boxed: true, file: true };
  }
  if (preset === "markdown") {
    return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_MARKDOWN, color: "#1f2937", fontSize: 16, bold: false, code: false, boxed: true, file: false, previewWidth: 300, previewHeight: 180 };
  }
  if (preset === "html") {
    return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_HTML, color: "#1f2937", fontSize: 16, bold: false, code: true, boxed: true, file: false, previewWidth: 300, previewHeight: 180 };
  }
  if (preset === "note") {
    return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_NOTE, color: "#1f2937", fontSize: 16, bold: false, code: false, boxed: true, file: true, previewWidth: 320, previewHeight: 220 };
  }
  return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_PLAIN, color, fontSize: 18, bold: false, code: false, boxed: false, file: false };
}
function compactDrawingData(data, compactDistance = DEFAULT_SETTINGS.drawingCompactDistance) {
  if (!Array.isArray(data?.strokes)) {
    return data;
  }
  data.strokes = data.strokes.map((stroke) => ({
    ...stroke,
    points: compactStrokePoints(stroke.points, compactDistance)
  }));
  return data;
}
function compactStrokePoints(points, compactDistance = DEFAULT_SETTINGS.drawingCompactDistance) {
  if (!Array.isArray(points) || points.length <= 2) {
    return points || [];
  }
  const compacted = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const last = compacted[compacted.length - 1];
    const distance = pointDistanceOnCanvas(last, point, 1, 1) * 1e3;
    if (distance >= compactDistance) {
      compacted.push(point);
    }
  }
  compacted.push(points[points.length - 1]);
  return compacted;
}
function getSourceInfo(element) {
  const lineStart = parseInteger(element.dataset.noteDrawLineStart);
  const lineEnd = parseInteger(element.dataset.noteDrawLineEnd);
  const dataLine = parseInteger(element.dataset.noteDrawDataLine) ?? parseDataLine(element.closest("[data-line]")?.getAttribute("data-line"));
  const dataLineScope = element.dataset.noteDrawDataLineScope || (Number.isFinite(parseDataLine(element.getAttribute("data-line"))) ? "self" : "ancestor");
  const exactDataLine = dataLineScope === "self" ? dataLine : null;
  const resolvedStart = exactDataLine ?? lineStart ?? null;
  const resolvedEnd = exactDataLine ?? lineEnd ?? resolvedStart;
  return {
    lineStart: resolvedStart,
    lineEnd: resolvedEnd,
    dataLine,
    dataLineScope,
    sourceText: typeof element._noteDrawSourceText === "string" ? element._noteDrawSourceText : null
  };
}
function resolveSourceEditTarget(source, sourceInfo, originalText) {
  const normalizedOriginal = normalizeRenderedText(originalText);
  if (!normalizedOriginal) {
    return null;
  }
  const blocks = collectMarkdownBlocks(source);
  const sourceLine = sourceInfo?.lineStart ?? (sourceInfo?.dataLineScope === "self" ? sourceInfo?.dataLine : null);
  let match = pickFromSectionText(source, sourceInfo, normalizedOriginal) || collectSourceLineBlock(source, sourceInfo, normalizedOriginal) || pickLineInSourceRange(source, sourceInfo, normalizedOriginal) || pickBlockInSourceRange(blocks, sourceInfo, normalizedOriginal) || pickBlockBySourceInfo(blocks, sourceInfo, normalizedOriginal);
  if (!match) {
    const candidates = blocks.filter((block) => normalizeMarkdownBlock(block.text) === normalizedOriginal);
    match = pickNearestBlock(candidates, sourceLine);
  }
  if (!match) {
    const partialCandidates = blocks.filter((block) => {
      const normalized = normalizeMarkdownBlock(block.text);
      return isReasonablePartialMatch(block, normalized, normalizedOriginal);
    });
    match = pickNearestBlock(partialCandidates, sourceLine);
  }
  if (!match) {
    match = pickNearestPlainLine(source, normalizedOriginal, sourceLine);
  }
  return match ? createTextEditTarget(match, sourceInfo, originalText) : null;
}
function resolveLockedTarget(source, target, baselineText) {
  if (!target) {
    return null;
  }
  const normalizedBaseline = normalizeRenderedText(baselineText);
  const start = Number(target.start);
  const end = Number(target.end);
  if (isValidSourceRange(source, start, end)) {
    const currentText = source.slice(start, end);
    const normalizedCurrent = normalizeMarkdownBlock(currentText);
    if (currentText === target.text || normalizedCurrent === normalizedBaseline || normalizedCurrent === target.normalizedText) {
      return {
        ...target,
        text: currentText
      };
    }
  }
  const exactIndex = findNearestTextIndex(source, target.text, target.start);
  if (exactIndex >= 0) {
    return {
      ...target,
      start: exactIndex,
      end: exactIndex + target.text.length,
      text: target.text
    };
  }
  return null;
}
function createTextEditTarget(match, sourceInfo, renderedText) {
  if (!match || !Number.isFinite(match.start) || !Number.isFinite(match.end)) {
    return null;
  }
  const text = String(match.text ?? "");
  return {
    start: match.start,
    end: match.end,
    line: Number.isFinite(match.line) ? match.line : null,
    endLine: Number.isFinite(match.endLine) ? match.endLine : match.line ?? null,
    text,
    normalizedText: normalizeRenderedText(renderedText),
    normalizedMarkdown: normalizeMarkdownBlock(text),
    sourceInfo: {
      lineStart: sourceInfo?.lineStart ?? null,
      lineEnd: sourceInfo?.lineEnd ?? null,
      dataLine: sourceInfo?.dataLine ?? null
    }
  };
}
function pickFromSectionText(source, sourceInfo, normalizedOriginal) {
  const sectionText = typeof sourceInfo?.sourceText === "string" ? sourceInfo.sourceText : "";
  if (!sectionText.trim()) {
    return null;
  }
  const section = locateSectionRange(source, sourceInfo, sectionText);
  if (!section) {
    return null;
  }
  const lineMatch = pickNearestPlainLine(section.text, normalizedOriginal, null);
  if (lineMatch) {
    return shiftMatch(lineMatch, section.start);
  }
  const blocks = collectMarkdownBlocks(section.text);
  let match = blocks.find((block) => normalizeMarkdownBlock(block.text) === normalizedOriginal);
  if (!match) {
    match = blocks.find((block) => {
      const normalized = normalizeMarkdownBlock(block.text);
      return isReasonablePartialMatch(block, normalized, normalizedOriginal);
    });
  }
  if (match) {
    return shiftMatch(match, section.start);
  }
  const normalizedSection = normalizeMarkdownBlock(section.text);
  const sectionLines = section.text.split(/\r?\n/).filter((line) => line.trim()).length;
  if (sectionLines <= 3 && isReasonableLineMatch(normalizedSection, normalizedOriginal)) {
    return {
      start: section.start,
      end: section.end,
      line: sourceInfo?.lineStart ?? null,
      endLine: sourceInfo?.lineEnd ?? sourceInfo?.lineStart ?? null,
      text: section.text
    };
  }
  return null;
}
function locateSectionRange(source, sourceInfo, sectionText) {
  const byLines = collectSourceLineRange(source, sourceInfo?.lineStart, sourceInfo?.lineEnd);
  if (byLines && (normalizeMarkdownBlock(byLines.text) === normalizeMarkdownBlock(sectionText) || normalizeMarkdownBlock(byLines.text).includes(normalizeMarkdownBlock(sectionText)) || normalizeMarkdownBlock(sectionText).includes(normalizeMarkdownBlock(byLines.text)))) {
    return byLines;
  }
  const preferredStart = getLineStartOffset(source, sourceInfo?.lineStart) ?? 0;
  const exactIndex = findNearestTextIndex(source, sectionText, preferredStart);
  if (exactIndex >= 0) {
    return {
      start: exactIndex,
      end: exactIndex + sectionText.length,
      line: sourceInfo?.lineStart ?? null,
      endLine: sourceInfo?.lineEnd ?? sourceInfo?.lineStart ?? null,
      text: source.slice(exactIndex, exactIndex + sectionText.length)
    };
  }
  return byLines;
}
function pickLineInSourceRange(source, sourceInfo, normalizedOriginal) {
  const lineStart = sourceInfo?.lineStart;
  const lineEnd = sourceInfo?.lineEnd ?? lineStart;
  if (!Number.isFinite(lineStart) || !Number.isFinite(lineEnd)) {
    return null;
  }
  const start = Math.max(0, Math.min(lineStart, lineEnd) - 1);
  const end = Math.max(lineStart, lineEnd) + 1;
  const candidates = collectLineMatches(source, normalizedOriginal).filter((match) => match.line >= start && match.line <= end);
  return pickNearestBlock(candidates, lineStart);
}
function pickNearestPlainLine(source, normalizedOriginal, sourceLine) {
  return pickNearestBlock(collectLineMatches(source, normalizedOriginal), sourceLine);
}
function collectLineMatches(source, normalizedOriginal) {
  const matches = [];
  const lines = source.split(/(\r?\n)/);
  let offset = 0;
  let inFence = false;
  for (let index = 0, currentLine = 0; index < lines.length; index += 2, currentLine += 1) {
    const line = lines[index] || "";
    const newline = lines[index + 1] || "";
    const trimmed = line.trim();
    const start = offset;
    const end = start + line.length;
    offset += line.length + newline.length;
    if (/^```|^~~~/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !trimmed) {
      continue;
    }
    const normalizedLine = normalizeMarkdownBlock(line);
    if (normalizedLine === normalizedOriginal || normalizedLine && normalizedOriginal && normalizedLine.includes(normalizedOriginal) || isReasonableLineMatch(normalizedLine, normalizedOriginal)) {
      matches.push({
        start,
        end,
        line: currentLine,
        endLine: currentLine,
        text: line
      });
    }
  }
  return matches;
}
function collectSourceLineRange(source, lineStart, lineEnd) {
  if (!Number.isFinite(lineStart)) {
    return null;
  }
  const startLine = Math.max(0, Math.min(lineStart, Number.isFinite(lineEnd) ? lineEnd : lineStart));
  const endLine = Math.max(startLine, Number.isFinite(lineEnd) ? Math.max(lineStart, lineEnd) : lineStart);
  const lines = source.split(/(\r?\n)/);
  let offset = 0;
  let start = null;
  let end = null;
  for (let index = 0, currentLine = 0; index < lines.length; index += 2, currentLine += 1) {
    const line = lines[index] || "";
    const newline = lines[index + 1] || "";
    const lineStartOffset = offset;
    const lineEndOffset = lineStartOffset + line.length;
    offset += line.length + newline.length;
    if (currentLine === startLine) {
      start = lineStartOffset;
    }
    if (currentLine === endLine) {
      end = lineEndOffset;
      break;
    }
  }
  if (!Number.isFinite(start)) {
    return null;
  }
  if (!Number.isFinite(end)) {
    end = source.length;
  }
  return {
    start,
    end,
    line: startLine,
    endLine,
    text: source.slice(start, end)
  };
}
function getLineStartOffset(source, wantedLine) {
  if (!Number.isFinite(wantedLine) || wantedLine < 0) {
    return null;
  }
  const lines = source.split(/(\r?\n)/);
  let offset = 0;
  for (let index = 0, currentLine = 0; index < lines.length; index += 2, currentLine += 1) {
    if (currentLine === wantedLine) {
      return offset;
    }
    offset += (lines[index] || "").length + (lines[index + 1] || "").length;
  }
  return null;
}
function shiftMatch(match, offset) {
  return {
    ...match,
    start: match.start + offset,
    end: match.end + offset
  };
}
function pickBlockInSourceRange(blocks, sourceInfo, normalizedOriginal) {
  const lineStart = sourceInfo?.lineStart;
  const lineEnd = sourceInfo?.lineEnd ?? lineStart;
  if (!Number.isFinite(lineStart) || !Number.isFinite(lineEnd)) {
    return null;
  }
  const start = Math.min(lineStart, lineEnd);
  const end = Math.max(lineStart, lineEnd);
  const candidates = blocks.filter((block) => block.line <= end && (block.endLine ?? block.line) >= start);
  const exact = candidates.find((block) => normalizeMarkdownBlock(block.text) === normalizedOriginal);
  if (exact) {
    return exact;
  }
  return candidates.find((block) => {
    const normalized = normalizeMarkdownBlock(block.text);
    return isReasonablePartialMatch(block, normalized, normalizedOriginal);
  }) || null;
}
function pickBlockBySourceInfo(blocks, sourceInfo, normalizedOriginal) {
  const lineStart = sourceInfo?.lineStart ?? (sourceInfo?.dataLineScope === "self" ? sourceInfo?.dataLine : null);
  if (!Number.isFinite(lineStart)) {
    return null;
  }
  const lineMatches = blocks.filter((block) => block.line <= lineStart && lineStart <= (block.endLine ?? block.line));
  const exact = lineMatches.find((block) => normalizeMarkdownBlock(block.text) === normalizedOriginal);
  if (exact) {
    return exact;
  }
  return lineMatches.find((block) => {
    const normalized = normalizeMarkdownBlock(block.text);
    return isReasonablePartialMatch(block, normalized, normalizedOriginal);
  }) || null;
}
function collectSourceLineBlock(source, sourceInfo, normalizedOriginal) {
  const primaryLine = sourceInfo?.dataLineScope === "self" ? sourceInfo?.dataLine : sourceInfo?.lineStart;
  if (!Number.isFinite(primaryLine)) {
    return null;
  }
  const candidateLines = [
    primaryLine,
    primaryLine - 1,
    primaryLine + 1
  ].filter((line, index, list) => Number.isFinite(line) && line >= 0 && list.indexOf(line) === index);
  const lines = source.split(/(\r?\n)/);
  let offset = 0;
  for (let index = 0, currentLine = 0; index < lines.length; index += 2, currentLine += 1) {
    const line = lines[index] || "";
    const newline = lines[index + 1] || "";
    const start = offset;
    const end = start + line.length;
    offset += line.length + newline.length;
    if (!candidateLines.includes(currentLine) || !line.trim()) {
      continue;
    }
    const normalizedLine = normalizeMarkdownBlock(line);
    if (normalizedLine === normalizedOriginal || normalizedLine && normalizedOriginal && normalizedLine.includes(normalizedOriginal) || isReasonableLineMatch(normalizedLine, normalizedOriginal)) {
      return {
        start,
        end,
        line: currentLine,
        endLine: currentLine,
        text: line
      };
    }
    return null;
  }
  return null;
}
function isReasonableLineMatch(normalizedLine, normalizedOriginal) {
  if (!normalizedLine || !normalizedOriginal) {
    return false;
  }
  if (normalizedLine.includes(normalizedOriginal) || normalizedOriginal.includes(normalizedLine)) {
    const longer = Math.max(normalizedLine.length, normalizedOriginal.length);
    const shorter = Math.min(normalizedLine.length, normalizedOriginal.length);
    return longer > 0 && shorter / longer > 0.75;
  }
  return false;
}
function isReasonablePartialMatch(block, normalized, normalizedOriginal) {
  if (!normalized || !normalizedOriginal) {
    return false;
  }
  const isPartial = normalized.includes(normalizedOriginal) || normalizedOriginal.includes(normalized);
  if (!isPartial) {
    return false;
  }
  const lineSpan = (block.endLine ?? block.line) - block.line;
  if (lineSpan <= 0) {
    return true;
  }
  const longer = Math.max(normalized.length, normalizedOriginal.length);
  const shorter = Math.min(normalized.length, normalizedOriginal.length);
  return longer > 0 && shorter / longer > 0.75;
}
function isValidSourceRange(source, start, end) {
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start && end <= source.length;
}
function findNearestTextIndex(source, text, preferredStart) {
  const needle = String(text || "");
  if (!needle) {
    return -1;
  }
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  let index = source.indexOf(needle);
  while (index >= 0) {
    const distance = Math.abs(index - (Number(preferredStart) || 0));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
    index = source.indexOf(needle, index + Math.max(1, needle.length));
  }
  return bestIndex;
}
function summarizeSourceInfo(sourceInfo) {
  if (!sourceInfo) {
    return null;
  }
  return {
    lineStart: sourceInfo.lineStart ?? null,
    lineEnd: sourceInfo.lineEnd ?? null,
    dataLine: sourceInfo.dataLine ?? null,
    dataLineScope: sourceInfo.dataLineScope ?? null,
    hasSourceText: typeof sourceInfo.sourceText === "string" && sourceInfo.sourceText.length > 0,
    sourceTextLength: typeof sourceInfo.sourceText === "string" ? sourceInfo.sourceText.length : 0,
    sourceTextSample: shortText(sourceInfo.sourceText)
  };
}
function summarizeTarget(target) {
  if (!target) {
    return null;
  }
  return {
    start: Number.isFinite(target.start) ? target.start : null,
    end: Number.isFinite(target.end) ? target.end : null,
    line: Number.isFinite(target.line) ? target.line : null,
    endLine: Number.isFinite(target.endLine) ? target.endLine : null,
    textLength: typeof target.text === "string" ? target.text.length : 0,
    textSample: shortText(target.text)
  };
}
function shortText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= 120) {
    return text;
  }
  return `${text.slice(0, 120)}...`;
}
function parseDataLine(value) {
  if (!value) {
    return null;
  }
  const matches = String(value).match(/\d+/g);
  if (!matches?.length) {
    return null;
  }
  return Number.parseInt(matches[0], 10);
}
function parseInteger(value) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}
function pointerDistance(a, b) {
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
}
function findResponsiveContentElement(previewEl, surfaceType) {
  if (!previewEl) {
    return null;
  }
  if (surfaceType === "source") {
    return previewEl.querySelector?.(".cm-content") || previewEl.querySelector?.(".cm-sizer") || previewEl;
  }
  return previewEl.querySelector?.(":scope > .markdown-preview-sizer") || previewEl.querySelector?.(".markdown-preview-sizer") || previewEl;
}
function measureResponsiveContentFrame(previewEl, surfaceType, surfaceWidth, canvas) {
  const content = findResponsiveContentElement(previewEl, surfaceType);
  const contentRect = content?.getBoundingClientRect?.();
  const surfaceRect = previewEl?.getBoundingClientRect?.() || canvas?.getBoundingClientRect?.();
  if (!contentRect || !surfaceRect || contentRect.width <= 1) {
    return constrainWideContentFrame({
      surfaceWidth,
      contentLeft: 0,
      contentWidth: surfaceWidth
    }, { isMobile: isMobileRuntime() });
  }
  return constrainWideContentFrame({
    surfaceWidth,
    contentLeft: contentRect.left - surfaceRect.left + (Number(previewEl?.scrollLeft) || 0),
    contentWidth: contentRect.width
  }, { isMobile: isMobileRuntime() });
}
function measureResponsiveViewportHeight(previewEl, scrollContainer) {
  const scrollRect = scrollContainer?.getBoundingClientRect?.();
  const candidates = [
    scrollContainer === previewEl ? previewEl?.clientHeight : scrollContainer?.clientHeight,
    scrollRect?.height,
    window.visualViewport?.height,
    window.innerHeight,
    previewEl?.clientHeight
  ];
  return Math.max(1, Number(candidates.find((value) => Number(value) > 1)) || 1);
}
function createElementLayoutId(index = -1) {
  return `el-${Date.now().toString(36)}-${Math.max(0, Number(index) || 0).toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
function needsElementLayoutMigration(strokes) {
  const ids = new Set();
  return (Array.isArray(strokes) ? strokes : []).some((stroke) => {
    const id = normalizeElementLayout(stroke?.layout)?.id;
    if (!id || ids.has(id)) {
      return true;
    }
    ids.add(id);
    return false;
  });
}
function isStableResponsiveCaptureFrame(surfaceWidth, frame) {
  const width = Number(surfaceWidth) || 0;
  const contentWidth = Number(frame?.width) || 0;
  const stableWideLane = width >= 900 && contentWidth >= 720;
  return width >= 180 && contentWidth >= 140 && (contentWidth / width >= 0.42 || stableWideLane);
}
function responsiveLayoutSignature(width, height, frame, surfaceType, viewportHeight) {
  return [
    surfaceType,
    Math.round(Number(width) || 0),
    Math.round(Number(height) || 0),
    Math.round(Number(frame?.left) || 0),
    Math.round(Number(frame?.width) || 0),
    Math.round(Number(viewportHeight) || 0)
  ].join(":");
}
function collectRenderedLineAnchors(root, canvas, canvasWindowTop) {
  if (!root || !canvas) {
    return [];
  }
  const canvasRect = canvas.getBoundingClientRect();
  const anchors = [];
  for (const element of root.querySelectorAll?.("[data-note-draw-line-start]") || []) {
    const start = parseInteger(element.dataset.noteDrawLineStart);
    const end = parseInteger(element.dataset.noteDrawLineEnd) ?? start;
    const path = normalizeVaultPath(element.dataset.noteDrawSourcePath || "");
    const rect = element.getBoundingClientRect?.();
    if (!Number.isFinite(start) || !Number.isFinite(end) || !path || !rect || rect.width <= 1 || rect.height <= 1) {
      continue;
    }
    anchors.push({
      path,
      start: Math.min(start, end),
      end: Math.max(start, end),
      left: rect.left - canvasRect.left,
      right: rect.right - canvasRect.left,
      top: rect.top - canvasRect.top + canvasWindowTop,
      bottom: rect.bottom - canvasRect.top + canvasWindowTop,
      height: rect.height,
      area: rect.width * rect.height,
      confidence: clamp(Number(element.dataset.noteDrawLineConfidence ?? 1), 0, 1)
    });
  }
  return anchors;
}
function collectVirtualMarkdownLineAnchors(view, root, canvas, canvasWindowTop, fallbackPath) {
  const renderer = view?.previewMode?.renderer;
  const sections = Array.isArray(renderer?.sections) ? renderer.sections : [];
  if (!root || !canvas || !sections.length || renderer?.previewEl !== root) {
    return [];
  }
  const canvasRect = canvas.getBoundingClientRect();
  const sizer = renderer.sizerEl || root.querySelector?.(":scope > .markdown-preview-sizer") || root.querySelector?.(".markdown-preview-sizer");
  const sizerRect = sizer?.getBoundingClientRect?.();
  const baseTop = sizerRect ? sizerRect.top - canvasRect.top + canvasWindowTop : 0;
  const frame = measureResponsiveContentFrame(root, "preview", Math.max(1, Number(root.scrollWidth) || root.clientWidth || 1), canvas);
  return buildVirtualMarkdownSectionAnchors(sections.map((section) => {
    const element = section?.el;
    const measured = Number(element?.offsetHeight) > 0 && Number.isFinite(Number(element?.offsetTop));
    return {
      startLine: section?.start?.line,
      endLine: section?.end?.line,
      height: Math.max(Number(section?.height) || 0, Number(element?.offsetHeight) || 0, 1),
      measuredTop: measured ? Number(element.offsetTop) : null,
      excluded: Boolean(element?.matches?.(".mod-ui, .mod-header, .mod-footer"))
    };
  }), {
    baseTop,
    left: frame.left,
    right: frame.left + frame.width,
    path: normalizeVaultPath(fallbackPath),
    confidence: 0.96
  });
}
function captureRenderedLineLocation(anchors, canvasX, canvasY, { maxDistance = 64 } = {}) {
  const horizontal = anchors.filter((anchor) => canvasX >= anchor.left - 28 && canvasX <= anchor.right + 28);
  const containing = horizontal.filter((anchor) => canvasY >= anchor.top && canvasY <= anchor.bottom);
  const candidates = containing.length ? containing : horizontal.map((anchor) => ({
    ...anchor,
    distance: canvasY < anchor.top ? anchor.top - canvasY : canvasY > anchor.bottom ? canvasY - anchor.bottom : 0
  })).filter((anchor) => anchor.distance <= maxDistance);
  const anchor = candidates.sort((a, b) => (a.distance || 0) - (b.distance || 0) || a.area - b.area)[0];
  if (!anchor) {
    return null;
  }
  const ratio = clamp((canvasY - anchor.top) / Math.max(1, anchor.height), 0, 0.999999);
  const distance = Number(anchor.distance || 0);
  const inside = canvasY >= anchor.top && canvasY <= anchor.bottom;
  return {
    path: anchor.path,
    line: anchor.start + ratio * Math.max(1, anchor.end - anchor.start + 1),
    lineConfidence: inside ? anchor.confidence : Math.min(anchor.confidence, clamp(1 - distance / Math.max(1, maxDistance), 0, 0.55))
  };
}
function projectRenderedLineLocation(anchors, path, line) {
  const normalizedPath = normalizeVaultPath(path);
  const lineNumber = Number(line);
  if (!normalizedPath || !Number.isFinite(lineNumber)) {
    return NaN;
  }
  const integerLine = Math.floor(lineNumber);
  const candidates = anchors.filter((anchor) => anchor.path === normalizedPath && integerLine >= anchor.start && integerLine <= anchor.end);
  const anchor = candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0) || (a.end - a.start) - (b.end - b.start) || a.area - b.area)[0];
  if (!anchor) {
    return NaN;
  }
  const ratio = clamp((lineNumber - anchor.start) / Math.max(1, anchor.end - anchor.start + 1), 0, 1);
  return anchor.top + ratio * anchor.height;
}
function captureCodeMirrorLineLocation(codeMirror, clientX, clientY, sourcePath) {
  try {
    const position = codeMirror.posAtCoords?.({ x: clientX, y: clientY }, false) ?? codeMirror.posAtCoords?.({ x: clientX, y: clientY });
    const doc = codeMirror.state?.doc;
    if (!Number.isFinite(position) || !doc?.lineAt) {
      return null;
    }
    const line = doc.lineAt(position);
    const startRect = codeMirror.coordsAtPos?.(line.from);
    const endRect = codeMirror.coordsAtPos?.(line.to);
    const top = Math.min(startRect?.top ?? clientY, endRect?.top ?? startRect?.top ?? clientY);
    const bottom = Math.max(startRect?.bottom ?? clientY + 1, endRect?.bottom ?? startRect?.bottom ?? clientY + 1);
    const ratio = clamp((clientY - top) / Math.max(1, bottom - top), 0, 0.999999);
    return {
      path: normalizeVaultPath(sourcePath),
      line: Math.max(0, line.number - 1) + ratio,
      lineConfidence: clientY >= top && clientY <= bottom ? 1 : 0.45
    };
  } catch (error) {
    void error;
    return null;
  }
}
function projectCodeMirrorLineLocation(codeMirror, linePosition) {
  try {
    const doc = codeMirror.state?.doc;
    const lineNumber = Number(linePosition);
    if (!doc?.line || !Number.isFinite(lineNumber)) {
      return NaN;
    }
    const wantedLine = Math.floor(lineNumber) + 1;
    if (wantedLine < 1 || wantedLine > (doc.lines || 1)) {
      return NaN;
    }
    const line = doc.line(wantedLine);
    const startRect = codeMirror.coordsAtPos?.(line.from);
    const endRect = codeMirror.coordsAtPos?.(line.to);
    if (!startRect && !endRect) {
      return NaN;
    }
    const top = Math.min(startRect?.top ?? endRect.top, endRect?.top ?? startRect.top);
    const bottom = Math.max(startRect?.bottom ?? endRect.bottom, endRect?.bottom ?? startRect.bottom);
    return top + clamp(lineNumber - Math.floor(lineNumber), 0, 1) * Math.max(1, bottom - top);
  } catch (error) {
    void error;
    return NaN;
  }
}
function findLayoutMeasureElement(previewEl) {
  return previewEl?.querySelector?.(".markdown-preview-sizer") || previewEl?.querySelector?.(".cm-sizer") || previewEl?.querySelector?.(".cm-content") || previewEl;
}
function measureCanvasExtent(previewEl, measureEl = null) {
  const previewRect = previewEl.getBoundingClientRect();
  const measureRect = measureEl?.getBoundingClientRect?.();
  const measureIsPreview = !measureEl || measureEl === previewEl;
  const scrollLeft = Math.max(0, Number(previewEl.scrollLeft) || 0);
  const scrollTop = Math.max(0, Number(previewEl.scrollTop) || 0);
  const relativeRight = measureRect ? measureRect.right - previewRect.left + scrollLeft : 0;
  const relativeBottom = measureRect ? measureRect.bottom - previewRect.top + scrollTop : 0;
  const width = Math.max(
    measureIsPreview ? previewEl.scrollWidth || 0 : 0,
    scrollLeft + (previewEl.clientWidth || 0),
    measureEl?.scrollWidth || 0,
    measureEl?.offsetWidth || 0,
    relativeRight,
    previewRect.width || 0,
    measureRect?.width || 0
  );
  const height = Math.max(
    measureIsPreview ? previewEl.scrollHeight || 0 : 0,
    scrollTop + (previewEl.clientHeight || 0),
    measureEl?.scrollHeight || 0,
    measureEl?.offsetHeight || 0,
    relativeBottom,
    measureIsPreview ? previewEl.offsetHeight || 0 : 0,
    previewRect.height || 0,
    measureRect?.height || 0
  );
  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
    visibleWidth: Math.max(1, previewRect.width || width)
  };
}
function measureVisibleSurfaceWindow(previewEl, scrollContainer, documentHeight) {
  const height = Math.max(1, Number(documentHeight) || 1);
  const previewRect = previewEl?.getBoundingClientRect?.();
  if (scrollContainer === previewEl) {
    const viewportHeight = Math.max(1, previewEl.clientHeight || previewRect?.height || window.innerHeight || 1);
    return {
      top: clamp(Number(previewEl.scrollTop) || 0, 0, Math.max(0, height - viewportHeight)),
      height: Math.min(height, viewportHeight)
    };
  }
  const viewportRect = scrollContainer?.getBoundingClientRect?.() || {
    top: 0,
    bottom: window.innerHeight || height,
    height: window.innerHeight || height
  };
  const surfaceTop = previewRect?.top || 0;
  const viewportTop = Math.max(0, viewportRect.top - surfaceTop);
  const viewportBottom = Math.min(height, (viewportRect.bottom || viewportRect.top + viewportRect.height) - surfaceTop);
  return {
    top: clamp(viewportTop, 0, Math.max(0, height - 1)),
    height: Math.max(1, viewportBottom - viewportTop || viewportRect.height || window.innerHeight || 1)
  };
}
function clearCanvasContext(context, canvas) {
  if (!context || !canvas) {
    return;
  }
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.restore();
}
function getScrollEventTarget(scroller) {
  if (!scroller) {
    return window;
  }
  return scroller === activeDocument.documentElement || scroller === activeDocument.body ? window : scroller;
}
function findScrollableAncestor(element) {
  let current = element;
  while (current && current !== activeDocument.body && current !== activeDocument.documentElement) {
    const style = window.getComputedStyle(current);
    const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY) && current.scrollHeight > current.clientHeight;
    const canScrollX = /(auto|scroll|overlay)/.test(style.overflowX) && current.scrollWidth > current.clientWidth;
    if (canScrollY || canScrollX) {
      return current;
    }
    current = current.parentElement;
  }
  return activeDocument.scrollingElement || activeDocument.documentElement;
}
function loadExportImage(src, timeoutMs) {
  if (!src) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const image = new Image();
    let timer = 0;
    const cleanup = () => {
      window.clearTimeout(timer);
      image.removeEventListener("load", done);
      image.removeEventListener("error", fail);
    };
    const done = () => {
      cleanup();
      resolve(image);
    };
    const fail = () => {
      cleanup();
      resolve(null);
    };
    image.decoding = "sync";
    image.loading = "eager";
    image.addEventListener("load", done, { once: true });
    image.addEventListener("error", fail, { once: true });
    timer = window.setTimeout(fail, timeoutMs);
    image.src = src;
    if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      done();
    }
  });
}
function arrayBufferToDataUrl(buffer, mime) {
  return `data:${mime || "image/png"};base64,${arrayBufferToBase64(buffer)}`;
}
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32768;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
function normalizeImageDataUrl(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(text) ? text : "";
}
function getImageStrokeCacheKey(stroke) {
  if (!isImageEmbedStroke(stroke)) {
    return "";
  }
  const dataLength = stroke.exportImageDataUrl ? String(stroke.exportImageDataUrl).length : 0;
  return [stroke.assetPath || "", stroke.assetName || "", stroke.assetSize || 0, dataLength].join("|");
}
function objectFitContain(sourceWidth, sourceHeight, boxWidth, boxHeight) {
  const scale = Math.min(boxWidth / Math.max(1, sourceWidth), boxHeight / Math.max(1, sourceHeight));
  const width = Math.max(1, sourceWidth * scale);
  const height = Math.max(1, sourceHeight * scale);
  return {
    x: (boxWidth - width) / 2,
    y: (boxHeight - height) / 2,
    width,
    height
  };
}
function waitForImage(image, timeoutMs) {
  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let timer = 0;
    const cleanup = () => {
      window.clearTimeout(timer);
      image.removeEventListener("load", done);
      image.removeEventListener("error", done);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    image.addEventListener("load", done, { once: true });
    image.addEventListener("error", done, { once: true });
    timer = window.setTimeout(done, timeoutMs);
  });
}
function pointDistanceOnCanvas(a, b, width, height) {
  return Math.hypot(
    ((a?.x || 0) - (b?.x || 0)) * Math.max(1, width || 1),
    ((a?.y || 0) - (b?.y || 0)) * Math.max(1, height || 1)
  );
}
function getTextStrokeLayout(stroke, width, measureText = null) {
  const point = stroke?.points?.[0] || { x: 0, y: 0 };
  const fontSize = clamp(Number(stroke?.fontSize || 18), 10, 72);
  const uiArrow = stroke?.uiRole === "arrow";
  const padded = !uiArrow && (stroke?.boxed || stroke?.code || stroke?.file || isButtonLikeStroke(stroke));
  const canvasX = clamp(Number(point.x || 0), 0, 1) * Math.max(1, Number(width) || 1);
  const maxWidth = Math.max(fontSize, Math.max(1, Number(width) || 1) - canvasX - Math.max(8, fontSize * 0.45) - 8);
  return computeTextLayout({
    text: String(stroke?.text || "").trim(),
    fontSize,
    textWidth: stroke?.textWidth,
    maxWidth,
    padded,
    measureText
  });
}
function getStrokeBounds(stroke, width, height) {
  if (!stroke?.points?.length) {
    return null;
  }
  if (isEmbedStroke(stroke) || isRichTextStroke(stroke)) {
    const point = stroke.points[0];
    const previewWidth = clamp(Number(stroke.previewWidth || 260), 80, 900);
    const previewHeight = clamp(Number(stroke.previewHeight || 160), 40, 700);
    const x = point.x * width;
    const y = point.y * height;
    return {
      minX: x,
      minY: y,
      maxX: x + previewWidth,
      maxY: y + previewHeight
    };
  }
  if (isTextStroke(stroke)) {
    const point = stroke.points[0];
    const layout = getTextStrokeLayout(stroke, width);
    const x = point.x * width;
    const y = point.y * height;
    return {
      minX: x - layout.paddingX,
      minY: y - layout.paddingY,
      maxX: x + layout.contentWidth + layout.paddingX,
      maxY: y + layout.contentHeight + layout.paddingY
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of stroke.points) {
    const x = point.x * width;
    const y = point.y * height;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    minX,
    minY,
    maxX,
    maxY
  };
}
function normalizeCanvasRect(a, b) {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y)
  };
}
function rectsIntersect(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}
function translateNormalizedBounds(bounds, dx, dy) {
  return {
    minX: bounds.minX + dx,
    minY: bounds.minY + dy,
    maxX: bounds.maxX + dx,
    maxY: bounds.maxY + dy
  };
}
function nearestSnapDelta(values, candidates, gridSize, threshold) {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const value of values) {
    if (!Number.isFinite(value)) {
      continue;
    }
    if (gridSize > 0) {
      const gridTarget = Math.round(value / gridSize) * gridSize;
      const gridDelta = gridTarget - value;
      const distance = Math.abs(gridDelta);
      if (distance <= threshold && distance < bestDistance) {
        best = gridDelta;
        bestDistance = distance;
      }
    }
    for (const candidate of candidates) {
      if (!Number.isFinite(candidate)) {
        continue;
      }
      const delta = candidate - value;
      const distance = Math.abs(delta);
      if (distance <= threshold && distance < bestDistance) {
        best = delta;
        bestDistance = distance;
      }
    }
  }
  return best;
}
function getSelectionHandlePointsFromRect(rect) {
  return [
    { handle: "nw", x: rect.x, y: rect.y },
    { handle: "ne", x: rect.x + rect.width, y: rect.y },
    { handle: "sw", x: rect.x, y: rect.y + rect.height },
    { handle: "se", x: rect.x + rect.width, y: rect.y + rect.height }
  ];
}
function getSelectionResizeAnchor(bounds, handle) {
  if (handle === "nw") {
    return { x: bounds.maxX, y: bounds.maxY };
  }
  if (handle === "ne") {
    return { x: bounds.minX, y: bounds.maxY };
  }
  if (handle === "sw") {
    return { x: bounds.maxX, y: bounds.minY };
  }
  return { x: bounds.minX, y: bounds.minY };
}
function getSelectionResizeCorner(bounds, handle) {
  if (handle === "nw") {
    return { x: bounds.minX, y: bounds.minY };
  }
  if (handle === "ne") {
    return { x: bounds.maxX, y: bounds.minY };
  }
  if (handle === "sw") {
    return { x: bounds.minX, y: bounds.maxY };
  }
  return { x: bounds.maxX, y: bounds.maxY };
}
function shiftNormalizedStrokesInsideCanvas(strokesByIndex) {
  let bounds = null;
  for (const stroke of strokesByIndex.values()) {
    for (const point of stroke.points) {
      bounds = bounds ? {
        minX: Math.min(bounds.minX, point.x),
        minY: Math.min(bounds.minY, point.y),
        maxX: Math.max(bounds.maxX, point.x),
        maxY: Math.max(bounds.maxY, point.y)
      } : {
        minX: point.x,
        minY: point.y,
        maxX: point.x,
        maxY: point.y
      };
    }
  }
  if (!bounds) {
    return;
  }
  let dx = 0;
  let dy = 0;
  if (bounds.minX < 0) {
    dx = -bounds.minX;
  } else if (bounds.maxX > 1) {
    dx = 1 - bounds.maxX;
  }
  if (bounds.minY < 0) {
    dy = -bounds.minY;
  } else if (bounds.maxY > 1) {
    dy = 1 - bounds.maxY;
  }
  if (dx === 0 && dy === 0) {
    return;
  }
  for (const stroke of strokesByIndex.values()) {
    stroke.points = stroke.points.map((point) => ({
      ...point,
      x: point.x + dx,
      y: point.y + dy
    }));
  }
}
function getPenOffsets(count, width) {
  if (count <= 1) {
    return [{ x: 0, y: 0 }];
  }
  const radius = Math.max(2, Number(width || 3) * 1.15);
  const offsets = [{ x: 0, y: 0 }];
  for (let index = 1; index < count; index += 1) {
    const angle = (index - 1) / Math.max(1, count - 1) * Math.PI * 2;
    offsets.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
  }
  return offsets;
}
function strokeHitTest(stroke, hitPoint, width, height, threshold) {
  const bounds = getStrokeBounds(stroke, width, height);
  const insideBounds = Boolean(bounds) && hitPoint.x >= bounds.minX - threshold && hitPoint.x <= bounds.maxX + threshold && hitPoint.y >= bounds.minY - threshold && hitPoint.y <= bounds.maxY + threshold;
  if (!insideBounds) {
    return false;
  }
  if (isEmbedStroke(stroke) || isRichTextStroke(stroke) || isTextStroke(stroke)) {
    return true;
  }
  if (stroke.points.length === 1) {
    return pointerDistance({
      x: stroke.points[0].x * width,
      y: stroke.points[0].y * height
    }, hitPoint) <= threshold;
  }
  let previous = {
    x: stroke.points[0].x * width,
    y: stroke.points[0].y * height
  };
  for (let index = 1; index < stroke.points.length; index += 1) {
    const current = {
      x: stroke.points[index].x * width,
      y: stroke.points[index].y * height
    };
    if (distanceToSegment(hitPoint, previous, current) <= threshold) {
      return true;
    }
    previous = current;
  }
  return false;
}
function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return pointerDistance(point, start);
  }
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy
  };
  return pointerDistance(point, projection);
}
function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function pickNearestBlock(candidates, sourceLine) {
  if (!candidates.length) {
    return null;
  }
  if (sourceLine === null || sourceLine === void 0) {
    return candidates[0];
  }
  return candidates.slice().sort((a, b) => Math.abs(a.line - sourceLine) - Math.abs(b.line - sourceLine))[0];
}
function formatReplacementBlock(originalBlock, editedText) {
  const original = String(originalBlock || "");
  const edited = normalizeEditableSourceText(editedText);
  const firstLine = original.split(/\r?\n/)[0] || "";
  const heading = firstLine.match(/^(#{1,6}\s+)/);
  if (heading) {
    return `${heading[1]}${edited}`;
  }
  const quote = firstLine.match(/^(\s{0,3}>\s?)/);
  if (quote) {
    return edited.split("\n").map((line) => `${quote[1]}${line}`).join("\n");
  }
  const task = firstLine.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)/);
  if (task) {
    const lines = edited.split("\n");
    return lines.map((line, index) => index === 0 ? `${task[1]}${line}` : line).join("\n");
  }
  const unordered = firstLine.match(/^(\s*[-*+]\s+)/);
  if (unordered) {
    const lines = edited.split("\n");
    return lines.map((line, index) => index === 0 ? `${unordered[1]}${line}` : line).join("\n");
  }
  const ordered = firstLine.match(/^(\s*\d+[.)]\s+)/);
  if (ordered) {
    const lines = edited.split("\n");
    return lines.map((line, index) => index === 0 ? `${ordered[1]}${line}` : line).join("\n");
  }
  return edited;
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return -- Re-enable dynamic interop lint rules after the plugin implementation. */
