"use strict";

const {
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  normalizePath,
  setIcon,
} = require("obsidian");

const PLUGIN_ID = "note-doodle-preview";
const DOODLE_DIR = `${PLUGIN_ID}/doodles`;
const DEBUG_LOG_FILE = "debug-log.jsonl";
const DEBUG_LOG_LIMIT = 150;
const TEXT_SAVE_DELAY_MS = 160;
const LONG_PRESS_MS = 550;
const SELECT_TAP_DISTANCE = 6;
const SELECT_STROKE_PADDING = 8;
const SELECTED_STROKE_ALPHA = 0.38;
const SELECT_RESIZE_HANDLE_SIZE = 10;
const SELECT_RESIZE_HANDLE_HIT_RADIUS = 15;
const DOODLE_INTERPOLATION_STEP_PX = 3;
const DOODLE_MIN_POINT_DISTANCE_PX = 0.55;
const DOODLE_COMPACT_DISTANCE_PX = 1.1;
const MAX_PEN_COUNT = 5;
const DEFAULT_PEN_OPACITY = 1;
const TOOL_DRAW = "draw";
const TOOL_SELECT = "select";
const BRUSH_PEN = "pen";
const BRUSH_WATERCOLOR = "watercolor";
const SETTINGS_EXTRA_CODE_ASSETS = [
  { path: "extras/code-1.jpg", label: "给我买咖啡 / Buy me a coffee" },
  { path: "extras/code-2.png", label: "支持继续维护 / Support this tool" },
];
const EDITABLE_SELECTOR = [
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
  ".markdown-preview-view .callout-content",
].join(",");

const BLOCKED_EDIT_SELECTOR = [
  ".note-doodle-button",
  ".note-doodle-toolbar",
  ".note-doodle-palette-panel",
  ".note-doodle-canvas",
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
  ".metadata-container",
].join(",");

