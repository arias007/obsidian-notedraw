var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/notedraw-plugin.js
var require_notedraw_plugin = __commonJS({
  "src/notedraw-plugin.js"(exports2, module2) {
    "use strict";
    var {
      MarkdownRenderer,
      MarkdownView,
      Notice,
      Plugin,
      PluginSettingTab,
      Setting,
      normalizePath,
      setIcon
    } = require("obsidian");
    var PLUGIN_ID = "notedraw";
    var DRAWING_DIR = `${PLUGIN_ID}/drawings`;
    var ASSET_DIR = `${PLUGIN_ID}/assets`;
    var WEBVIEW_DRAWING_PREFIX = "webviews";
    var LEGACY_PLUGIN_ID = "note-doodle-preview";
    var LEGACY_DRAWING_DIR = `${LEGACY_PLUGIN_ID}/doodles`;
    var DEBUG_LOG_FILE = "debug-log.jsonl";
    var DEBUG_LOG_LIMIT = 150;
    var TEXT_SAVE_DELAY_MS = 160;
    var LONG_PRESS_MS = 550;
    var SELECT_TAP_DISTANCE = 6;
    var SELECT_STROKE_PADDING = 8;
    var SELECTED_STROKE_ALPHA = 0.38;
    var SELECT_RESIZE_HANDLE_SIZE = 10;
    var SELECT_RESIZE_HANDLE_HIT_RADIUS = 15;
    var DRAWING_INTERPOLATION_STEP_PX = 3;
    var DRAWING_MIN_POINT_DISTANCE_PX = 0.55;
    var DRAWING_COMPACT_DISTANCE_PX = 1.1;
    var MAX_PEN_COUNT = 5;
    var MIN_BRUSH_WIDTH = 0.5;
    var MAX_BRUSH_WIDTH = 32;
    var DEFAULT_PEN_OPACITY = 1;
    var TOOL_DRAW = "draw";
    var TOOL_SELECT = "select";
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
      "#fb8c00",
      "#fdd835",
      "#43a047",
      "#00acc1",
      "#1e88e5",
      "#5e35b1",
      "#8e24aa",
      "#ec407a",
      "#6d4c41",
      "#546e7a",
      "#111827",
      "#ffffff",
      "#9e9e9e"
    ];
    var SETTINGS_EXTRA_CODE_ASSETS = [
      { path: "extras/code-1.jpg", label: "\u7ED9\u6211\u4E70\u5496\u5561 / Buy me a coffee" },
      { path: "extras/code-2.png", label: "\u652F\u6301\u7EE7\u7EED\u7EF4\u62A4 / Support this tool" }
    ];
    var DEFAULT_SETTINGS = {
      defaultPenColor: "#e53935",
      defaultPenWidth: 3,
      defaultPenOpacity: DEFAULT_PEN_OPACITY,
      defaultWatercolorColor: "#3b82f6",
      defaultWatercolorWidth: 9,
      defaultWatercolorOpacity: 0.45,
      toolbarTopOffset: 6,
      enableDebugLog: false
    };
    var EDITABLE_SELECTOR = [
      ".markdown-preview-view h1",
      ".markdown-preview-view h2",
      ".markdown-preview-view h3",
      ".markdown-preview-view h4",
      ".markdown-preview-view h5",
      ".markdown-preview-view h6",
      ".markdown-preview-view p",
      ".markdown-preview-view li",
      ".markdown-preview-view blockquote",
      ".markdown-preview-view td",
      ".markdown-preview-view th",
      ".markdown-preview-view .callout-content"
    ].join(",");
    var BLOCKED_EDIT_SELECTOR = [
      ".notedraw-button",
      ".notedraw-toolbar",
      ".notedraw-palette-panel",
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
      ".internal-embed",
      ".external-embed",
      ".markdown-embed",
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
      ".notedraw-embed-layer",
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
    var NoteDrawPlugin2 = class extends Plugin {
      async onload() {
        this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() || {} };
        this.controllers = /* @__PURE__ */ new WeakMap();
        this.sourceControllers = /* @__PURE__ */ new Map();
        this.webviewControllers = /* @__PURE__ */ new Map();
        this.headerActions = /* @__PURE__ */ new Map();
        this.saveTimers = /* @__PURE__ */ new Map();
        this.textSaveStates = /* @__PURE__ */ new WeakMap();
        this.webviewSyncTimer = null;
        this.webviewMutationObserver = null;
        this.api = this.createPublicApi();
        if (typeof window !== "undefined") {
          window.NoteDraw = this.api;
        }
        cleanupAllDrawingHeaderButtons();
        this.addCommand({
          id: "toggle-notedraw",
          name: "Toggle preview edit and drawing mode",
          callback: () => this.toggleActiveController()
        });
        this.addSettingTab(new NoteDrawSettingTab(this.app, this));
        const syncSurfaces = () => {
          this.syncSourceControllers();
          this.syncWebviewControllers();
        };
        this.registerEvent(this.app.workspace.on("layout-change", syncSurfaces));
        this.registerEvent(this.app.workspace.on("active-leaf-change", syncSurfaces));
        this.registerEvent(this.app.workspace.on("file-open", syncSurfaces));
        this.installWebviewObserver();
        window.setTimeout(syncSurfaces, 0);
        this.registerMarkdownPostProcessor((el, ctx) => {
          const preview = el.closest(".markdown-preview-view");
          if (!preview || isEmbeddedPreview(preview)) {
            return;
          }
          const view = findOwningMarkdownView(this.app, preview, ctx.sourcePath);
          if (!view || !view.file || !ctx.sourcePath || view.file.path !== ctx.sourcePath) {
            return;
          }
          annotateEditableElements(el, ctx);
          const existingController = this.controllers.get(preview) || preview._noteDrawController;
          if (existingController?.plugin === this) {
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
          this.register(() => controller.destroy());
          window.setTimeout(() => this.syncWebviewControllers(), 0);
        });
      }
      onunload() {
        for (const controller of this.sourceControllers.values()) {
          controller.destroy();
        }
        this.sourceControllers.clear();
        for (const controller of this.webviewControllers.values()) {
          controller.destroy();
        }
        this.webviewControllers.clear();
        for (const state of this.headerActions.values()) {
          state.button?.remove();
        }
        this.headerActions.clear();
        cleanupAllDrawingHeaderButtons();
        for (const timer of this.saveTimers.values()) {
          clearTimeout(timer);
        }
        this.saveTimers.clear();
        if (this.webviewSyncTimer !== null) {
          window.clearTimeout(this.webviewSyncTimer);
          this.webviewSyncTimer = null;
        }
        this.webviewMutationObserver?.disconnect();
        this.webviewMutationObserver = null;
        if (typeof window !== "undefined" && window.NoteDraw === this.api) {
          delete window.NoteDraw;
        }
      }
      async saveSettings() {
        this.settings = sanitizeSettings(this.settings);
        await this.saveData(this.settings);
        for (const controller of this.getAllControllers()) {
          controller.applySettings();
        }
      }
      getAllControllers() {
        const controllers = [];
        for (const controller of this.sourceControllers.values()) {
          controllers.push(controller);
        }
        for (const controller of this.webviewControllers.values()) {
          controllers.push(controller);
        }
        document.querySelectorAll(".notedraw-shell").forEach((element) => {
          const controller = element._noteDrawController;
          if (controller?.plugin === this && !controllers.includes(controller)) {
            controllers.push(controller);
          }
        });
        return controllers;
      }
      installWebviewObserver() {
        if (typeof MutationObserver === "undefined" || !document?.body) {
          return;
        }
        this.webviewMutationObserver = new MutationObserver((mutations) => {
          if (mutations.some((mutation) => isWebviewSyncMutation(mutation))) {
            this.scheduleWebviewSync();
          }
        });
        this.webviewMutationObserver.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["data-url", "src", "class"]
        });
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
        return {
          version: "3.1.5",
          getActiveController: () => this.getActiveController(),
          readDrawings: async (file) => this.readDrawings(file),
          writeDrawings: async (file, data) => this.writeDrawings(file, normalizeDrawingData(data, file)),
          getStoragePaths: (file) => ({
            current: this.drawingPathForFile(file),
            legacy: this.legacyDrawingPathForFile(file)
          }),
          injectExportSnapshot: async (file, container) => this.injectExportSnapshot(file, container),
          replaceSelectionText: async (file, originalText, editedText) => {
            if (!file) {
              return { changed: false, reason: "missing-file" };
            }
            const sourceInfo = null;
            const source = await this.app.vault.read(file);
            const target = resolveSourceEditTarget(source, sourceInfo, originalText);
            if (!target) {
              return { changed: false, reason: "target-not-found" };
            }
            return this.saveTextBlock(file, originalText, editedText, sourceInfo, target);
          },
          insertStroke: async (file, stroke) => {
            const data = await this.readDrawings(file);
            const normalized = normalizeStroke(stroke);
            if (!normalized.points.length) {
              return data;
            }
            data.strokes.push(normalized);
            await this.writeDrawings(file, data);
            return data;
          }
        };
      }
      getActiveController() {
        const activeLeaf = this.app.workspace.activeLeaf;
        const activeView = activeLeaf?.view;
        const activeContainer = activeView?.containerEl;
        if (activeView instanceof MarkdownView) {
          const surface2 = isSourceMode(activeView) ? findSourceSurfaceForView(activeView) || findRootPreviewForView(activeView) : findRootPreviewForView(activeView) || findSourceSurfaceForView(activeView);
          const controller = surface2 ? this.controllers.get(surface2) || surface2._noteDrawController : null;
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
        const surface = view ? isSourceMode(view) ? findSourceSurfaceForView(view) || findRootPreviewForView(view) : findRootPreviewForView(view) || findSourceSurfaceForView(view) : null;
        return surface ? this.controllers.get(surface) || surface._noteDrawController : null;
      }
      toggleActiveController() {
        const controller = this.getActiveController();
        if (!controller) {
          new Notice("Open a note or webview first.");
          return;
        }
        controller.toggle().catch((error) => {
          console.error(`[${PLUGIN_ID}] Failed to toggle NoteDraw`, error);
        });
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
          const shouldMount = Boolean(sourceEl) && isSourceMode(view);
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
          this.register(() => controller.destroy());
        }
        for (const [view, controller] of Array.from(this.sourceControllers.entries())) {
          if (!activeViews.has(view) && !controller.previewEl?.isConnected) {
            controller.destroy();
            this.sourceControllers.delete(view);
          }
        }
      }
      syncWebviewControllers() {
        const surfaces = findWebviewSurfaces(document);
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
          this.register(() => controller.destroy());
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
          state.clickHandler = (event) => this.resolveHeaderController(view, state)?.onButtonClick(event);
          state.pointerDownHandler = (event) => this.resolveHeaderController(view, state)?.onButtonPointerDown(event);
          state.pointerUpHandler = (event) => this.resolveHeaderController(view, state)?.onButtonPointerUp(event);
          let button = null;
          if (typeof view?.addAction === "function") {
            button = view.addAction("wand-sparkles", "Edit text / draw", state.clickHandler);
          }
          if (!button) {
            const actions = view?.containerEl?.querySelector(".view-actions");
            button = document.createElement("div");
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
          state.button = button;
          this.headerActions.set(view, state);
        }
        state.controllers ?? (state.controllers = /* @__PURE__ */ new Set());
        state.controllers.add(controller);
        state.controller = this.pickHeaderController(view, state, controller);
        state.button._noteDrawController = state.controller || controller;
        state.button.classList.add("notedraw-header-button");
        state.button.classList.toggle("notedraw-webview-button", state.button._noteDrawController?.surfaceType === "webview");
        state.button.setAttribute("aria-label", "Edit text / draw");
        state.button.setAttribute("title", "Edit text / draw");
        state.button.classList.toggle("is-active", Boolean(state.button._noteDrawController?.active));
        this.cleanupHeaderButtons(view, state.button);
        return state.button;
      }
      installSurfaceButton(controller) {
        const actions = findWebviewButtonHost(controller.previewEl, controller.view);
        const inline = actions && !actions.classList?.contains("view-actions");
        const button = document.createElement(inline ? "button" : "div");
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
        button.setAttribute("aria-label", "Edit webview / draw");
        button.setAttribute("title", "Edit webview / draw");
        button.addEventListener("click", (event) => controller.onButtonClick(event));
        button.addEventListener("pointerdown", () => controller.onButtonPointerDown());
        button.addEventListener("pointerup", () => controller.onButtonPointerUp());
        button.addEventListener("pointercancel", () => controller.onButtonPointerUp());
        button.addEventListener("pointerleave", () => controller.onButtonPointerUp());
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
        state.button?._noteDrawController && delete state.button._noteDrawController;
        state.button?.classList.remove("is-active");
        if (!controller.view?.containerEl?.isConnected) {
          state.button?.remove();
          this.headerActions.delete(controller.view);
          this.cleanupHeaderButtons(controller.view);
        }
      }
      resolveHeaderController(view, state) {
        const controller = this.pickHeaderController(view, state);
        if (controller) {
          state.controller = controller;
          state.button._noteDrawController = controller;
          state.button.classList.toggle("is-active", controller.active);
          state.button.classList.toggle("notedraw-webview-button", controller.surfaceType === "webview");
        }
        return controller;
      }
      pickHeaderController(view, state, preferred = null) {
        const controllers = Array.from(state.controllers || []).filter((controller) => controller?.previewEl?.isConnected && controller.view === view && controller.surfaceType !== "webview");
        const currentMode = isSourceMode(view) ? "source" : "preview";
        const preferredLive = preferred && controllers.includes(preferred) ? preferred : null;
        return controllers.find((controller) => controller.surfaceType === currentMode) || preferredLive || controllers.find((controller) => controller.active) || controllers[0] || null;
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
        const imageDataUrl = isImageAssetMime(originalName, mime) ? arrayBufferToDataUrl(buffer, mime) : "";
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
        } catch (_) {
          return "";
        }
      }
      async appendDebugLog(entry) {
        if (!this.settings?.enableDebugLog) {
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
        try {
          if (await adapter.exists(path)) {
            return normalizeDrawingData(JSON.parse(await adapter.read(path)), file);
          }
          if (await adapter.exists(legacyPath)) {
            const migrated = normalizeDrawingData(JSON.parse(await adapter.read(legacyPath)), file);
            await this.writeDrawings(file, migrated);
            return migrated;
          }
          return createEmptyDrawingData(file);
        } catch (error) {
          console.error(`[${PLUGIN_ID}] Failed to read drawing file`, error);
          return createEmptyDrawingData(file);
        }
      }
      scheduleDrawingSave(file, data) {
        const path = this.drawingPathForFile(file);
        const previous = this.saveTimers.get(path);
        if (previous) {
          clearTimeout(previous);
        }
        const timer = setTimeout(() => {
          this.saveTimers.delete(path);
          compactDrawingData(data);
          this.writeDrawings(file, data).catch((error) => {
            console.error(`[${PLUGIN_ID}] Failed to save drawing file`, error);
            new Notice("Failed to save drawing data.");
          });
        }, 500);
        this.saveTimers.set(path, timer);
      }
      async writeDrawings(file, data) {
        await this.ensureDrawingDir();
        const path = this.drawingPathForFile(file);
        const body = JSON.stringify({
          ...data,
          sourcePath: file.path,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }, null, 2);
        await this.app.vault.adapter.write(path, body);
      }
      async injectExportSnapshot(file, container) {
        if (!file || !(container instanceof HTMLElement)) {
          return null;
        }
        const liveLayer = container.querySelector(".notedraw-embed-layer");
        if (liveLayer instanceof HTMLElement) {
          const liveDrawingData = container._noteDrawController?.drawingData || null;
          await this.injectExportImageCanvasLayer(file, container, liveDrawingData);
          await prepareExportImages(liveLayer);
          await this.replaceExportVideos(liveLayer);
          return liveLayer;
        }
        container.querySelectorAll(".notedraw-export-snapshot-layer").forEach((element) => element.remove());
        const drawingData = await this.readDrawings(file);
        const strokes = Array.isArray(drawingData?.strokes) ? drawingData.strokes : [];
        const exportable = strokes.filter((stroke) => isEmbedStroke(stroke) || isRichTextStroke(stroke));
        if (!exportable.length) {
          return null;
        }
        const rect = container.getBoundingClientRect();
        const width = Math.max(1, Math.ceil(container.scrollWidth || rect.width || 1));
        const height = Math.max(1, Math.ceil(container.scrollHeight || rect.height || 1));
        if (getComputedStyle(container).position === "static") {
          applyElementStyles(container, { position: "relative" });
        }
        const layer = container.createDiv({ cls: "notedraw-export-snapshot-layer" });
        applyElementStyles(layer, {
          width: `${width}px`,
          height: `${height}px`
        });
        const renderer = new NoteDrawExportSnapshotRenderer(this, file, layer, width, height);
        await renderer.render(exportable);
        if (!layer.children.length) {
          layer.remove();
          return null;
        }
        await prepareExportImages(layer);
        await this.replaceExportVideos(layer);
        return layer;
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
        const scale = Math.min(2, Math.max(1, Number(window.devicePixelRatio || 1)));
        const canvas = document.createElement("canvas");
        canvas.className = "notedraw-export-image-canvas-layer";
        canvas.width = Math.ceil(width * scale);
        canvas.height = Math.ceil(height * scale);
        applyElementStyles(canvas, {
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
        const context = canvas.getContext("2d");
        if (!context) {
          return null;
        }
        context.scale(scale, scale);
        container.appendChild(canvas);
        let drewImage = false;
        for (const stroke of imageStrokes) {
          drewImage = await this.drawExportImageStrokeOn(context, stroke, width, height) || drewImage;
        }
        if (!drewImage) {
          canvas.remove();
          return null;
        }
        window.setTimeout(() => {
          canvas.remove();
        }, 3e4);
        return canvas;
      }
      async drawExportImageStrokeOn(context, stroke, width, height) {
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
        context.save();
        context.globalAlpha = clamp(Number(stroke.opacity ?? 1), 0, 1);
        context.fillStyle = "#fff";
        context.fillRect(x, y, boxWidth, boxHeight);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, x + fit.x, y + fit.y, fit.width, fit.height);
        context.restore();
        return true;
      }
      async replaceExportVideos(root) {
        const videos = Array.from(root.querySelectorAll("video"));
        let replaced = false;
        for (const video of videos) {
          const snapshot = await this.createVideoSnapshot(video).catch((error) => {
            console.warn(`[${PLUGIN_ID}] Failed to capture export video frame`, error);
            return null;
          });
          if (snapshot) {
            video.replaceWith(snapshot);
            replaced = true;
          }
        }
        return replaced;
      }
      async createVideoSnapshot(video) {
        if (!(video instanceof HTMLVideoElement)) {
          return null;
        }
        await waitForMedia(video, 1400).catch(() => null);
        const rect = video.getBoundingClientRect();
        const width = Math.max(1, Math.ceil(video.videoWidth || rect.width || video.clientWidth || 320));
        const height = Math.max(1, Math.ceil(video.videoHeight || rect.height || video.clientHeight || 180));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        applyElementStyles(canvas, {
          display: "block",
          width: "100%",
          height: "100%",
          background: "#000"
        });
        const context = canvas.getContext("2d");
        if (!context) {
          return this.createVideoFallbackCard(video);
        }
        try {
          context.drawImage(video, 0, 0, width, height);
          return canvas;
        } catch (_) {
          return this.createVideoFallbackCard(video);
        }
      }
      createVideoFallbackCard(video) {
        const card = document.createElement("div");
        card.className = "notedraw-file-card notedraw-video-fallback";
        const iconEl = document.createElement("span");
        iconEl.className = "notedraw-file-icon";
        setIcon(iconEl, "file-video");
        card.appendChild(iconEl);
        const body = document.createElement("div");
        body.className = "notedraw-file-body";
        const nameEl = document.createElement("div");
        nameEl.className = "notedraw-file-name";
        nameEl.textContent = video.getAttribute("data-filename") || video.getAttribute("title") || "Video";
        body.appendChild(nameEl);
        card.appendChild(body);
        return card;
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
        if (normalizeRenderedText(baselineText) === normalizeRenderedText(latestText)) {
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
        if (state.pending || normalizeRenderedText(state.baselineText) !== normalizeRenderedText(state.latestText)) {
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
        const normalizedEdited = normalizeRenderedText(editedText);
        if (!normalizedOriginal || normalizedOriginal === normalizedEdited) {
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
        this.active = false;
        this.drawingData = {
          version: 1,
          sourcePath: file.path,
          strokes: [],
          updatedAt: null
        };
        this.currentStroke = null;
        this.currentEditor = null;
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
        this.didMove = false;
        this.redoStack = [];
        this.selectedStrokeIndex = -1;
        this.selectedStrokeIndexes = /* @__PURE__ */ new Set();
        this.drawingsVisible = true;
        this.buttonLongPressed = false;
        this.buttonLongPressTimer = null;
        this.paletteOpen = false;
        this.textPanelOpen = false;
        this.textPreset = "plain";
        this.pendingEmbedTool = null;
        this.lastTextTap = null;
        this.embedLayer = null;
        this.embedNodes = /* @__PURE__ */ new Map();
        this.embedRenderTokens = /* @__PURE__ */ new Map();
        this.canvasImageCache = /* @__PURE__ */ new Map();
        this.hiddenFileInput = null;
        this.canvasCssWidth = 1;
        this.canvasCssHeight = 1;
        this.renderFrameId = null;
        this.resizeFrameId = null;
        this.positionFrameId = null;
        this.staticCanvas = document.createElement("canvas");
        this.staticCtx = null;
        this.staticCacheDirty = true;
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
      }
      async mount() {
        cleanupDrawingUi(this.previewEl);
        this.previewEl._noteDrawController = this;
        this.previewEl.addClass("notedraw-shell");
        this.previewEl.toggleClass("is-notedraw-source-shell", this.surfaceType === "source");
        this.previewEl.toggleClass("is-notedraw-webview-shell", this.surfaceType === "webview");
        this.button = this.createHeaderButton();
        this.toolbar = this.previewEl.createDiv({ cls: "notedraw-toolbar" });
        this.selectButton = this.toolbar.createEl("button", {
          attr: { type: "button", title: "Select drawings" }
        });
        setIcon(this.selectButton, "mouse-pointer-2");
        this.selectButton.addEventListener("click", () => this.toggleSelectMode());
        this.penButton = this.toolbar.createEl("button", {
          attr: { type: "button", title: "Pen" }
        });
        setIcon(this.penButton, "pen-line");
        this.penButton.addEventListener("click", () => this.setBrushMode(BRUSH_PEN));
        this.watercolorButton = this.toolbar.createEl("button", {
          attr: { type: "button", title: "Watercolor brush" }
        });
        setIcon(this.watercolorButton, "paintbrush");
        this.watercolorButton.addEventListener("click", () => this.setBrushMode(BRUSH_WATERCOLOR));
        if (this.surfaceType !== "source") {
          this.textButton = this.toolbar.createEl("button", {
            attr: { type: "button", title: "Floating text" }
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
        }
        this.undoButton = this.toolbar.createEl("button", {
          attr: { type: "button", title: "Undo last drawing" }
        });
        setIcon(this.undoButton, "undo-2");
        this.undoButton.addEventListener("click", () => this.undoLastStroke());
        this.redoButton = this.toolbar.createEl("button", {
          attr: { type: "button", title: "Redo drawing" }
        });
        setIcon(this.redoButton, "redo-2");
        this.redoButton.addEventListener("click", () => this.redoLastStroke());
        this.deleteButton = this.toolbar.createEl("button", {
          attr: { type: "button", title: "Delete selected drawing" }
        });
        setIcon(this.deleteButton, "trash-2");
        this.deleteButton.addEventListener("click", () => this.deleteSelectedStroke());
        this.paletteButton = this.toolbar.createEl("button", {
          attr: { type: "button", title: "Pen settings" }
        });
        setIcon(this.paletteButton, "palette");
        this.paletteButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (this.toolMode === TOOL_SELECT) {
            this.setPaletteOpen(false);
            return;
          }
          this.togglePalettePanel();
        });
        this.palettePanel = this.previewEl.createDiv({ cls: "notedraw-palette-panel" });
        this.createColorPalette();
        if (this.surfaceType !== "source") {
          this.textPanel = this.previewEl.createDiv({ cls: "notedraw-text-panel" });
          this.createTextPanel();
        }
        this.colorInput = this.palettePanel.createEl("input", {
          cls: "notedraw-advanced-color",
          attr: {
            type: "color",
            value: this.penColor,
            title: "Advanced color",
            "aria-label": "Advanced color"
          }
        });
        this.colorInput.addEventListener("input", () => {
          this.currentBrushSettings().color = this.colorInput.value;
          this.syncCurrentBrushFields();
          this.syncColorSwatches();
          this.updateToolButtons();
        });
        this.hiddenFileInput = this.previewEl.createEl("input", {
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
            new Notice("Failed to import file.");
          });
        });
        this.widthInput = this.createPaletteInput("circle", "width", {
          type: "range",
          value: String(this.penWidth),
          min: String(MIN_BRUSH_WIDTH),
          max: String(MAX_BRUSH_WIDTH),
          step: "0.5",
          title: "Pen width"
        });
        this.widthInput.addEventListener("input", () => {
          this.currentBrushSettings().width = clamp(Number(this.widthInput.value), MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH);
          this.syncCurrentBrushFields();
          this.updateToolButtons();
        });
        this.opacityInput = this.createPaletteInput("droplets", "opacity", {
          type: "range",
          value: String(this.penOpacity),
          min: "0",
          max: "1",
          step: "0.02",
          title: "Pen opacity"
        });
        this.opacityInput.addEventListener("input", () => {
          this.currentBrushSettings().opacity = clamp(Number(this.opacityInput.value), 0, 1);
          this.syncCurrentBrushFields();
          this.updateToolButtons();
        });
        this.embedLayer = this.previewEl.createDiv({ cls: "notedraw-embed-layer" });
        this.canvas = this.previewEl.createEl("canvas", { cls: "notedraw-canvas" });
        this.canvas.addEventListener("pointerdown", this.onPointerDown);
        this.canvas.addEventListener("pointermove", this.onPointerMove);
        this.canvas.addEventListener("pointerup", this.onPointerUp);
        this.canvas.addEventListener("pointercancel", this.onPointerUp);
        this.canvas.addEventListener("lostpointercapture", this.onPointerUp);
        this.canvas.addEventListener("dblclick", this.onCanvasDoubleClick);
        this.canvas.addEventListener("wheel", this.onWheel, { passive: true });
        window.addEventListener("resize", this.onResize);
        document.addEventListener("pointerdown", this.onDocumentPointerDown, true);
        if (typeof ResizeObserver !== "undefined") {
          this.resizeObserver = new ResizeObserver(this.onResize);
          this.resizeObserver.observe(this.previewEl);
          this.layoutMeasureEl = findLayoutMeasureElement(this.previewEl);
          if (this.layoutMeasureEl && this.layoutMeasureEl !== this.previewEl) {
            this.resizeObserver.observe(this.layoutMeasureEl);
          }
        }
        this.scrollEventTarget = getScrollEventTarget(findScrollableAncestor(this.previewEl));
        this.scrollEventTarget?.addEventListener("scroll", this.onScroll, { passive: true });
        this.updateToolButtons();
        this.syncPaletteInputs();
      }
      applySettings() {
        const settings = sanitizeSettings(this.plugin?.settings || {});
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
      createPaletteInput(icon, cls, attr) {
        const row = this.palettePanel.createDiv({ cls: "notedraw-palette-row" });
        const iconEl = row.createSpan({ cls: "notedraw-palette-icon" });
        setIcon(iconEl, icon);
        return row.createEl("input", {
          cls: `notedraw-${cls}`,
          attr
        });
      }
      createHeaderButton() {
        return this.plugin.installHeaderButton(this);
      }
      async setFile(file) {
        if (!file || this.file?.path === file.path) {
          return;
        }
        this.endTextEdit();
        this.file = file;
        this.currentStroke = null;
        this.pointerDown = false;
        this.pointerStartEditable = null;
        this.activePointerId = null;
        this.touchPointers.clear();
        this.multiTouchScrolling = false;
        this.multiTouchLastCenter = null;
        this.suppressTouchDrawing = false;
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
        this.redoStack = [];
        this.selectedStrokeIndex = -1;
        this.selectedStrokeIndexes.clear();
        this.embedNodes.forEach((node) => node.remove());
        this.embedNodes.clear();
        this.embedRenderTokens.clear();
        this.canvasImageCache.clear();
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
      destroy() {
        this.endTextEdit();
        this.endFloatingTextInput(false);
        this.clearButtonLongPress();
        this.cancelRenderFrame();
        this.cancelResizeFrame();
        this.cancelPositionFrame();
        this.resizeObserver?.disconnect();
        this.scrollEventTarget?.removeEventListener("scroll", this.onScroll);
        this.scrollEventTarget = null;
        this.layoutMeasureEl = null;
        window.removeEventListener("resize", this.onResize);
        document.removeEventListener("pointerdown", this.onDocumentPointerDown, true);
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
        this.hiddenFileInput?.remove();
        this.embedLayer?.remove();
        this.embedNodes.clear();
        this.embedRenderTokens.clear();
        this.canvas?.remove();
        this.previewEl.removeClass("notedraw-shell");
        this.previewEl.removeClass("is-drawing-active");
        this.previewEl.removeClass("is-drawing-hidden");
        this.previewEl.removeClass("is-select-mode");
        this.previewEl.removeClass("is-palette-open");
        this.previewEl.removeClass("is-text-panel-open");
        this.previewEl.removeClass("is-watercolor-mode");
        this.previewEl.removeClass("is-notedraw-source-shell");
        this.previewEl.removeClass("is-notedraw-webview-shell");
        this.previewEl.removeClass("is-resizing-selection");
        if (this.previewEl._noteDrawController === this) {
          delete this.previewEl._noteDrawController;
        }
      }
      async toggle() {
        this.active = !this.active;
        this.previewEl.toggleClass("is-drawing-active", this.active);
        this.button?.classList.toggle("is-active", this.active);
        if (!this.active) {
          this.endTextEdit();
          this.endFloatingTextInput(false);
          this.setPaletteOpen(false);
          this.setTextPanelOpen(false);
          this.cancelCurrentStroke();
          this.cancelSelectionDrag(true);
          this.cancelSelectedStrokeDrag(true);
        } else {
          this.ensureDrawingsLoaded().catch((error) => {
            console.error(`[${PLUGIN_ID}] Failed to load drawings`, error);
          });
          this.scheduleLayoutRefresh();
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
        this.scheduleResize();
      }
      onScroll() {
        this.scheduleFloatingControlsPosition();
      }
      scheduleResize() {
        if (this.resizeFrameId !== null) {
          return;
        }
        this.resizeFrameId = window.requestAnimationFrame(() => {
          this.resizeFrameId = null;
          this.resizeCanvas();
          this.updateFloatingControlsPosition();
          this.render();
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
        });
      }
      cancelPositionFrame() {
        if (this.positionFrameId !== null) {
          window.cancelAnimationFrame(this.positionFrameId);
          this.positionFrameId = null;
        }
      }
      scheduleLayoutRefresh() {
        this.scheduleResize();
        window.requestAnimationFrame?.(() => this.scheduleResize());
        window.requestAnimationFrame?.(() => window.requestAnimationFrame?.(() => this.scheduleResize()));
        window.setTimeout(() => this.scheduleResize(), 80);
        window.setTimeout(() => this.scheduleResize(), 350);
        window.setTimeout(() => this.scheduleResize(), 800);
        window.setTimeout(() => this.scheduleResize(), 1600);
        window.setTimeout(() => this.scheduleResize(), 2600);
      }
      updateFloatingControlsPosition() {
        if (!this.button || !this.toolbar) {
          return;
        }
        const host = this.view?.containerEl || this.previewEl.closest?.(".workspace-leaf-content") || this.previewEl;
        const hostRect = host.getBoundingClientRect();
        const buttonRect = this.button.getBoundingClientRect();
        const viewHeader = this.view?.containerEl?.querySelector?.(".view-header") || this.button.closest?.(".view-header") || null;
        const chromeRect = viewHeader?.getBoundingClientRect?.() || this.button.closest?.(".view-actions")?.getBoundingClientRect?.() || null;
        const toolbarHeight = Math.max(36, this.toolbar.getBoundingClientRect().height || 36);
        const buttonVisible = buttonRect.width > 0 && buttonRect.height > 0 && buttonRect.bottom > 0 && buttonRect.top < window.innerHeight;
        const anchorRight = hostRect.right > 0 ? hostRect.right : buttonVisible ? buttonRect.right : window.innerWidth;
        const headerBottom = chromeRect && chromeRect.bottom > 0 ? chromeRect.bottom : 48;
        const anchorBottom = Math.max(
          buttonVisible ? buttonRect.bottom : 0,
          headerBottom
        );
        const right = clamp(window.innerWidth - anchorRight + 10, 8, Math.max(8, window.innerWidth - 48));
        const minTop = Math.max(56, headerBottom + 6);
        const maxTop = Math.max(minTop, window.innerHeight - toolbarHeight - 8);
        const topOffset = sanitizeSettings(this.plugin?.settings || {}).toolbarTopOffset;
        const top = clamp(anchorBottom + topOffset, minTop, maxTop);
        this.previewEl.style.setProperty("--notedraw-toolbar-right", `${Math.round(right)}px`);
        this.previewEl.style.setProperty("--notedraw-toolbar-top", `${Math.round(top)}px`);
        this.previewEl.style.setProperty("--notedraw-palette-top", `${Math.round(top + 42)}px`);
        this.previewEl.style.setProperty("--notedraw-text-panel-top", `${Math.round(top + 42)}px`);
      }
      setBrushMode(mode) {
        if (![BRUSH_PEN, BRUSH_WATERCOLOR].includes(mode)) {
          return;
        }
        this.brushMode = mode;
        this.toolMode = TOOL_DRAW;
        this.previewEl.removeClass("is-select-mode");
        this.endTextEdit();
        this.cancelCurrentStroke();
        this.cancelSelectionDrag(true);
        this.syncCurrentBrushFields();
        this.syncPaletteInputs();
        this.updateToolButtons();
        this.render();
      }
      setTextMode() {
        this.toolMode = TOOL_TEXT;
        this.previewEl.removeClass("is-select-mode");
        this.setPaletteOpen(false);
        this.setTextPanelOpen(false);
        this.endTextEdit();
        this.cancelCurrentStroke();
        this.cancelSelectionDrag(true);
        this.updateToolButtons();
        this.render();
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
      updateToolButtons() {
        const penActive = this.toolMode === TOOL_DRAW && this.brushMode === BRUSH_PEN;
        const watercolorActive = this.toolMode === TOOL_DRAW && this.brushMode === BRUSH_WATERCOLOR;
        this.applyBrushButtonState(this.penButton, this.brushSettings?.[BRUSH_PEN], penActive);
        this.applyBrushButtonState(this.watercolorButton, this.brushSettings?.[BRUSH_WATERCOLOR], watercolorActive);
        this.textButton?.classList.toggle("is-active", this.toolMode === TOOL_TEXT || this.textPanelOpen);
        this.textButton?.toggleAttribute("hidden", this.surfaceType === "source");
        this.selectButton?.classList.toggle("is-active", this.toolMode === TOOL_SELECT);
        this.paletteButton?.toggleAttribute("disabled", this.toolMode === TOOL_SELECT);
        this.previewEl.toggleClass("is-watercolor-mode", this.toolMode === TOOL_DRAW && this.brushMode === BRUSH_WATERCOLOR);
      }
      createTextPanel() {
        const groups = [
          {
            label: "Text",
            items: [
              { id: "plain", label: "Text", icon: "type" },
              { id: "title", label: "Title", icon: "type" },
              { id: "code", label: "Code", icon: "code-2" },
              { id: "button", label: "Button", icon: "square" },
              { id: "file", label: "File tag", icon: "file-text" }
            ]
          },
          {
            label: "Import",
            items: [
              { id: "image", label: "Image", icon: "image" },
              { id: "video", label: "Video", icon: "film" },
              { id: "attachment", label: "File", icon: "paperclip" }
            ]
          },
          {
            label: "Preview",
            items: [
              { id: "markdown", label: "MD", icon: "pilcrow" },
              { id: "html", label: "HTML", icon: "code" },
              { id: "note", label: "Note", icon: "file-text" }
            ]
          }
        ];
        for (const group of groups) {
          const groupEl = this.textPanel.createDiv({ cls: "notedraw-text-group" });
          groupEl.createDiv({ cls: "notedraw-text-group-label", text: group.label });
          const gridEl = groupEl.createDiv({ cls: "notedraw-text-grid" });
          for (const item of group.items) {
            const button = gridEl.createEl("button", {
              cls: "notedraw-text-option",
              attr: { type: "button", title: item.label }
            });
            button.dataset.noteDrawTextPreset = item.id;
            setIcon(button, item.icon);
            button.createSpan({ text: item.label });
            button.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              this.textPreset = item.id;
              this.setTextMode();
              this.setTextPanelOpen(false);
              this.syncTextPanelButtons();
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
      toggleTextPanel() {
        if (this.surfaceType === "source") {
          return;
        }
        this.setTextPanelOpen(!this.textPanelOpen);
      }
      setTextPanelOpen(open) {
        this.textPanelOpen = Boolean(open) && this.surfaceType !== "source";
        this.previewEl.toggleClass("is-text-panel-open", this.textPanelOpen);
        this.textButton?.classList.toggle("is-active", this.toolMode === TOOL_TEXT || this.textPanelOpen);
        if (this.textPanelOpen) {
          this.setPaletteOpen(false);
          this.updateFloatingControlsPosition();
          this.syncTextPanelButtons();
        }
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
              "aria-label": `Use color ${color}`
            }
          });
          button.style.setProperty("--notedraw-swatch-color", color);
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
            title: "Advanced color",
            "aria-label": "Advanced color"
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
        button.style.setProperty("--notedraw-brush-button-color", color);
        button.style.setProperty("--notedraw-brush-button-contrast", contrastTextColor(color));
      }
      toggleSelectMode() {
        this.toolMode = this.toolMode === TOOL_SELECT ? TOOL_DRAW : TOOL_SELECT;
        this.previewEl.toggleClass("is-select-mode", this.toolMode === TOOL_SELECT);
        if (this.toolMode === TOOL_SELECT) {
          this.setPaletteOpen(false);
          this.setTextPanelOpen(false);
        }
        this.updateToolButtons();
        this.endTextEdit();
        this.cancelCurrentStroke();
        this.cancelSelectionDrag(true);
        this.render();
      }
      togglePalettePanel() {
        if (this.toolMode === TOOL_SELECT) {
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
        this.paletteButton?.classList.toggle("is-active", this.paletteOpen);
        if (this.paletteOpen) {
          this.updateFloatingControlsPosition();
        }
      }
      onDocumentPointerDown(event) {
        if (!this.paletteOpen && !this.textPanelOpen) {
          return;
        }
        const target = event.target;
        if (this.palettePanel?.contains(target) || this.paletteButton?.contains(target) || this.textPanel?.contains(target) || this.textButton?.contains(target)) {
          return;
        }
        this.setPaletteOpen(false);
        this.setTextPanelOpen(false);
      }
      onButtonPointerDown() {
        this.clearButtonLongPress();
        this.buttonLongPressTimer = window.setTimeout(() => {
          this.buttonLongPressed = true;
          this.toggleDrawingsVisible();
        }, LONG_PRESS_MS);
      }
      onButtonPointerUp() {
        this.clearButtonLongPress();
      }
      onButtonClick(event) {
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
        this.drawingsVisible = !this.drawingsVisible;
        this.previewEl.toggleClass("is-drawing-hidden", !this.drawingsVisible);
        this.button?.setAttribute(
          "title",
          this.drawingsVisible ? "Edit text / draw" : "Edit text / draw (drawings hidden)"
        );
      }
      resizeCanvas() {
        this.layoutMeasureEl = findLayoutMeasureElement(this.previewEl);
        const measured = measureCanvasExtent(this.previewEl, this.layoutMeasureEl);
        const ratio = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(measured.width));
        const height = Math.max(1, Math.round(measured.height));
        this.canvasCssWidth = width;
        this.canvasCssHeight = height;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.canvas.width = Math.round(width * ratio);
        this.canvas.height = Math.round(height * ratio);
        this.ctx = this.canvas.getContext("2d");
        this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        if (this.staticCanvas.width !== this.canvas.width || this.staticCanvas.height !== this.canvas.height) {
          this.staticCanvas.width = this.canvas.width;
          this.staticCanvas.height = this.canvas.height;
          this.staticCtx = this.staticCanvas.getContext("2d");
          this.invalidateStaticCache();
        }
        this.staticCtx?.setTransform(ratio, 0, 0, ratio, 0, 0);
        if (measured.visibleWidth > 0) {
          this.canvas.style.minWidth = `${Math.round(measured.visibleWidth)}px`;
        }
      }
      onPointerDown(event) {
        if (!this.active || event.button !== 0) {
          return;
        }
        if (event.pointerType === "touch") {
          this.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (this.suppressTouchDrawing || this.touchPointers.size >= 2) {
            this.startMultiTouchScroll(event);
            return;
          }
        }
        const target = this.elementBelowCanvas(event.clientX, event.clientY);
        const editable = this.allowTextEdit ? findEditableTarget(target, this.previewEl) : null;
        const sourceTextTarget = this.surfaceType === "source" && this.toolMode !== TOOL_SELECT && isSourceTextTarget(target, this.previewEl);
        const point = this.eventToPoint(event);
        const hitStrokeIndex = this.findStrokeAt(point);
        const resizeHandle = this.findSelectionHandleAt(point);
        if (resizeHandle) {
          this.startSelectedStrokeResize(event, point, resizeHandle);
          return;
        }
        if (this.getSelectedStrokeIndexes().length && !this.selectedStrokeFrameContains(point) && hitStrokeIndex < 0) {
          this.clearSelectedStrokes();
          if (!editable && this.toolMode !== TOOL_SELECT && this.toolMode !== TOOL_TEXT) {
            this.render();
            event.preventDefault();
            event.stopPropagation();
            return;
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
        } catch (_) {
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
      elementBelowCanvas(clientX, clientY) {
        const previous = this.canvas.style.pointerEvents;
        this.canvas.style.pointerEvents = "none";
        const target = document.elementFromPoint(clientX, clientY);
        this.canvas.style.pointerEvents = previous;
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
          this.didMove = movedDistance > SELECT_TAP_DISTANCE;
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
          if (this.touchPointers.has(event.pointerId)) {
            this.touchPointers.delete(event.pointerId);
          }
          if (this.multiTouchScrolling || this.suppressTouchDrawing) {
            if (this.touchPointers.size < 2) {
              this.multiTouchScrolling = false;
              this.multiTouchLastCenter = null;
              this.previewEl.removeClass("is-two-finger-scroll");
            }
            if (this.touchPointers.size === 0) {
              this.suppressTouchDrawing = false;
            }
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
        if (this.toolMode === TOOL_TEXT && !this.currentStroke) {
          const point = this.pointerStartPoint || this.eventToPoint(event);
          if (movedDistance <= SELECT_TAP_DISTANCE && !this.didMove) {
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
        if (!this.didMove || movedDistance <= SELECT_TAP_DISTANCE || this.currentStroke.points.length < 2) {
          const point = this.pointerStartPoint || this.eventToPoint(event);
          this.currentStroke = null;
          if (editable) {
            this.startTextEdit(editable, this.pointerStartClient || { x: event.clientX, y: event.clientY });
          } else if (this.pointerStartSourceText) {
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
          this.drawingData.strokes.push(this.currentStroke);
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
        } catch (_) {
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
        return distance <= SELECT_TAP_DISTANCE * 2;
      }
      openFloatingTextInput(point, index = -1) {
        this.endFloatingTextInput(false);
        this.endTextEdit();
        const existing = index >= 0 ? this.drawingData.strokes[index] : null;
        const canvasPoint = this.pointToCanvas(point);
        const textarea = this.previewEl.createEl("textarea", {
          cls: "notedraw-floating-text-input",
          attr: {
            rows: "1",
            spellcheck: "true"
          }
        });
        textarea.value = isTextLikeStroke(existing) ? existing.text : "";
        textarea.style.left = `${Math.round(canvasPoint.x)}px`;
        textarea.style.top = `${Math.round(canvasPoint.y)}px`;
        textarea.style.color = isTextLikeStroke(existing) ? existing.color : this.currentBrushSettings().color || this.penColor;
        textarea.style.fontSize = `${isTextLikeStroke(existing) ? clamp(Number(existing.fontSize || 18), 10, 72) : 18}px`;
        textarea.style.fontWeight = isTextLikeStroke(existing) && existing.bold ? "700" : "400";
        textarea.style.fontFamily = isTextLikeStroke(existing) && existing.code ? "monospace" : "sans-serif";
        const state = {
          element: textarea,
          point: { ...point, t: Date.now() },
          index,
          committed: false
        };
        this.floatingTextInput = state;
        const resize = () => {
          textarea.style.height = "auto";
          textarea.style.width = "auto";
          textarea.style.width = `${Math.min(Math.max(120, textarea.scrollWidth + 12), Math.max(160, this.canvasWidth() - canvasPoint.x - 16))}px`;
          textarea.style.height = `${Math.max(32, textarea.scrollHeight + 4)}px`;
        };
        const commit = () => this.commitFloatingTextInput(state);
        const cancel = () => this.endFloatingTextInput(false, state);
        textarea.addEventListener("input", resize);
        textarea.addEventListener("blur", commit);
        textarea.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        });
        window.requestAnimationFrame(() => {
          resize();
          textarea.focus();
          textarea.select();
        });
      }
      commitFloatingTextInput(state = this.floatingTextInput) {
        if (!state || state.committed) {
          return;
        }
        state.committed = true;
        const text = state.element.value.trim();
        if (!text) {
          this.endFloatingTextInput(false, state);
          return;
        }
        if (state.index >= 0 && isTextLikeStroke(this.drawingData.strokes[state.index])) {
          const stroke = this.drawingData.strokes[state.index];
          stroke.text = text;
          stroke.render = normalizeTextRenderMode(stroke.render);
          if (isRichTextStroke(stroke)) {
            stroke.previewWidth = stroke.previewWidth || 300;
            stroke.previewHeight = stroke.previewHeight || 180;
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
            fontSize: preset.fontSize,
            bold: preset.bold,
            code: preset.code,
            boxed: preset.boxed,
            file: preset.file,
            previewWidth: preset.previewWidth,
            previewHeight: preset.previewHeight,
            points: [{ ...state.point, t: Date.now() }]
          };
          this.drawingData.strokes.push(stroke);
          this.setSelectedStrokes(this.drawingData.strokes.length - 1);
        }
        this.redoStack = [];
        this.invalidateStaticCache();
        this.plugin.scheduleDrawingSave(this.file, this.drawingData);
        this.endFloatingTextInput(false, state);
        this.render();
      }
      endFloatingTextInput(commit = true, state = this.floatingTextInput) {
        if (!state) {
          return;
        }
        if (commit && !state.committed) {
          this.commitFloatingTextInput(state);
          return;
        }
        state.element?.remove();
        if (this.floatingTextInput === state) {
          this.floatingTextInput = null;
        }
      }
      editFloatingTextStroke(index, point = null) {
        const stroke = this.drawingData.strokes[index];
        if (!isTextLikeStroke(stroke)) {
          return;
        }
        this.setSelectedStrokes(index);
        this.openFloatingTextInput(point || stroke.points[0], index);
      }
      handleTextToolTap(point) {
        if (isAssetTextPreset(this.textPreset)) {
          this.pendingEmbedTool = { preset: this.textPreset, point };
          if (this.hiddenFileInput) {
            this.hiddenFileInput.accept = filePickerAcceptForPreset(this.textPreset);
            this.hiddenFileInput.click();
          }
          return;
        }
        this.openFloatingTextInput(point);
      }
      async insertImportedAsset(fileLike, point) {
        const asset = await this.plugin.importLocalAsset(fileLike);
        if (!asset) {
          return;
        }
        const previewRenderMode = classifyImportedPreviewRender(asset);
        if (previewRenderMode) {
          const isHtmlPreview = previewRenderMode === TEXT_RENDER_HTML;
          const stroke2 = {
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
            points: [{ ...point, t: Date.now() }]
          };
          this.pendingEmbedTool = null;
          this.drawingData.strokes.push(stroke2);
          this.setSelectedStrokes(this.drawingData.strokes.length - 1);
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
          points: [{ ...point, t: Date.now() }]
        };
        this.pendingEmbedTool = null;
        this.drawingData.strokes.push(stroke);
        this.setSelectedStrokes(this.drawingData.strokes.length - 1);
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
          } catch (_) {
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
        } catch (_) {
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
        if (movedDistance <= SELECT_TAP_DISTANCE || !this.selectionStartPoint || !this.selectionCurrentPoint) {
          this.setSelectedStrokes(this.findStrokeAt(point));
        } else {
          this.setSelectedStrokes(this.findStrokesInSelection(this.selectionStartPoint, this.selectionCurrentPoint));
        }
        this.releasePointerCapture(event.pointerId);
        this.clearSelectionDragState();
        this.requestRender();
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
      startSelectedStrokeDrag(event, point, hitIndex = -1) {
        const indexes = this.getSelectedStrokeIndexes();
        if (!indexes.length) {
          return;
        }
        this.endTextEdit();
        this.pointerDown = false;
        this.currentStroke = null;
        this.draggingStroke = true;
        this.dragStrokeStartPoint = point;
        this.dragStrokeOriginalPoints = new Map(indexes.map((index) => [
          index,
          this.drawingData.strokes[index].points.map((strokePoint) => ({ ...strokePoint }))
        ]));
        this.dragStrokeMoved = false;
        this.dragStrokeHitIndex = hitIndex;
        this.pointerStartClient = { x: event.clientX, y: event.clientY };
        this.activePointerId = event.pointerId;
        this.previewEl.addClass("is-moving-selection");
        try {
          this.canvas.setPointerCapture(event.pointerId);
        } catch (_) {
        }
        event.preventDefault();
        event.stopPropagation();
      }
      moveSelectedStroke(event) {
        if (!this.dragStrokeStartPoint || !this.dragStrokeOriginalPoints?.size) {
          return;
        }
        const point = this.eventToPoint(event);
        const originalPoints = Array.from(this.dragStrokeOriginalPoints.values()).flat();
        const xs = originalPoints.map((strokePoint) => strokePoint.x);
        const ys = originalPoints.map((strokePoint) => strokePoint.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const dx = clamp(point.x - this.dragStrokeStartPoint.x, -minX, 1 - maxX);
        const dy = clamp(point.y - this.dragStrokeStartPoint.y, -minY, 1 - maxY);
        const movedDistance = pointDistanceOnCanvas(
          this.dragStrokeStartPoint,
          point,
          this.canvasWidth(),
          this.canvasHeight()
        );
        if (movedDistance > SELECT_TAP_DISTANCE) {
          this.dragStrokeMoved = true;
        }
        for (const [index, points] of this.dragStrokeOriginalPoints.entries()) {
          const stroke = this.drawingData.strokes[index];
          if (!stroke) {
            continue;
          }
          stroke.points = points.map((strokePoint) => ({
            ...strokePoint,
            x: clamp(strokePoint.x + dx, 0, 1),
            y: clamp(strokePoint.y + dy, 0, 1)
          }));
        }
        this.requestRender();
        event.preventDefault();
        event.stopPropagation();
      }
      finishSelectedStrokeDrag(event) {
        if (this.dragStrokeMoved) {
          this.lastTextTap = null;
          this.redoStack = [];
          this.plugin.scheduleDrawingSave(this.file, this.drawingData);
        } else if (this.getSelectedStrokeIndexes().length > 1 && this.dragStrokeHitIndex >= 0) {
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
        this.dragStrokeMoved = false;
        this.dragStrokeHitIndex = -1;
        this.pointerStartClient = null;
        this.activePointerId = null;
        this.previewEl.removeClass("is-moving-selection");
      }
      startSelectedStrokeResize(event, point, handle) {
        const indexes = this.getSelectedStrokeIndexes();
        const bounds = this.getSelectedStrokeNormalizedBounds();
        if (!indexes.length || !bounds) {
          return;
        }
        this.endTextEdit();
        this.pointerDown = false;
        this.currentStroke = null;
        this.resizingSelection = true;
        this.resizeSelectionHandle = handle;
        this.resizeSelectionStartPoint = point;
        this.resizeSelectionOriginalBounds = bounds;
        this.resizeSelectionOriginalStrokes = new Map(indexes.map((index) => [
          index,
          {
            width: this.drawingData.strokes[index].width || this.penWidth,
            fontSize: this.drawingData.strokes[index].fontSize || 18,
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
        } catch (_) {
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
        if (movedDistance > SELECT_TAP_DISTANCE) {
          this.resizeSelectionMoved = true;
        }
        this.applySelectedStrokeResize(point);
        this.requestRender();
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
            previewWidth: clamp((original.previewWidth || 260) * Math.abs(scaleX), 80, 900),
            previewHeight: clamp((original.previewHeight || 160) * Math.abs(scaleY), 40, 700),
            points: original.points.map((strokePoint) => ({
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
          }
          if (isTextLikeStroke(stroke) || isEmbedStroke(stroke)) {
            stroke.previewWidth = next.previewWidth;
            stroke.previewHeight = next.previewHeight;
          }
          stroke.points = next.points.map((strokePoint) => ({
            x: clamp(strokePoint.x, 0, 1),
            y: clamp(strokePoint.y, 0, 1)
          }));
        }
      }
      finishSelectedStrokeResize(event) {
        if (this.resizeSelectionMoved) {
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
        } catch (_) {
        }
      }
      addPointerSamples(event) {
        const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : null;
        const events = samples?.length ? samples : [event];
        for (const sample of events) {
          if (this.pointerStartClient && pointerDistance(this.pointerStartClient, {
            x: sample.clientX,
            y: sample.clientY
          }) > SELECT_TAP_DISTANCE) {
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
        if (distance <= DRAWING_MIN_POINT_DISTANCE_PX) {
          return;
        }
        const steps = Math.max(1, Math.ceil(distance / DRAWING_INTERPOLATION_STEP_PX));
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
        const y = event.clientY - rect.top;
        const width = Math.max(1, rect.width);
        const height = Math.max(1, rect.height);
        return {
          x: clamp(x / width, 0, 1),
          y: clamp(y / height, 0, 1),
          t: Date.now()
        };
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
      requestRender() {
        if (this.renderFrameId !== null) {
          return;
        }
        this.renderFrameId = window.requestAnimationFrame(() => {
          this.renderFrameId = null;
          this.render();
        });
      }
      cancelRenderFrame() {
        if (this.renderFrameId !== null) {
          window.cancelAnimationFrame(this.renderFrameId);
          this.renderFrameId = null;
        }
      }
      render() {
        if (!this.ctx) {
          return;
        }
        this.applyWebEdits();
        this.updateEmbedLayer();
        this.ctx.clearRect(0, 0, this.canvasWidth(), this.canvasHeight());
        this.ensureStaticCache();
        if (this.staticCanvas.width > 0 && this.staticCanvas.height > 0) {
          this.ctx.drawImage(this.staticCanvas, 0, 0, this.canvasWidth(), this.canvasHeight());
        }
        for (const [index, stroke] of this.drawingData.strokes.entries()) {
          if (this.isStrokeSelected(index)) {
            this.drawStroke(stroke, SELECTED_STROKE_ALPHA);
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
        this.staticCtx.clearRect(0, 0, this.canvasWidth(), this.canvasHeight());
        for (const [index, stroke] of this.drawingData.strokes.entries()) {
          if (!this.isStrokeSelected(index)) {
            this.drawStrokeOn(this.staticCtx, stroke);
          }
        }
        this.staticCacheDirty = false;
      }
      invalidateStaticCache() {
        this.staticCacheDirty = true;
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
        const file = this.plugin.app.metadataCache.getFirstLinkpathDest(normalized, this.file.path) || this.plugin.app.vault.getFileByPath(normalizePath(normalized));
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
        } catch (_) {
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
        const paddingX = stroke.boxed || stroke.code || stroke.file ? Math.max(8, fontSize * 0.45) : 0;
        const paddingY = stroke.boxed || stroke.code || stroke.file ? Math.max(4, fontSize * 0.26) : 0;
        ctx.save();
        ctx.globalAlpha = alpha * opacity;
        ctx.font = `${stroke.bold ? "700 " : ""}${fontSize}px ${stroke.code ? "monospace" : "sans-serif"}`;
        ctx.textBaseline = "top";
        ctx.fillStyle = stroke.color || this.penColor;
        if (paddingX || paddingY) {
          const metrics = ctx.measureText(text);
          const width = Math.max(fontSize, metrics.width);
          const height = fontSize * 1.28;
          ctx.fillStyle = stroke.code ? "rgba(127, 127, 127, 0.14)" : "rgba(255, 255, 255, 0.74)";
          ctx.strokeStyle = stroke.color || this.penColor;
          ctx.lineWidth = 1.25;
          roundRect(ctx, point.x - paddingX, point.y - paddingY, width + paddingX * 2, height + paddingY * 2, 6);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = stroke.color || this.penColor;
        ctx.fillText(text, point.x, point.y);
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
        const padding = Math.max(SELECT_STROKE_PADDING, this.getSelectedStrokeMaxWidth() + 4);
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
        for (let index = this.drawingData.strokes.length - 1; index >= 0; index -= 1) {
          const stroke = this.drawingData.strokes[index];
          const threshold = Math.max(SELECT_STROKE_PADDING, (stroke.width || this.penWidth) / 2 + SELECT_STROKE_PADDING);
          if (strokeHitTest(stroke, hitPoint, width, height, threshold)) {
            return index;
          }
        }
        return -1;
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
        this.invalidateStaticCache();
      }
      clearSelectedStrokes() {
        this.selectedStrokeIndexes.clear();
        this.selectedStrokeIndex = -1;
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
      getSelectedStrokeBounds() {
        const indexes = this.getSelectedStrokeIndexes();
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
      getSelectedStrokeNormalizedBounds() {
        const bounds = this.getSelectedStrokeBounds();
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
        const padding = Math.max(SELECT_STROKE_PADDING, this.getSelectedStrokeMaxWidth() + 4);
        return {
          x: bounds.minX - padding,
          y: bounds.minY - padding,
          width: bounds.maxX - bounds.minX + padding * 2,
          height: bounds.maxY - bounds.minY + padding * 2
        };
      }
      findSelectionHandleAt(point) {
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
          return;
        }
        this.endTextEdit();
        this.currentEditor = element;
        element.dataset.noteDrawOriginal = element.innerText;
        const saveToVault = this.surfaceType !== "webview";
        if (saveToVault) {
          this.plugin.prepareTextEditState(this.file, element.innerText, element);
        }
        element.contentEditable = "true";
        element.spellcheck = true;
        element.addClass("notedraw-editing");
        element.focus();
        placeCaretInEditable(element, clientPoint);
        const onInput = () => {
          if (!saveToVault) {
            return;
          }
          this.plugin.scheduleTextSave(
            this.file,
            element.dataset.noteDrawOriginal || "",
            element.innerText,
            element
          );
        };
        const onKeyDown = (event) => {
          if (event.key === "Escape") {
            this.endTextEdit();
          }
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            this.endTextEdit();
          }
        };
        const onBlur = () => this.endTextEdit();
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
        const edited = element.innerText;
        if (this.surfaceType === "webview") {
          this.commitWebviewTextEdit(element, original, edited);
        } else if (normalizeRenderedText(original) !== normalizeRenderedText(edited)) {
          this.plugin.scheduleTextSaveNow(this.file, original, edited, element);
        }
        element._noteDrawCleanup?.();
        delete element._noteDrawCleanup;
        delete element.dataset.noteDrawOriginal;
        element.contentEditable = "false";
        element.removeClass("notedraw-editing");
        this.currentEditor = null;
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
        this.plugin.scheduleDrawingSave(this.file, this.drawingData);
        this.render();
      }
      deleteSelectedStroke() {
        const indexes = this.getSelectedStrokeIndexes();
        if (!indexes.length) {
          return;
        }
        for (const index of indexes.slice().sort((a, b) => b - a)) {
          this.drawingData.strokes.splice(index, 1);
        }
        this.clearSelectedStrokes();
        this.redoStack = [];
        this.plugin.scheduleDrawingSave(this.file, this.drawingData);
        this.render();
      }
    };
    module2.exports = NoteDrawPlugin2;
    var NoteDrawExportSnapshotRenderer = class {
      constructor(plugin, file, layer, width, height) {
        this.plugin = plugin;
        this.file = file;
        this.layer = layer;
        this.width = width;
        this.height = height;
      }
      async render(strokes) {
        for (const stroke of strokes) {
          await this.renderStroke(stroke).catch((error) => {
            console.warn(`[${PLUGIN_ID}] Failed to render export snapshot item`, error);
          });
        }
      }
      async renderStroke(stroke) {
        if (!stroke?.points?.length) {
          return;
        }
        const bounds = getStrokeBounds(stroke, this.width, this.height);
        if (!bounds) {
          return;
        }
        const node = this.layer.createDiv({ cls: "notedraw-export-snapshot-item" });
        node.toggleClass("is-rich-text", isRichTextStroke(stroke));
        node.toggleClass("is-asset", isEmbedStroke(stroke));
        if (stroke.assetPath) {
          node.setAttribute("data-notedraw-asset-path", stroke.assetPath);
        }
        if (stroke.assetName) {
          node.setAttribute("data-notedraw-asset-name", stroke.assetName);
        }
        if (stroke.assetMime) {
          node.setAttribute("data-notedraw-asset-mime", stroke.assetMime);
        }
        applyElementStyles(node, {
          left: `${Math.round(bounds.minX)}px`,
          top: `${Math.round(bounds.minY)}px`,
          width: `${Math.max(32, Math.round(bounds.maxX - bounds.minX))}px`,
          height: `${Math.max(28, Math.round(bounds.maxY - bounds.minY))}px`,
          opacity: String(clamp(Number(stroke.opacity ?? 1), 0, 1))
        });
        if (isRichTextStroke(stroke)) {
          await this.renderRichText(node, stroke);
          return;
        }
        if (stroke.embedType === EMBED_IMAGE) {
          await this.renderImage(node, stroke);
          return;
        }
        if (stroke.embedType === EMBED_VIDEO) {
          node.createEl("video", {
            attr: {
              src: this.assetResourceUrl(stroke.assetPath),
              title: stroke.assetName || "Video",
              "data-filename": stroke.assetName || "",
              preload: "metadata",
              muted: "true",
              playsinline: "true"
            }
          });
          return;
        }
        this.renderFileCard(node, stroke);
      }
      async renderImage(node, stroke) {
        const image = node.createEl("img", {
          attr: {
            alt: stroke.assetName || "Image",
            decoding: "sync",
            loading: "eager",
            src: await this.assetImageSource(stroke)
          }
        });
        await waitForImage(image, 1800).catch(() => null);
        const canvas = createExportImageCanvas(image);
        if (canvas) {
          image.replaceWith(canvas);
          return;
        }
        await prepareExportImage(image);
      }
      async renderRichText(node, stroke) {
        const renderMode = normalizeTextRenderMode(stroke.render);
        const content = String(stroke.text || "");
        if (renderMode === TEXT_RENDER_HTML) {
          node.appendChild(sanitizeHTMLToDomSafe(content));
          await prepareExportImages(node);
          return;
        }
        if (renderMode === TEXT_RENDER_NOTE) {
          const noteContent = await this.resolveNotePreviewContent(content);
          await MarkdownRenderer.render(this.plugin.app, noteContent, node, this.file.path, this.plugin);
          await prepareExportImages(node);
          return;
        }
        await MarkdownRenderer.render(this.plugin.app, content, node, this.file.path, this.plugin);
        await prepareExportImages(node);
      }
      renderFileCard(node, stroke) {
        const fileCard = node.createDiv({ cls: "notedraw-file-card" });
        const iconEl = fileCard.createSpan({ cls: "notedraw-file-icon" });
        setIcon(iconEl, "paperclip");
        const body = fileCard.createDiv({ cls: "notedraw-file-body" });
        body.createDiv({ cls: "notedraw-file-name", text: stroke.assetName || stroke.text || "Attachment" });
        body.createDiv({ cls: "notedraw-file-meta", text: formatBytes(stroke.assetSize) });
      }
      async resolveNotePreviewContent(text) {
        const link = String(text || "").trim();
        const normalized = unwrapWikiLink(link);
        const file = this.plugin.app.metadataCache.getFirstLinkpathDest(normalized, this.file.path) || this.plugin.app.vault.getFileByPath(normalizePath(normalized));
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
        } catch (_) {
          return "";
        }
      }
      async assetImageSource(stroke) {
        const dataUrl = await this.assetDataUrl(stroke.assetPath, stroke.assetMime || guessMimeType(stroke.assetName || stroke.assetPath));
        return dataUrl || this.assetResourceUrl(stroke.assetPath);
      }
      async assetDataUrl(assetPath, mime) {
        if (!assetPath) {
          return "";
        }
        try {
          const buffer = await this.plugin.app.vault.adapter.readBinary(normalizeVaultPath(assetPath));
          return `data:${mime || "image/png"};base64,${arrayBufferToBase64(buffer)}`;
        } catch (_) {
          return "";
        }
      }
    };
    var NoteDrawSettingTab = class extends PluginSettingTab {
      constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
      }
      display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "NoteDraw" });
        this.renderSettings();
        const codesContainer = containerEl.createDiv({ cls: "notedraw-settings-codes" });
        this.renderExtraCodes(codesContainer);
      }
      renderSettings() {
        const { containerEl } = this;
        const settings = sanitizeSettings(this.plugin.settings);
        new Setting(containerEl).setName("Default pen color").setDesc("Initial color for new pen strokes.").addColorPicker((component) => component.setValue(settings.defaultPenColor).onChange(async (value) => {
          this.plugin.settings.defaultPenColor = value;
          await this.plugin.saveSettings();
        }));
        new Setting(containerEl).setName("Default pen width").setDesc("Initial pen width.").addSlider((component) => component.setLimits(MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH, 0.5).setValue(settings.defaultPenWidth).setDynamicTooltip().onChange(async (value) => {
          this.plugin.settings.defaultPenWidth = value;
          await this.plugin.saveSettings();
        }));
        new Setting(containerEl).setName("Default pen opacity").setDesc("Initial pen opacity.").addSlider((component) => component.setLimits(0, 1, 0.02).setValue(settings.defaultPenOpacity).setDynamicTooltip().onChange(async (value) => {
          this.plugin.settings.defaultPenOpacity = value;
          await this.plugin.saveSettings();
        }));
        new Setting(containerEl).setName("Default watercolor color").setDesc("Initial color for watercolor strokes.").addColorPicker((component) => component.setValue(settings.defaultWatercolorColor).onChange(async (value) => {
          this.plugin.settings.defaultWatercolorColor = value;
          await this.plugin.saveSettings();
        }));
        new Setting(containerEl).setName("Default watercolor width").setDesc("Initial watercolor width.").addSlider((component) => component.setLimits(MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH, 0.5).setValue(settings.defaultWatercolorWidth).setDynamicTooltip().onChange(async (value) => {
          this.plugin.settings.defaultWatercolorWidth = value;
          await this.plugin.saveSettings();
        }));
        new Setting(containerEl).setName("Default watercolor opacity").setDesc("Initial watercolor opacity.").addSlider((component) => component.setLimits(0, 1, 0.02).setValue(settings.defaultWatercolorOpacity).setDynamicTooltip().onChange(async (value) => {
          this.plugin.settings.defaultWatercolorOpacity = value;
          await this.plugin.saveSettings();
        }));
        new Setting(containerEl).setName("Toolbar top offset").setDesc("Extra pixels below the Obsidian header.").addSlider((component) => component.setLimits(0, 48, 1).setValue(settings.toolbarTopOffset).setDynamicTooltip().onChange(async (value) => {
          this.plugin.settings.toolbarTopOffset = value;
          await this.plugin.saveSettings();
        }));
        new Setting(containerEl).setName("Debug log").setDesc("Write text-save diagnostics to the plugin folder only while troubleshooting.").addToggle((component) => component.setValue(settings.enableDebugLog).onChange(async (value) => {
          this.plugin.settings.enableDebugLog = value;
          await this.plugin.saveSettings();
        }));
      }
      async renderExtraCodes(containerEl) {
        const codeItems = (await Promise.all(
          SETTINGS_EXTRA_CODE_ASSETS.map(async (asset) => {
            const src = await this.plugin.getOptionalAssetResourcePath(asset.path);
            return src ? { ...asset, src } : null;
          })
        )).filter(Boolean);
        if (!codeItems.length) {
          containerEl.remove();
          return;
        }
        containerEl.createDiv({
          cls: "notedraw-settings-codes-title",
          text: "\u7ED9\u6211\u4E70\u5496\u5561 / Buy me a coffee"
        });
        containerEl.createDiv({
          cls: "notedraw-settings-codes-subtitle",
          text: "\u5982\u679C\u8FD9\u4E2A\u63D2\u4EF6\u5E2E\u5230\u4F60\uFF0C\u53EF\u4EE5\u626B\u7801\u6253\u8D4F\u652F\u6301\u7EE7\u7EED\u7EF4\u62A4 / If this tool helps, tips are appreciated."
        });
        const gridEl = containerEl.createDiv({ cls: "notedraw-settings-codes-grid" });
        for (const item of codeItems) {
          const codeEl = gridEl.createDiv({ cls: "notedraw-settings-code" });
          const imageEl = codeEl.createEl("img", {
            cls: "notedraw-settings-code-image",
            attr: {
              alt: item.label,
              loading: "lazy",
              src: item.src
            }
          });
          imageEl.src = item.src;
          codeEl.createDiv({
            cls: "notedraw-settings-code-label",
            text: item.label
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
        defaultPenColor: isCssColor(input.defaultPenColor) ? input.defaultPenColor : DEFAULT_SETTINGS.defaultPenColor,
        defaultPenWidth: clamp(Number(input.defaultPenWidth ?? DEFAULT_SETTINGS.defaultPenWidth), MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH),
        defaultPenOpacity: clamp(Number(input.defaultPenOpacity ?? DEFAULT_SETTINGS.defaultPenOpacity), 0, 1),
        defaultWatercolorColor: isCssColor(input.defaultWatercolorColor) ? input.defaultWatercolorColor : DEFAULT_SETTINGS.defaultWatercolorColor,
        defaultWatercolorWidth: clamp(Number(input.defaultWatercolorWidth ?? DEFAULT_SETTINGS.defaultWatercolorWidth), MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH),
        defaultWatercolorOpacity: clamp(Number(input.defaultWatercolorOpacity ?? DEFAULT_SETTINGS.defaultWatercolorOpacity), 0, 1),
        toolbarTopOffset: clamp(Number(input.toolbarTopOffset ?? DEFAULT_SETTINGS.toolbarTopOffset), 0, 48),
        enableDebugLog: Boolean(input.enableDebugLog)
      };
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
          overlay.style.pointerEvents = "none";
        }
        if (typeof document.caretRangeFromPoint === "function") {
          range = document.caretRangeFromPoint(clientPoint.x, clientPoint.y);
        } else if (typeof document.caretPositionFromPoint === "function") {
          const position = document.caretPositionFromPoint(clientPoint.x, clientPoint.y);
          if (position?.offsetNode) {
            range = document.createRange();
            range.setStart(position.offsetNode, position.offset);
            range.collapse(true);
          }
        }
      } finally {
        if (overlay) {
          overlay.style.pointerEvents = previousPointerEvents || "";
        }
      }
      if (!range || !element.contains(range.startContainer)) {
        return null;
      }
      range.collapse(true);
      return range;
    }
    function nearestTextRangeFromPoint(element, clientPoint) {
      const walker = document.createTreeWalker(
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
          const charRange = document.createRange();
          charRange.setStart(node, offset);
          charRange.setEnd(node, offset + 1);
          for (const rect of Array.from(charRange.getClientRects())) {
            if (!isUsableRect(rect)) {
              continue;
            }
            const score = scoreRectDistance(rect, clientPoint);
            if (score < bestScore) {
              const caretOffset = clientPoint.x > rect.left + rect.width / 2 ? offset + 1 : offset;
              const caretRange = document.createRange();
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
    function scoreRectDistance(rect, point) {
      const xDistance = point.x < rect.left ? rect.left - point.x : point.x > rect.right ? point.x - rect.right : 0;
      const yDistance = point.y < rect.top ? rect.top - point.y : point.y > rect.bottom ? point.y - rect.bottom : 0;
      const centerY = rect.top + rect.height / 2;
      const sameLineBonus = point.y >= rect.top - 2 && point.y <= rect.bottom + 2 ? 0 : 1e5;
      const linePenalty = Math.abs(point.y - centerY) * 200;
      const inlinePenalty = xDistance;
      return sameLineBonus + linePenalty + inlinePenalty;
    }
    function rangeAtEditableEnd(element) {
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      return range;
    }
    function normalizeMarkdownBlock(value) {
      let text = String(value || "").trim();
      text = text.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "").replace(/^#{1,6}\s+/gm, "").replace(/^\s{0,3}>\s?/gm, "").replace(/^\s*[-*+]\s+/gm, "").replace(/^\s*\d+[.)]\s+/gm, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/_([^_]+)_/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
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
    function annotateEditableElements(root, ctx) {
      const elements = [];
      if (root.matches?.(EDITABLE_SELECTOR)) {
        elements.push(root);
      }
      elements.push(...root.querySelectorAll(EDITABLE_SELECTOR));
      for (const element of elements) {
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
        }
        if (Number.isFinite(info.lineEnd)) {
          element.dataset.noteDrawLineEnd = String(info.lineEnd);
        }
      }
    }
    function safeGetSectionInfo(ctx, element) {
      try {
        return ctx.getSectionInfo?.(element) || null;
      } catch (_) {
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
    function collectWorkspaceLeaves(app) {
      const leaves = [];
      try {
        app.workspace.iterateAllLeaves((leaf) => leaves.push(leaf));
      } catch (_) {
        return [];
      }
      return leaves;
    }
    function findRootPreviewForView(view) {
      const previews = Array.from(view?.containerEl?.querySelectorAll(".markdown-preview-view") || []);
      return previews.find((preview) => !isEmbeddedPreview(preview)) || null;
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
      } catch (_) {
        return text;
      }
    }
    function webviewSurfaceLabel(identity, view) {
      try {
        const parsed = new URL(identity);
        return parsed.hostname.replace(/^www\./, "") || viewTitle(view) || "webview";
      } catch (_) {
        return viewTitle(view) || "webview";
      }
    }
    function viewTitle(view) {
      try {
        if (typeof view?.getDisplayText === "function") {
          return view.getDisplayText();
        }
      } catch (_) {
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
      const flattened = flattenImageOnWhite(image);
      if (flattened) {
        await waitForImage(image, 800).catch(() => null);
      }
    }
    function flattenImageOnWhite(image) {
      try {
        const width = Math.max(1, image.naturalWidth || image.width);
        const height = Math.max(1, image.naturalHeight || image.height);
        const canvas = document.createElement("canvas");
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
      } catch (_) {
        return false;
      }
    }
    function createExportImageCanvas(image) {
      try {
        const width = Math.max(1, image.naturalWidth || image.width);
        const height = Math.max(1, image.naturalHeight || image.height);
        if (!width || !height) {
          return null;
        }
        const canvas = document.createElement("canvas");
        canvas.className = "notedraw-export-image-canvas";
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          return null;
        }
        context.fillStyle = "#fff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        applyElementStyles(canvas, {
          display: "block",
          width: "100%",
          height: "100%",
          background: "#fff"
        });
        return canvas;
      } catch (_) {
        return null;
      }
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
      if (typeof Buffer !== "undefined") {
        return Buffer.from(bytes).toString("base64");
      }
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
    function waitForMedia(media, timeoutMs) {
      if (media.readyState >= 2) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        let timer = 0;
        const cleanup = () => {
          window.clearTimeout(timer);
          media.removeEventListener("loadeddata", done);
          media.removeEventListener("loadedmetadata", done);
          media.removeEventListener("canplay", done);
          media.removeEventListener("error", done);
        };
        const done = () => {
          cleanup();
          resolve();
        };
        media.addEventListener("loadeddata", done, { once: true });
        media.addEventListener("loadedmetadata", done, { once: true });
        media.addEventListener("canplay", done, { once: true });
        media.addEventListener("error", done, { once: true });
        timer = window.setTimeout(done, timeoutMs);
      });
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
      } catch (_) {
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
      canvas.style.pointerEvents = "none";
      const target = document.elementFromPoint(clientPoint.x, clientPoint.y);
      canvas.style.pointerEvents = previousPointerEvents;
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
      document.querySelectorAll(".notedraw-header-button, .notedraw-webview-button").forEach((button) => button.remove());
    }
    function cleanupDrawingUi(preview) {
      preview.querySelectorAll(".notedraw-button, .notedraw-fallback-button, .notedraw-webview-button, .notedraw-toolbar, .notedraw-palette-panel, .notedraw-text-panel, .notedraw-embed-layer, .notedraw-file-input, .notedraw-canvas").forEach((element) => element.remove());
      preview.classList.remove("notedraw-shell", "is-drawing-active", "is-drawing-hidden", "is-select-mode", "is-palette-open", "is-text-panel-open", "is-watercolor-mode", "is-selecting-strokes", "is-resizing-selection", "is-notedraw-webview-shell");
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
    function isWebviewRelatedNode(node) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }
      return node.matches?.(".mwv-embed, webview, iframe, .workspace-leaf-content[data-type*='webview'], .workspace-leaf-content[data-type*='web-view'], .workspace-leaf-content[data-type*='browser'], .workspace-leaf-content[data-type*='iframe']") || Boolean(node.querySelector?.(".mwv-embed, webview, iframe, .workspace-leaf-content[data-type*='webview'], .workspace-leaf-content[data-type*='web-view'], .workspace-leaf-content[data-type*='browser'], .workspace-leaf-content[data-type*='iframe']"));
    }
    function normalizeVaultPath(path) {
      return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
    }
    function sanitizeAssetFileName(name) {
      const cleaned = String(name || "attachment.bin").replace(/\\/g, "/").split("/").pop().replace(/[<>:"|?*\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim();
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
    function isImageAssetMime(name, mime) {
      const lowerName = String(name || "").toLowerCase();
      const lowerMime = String(mime || "").toLowerCase();
      return lowerMime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerName);
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
      return text.replace(/^\!?\[\[/, "").replace(/\]\]$/, "").trim();
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
      const template = document.createElement("template");
      template.innerHTML = String(content || "");
      template.content.querySelectorAll("script, iframe, object, embed, link[rel='import']").forEach((node) => node.remove());
      template.content.querySelectorAll("*").forEach((element) => {
        for (const attribute of Array.from(element.attributes || [])) {
          const name = attribute.name.toLowerCase();
          const value = attribute.value || "";
          if (name.startsWith("on") || /^\s*javascript:/i.test(value)) {
            element.removeAttribute(attribute.name);
          }
        }
      });
      return template.content.cloneNode(true);
    }
    function createEmptyDrawingData(file) {
      return {
        version: 1,
        sourcePath: file.path,
        strokes: [],
        webEdits: [],
        updatedAt: null
      };
    }
    function normalizeDrawingData(data, file) {
      const strokes = Array.isArray(data?.strokes) ? data.strokes : [];
      return {
        version: Number.isFinite(data?.version) ? data.version : 1,
        sourcePath: file.path,
        strokes: strokes.map(normalizeStroke).map((stroke) => ({
          ...stroke,
          points: compactStrokePoints(stroke.points)
        })).filter((stroke) => stroke.points.length),
        webEdits: normalizeWebEdits(data?.webEdits),
        updatedAt: data?.updatedAt || null
      };
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
        fontSize: Number.isFinite(Number(stroke?.fontSize)) ? clamp(Number(stroke.fontSize), 10, 72) : 18,
        bold: Boolean(stroke?.bold),
        code: Boolean(stroke?.code),
        boxed: Boolean(stroke?.boxed),
        file: Boolean(stroke?.file),
        points: points.map((point) => ({
          x: clamp(Number(point?.x), 0, 1),
          y: clamp(Number(point?.y), 0, 1),
          t: Number.isFinite(Number(point?.t)) ? Number(point.t) : Date.now()
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
    function createTextPreset(preset, text, color) {
      const normalized = String(text || "").trim();
      if (preset === "title") {
        return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_PLAIN, color, fontSize: 26, bold: true, code: false, boxed: false, file: false };
      }
      if (preset === "code") {
        return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_PLAIN, color: "#374151", fontSize: 16, bold: false, code: true, boxed: true, file: false };
      }
      if (preset === "button") {
        return { kind: TOOL_TEXT, text: normalized, render: TEXT_RENDER_PLAIN, color, fontSize: 17, bold: true, code: false, boxed: true, file: false };
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
    function compactDrawingData(data) {
      if (!Array.isArray(data?.strokes)) {
        return data;
      }
      data.strokes = data.strokes.map((stroke) => ({
        ...stroke,
        points: compactStrokePoints(stroke.points)
      }));
      return data;
    }
    function compactStrokePoints(points) {
      if (!Array.isArray(points) || points.length <= 2) {
        return points || [];
      }
      const compacted = [points[0]];
      for (let index = 1; index < points.length - 1; index += 1) {
        const point = points[index];
        const last = compacted[compacted.length - 1];
        const distance = pointDistanceOnCanvas(last, point, 1, 1) * 1e3;
        if (distance >= DRAWING_COMPACT_DISTANCE_PX) {
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
    function findLayoutMeasureElement(previewEl) {
      return previewEl?.querySelector?.(".markdown-preview-sizer") || previewEl?.querySelector?.(".cm-sizer") || previewEl?.querySelector?.(".cm-content") || previewEl;
    }
    function measureCanvasExtent(previewEl, measureEl = null) {
      const previewRect = previewEl.getBoundingClientRect();
      const measureRect = measureEl?.getBoundingClientRect?.();
      const width = Math.max(
        previewEl.scrollWidth || 0,
        measureEl?.scrollWidth || 0,
        measureEl?.offsetWidth || 0,
        previewRect.width || 0,
        measureRect?.width || 0
      );
      const height = Math.max(
        previewEl.scrollHeight || 0,
        measureEl?.scrollHeight || 0,
        measureEl?.offsetHeight || 0,
        previewEl.offsetHeight || 0,
        previewRect.height || 0,
        measureRect?.height || 0
      );
      return {
        width: Math.max(1, width),
        height: Math.max(1, height),
        visibleWidth: Math.max(1, previewRect.width || width)
      };
    }
    function getScrollEventTarget(scroller) {
      if (!scroller) {
        return window;
      }
      return scroller === document.documentElement || scroller === document.body ? window : scroller;
    }
    function findScrollableAncestor(element) {
      let current = element;
      while (current && current !== document.body && current !== document.documentElement) {
        const style = window.getComputedStyle(current);
        const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY) && current.scrollHeight > current.clientHeight;
        const canScrollX = /(auto|scroll|overlay)/.test(style.overflowX) && current.scrollWidth > current.clientWidth;
        if (canScrollY || canScrollX) {
          return current;
        }
        current = current.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    }
    function pointDistanceOnCanvas(a, b, width, height) {
      return Math.hypot(
        ((a?.x || 0) - (b?.x || 0)) * Math.max(1, width || 1),
        ((a?.y || 0) - (b?.y || 0)) * Math.max(1, height || 1)
      );
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
        const fontSize = clamp(Number(stroke.fontSize || 18), 10, 72);
        const textWidth = Math.max(fontSize, String(stroke.text || "").length * fontSize * 0.62);
        const paddingX = stroke.boxed || stroke.code || stroke.file ? Math.max(8, fontSize * 0.45) : 0;
        const paddingY = stroke.boxed || stroke.code || stroke.file ? Math.max(4, fontSize * 0.26) : 0;
        const x = point.x * width;
        const y = point.y * height;
        return {
          minX: x - paddingX,
          minY: y - paddingY,
          maxX: x + textWidth + paddingX,
          maxY: y + fontSize * 1.28 + paddingY
        };
      }
      const xs = stroke.points.map((point) => point.x * width);
      const ys = stroke.points.map((point) => point.y * height);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys)
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
      if (isEmbedStroke(stroke) || isRichTextStroke(stroke)) {
        const bounds = getStrokeBounds(stroke, width, height);
        return Boolean(bounds) && hitPoint.x >= bounds.minX - threshold && hitPoint.x <= bounds.maxX + threshold && hitPoint.y >= bounds.minY - threshold && hitPoint.y <= bounds.maxY + threshold;
      }
      if (isTextStroke(stroke)) {
        const bounds = getStrokeBounds(stroke, width, height);
        return Boolean(bounds) && hitPoint.x >= bounds.minX - threshold && hitPoint.x <= bounds.maxX + threshold && hitPoint.y >= bounds.minY - threshold && hitPoint.y <= bounds.maxY + threshold;
      }
      const points = stroke.points.map((point) => ({
        x: point.x * width,
        y: point.y * height
      }));
      if (points.length === 1) {
        return pointerDistance(points[0], hitPoint) <= threshold;
      }
      for (let index = 1; index < points.length; index += 1) {
        if (distanceToSegment(hitPoint, points[index - 1], points[index]) <= threshold) {
          return true;
        }
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
      const edited = normalizeRenderedText(editedText);
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
  }
});

// src/main.js
var main_exports = {};
__export(main_exports, {
  default: () => main_default
});
module.exports = __toCommonJS(main_exports);
var import_notedraw_plugin = __toESM(require_notedraw_plugin());
var main_default = import_notedraw_plugin.default;