module.exports = class NoteDoodlePreviewPlugin extends Plugin {
  async onload() {
    this.controllers = new WeakMap();
    this.sourceControllers = new Map();
    this.headerActions = new Map();
    this.saveTimers = new Map();
    this.textSaveStates = new WeakMap();
    cleanupAllDoodleHeaderButtons();

    this.addCommand({
      id: "toggle-note-doodle-preview",
      name: "Toggle preview edit and doodle mode",
      callback: () => this.toggleActiveController(),
    });
    this.addSettingTab(new NoteDoodlePreviewSettingTab(this.app, this));

    const syncSource = () => this.syncSourceControllers();
    this.registerEvent(this.app.workspace.on("layout-change", syncSource));
    this.registerEvent(this.app.workspace.on("active-leaf-change", syncSource));
    this.registerEvent(this.app.workspace.on("file-open", syncSource));
    window.setTimeout(syncSource, 0);

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

      const existingController = this.controllers.get(preview) || preview._noteDoodleController;
      if (existingController?.plugin === this) {
        existingController.setFile(view.file).catch((error) => {
          console.error(`[${PLUGIN_ID}] Failed to switch preview controller file`, error);
        });
        return;
      }

      if (existingController?.destroy) {
        existingController.destroy();
      }

      cleanupDoodleUi(preview);

      const controller = new PreviewDoodleController(this, preview, view, view.file);
      this.controllers.set(preview, controller);
      controller.mount();
      this.register(() => controller.destroy());
    });
  }

  onunload() {
    for (const controller of this.sourceControllers.values()) {
      controller.destroy();
    }
    this.sourceControllers.clear();

    for (const state of this.headerActions.values()) {
      state.button?.remove();
    }
    this.headerActions.clear();
    cleanupAllDoodleHeaderButtons();

    for (const timer of this.saveTimers.values()) {
      clearTimeout(timer);
    }
    this.saveTimers.clear();
  }

  toggleActiveController() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const surface = view
      ? (isSourceMode(view) ? findSourceSurfaceForView(view) || findRootPreviewForView(view) : findRootPreviewForView(view) || findSourceSurfaceForView(view))
      : null;
    const controller = surface ? this.controllers.get(surface) || surface._noteDoodleController : null;

    if (!controller) {
      new Notice("Open a note first.");
      return;
    }

    controller.toggle();
  }

  syncSourceControllers() {
    const leaves = this.app.workspace.getLeavesOfType?.("markdown") || [];
    const activeViews = new Set();

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

      const mountedOnElement = this.controllers.get(sourceEl) || sourceEl._noteDoodleController;
      if (mountedOnElement?.destroy) {
        mountedOnElement.destroy();
      }

      cleanupDoodleUi(sourceEl);

      const controller = new PreviewDoodleController(this, sourceEl, view, view.file, {
        allowTextEdit: false,
        surfaceType: "source",
      });
      this.controllers.set(sourceEl, controller);
      this.sourceControllers.set(view, controller);
      controller.mount().catch((error) => {
        console.error(`[${PLUGIN_ID}] Failed to mount source doodle controller`, error);
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

  installHeaderButton(controller) {
    const view = controller.view;
    let state = this.headerActions.get(view);

    if (!state || !state.button?.isConnected) {
      state = {
        button: null,
        controller: null,
        controllers: new Set(),
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
          button.classList.add("note-doodle-fallback-button");
        }
      }

      button.addEventListener("pointerdown", state.pointerDownHandler);
      button.addEventListener("pointerup", state.pointerUpHandler);
      button.addEventListener("pointercancel", state.pointerUpHandler);
      button.addEventListener("pointerleave", state.pointerUpHandler);

      state.button = button;
      this.headerActions.set(view, state);
    }

    state.controllers ??= new Set();
    state.controllers.add(controller);
    state.controller = this.pickHeaderController(view, state, controller);
    state.button._noteDoodleController = controller;
    state.button.classList.add("note-doodle-header-button");
    state.button.setAttribute("aria-label", "Edit text / draw");
    state.button.setAttribute("title", "Edit text / draw");
    state.button.classList.toggle("is-active", controller.active);
    this.cleanupHeaderButtons(view, state.button);

    return state.button;
  }

  releaseHeaderButton(controller) {
    const state = this.headerActions.get(controller.view);
    if (!state) {
      return;
    }

    state.controllers?.delete(controller);
    if (state.controller === controller) {
      state.controller = this.pickHeaderController(controller.view, state);
    }

    if (state.controller) {
      state.button._noteDoodleController = state.controller;
      state.button.classList.toggle("is-active", state.controller.active);
      return;
    }

    state.button?._noteDoodleController && delete state.button._noteDoodleController;
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
      state.button._noteDoodleController = controller;
      state.button.classList.toggle("is-active", controller.active);
    }

    return controller;
  }

  pickHeaderController(view, state, preferred = null) {
    const controllers = Array.from(state.controllers || [])
      .filter((controller) => controller?.previewEl?.isConnected && controller.view === view);
    const currentMode = isSourceMode(view) ? "source" : "preview";
    const preferredLive = preferred && controllers.includes(preferred) ? preferred : null;

    return controllers.find((controller) => controller.surfaceType === currentMode)
      || preferredLive
      || controllers.find((controller) => controller.active)
      || controllers[0]
      || null;
  }

  cleanupHeaderButtons(view, keepButton = null) {
    view?.containerEl
      ?.querySelectorAll(".note-doodle-header-button")
      .forEach((button) => {
        if (button !== keepButton) {
          button.remove();
        }
      });
  }

  async ensureDoodleDir() {
    const base = this.app.vault.configDir;
    const pluginDir = `${base}/plugins/${PLUGIN_ID}`;
    const doodleDir = `${pluginDir}/doodles`;

    await this.ensureFolder(`${base}/plugins`);
    await this.ensureFolder(pluginDir);
    await this.ensureFolder(doodleDir);

    return doodleDir;
  }

  async ensureFolder(path) {
    const adapter = this.app.vault.adapter;
    const parts = normalizeVaultPath(path).split("/").filter(Boolean);
    let current = "";

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!(await adapter.exists(current))) {
        await adapter.mkdir(current);
      }
    }
  }

  doodlePathForFile(file) {
    const encoded = file.path
      .replace(/\\/g, "/")
      .replace(/[^a-zA-Z0-9._/-]/g, "_")
      .replace(/\//g, "__");

    return `${this.app.vault.configDir}/plugins/${DOODLE_DIR}/${encoded}.json`;
  }

  debugLogPath() {
    return `${this.app.vault.configDir}/plugins/${PLUGIN_ID}/${DEBUG_LOG_FILE}`;
  }

  async appendDebugLog(entry) {
    try {
      await this.ensureDoodleDir();

      const path = this.debugLogPath();
      const adapter = this.app.vault.adapter;
      const line = JSON.stringify({
        time: new Date().toISOString(),
        ...entry,
      });
      let lines = [];

      if (await adapter.exists(path)) {
        lines = String(await adapter.read(path) || "")
          .split(/\r?\n/)
          .filter(Boolean)
          .slice(-(DEBUG_LOG_LIMIT - 1));
      }

      lines.push(line);
      await adapter.write(path, `${lines.join("\n")}\n`);
    } catch (error) {
      console.error(`[${PLUGIN_ID}] Failed to write debug log`, error);
    }
  }

  async readDoodles(file) {
    const path = this.doodlePathForFile(file);
    const adapter = this.app.vault.adapter;

    if (!(await adapter.exists(path))) {
      return createEmptyDoodleData(file);
    }

    try {
      return normalizeDoodleData(JSON.parse(await adapter.read(path)), file);
    } catch (error) {
      console.error(`[${PLUGIN_ID}] Failed to read doodle file`, error);
      return createEmptyDoodleData(file);
    }
  }

  scheduleDoodleSave(file, data) {
    const path = this.doodlePathForFile(file);
    const previous = this.saveTimers.get(path);

    if (previous) {
      clearTimeout(previous);
    }

    const timer = setTimeout(() => {
      this.saveTimers.delete(path);
      compactDoodleData(data);
      this.writeDoodles(file, data).catch((error) => {
        console.error(`[${PLUGIN_ID}] Failed to save doodle file`, error);
        new Notice("Failed to save doodle data.");
      });
    }, 500);

    this.saveTimers.set(path, timer);
  }

  async writeDoodles(file, data) {
    await this.ensureDoodleDir();

    const path = this.doodlePathForFile(file);
    const body = JSON.stringify({
      ...data,
      sourcePath: file.path,
      updatedAt: new Date().toISOString(),
    }, null, 2);

    await this.app.vault.adapter.write(path, body);
  }

  getPluginAssetPath(relativePath) {
    const pluginDir = this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
    return normalizePath(`${pluginDir}/${relativePath}`);
  }

  async getOptionalAssetResourcePath(relativePath) {
    const assetPath = this.getPluginAssetPath(relativePath);
    if (!(await this.app.vault.adapter.exists(assetPath))) {
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
    state.targetPromise = this.resolveTextEditTarget(file, originalText, element)
      .then((target) => {
        state.target = target;
        return target;
      })
      .catch((error) => {
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
      target: summarizeTarget(target),
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
      state.targetPromise = this.resolveTextEditTarget(file, originalText, element)
        .then((target) => {
          state.target = target;
          return target;
        })
        .catch((error) => {
          console.error(`[${PLUGIN_ID}] Failed to resolve text edit target`, error);
          return null;
        });
    }

    if (state.timer) {
      window.clearTimeout(state.timer);
    }

    element.addClass("note-doodle-saving");
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
      state.targetPromise = this.resolveTextEditTarget(file, originalText, element)
        .then((target) => {
          state.target = target;
          return target;
        })
        .catch((error) => {
          console.error(`[${PLUGIN_ID}] Failed to resolve text edit target`, error);
          return null;
        });
    }

    if (state.timer) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }

    element.addClass("note-doodle-saving");
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
        saveLogged: false,
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
      element.removeClass("note-doodle-saving");
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
        state.target,
      );

      if (result.changed) {
        state.baselineText = latestText;
        state.target = result.target || state.target;
        state.warningLogged = false;
        state.saveBlocked = false;
        element.dataset.noteDoodleOriginal = latestText;
        element.removeClass("note-doodle-save-failed");

        if (!state.saveLogged) {
          this.appendDebugLog({
            event: "save-ok",
            file: state.file?.path,
            sourceInfo: summarizeSourceInfo(state.latestSourceInfo),
            target: summarizeTarget(state.target),
            original: shortText(baselineText),
            edited: shortText(latestText),
          });
          state.saveLogged = true;
        }
      } else {
        element.addClass("note-doodle-save-failed");
        state.saveBlocked = true;
        if (!state.warningLogged) {
          console.warn(`[${PLUGIN_ID}] Could not find the original block to update`, {
            path: state.file?.path,
            sourceInfo: state.latestSourceInfo,
            originalLength: String(baselineText || "").length,
            editedLength: String(latestText || "").length,
          });
          this.appendDebugLog({
            event: "save-miss",
            file: state.file?.path,
            sourceInfo: summarizeSourceInfo(state.latestSourceInfo),
            target: summarizeTarget(state.target),
            original: shortText(baselineText),
            edited: shortText(latestText),
          });
          state.warningLogged = true;
        }
      }
    } catch (error) {
      console.error(`[${PLUGIN_ID}] Failed to save text block`, error);
      element.addClass("note-doodle-save-failed");
      this.appendDebugLog({
        event: "save-error",
        file: state.file?.path,
        sourceInfo: summarizeSourceInfo(state.latestSourceInfo),
        target: summarizeTarget(state.target),
        error: String(error?.message || error),
      });
    } finally {
      state.saving = false;
    }

    if (state.pending || normalizeRenderedText(state.baselineText) !== normalizeRenderedText(state.latestText)) {
      if (state.saveBlocked) {
        element.removeClass("note-doodle-saving");
        return;
      }

      state.pending = false;
      state.timer = window.setTimeout(() => {
        state.timer = null;
        this.flushTextSave(element);
      }, TEXT_SAVE_DELAY_MS);
      return;
    }

    element.removeClass("note-doodle-saving");
  }

  async saveTextBlock(file, originalText, editedText, sourceInfo, target) {
    const normalizedOriginal = normalizeRenderedText(originalText);
    const normalizedEdited = normalizeRenderedText(editedText);

    if (!normalizedOriginal || normalizedOriginal === normalizedEdited) {
      return { changed: true, target };
    }

    const source = await this.app.vault.read(file);
    const match = resolveLockedTarget(source, target, originalText)
      || resolveSourceEditTarget(source, sourceInfo, originalText);

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
      text: replacement,
    }, sourceInfo, editedText);

    if (currentText !== replacement) {
      await this.app.vault.modify(file, `${source.slice(0, start)}${replacement}${source.slice(end)}`);
    }

    return { changed: true, target: nextTarget };
  }
};

class PreviewDoodleController {
  constructor(plugin, previewEl, view, file, options = {}) {
    this.plugin = plugin;
    this.previewEl = previewEl;
    this.view = view;
    this.file = file;
    this.allowTextEdit = options.allowTextEdit !== false;
    this.surfaceType = options.surfaceType || "preview";
    this.active = false;
    this.doodleData = {
      version: 1,
      sourcePath: file.path,
      strokes: [],
      updatedAt: null,
    };
    this.currentStroke = null;
    this.currentEditor = null;
    this.brushMode = BRUSH_PEN;
    this.brushSettings = {
      [BRUSH_PEN]: {
        color: "#e53935",
        width: 3,
        opacity: DEFAULT_PEN_OPACITY,
        count: 1,
      },
      [BRUSH_WATERCOLOR]: {
        color: "#3b82f6",
        width: 9,
        opacity: 0.34,
        count: 3,
      },
    };
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
    this.activePointerId = null;
    this.touchPointers = new Map();
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
    this.selectedStrokeIndexes = new Set();
    this.doodlesVisible = true;
    this.buttonLongPressed = false;
    this.buttonLongPressTimer = null;
    this.paletteOpen = false;
    this.canvasCssWidth = 1;
    this.canvasCssHeight = 1;
    this.renderFrameId = null;
    this.resizeFrameId = null;
    this.staticCanvas = document.createElement("canvas");
    this.staticCtx = null;
    this.staticCacheDirty = true;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onButtonClick = this.onButtonClick.bind(this);
    this.onButtonPointerDown = this.onButtonPointerDown.bind(this);
    this.onButtonPointerUp = this.onButtonPointerUp.bind(this);
    this.onDocumentPointerDown = this.onDocumentPointerDown.bind(this);
  }

  async mount() {
    cleanupDoodleUi(this.previewEl);
    this.previewEl._noteDoodleController = this;
    this.previewEl.addClass("note-doodle-shell");
    this.previewEl.toggleClass("is-note-doodle-source-shell", this.surfaceType === "source");

    this.button = this.createHeaderButton();

    this.toolbar = this.previewEl.createDiv({ cls: "note-doodle-toolbar" });
    this.penButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: "Pen" },
    });
    setIcon(this.penButton, "pen-line");
    this.penButton.addEventListener("click", () => this.setBrushMode(BRUSH_PEN));

    this.watercolorButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: "Watercolor brush" },
    });
    setIcon(this.watercolorButton, "paintbrush");
    this.watercolorButton.addEventListener("click", () => this.setBrushMode(BRUSH_WATERCOLOR));

    this.selectButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: "Select doodles" },
    });
    setIcon(this.selectButton, "mouse-pointer-2");
    this.selectButton.addEventListener("click", () => this.toggleSelectMode());

    this.undoButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: "Undo last doodle" },
    });
    setIcon(this.undoButton, "undo-2");
    this.undoButton.addEventListener("click", () => this.undoLastStroke());

    this.redoButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: "Redo doodle" },
    });
    setIcon(this.redoButton, "redo-2");
    this.redoButton.addEventListener("click", () => this.redoLastStroke());

    this.deleteButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: "Delete selected doodle" },
    });
    setIcon(this.deleteButton, "trash-2");
    this.deleteButton.addEventListener("click", () => this.deleteSelectedStroke());

    this.paletteButton = this.toolbar.createEl("button", {
      attr: { type: "button", title: "Pen settings" },
    });
    setIcon(this.paletteButton, "palette");
    this.paletteButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.togglePalettePanel();
    });

    this.palettePanel = this.previewEl.createDiv({ cls: "note-doodle-palette-panel" });
    this.colorInput = this.createPaletteInput("palette", "color", {
      type: "color",
      value: this.penColor,
      title: "Pen color",
    });
    this.colorInput.addEventListener("input", () => {
      this.currentBrushSettings().color = this.colorInput.value;
      this.syncCurrentBrushFields();
    });

    this.widthInput = this.createPaletteInput("circle", "width", {
      type: "range",
      value: String(this.penWidth),
      min: "1",
      max: "16",
      step: "1",
      title: "Pen width",
    });
    this.widthInput.addEventListener("input", () => {
      this.currentBrushSettings().width = Number(this.widthInput.value);
      this.syncCurrentBrushFields();
    });

    this.opacityInput = this.createPaletteInput("droplets", "opacity", {
      type: "range",
      value: String(this.penOpacity),
      min: "0.1",
      max: "1",
      step: "0.05",
      title: "Pen opacity",
    });
    this.opacityInput.addEventListener("input", () => {
      this.currentBrushSettings().opacity = clamp(Number(this.opacityInput.value), 0.1, 1);
      this.syncCurrentBrushFields();
    });

    this.countInput = this.createPaletteInput("layers-3", "count", {
      type: "range",
      value: String(this.penCount),
      min: "1",
      max: String(MAX_PEN_COUNT),
      step: "1",
      title: "Pen count",
    });
    this.countInput.addEventListener("input", () => {
      this.currentBrushSettings().count = clamp(Math.round(Number(this.countInput.value)), 1, MAX_PEN_COUNT);
      this.syncCurrentBrushFields();
    });

    this.canvas = this.previewEl.createEl("canvas", { cls: "note-doodle-canvas" });
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("lostpointercapture", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("resize", this.onResize);
    document.addEventListener("pointerdown", this.onDocumentPointerDown, true);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(this.previewEl);
    }

    this.doodleData = await this.plugin.readDoodles(this.file);
    this.updateToolButtons();
    this.syncPaletteInputs();
    this.resizeCanvas();
    this.render();
    this.scheduleLayoutRefresh();
  }

  createPaletteInput(icon, cls, attr) {
    const row = this.palettePanel.createDiv({ cls: "note-doodle-palette-row" });
    const iconEl = row.createSpan({ cls: "note-doodle-palette-icon" });
    setIcon(iconEl, icon);
    return row.createEl("input", {
      cls: `note-doodle-${cls}`,
      attr,
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
    this.invalidateStaticCache();
    this.doodleData = await this.plugin.readDoodles(file);
    this.resizeCanvas();
    this.render();
  }

  destroy() {
    this.endTextEdit();
    this.clearButtonLongPress();
    this.cancelRenderFrame();
    this.cancelResizeFrame();
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("pointerdown", this.onDocumentPointerDown, true);
    this.plugin.releaseHeaderButton(this);
    this.toolbar?.remove();
    this.palettePanel?.remove();
    this.canvas?.remove();
    this.previewEl.removeClass("note-doodle-shell");
    this.previewEl.removeClass("is-doodle-active");
    this.previewEl.removeClass("is-doodle-hidden");
    this.previewEl.removeClass("is-select-mode");
    this.previewEl.removeClass("is-palette-open");
    this.previewEl.removeClass("is-watercolor-mode");
    this.previewEl.removeClass("is-note-doodle-source-shell");
    this.previewEl.removeClass("is-resizing-selection");
    if (this.previewEl._noteDoodleController === this) {
      delete this.previewEl._noteDoodleController;
    }
  }

  toggle() {
    this.active = !this.active;
    this.previewEl.toggleClass("is-doodle-active", this.active);
    this.button?.classList.toggle("is-active", this.active);

    if (!this.active) {
      this.endTextEdit();
      this.setPaletteOpen(false);
      this.cancelCurrentStroke();
      this.cancelSelectionDrag(true);
      this.cancelSelectedStrokeDrag(true);
    } else {
      this.scheduleLayoutRefresh();
    }
  }

  onResize() {
    this.scheduleResize();
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

  scheduleLayoutRefresh() {
    this.scheduleResize();
    window.requestAnimationFrame?.(() => this.scheduleResize());
    window.requestAnimationFrame?.(() => window.requestAnimationFrame?.(() => this.scheduleResize()));
    window.setTimeout(() => this.scheduleResize(), 80);
    window.setTimeout(() => this.scheduleResize(), 350);
  }

  updateFloatingControlsPosition() {
    if (!this.button || !this.toolbar) {
      return;
    }

    const hostRect = (this.view?.containerEl || this.previewEl).getBoundingClientRect();
    const buttonRect = this.button.getBoundingClientRect();
    const buttonVisible = buttonRect.width > 0
      && buttonRect.height > 0
      && buttonRect.bottom > 0
      && buttonRect.top < window.innerHeight;
    const anchorRight = hostRect.right > 0 ? hostRect.right : (buttonVisible ? buttonRect.right : window.innerWidth);
    const anchorBottom = buttonVisible ? buttonRect.bottom : hostRect.top + 40;
    const right = clamp(window.innerWidth - anchorRight + 10, 8, Math.max(8, window.innerWidth - 48));
    const top = clamp(anchorBottom + 10, Math.max(42, hostRect.top + 42), Math.max(42, window.innerHeight - 48));

    this.previewEl.style.setProperty("--note-doodle-toolbar-right", `${Math.round(right)}px`);
    this.previewEl.style.setProperty("--note-doodle-toolbar-top", `${Math.round(top)}px`);
    this.previewEl.style.setProperty("--note-doodle-palette-top", `${Math.round(top + 42)}px`);
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
    if (this.widthInput) {
      this.widthInput.value = String(settings.width);
    }
    if (this.opacityInput) {
      this.opacityInput.value = String(settings.opacity);
    }
    if (this.countInput) {
      this.countInput.value = String(settings.count);
    }
  }

  updateToolButtons() {
    this.penButton?.classList.toggle("is-active", this.toolMode === TOOL_DRAW && this.brushMode === BRUSH_PEN);
    this.watercolorButton?.classList.toggle("is-active", this.toolMode === TOOL_DRAW && this.brushMode === BRUSH_WATERCOLOR);
    this.selectButton?.classList.toggle("is-active", this.toolMode === TOOL_SELECT);
    this.previewEl.toggleClass("is-watercolor-mode", this.toolMode === TOOL_DRAW && this.brushMode === BRUSH_WATERCOLOR);
  }

  toggleSelectMode() {
    this.toolMode = this.toolMode === TOOL_SELECT ? TOOL_DRAW : TOOL_SELECT;
    this.previewEl.toggleClass("is-select-mode", this.toolMode === TOOL_SELECT);
    this.updateToolButtons();
    this.endTextEdit();
    this.cancelCurrentStroke();
    this.cancelSelectionDrag(true);
    this.render();
  }

  togglePalettePanel() {
    this.setPaletteOpen(!this.paletteOpen);
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
    if (!this.paletteOpen) {
      return;
    }

    const target = event.target;
    if (this.palettePanel?.contains(target) || this.paletteButton?.contains(target)) {
      return;
    }

    this.setPaletteOpen(false);
  }

  onButtonPointerDown() {
    this.clearButtonLongPress();
    this.buttonLongPressTimer = window.setTimeout(() => {
      this.buttonLongPressed = true;
      this.toggleDoodlesVisible();
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

    this.toggle();
  }

  clearButtonLongPress() {
    if (this.buttonLongPressTimer) {
      window.clearTimeout(this.buttonLongPressTimer);
      this.buttonLongPressTimer = null;
    }
  }

  toggleDoodlesVisible() {
    this.doodlesVisible = !this.doodlesVisible;
    this.previewEl.toggleClass("is-doodle-hidden", !this.doodlesVisible);
    this.button?.setAttribute(
      "title",
      this.doodlesVisible ? "Edit text / draw" : "Edit text / draw (doodles hidden)",
    );
  }

  resizeCanvas() {
    const rect = this.previewEl.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.previewEl.scrollWidth));
    const height = Math.max(1, Math.round(this.previewEl.scrollHeight));
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

    if (rect.width > 0) {
      this.canvas.style.minWidth = `${Math.round(rect.width)}px`;
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
    const point = this.eventToPoint(event);
    const hitStrokeIndex = this.findStrokeAt(point);
    const resizeHandle = this.findSelectionHandleAt(point);

    if (resizeHandle) {
      this.startSelectedStrokeResize(event, point, resizeHandle);
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
    this.activePointerId = event.pointerId;

    if (!editable) {
      this.endTextEdit();
    }

    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture is best-effort; drawing still works without it.
    }

    const brush = this.currentBrushSettings();
    this.currentStroke = {
      brush: this.brushMode,
      color: brush.color,
      width: brush.width,
      opacity: brush.opacity,
      count: brush.count,
      points: [this.pointerStartPoint],
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

    if (!this.active || !this.pointerDown || !this.currentStroke || event.pointerId !== this.activePointerId) {
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

    if (!this.active || !this.pointerDown || !this.currentStroke || event.pointerId !== this.activePointerId) {
      return;
    }

    this.addPointerSamples(event);

    this.pointerDown = false;
    const movedDistance = this.pointerStartClient
      ? pointerDistance(this.pointerStartClient, { x: event.clientX, y: event.clientY })
      : 0;
    const editable = this.pointerStartEditable;

    if (!this.didMove || movedDistance <= SELECT_TAP_DISTANCE || this.currentStroke.points.length < 2) {
      const point = this.pointerStartPoint || this.eventToPoint(event);
      this.currentStroke = null;
      if (editable) {
        this.startTextEdit(editable, this.pointerStartClient || { x: event.clientX, y: event.clientY });
      } else {
        this.setSelectedStrokes(this.findStrokeAt(point));
      }
    } else {
      this.doodleData.strokes.push(this.currentStroke);
      this.clearSelectedStrokes();
      this.redoStack = [];
      this.invalidateStaticCache();
      this.plugin.scheduleDoodleSave(this.file, this.doodleData);
      this.currentStroke = null;
    }

    try {
      if (this.canvas.hasPointerCapture?.(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    } catch (_) {
      // Ignore capture release errors from already-cancelled pointers.
    }

    this.pointerStartPoint = null;
    this.pointerStartClient = null;
    this.pointerStartEditable = null;
    this.activePointerId = null;
    this.didMove = false;
    this.render();
    event.preventDefault();
    event.stopPropagation();
  }

  onWheel(event) {
    if (!this.active) {
      return;
    }

    const scroller = findScrollableAncestor(this.previewEl);
    if (!scroller) {
      return;
    }

    scroller.scrollBy({
      left: event.deltaX,
      top: event.deltaY,
      behavior: "auto",
    });
    event.preventDefault();
    event.stopPropagation();
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
        behavior: "auto",
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
      y: y / this.touchPointers.size,
    };
  }

  cancelCurrentStroke() {
    if (this.activePointerId !== null) {
      try {
        if (this.canvas.hasPointerCapture?.(this.activePointerId)) {
          this.canvas.releasePointerCapture(this.activePointerId);
        }
      } catch (_) {
        // Ignore release errors from already-cancelled pointers.
      }
    }

    this.currentStroke = null;
    this.pointerDown = false;
    this.pointerStartPoint = null;
    this.pointerStartClient = null;
    this.pointerStartEditable = null;
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
      // Pointer capture is best-effort; selection still works without it.
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
    const movedDistance = this.pointerStartClient
      ? pointerDistance(this.pointerStartClient, { x: event.clientX, y: event.clientY })
      : 0;

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
      this.doodleData.strokes[index].points.map((strokePoint) => ({ ...strokePoint })),
    ]));
    this.dragStrokeMoved = false;
    this.dragStrokeHitIndex = hitIndex;
    this.pointerStartClient = { x: event.clientX, y: event.clientY };
    this.activePointerId = event.pointerId;
    this.previewEl.addClass("is-moving-selection");

    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture is best-effort; dragging still works without it.
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
      this.canvasHeight(),
    );

    if (movedDistance > SELECT_TAP_DISTANCE) {
      this.dragStrokeMoved = true;
    }

    for (const [index, points] of this.dragStrokeOriginalPoints.entries()) {
      const stroke = this.doodleData.strokes[index];
      if (!stroke) {
        continue;
      }

      stroke.points = points.map((strokePoint) => ({
        ...strokePoint,
        x: clamp(strokePoint.x + dx, 0, 1),
        y: clamp(strokePoint.y + dy, 0, 1),
      }));
    }

    this.requestRender();
    event.preventDefault();
    event.stopPropagation();
  }

  finishSelectedStrokeDrag(event) {
    if (this.dragStrokeMoved) {
      this.redoStack = [];
      this.plugin.scheduleDoodleSave(this.file, this.doodleData);
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
        const stroke = this.doodleData.strokes[index];
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
        width: this.doodleData.strokes[index].width || this.penWidth,
        points: this.doodleData.strokes[index].points.map((strokePoint) => ({ ...strokePoint })),
      },
    ]));
    this.resizeSelectionMoved = false;
    this.pointerStartClient = { x: event.clientX, y: event.clientY };
    this.activePointerId = event.pointerId;
    this.previewEl.addClass("is-resizing-selection");

    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture is best-effort; resizing still works without it.
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
      this.canvasHeight(),
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

    const nextByIndex = new Map();
    for (const [index, original] of originalStrokes.entries()) {
      nextByIndex.set(index, {
        width: clamp((original.width || this.penWidth) * strokeScale, 0.5, 80),
        points: original.points.map((strokePoint) => ({
          x: anchor.x + (strokePoint.x - anchor.x) * scaleX,
          y: anchor.y + (strokePoint.y - anchor.y) * scaleY,
        })),
      });
    }

    shiftNormalizedStrokesInsideCanvas(nextByIndex);

    for (const [index, next] of nextByIndex.entries()) {
      const stroke = this.doodleData.strokes[index];
      if (!stroke) {
        continue;
      }

      stroke.width = next.width;
      stroke.points = next.points.map((strokePoint) => ({
        x: clamp(strokePoint.x, 0, 1),
        y: clamp(strokePoint.y, 0, 1),
      }));
    }
  }

  finishSelectedStrokeResize(event) {
    if (this.resizeSelectionMoved) {
      this.redoStack = [];
      this.plugin.scheduleDoodleSave(this.file, this.doodleData);
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
        const stroke = this.doodleData.strokes[index];
        if (stroke) {
          stroke.width = original.width;
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
      // Ignore capture release errors from already-cancelled pointers.
    }
  }

  addPointerSamples(event) {
    const samples = typeof event.getCoalescedEvents === "function"
      ? event.getCoalescedEvents()
      : null;
    const events = samples?.length ? samples : [event];

    for (const sample of events) {
      if (this.pointerStartClient && pointerDistance(this.pointerStartClient, {
        x: sample.clientX,
        y: sample.clientY,
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

    if (distance <= DOODLE_MIN_POINT_DISTANCE_PX) {
      return;
    }

    const steps = Math.max(1, Math.ceil(distance / DOODLE_INTERPOLATION_STEP_PX));

    for (let index = 1; index <= steps; index += 1) {
      const ratio = index / steps;
      points.push({
        x: from.x + (point.x - from.x) * ratio,
        y: from.y + (point.y - from.y) * ratio,
        t: Math.round((from.t || Date.now()) + ((point.t || Date.now()) - (from.t || Date.now())) * ratio),
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
      t: Date.now(),
    };
  }

  pointToCanvas(point) {
    return {
      x: point.x * this.canvasWidth(),
      y: point.y * this.canvasHeight(),
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

    this.ctx.clearRect(0, 0, this.canvasWidth(), this.canvasHeight());
    this.ensureStaticCache();
    if (this.staticCanvas.width > 0 && this.staticCanvas.height > 0) {
      this.ctx.drawImage(this.staticCanvas, 0, 0, this.canvasWidth(), this.canvasHeight());
    }

    for (const [index, stroke] of this.doodleData.strokes.entries()) {
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
    for (const [index, stroke] of this.doodleData.strokes.entries()) {
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

  drawStrokeOn(ctx, stroke, alpha = 1) {
    if (!stroke.points.length) {
      return;
    }

    if ((stroke.brush || BRUSH_PEN) === BRUSH_WATERCOLOR) {
      this.drawWatercolorStrokeOn(ctx, stroke, alpha);
      return;
    }

    const count = clamp(Math.round(Number(stroke.count || 1)), 1, MAX_PEN_COUNT);
    const opacity = clamp(Number(stroke.opacity ?? DEFAULT_PEN_OPACITY), 0.1, 1);
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

  drawWatercolorStroke(stroke, alpha = 1) {
    this.drawWatercolorStrokeOn(this.ctx, stroke, alpha);
  }

  drawWatercolorStrokeOn(ctx, stroke, alpha = 1) {
    if (!stroke.points.length) {
      return;
    }

    const width = Math.max(2, stroke.width || this.penWidth);
    const opacity = clamp(Number(stroke.opacity ?? 0.34), 0.08, 1);
    const layers = [
      { width: width * 2.25, opacity: 0.12 },
      { width: width * 1.45, opacity: 0.18 },
      { width: width * 0.78, opacity: 0.26 },
    ];

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.color || this.penColor;

    for (const layer of layers) {
      ctx.globalAlpha = alpha * opacity * layer.opacity;
      ctx.lineWidth = layer.width;
      ctx.beginPath();
      const first = this.pointToCanvas(stroke.points[0]);
      ctx.moveTo(first.x, first.y);

      for (let pointIndex = 1; pointIndex < stroke.points.length; pointIndex += 1) {
        const next = this.pointToCanvas(stroke.points[pointIndex]);
        ctx.lineTo(next.x, next.y);
      }

      ctx.stroke();
    }

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
        SELECT_RESIZE_HANDLE_SIZE,
      );
      this.ctx.strokeRect(
        handle.x - SELECT_RESIZE_HANDLE_SIZE / 2,
        handle.y - SELECT_RESIZE_HANDLE_SIZE / 2,
        SELECT_RESIZE_HANDLE_SIZE,
        SELECT_RESIZE_HANDLE_SIZE,
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

    for (let index = this.doodleData.strokes.length - 1; index >= 0; index -= 1) {
      const stroke = this.doodleData.strokes[index];
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

    for (let index = 0; index < this.doodleData.strokes.length; index += 1) {
      const stroke = this.doodleData.strokes[index];
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
      normalized
        .map((index) => Number(index))
        .filter((index) => Number.isInteger(index) && index >= 0 && index < this.doodleData.strokes.length),
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
      return Array.from(this.selectedStrokeIndexes)
        .filter((index) => index >= 0 && index < this.doodleData.strokes.length)
        .sort((a, b) => a - b);
    }

    if (this.selectedStrokeIndex >= 0 && this.selectedStrokeIndex < this.doodleData.strokes.length) {
      return [this.selectedStrokeIndex];
    }

    return [];
  }

  isStrokeSelected(index) {
    return this.selectedStrokeIndexes.has(index)
      || (!this.selectedStrokeIndexes.size && this.selectedStrokeIndex === index);
  }

  getSelectedStrokeBounds() {
    const indexes = this.getSelectedStrokeIndexes();
    let result = null;

    for (const index of indexes) {
      const bounds = getStrokeBounds(this.doodleData.strokes[index], this.canvasWidth(), this.canvasHeight());
      if (!bounds) {
        continue;
      }

      result = result
        ? {
            minX: Math.min(result.minX, bounds.minX),
            maxX: Math.max(result.maxX, bounds.maxX),
            minY: Math.min(result.minY, bounds.minY),
            maxY: Math.max(result.maxY, bounds.maxY),
          }
        : { ...bounds };
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
      maxY: clamp(bounds.maxY / height, 0, 1),
    };
  }

  getSelectedStrokeMaxWidth() {
    return this.getSelectedStrokeIndexes()
      .map((index) => this.doodleData.strokes[index]?.width || this.penWidth)
      .reduce((max, width) => Math.max(max, width), this.penWidth);
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
      height: bounds.maxY - bounds.minY + padding * 2,
    };
  }

  findSelectionHandleAt(point) {
    const rect = this.getSelectedFrameCanvasRect();
    if (!rect) {
      return null;
    }

    const hitPoint = this.pointToCanvas(point);
    for (const handle of getSelectionHandlePointsFromRect(rect)) {
      if (Math.abs(hitPoint.x - handle.x) <= SELECT_RESIZE_HANDLE_HIT_RADIUS
        && Math.abs(hitPoint.y - handle.y) <= SELECT_RESIZE_HANDLE_HIT_RADIUS) {
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

    return hitPoint.x >= rect.x
      && hitPoint.x <= rect.x + rect.width
      && hitPoint.y >= rect.y
      && hitPoint.y <= rect.y + rect.height;
  }

  startTextEdit(element, clientPoint = null) {
    if (this.currentEditor === element) {
      return;
    }

    this.endTextEdit();

    this.currentEditor = element;
    element.dataset.noteDoodleOriginal = element.innerText;
    this.plugin.prepareTextEditState(this.file, element.innerText, element);
    element.contentEditable = "true";
    element.spellcheck = true;
    element.addClass("note-doodle-editing");
    element.focus();

    placeCaretInEditable(element, clientPoint);

    const onInput = () => {
      this.plugin.scheduleTextSave(
        this.file,
        element.dataset.noteDoodleOriginal || "",
        element.innerText,
        element,
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

    element._noteDoodleCleanup = () => {
      element.removeEventListener("input", onInput);
      element.removeEventListener("keydown", onKeyDown);
      element.removeEventListener("blur", onBlur);
    };

    element.addEventListener("input", onInput);
    element.addEventListener("keydown", onKeyDown);
    element.addEventListener("blur", onBlur);
  }

  endTextEdit() {
    const element = this.currentEditor;
    if (!element) {
      return;
    }

    const original = element.dataset.noteDoodleOriginal || "";
    const edited = element.innerText;

    if (normalizeRenderedText(original) !== normalizeRenderedText(edited)) {
      this.plugin.scheduleTextSaveNow(this.file, original, edited, element);
    }

    element._noteDoodleCleanup?.();
    delete element._noteDoodleCleanup;
    delete element.dataset.noteDoodleOriginal;
    element.contentEditable = "false";
    element.removeClass("note-doodle-editing");
    this.currentEditor = null;
  }

  undoLastStroke() {
    if (!this.doodleData.strokes.length) {
      return;
    }

    const removed = this.doodleData.strokes.pop();
    this.redoStack.push(removed);
    this.clearSelectedStrokes();
    this.plugin.scheduleDoodleSave(this.file, this.doodleData);
    this.render();
  }

  redoLastStroke() {
    if (!this.redoStack.length) {
      return;
    }

    const restored = this.redoStack.pop();
    this.doodleData.strokes.push(restored);
    this.setSelectedStrokes(this.doodleData.strokes.length - 1);
    this.plugin.scheduleDoodleSave(this.file, this.doodleData);
    this.render();
  }

  deleteSelectedStroke() {
    const indexes = this.getSelectedStrokeIndexes();
    if (!indexes.length) {
      return;
    }

    for (const index of indexes.slice().sort((a, b) => b - a)) {
      this.doodleData.strokes.splice(index, 1);
    }
    this.clearSelectedStrokes();
    this.redoStack = [];
    this.plugin.scheduleDoodleSave(this.file, this.doodleData);
    this.render();
  }
}

class NoteDoodlePreviewSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Note Doodle Preview" });

    const codesContainer = containerEl.createDiv({ cls: "note-doodle-settings-codes" });
    this.renderExtraCodes(codesContainer);
  }

  async renderExtraCodes(containerEl) {
    const codeItems = (
      await Promise.all(
        SETTINGS_EXTRA_CODE_ASSETS.map(async (asset) => {
          const src = await this.plugin.getOptionalAssetResourcePath(asset.path);
          return src ? { ...asset, src } : null;
        }),
      )
    ).filter(Boolean);

    if (!codeItems.length) {
      containerEl.remove();
      return;
    }

    containerEl.createDiv({
      cls: "note-doodle-settings-codes-title",
      text: "给我买咖啡 / Buy me a coffee",
    });
    containerEl.createDiv({
      cls: "note-doodle-settings-codes-subtitle",
      text: "如果这个插件帮到你，可以扫码打赏支持继续维护 / If this tool helps, tips are appreciated.",
    });

    const gridEl = containerEl.createDiv({ cls: "note-doodle-settings-codes-grid" });
    for (const item of codeItems) {
      const codeEl = gridEl.createDiv({ cls: "note-doodle-settings-code" });
      const imageEl = codeEl.createEl("img", {
        cls: "note-doodle-settings-code-image",
        attr: {
          alt: item.label,
          loading: "lazy",
          src: item.src,
        },
      });
      imageEl.src = item.src;
      codeEl.createDiv({
        cls: "note-doodle-settings-code-label",
        text: item.label,
      });
    }
  }
}

function findEditableTarget(target, previewEl) {
  if (!target || !previewEl.contains(target)) {
    return null;
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

function normalizeRenderedText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function placeCaretInEditable(element, clientPoint) {
  const selection = window.getSelection?.();
  if (!selection) {
    return;
  }

  const range = rangeFromClientPoint(element, clientPoint) || rangeAtEditableEnd(element);
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

  if (!range || !element.contains(range.startContainer)) {
    return null;
  }

  range.collapse(true);
  return range;
}

function rangeAtEditableEnd(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  return range;
}

function normalizeMarkdownBlock(value) {
  let text = String(value || "").trim();

  text = text
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

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
          text: buffer.replace(/\s+$/, ""),
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
          text: buffer.replace(/\s+$/, ""),
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
      text: buffer.replace(/\s+$/, ""),
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
      element.dataset.noteDoodleDataLine = String(dataLine);
      element.dataset.noteDoodleDataLineScope = Number.isFinite(ownDataLine) ? "self" : "ancestor";
    }

    if (!info) {
      continue;
    }

    if (typeof info.text === "string" && info.text.trim()) {
      element._noteDoodleSourceText = info.text;
    }

    if (Number.isFinite(info.lineStart)) {
      element.dataset.noteDoodleLineStart = String(info.lineStart);
    }

    if (Number.isFinite(info.lineEnd)) {
      element.dataset.noteDoodleLineEnd = String(info.lineEnd);
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

function findRootPreviewForView(view) {
  const previews = Array.from(view?.containerEl?.querySelectorAll(".markdown-preview-view") || []);
  return previews.find((preview) => !isEmbeddedPreview(preview)) || null;
}

function isSourceMode(view) {
  try {
    if (typeof view?.getMode === "function") {
      return view.getMode() === "source";
    }
  } catch (_) {
    // Fall through to state/DOM checks.
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

  return container.querySelector(".markdown-source-view .cm-scroller")
    || container.querySelector(".markdown-source-view .cm-editor")
    || container.querySelector(".markdown-source-view")
    || null;
}

function isEmbeddedPreview(preview) {
  return Boolean(preview.closest(".markdown-embed, .markdown-embed-content, .internal-embed, .external-embed"));
}

function cleanupAllDoodleHeaderButtons() {
  document
    .querySelectorAll(".note-doodle-header-button")
    .forEach((button) => button.remove());
}

function cleanupDoodleUi(preview) {
  preview.querySelectorAll(".note-doodle-button, .note-doodle-fallback-button, .note-doodle-toolbar, .note-doodle-palette-panel, .note-doodle-canvas")
    .forEach((element) => element.remove());
  preview.classList.remove("note-doodle-shell", "is-doodle-active", "is-doodle-hidden", "is-select-mode", "is-palette-open", "is-watercolor-mode", "is-selecting-strokes", "is-resizing-selection");
}

function normalizeVaultPath(path) {
  return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function createEmptyDoodleData(file) {
  return {
    version: 1,
    sourcePath: file.path,
    strokes: [],
    updatedAt: null,
  };
}

function normalizeDoodleData(data, file) {
  const strokes = Array.isArray(data?.strokes) ? data.strokes : [];

  return {
    version: Number.isFinite(data?.version) ? data.version : 1,
    sourcePath: file.path,
    strokes: strokes
      .map(normalizeStroke)
      .map((stroke) => ({
        ...stroke,
        points: compactStrokePoints(stroke.points),
      }))
      .filter((stroke) => stroke.points.length),
    updatedAt: data?.updatedAt || null,
  };
}

function normalizeStroke(stroke) {
  const points = Array.isArray(stroke?.points) ? stroke.points : [];

  return {
    brush: stroke?.brush === BRUSH_WATERCOLOR ? BRUSH_WATERCOLOR : BRUSH_PEN,
    color: typeof stroke?.color === "string" ? stroke.color : "#e53935",
    width: Number.isFinite(Number(stroke?.width)) ? Number(stroke.width) : 3,
    opacity: clamp(Number(stroke?.opacity ?? DEFAULT_PEN_OPACITY), 0.1, 1),
    count: clamp(Math.round(Number(stroke?.count) || 1), 1, MAX_PEN_COUNT),
    points: points
      .map((point) => ({
        x: clamp(Number(point?.x), 0, 1),
        y: clamp(Number(point?.y), 0, 1),
        t: Number.isFinite(Number(point?.t)) ? Number(point.t) : Date.now(),
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  };
}

function compactDoodleData(data) {
  if (!Array.isArray(data?.strokes)) {
    return data;
  }

  data.strokes = data.strokes.map((stroke) => ({
    ...stroke,
    points: compactStrokePoints(stroke.points),
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
    const distance = pointDistanceOnCanvas(last, point, 1, 1) * 1000;

    if (distance >= DOODLE_COMPACT_DISTANCE_PX) {
      compacted.push(point);
    }
  }

  compacted.push(points[points.length - 1]);
  return compacted;
}

function getSourceInfo(element) {
  const lineStart = parseInteger(element.dataset.noteDoodleLineStart);
  const lineEnd = parseInteger(element.dataset.noteDoodleLineEnd);
  const dataLine = parseInteger(element.dataset.noteDoodleDataLine)
    ?? parseDataLine(element.closest("[data-line]")?.getAttribute("data-line"));
  const dataLineScope = element.dataset.noteDoodleDataLineScope || (
    Number.isFinite(parseDataLine(element.getAttribute("data-line"))) ? "self" : "ancestor"
  );
  const exactDataLine = dataLineScope === "self" ? dataLine : null;
  const resolvedStart = exactDataLine ?? lineStart ?? null;
  const resolvedEnd = exactDataLine ?? lineEnd ?? resolvedStart;

  return {
    lineStart: resolvedStart,
    lineEnd: resolvedEnd,
    dataLine,
    dataLineScope,
    sourceText: typeof element._noteDoodleSourceText === "string" ? element._noteDoodleSourceText : null,
  };
}

function resolveSourceEditTarget(source, sourceInfo, originalText) {
  const normalizedOriginal = normalizeRenderedText(originalText);

  if (!normalizedOriginal) {
    return null;
  }

  const blocks = collectMarkdownBlocks(source);
  const sourceLine = sourceInfo?.lineStart ?? (
    sourceInfo?.dataLineScope === "self" ? sourceInfo?.dataLine : null
  );
  let match = pickFromSectionText(source, sourceInfo, normalizedOriginal)
    || collectSourceLineBlock(source, sourceInfo, normalizedOriginal)
    || pickLineInSourceRange(source, sourceInfo, normalizedOriginal)
    || pickBlockInSourceRange(blocks, sourceInfo, normalizedOriginal)
    || pickBlockBySourceInfo(blocks, sourceInfo, normalizedOriginal);

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

    if (
      currentText === target.text
      || normalizedCurrent === normalizedBaseline
      || normalizedCurrent === target.normalizedText
    ) {
      return {
        ...target,
        text: currentText,
      };
    }
  }

  const exactIndex = findNearestTextIndex(source, target.text, target.start);
  if (exactIndex >= 0) {
    return {
      ...target,
      start: exactIndex,
      end: exactIndex + target.text.length,
      text: target.text,
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
      dataLine: sourceInfo?.dataLine ?? null,
    },
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
      text: section.text,
    };
  }

  return null;
}

function locateSectionRange(source, sourceInfo, sectionText) {
  const byLines = collectSourceLineRange(source, sourceInfo?.lineStart, sourceInfo?.lineEnd);

  if (byLines && (
    normalizeMarkdownBlock(byLines.text) === normalizeMarkdownBlock(sectionText)
    || normalizeMarkdownBlock(byLines.text).includes(normalizeMarkdownBlock(sectionText))
    || normalizeMarkdownBlock(sectionText).includes(normalizeMarkdownBlock(byLines.text))
  )) {
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
      text: source.slice(exactIndex, exactIndex + sectionText.length),
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
  const candidates = collectLineMatches(source, normalizedOriginal)
    .filter((match) => match.line >= start && match.line <= end);

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
    if (
      normalizedLine === normalizedOriginal
      || (normalizedLine && normalizedOriginal && normalizedLine.includes(normalizedOriginal))
      || isReasonableLineMatch(normalizedLine, normalizedOriginal)
    ) {
      matches.push({
        start,
        end,
        line: currentLine,
        endLine: currentLine,
        text: line,
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
    text: source.slice(start, end),
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
    end: match.end + offset,
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
  const lineStart = sourceInfo?.lineStart ?? (
    sourceInfo?.dataLineScope === "self" ? sourceInfo?.dataLine : null
  );

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
    primaryLine + 1,
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

    if (
      normalizedLine === normalizedOriginal
      || (normalizedLine && normalizedOriginal && normalizedLine.includes(normalizedOriginal))
      || isReasonableLineMatch(normalizedLine, normalizedOriginal)
    ) {
      return {
        start,
        end,
        line: currentLine,
        endLine: currentLine,
        text: line,
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
  return Number.isFinite(start)
    && Number.isFinite(end)
    && start >= 0
    && end >= start
    && end <= source.length;
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
    sourceTextSample: shortText(sourceInfo.sourceText),
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
    textSample: shortText(target.text),
  };
}

function shortText(value) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

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

function findScrollableAncestor(element) {
  let current = element;

  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY)
      && current.scrollHeight > current.clientHeight;
    const canScrollX = /(auto|scroll|overlay)/.test(style.overflowX)
      && current.scrollWidth > current.clientWidth;

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
    ((a?.y || 0) - (b?.y || 0)) * Math.max(1, height || 1),
  );
}

function getStrokeBounds(stroke, width, height) {
  if (!stroke?.points?.length) {
    return null;
  }

  const xs = stroke.points.map((point) => point.x * width);
  const ys = stroke.points.map((point) => point.y * height);

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function normalizeCanvasRect(a, b) {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

function rectsIntersect(a, b) {
  return a.minX <= b.maxX
    && a.maxX >= b.minX
    && a.minY <= b.maxY
    && a.maxY >= b.minY;
}

function getSelectionHandlePointsFromRect(rect) {
  return [
    { handle: "nw", x: rect.x, y: rect.y },
    { handle: "ne", x: rect.x + rect.width, y: rect.y },
    { handle: "sw", x: rect.x, y: rect.y + rect.height },
    { handle: "se", x: rect.x + rect.width, y: rect.y + rect.height },
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
      bounds = bounds
        ? {
            minX: Math.min(bounds.minX, point.x),
            minY: Math.min(bounds.minY, point.y),
            maxX: Math.max(bounds.maxX, point.x),
            maxY: Math.max(bounds.maxY, point.y),
          }
        : {
            minX: point.x,
            minY: point.y,
            maxX: point.x,
            maxY: point.y,
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
      y: point.y + dy,
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
    const angle = ((index - 1) / Math.max(1, count - 1)) * Math.PI * 2;
    offsets.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }

  return offsets;
}

function strokeHitTest(stroke, hitPoint, width, height, threshold) {
  const points = stroke.points.map((point) => ({
    x: point.x * width,
    y: point.y * height,
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
    y: start.y + t * dy,
  };

  return pointerDistance(point, projection);
}

function pickNearestBlock(candidates, sourceLine) {
  if (!candidates.length) {
    return null;
  }

  if (sourceLine === null || sourceLine === undefined) {
    return candidates[0];
  }

  return candidates
    .slice()
    .sort((a, b) => Math.abs(a.line - sourceLine) - Math.abs(b.line - sourceLine))[0];
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
    return edited
      .split("\n")
      .map((line) => `${quote[1]}${line}`)
      .join("\n");
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
