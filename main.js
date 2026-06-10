"use strict";

const {
  MarkdownView,
  Notice,
  Plugin,
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
const DOODLE_INTERPOLATION_STEP_PX = 2;
const DOODLE_MIN_POINT_DISTANCE_PX = 0.35;
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
    this.saveTimers = new Map();
    this.textSaveStates = new WeakMap();

    this.addCommand({
      id: "toggle-note-doodle-preview",
      name: "Toggle preview edit and doodle mode",
      callback: () => this.toggleActiveController(),
    });

    this.registerMarkdownPostProcessor((el, ctx) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || !view.file || !ctx.sourcePath || view.file.path !== ctx.sourcePath) {
        return;
      }

      annotateEditableElements(el, ctx);

      const preview = el.closest(".markdown-preview-view");
      if (!preview) {
        return;
      }

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
    for (const timer of this.saveTimers.values()) {
      clearTimeout(timer);
    }
    this.saveTimers.clear();
  }

  toggleActiveController() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const preview = view?.containerEl?.querySelector(".markdown-preview-view");
    const controller = preview ? this.controllers.get(preview) || preview._noteDoodleController : null;

    if (!controller) {
      new Notice("Open a note in reading preview first.");
      return;
    }

    controller.toggle();
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
  constructor(plugin, previewEl, view, file) {
    this.plugin = plugin;
    this.previewEl = previewEl;
    this.view = view;
    this.file = file;
    this.active = false;
    this.doodleData = {
      version: 1,
      sourcePath: file.path,
      strokes: [],
      updatedAt: null,
    };
    this.currentStroke = null;
    this.currentEditor = null;
    this.penColor = "#e53935";
    this.penWidth = 3;
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
    this.didMove = false;
    this.redoStack = [];
    this.selectedStrokeIndex = -1;
    this.doodlesVisible = true;
    this.buttonLongPressed = false;
    this.buttonLongPressTimer = null;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onButtonClick = this.onButtonClick.bind(this);
    this.onButtonPointerDown = this.onButtonPointerDown.bind(this);
    this.onButtonPointerUp = this.onButtonPointerUp.bind(this);
  }

  async mount() {
    cleanupDoodleUi(this.previewEl);
    this.previewEl._noteDoodleController = this;
    this.previewEl.addClass("note-doodle-shell");

    this.button = this.createHeaderButton();
    this.button.addEventListener("pointerdown", this.onButtonPointerDown);
    this.button.addEventListener("pointerup", this.onButtonPointerUp);
    this.button.addEventListener("pointercancel", this.onButtonPointerUp);
    this.button.addEventListener("pointerleave", this.onButtonPointerUp);

    this.toolbar = this.previewEl.createDiv({ cls: "note-doodle-toolbar" });
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

    this.colorInput = this.toolbar.createEl("input", {
      attr: { type: "color", value: this.penColor, title: "Pen color" },
    });
    this.colorInput.addEventListener("change", () => {
      this.penColor = this.colorInput.value;
    });

    this.widthInput = this.toolbar.createEl("input", {
      cls: "note-doodle-width",
      attr: {
        type: "range",
        value: String(this.penWidth),
        min: "1",
        max: "16",
        step: "1",
        title: "Pen width",
      },
    });
    this.widthInput.addEventListener("input", () => {
      this.penWidth = Number(this.widthInput.value);
    });

    this.canvas = this.previewEl.createEl("canvas", { cls: "note-doodle-canvas" });
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("lostpointercapture", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("resize", this.onResize);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(this.previewEl);
    }

    this.doodleData = await this.plugin.readDoodles(this.file);
    this.resizeCanvas();
    this.render();
  }

  createHeaderButton() {
    let button = null;

    if (typeof this.view?.addAction === "function") {
      button = this.view.addAction("wand-sparkles", "Edit text / draw", this.onButtonClick);
    }

    if (!button) {
      const actions = this.view?.containerEl?.querySelector(".view-actions");
      button = document.createElement("div");
      button.classList.add("clickable-icon", "view-action");
      button.setAttribute("aria-label", "Edit text / draw");
      button.setAttribute("title", "Edit text / draw");
      setIcon(button, "wand-sparkles");
      button.addEventListener("click", this.onButtonClick);

      if (actions) {
        actions.appendChild(button);
      } else {
        this.previewEl.appendChild(button);
        button.classList.add("note-doodle-fallback-button");
      }
    }

    button.classList.add("note-doodle-header-button");
    button.setAttribute("aria-label", "Edit text / draw");
    button.setAttribute("title", "Edit text / draw");

    return button;
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
    this.redoStack = [];
    this.selectedStrokeIndex = -1;
    this.doodleData = await this.plugin.readDoodles(file);
    this.resizeCanvas();
    this.render();
  }

  destroy() {
    this.endTextEdit();
    this.clearButtonLongPress();
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.onResize);
    this.button?.remove();
    this.toolbar?.remove();
    this.canvas?.remove();
    this.previewEl.removeClass("note-doodle-shell");
    this.previewEl.removeClass("is-doodle-active");
    this.previewEl.removeClass("is-doodle-hidden");
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
    }
  }

  onResize() {
    this.resizeCanvas();
    this.render();
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

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ctx = this.canvas.getContext("2d");
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

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
    const editable = findEditableTarget(target, this.previewEl);
    const point = this.eventToPoint(event);

    if (this.selectedStrokeFrameContains(point)) {
      this.startSelectedStrokeDrag(event, point);
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

    this.currentStroke = {
      color: this.penColor,
      width: this.penWidth,
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

    if (!this.active || !this.pointerDown || !this.currentStroke || event.pointerId !== this.activePointerId) {
      return;
    }

    const wasDrawing = this.didMove;
    this.addPointerSamples(event);

    if (this.didMove && !wasDrawing) {
      this.endTextEdit();
      this.selectedStrokeIndex = -1;
    }

    if (this.didMove) {
      this.render();
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
        this.startTextEdit(editable);
      } else {
        this.selectedStrokeIndex = this.findStrokeAt(point);
      }
    } else {
      this.doodleData.strokes.push(this.currentStroke);
      this.selectedStrokeIndex = -1;
      this.redoStack = [];
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

  startSelectedStrokeDrag(event, point) {
    const stroke = this.doodleData.strokes[this.selectedStrokeIndex];
    if (!stroke) {
      return;
    }

    this.endTextEdit();
    this.pointerDown = false;
    this.currentStroke = null;
    this.draggingStroke = true;
    this.dragStrokeStartPoint = point;
    this.dragStrokeOriginalPoints = stroke.points.map((strokePoint) => ({ ...strokePoint }));
    this.dragStrokeMoved = false;
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
    const stroke = this.doodleData.strokes[this.selectedStrokeIndex];
    if (!stroke || !this.dragStrokeStartPoint || !this.dragStrokeOriginalPoints) {
      return;
    }

    const point = this.eventToPoint(event);
    const xs = this.dragStrokeOriginalPoints.map((strokePoint) => strokePoint.x);
    const ys = this.dragStrokeOriginalPoints.map((strokePoint) => strokePoint.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const dx = clamp(point.x - this.dragStrokeStartPoint.x, -minX, 1 - maxX);
    const dy = clamp(point.y - this.dragStrokeStartPoint.y, -minY, 1 - maxY);
    const movedDistance = pointDistanceOnCanvas(
      this.dragStrokeStartPoint,
      point,
      this.canvas.clientWidth,
      this.canvas.clientHeight,
    );

    if (movedDistance > SELECT_TAP_DISTANCE) {
      this.dragStrokeMoved = true;
    }

    stroke.points = this.dragStrokeOriginalPoints.map((strokePoint) => ({
      ...strokePoint,
      x: clamp(strokePoint.x + dx, 0, 1),
      y: clamp(strokePoint.y + dy, 0, 1),
    }));

    this.render();
    event.preventDefault();
    event.stopPropagation();
  }

  finishSelectedStrokeDrag(event) {
    if (this.dragStrokeMoved) {
      this.redoStack = [];
      this.plugin.scheduleDoodleSave(this.file, this.doodleData);
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
    const stroke = this.doodleData.strokes[this.selectedStrokeIndex];
    if (restoreOriginal && stroke && this.dragStrokeOriginalPoints) {
      stroke.points = this.dragStrokeOriginalPoints.map((strokePoint) => ({ ...strokePoint }));
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
    this.pointerStartClient = null;
    this.activePointerId = null;
    this.previewEl.removeClass("is-moving-selection");
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
    const distance = pointDistanceOnCanvas(from, point, this.canvas.clientWidth, this.canvas.clientHeight);

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
      x: point.x * this.canvas.clientWidth,
      y: point.y * this.canvas.clientHeight,
    };
  }

  render() {
    if (!this.ctx) {
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);

    for (const [index, stroke] of this.doodleData.strokes.entries()) {
      if (index === this.selectedStrokeIndex) {
        this.drawStroke(stroke, SELECTED_STROKE_ALPHA);
        this.drawSelection(stroke);
      } else {
        this.drawStroke(stroke);
      }
    }

    if (this.currentStroke && this.didMove) {
      this.drawStroke(this.currentStroke);
    }
  }

  drawStroke(stroke, alpha = 1) {
    if (!stroke.points.length) {
      return;
    }

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = stroke.color || this.penColor;
    this.ctx.lineWidth = stroke.width || this.penWidth;
    this.ctx.beginPath();

    const first = this.pointToCanvas(stroke.points[0]);
    this.ctx.moveTo(first.x, first.y);

    for (const point of stroke.points.slice(1)) {
      const next = this.pointToCanvas(point);
      this.ctx.lineTo(next.x, next.y);
    }

    this.ctx.stroke();
    this.ctx.restore();
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

  drawSelection(stroke) {
    const bounds = getStrokeBounds(stroke, this.canvas.clientWidth, this.canvas.clientHeight);
    if (!bounds) {
      return;
    }

    const padding = Math.max(SELECT_STROKE_PADDING, (stroke.width || this.penWidth) + 4);
    const x = bounds.minX - padding;
    const y = bounds.minY - padding;
    const width = bounds.maxX - bounds.minX + padding * 2;
    const height = bounds.maxY - bounds.minY + padding * 2;

    this.ctx.save();
    this.ctx.strokeStyle = "rgba(255, 193, 7, 0.95)";
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([6, 4]);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.restore();
  }

  findStrokeAt(point) {
    const hitPoint = this.pointToCanvas(point);
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    for (let index = this.doodleData.strokes.length - 1; index >= 0; index -= 1) {
      const stroke = this.doodleData.strokes[index];
      const threshold = Math.max(SELECT_STROKE_PADDING, (stroke.width || this.penWidth) / 2 + SELECT_STROKE_PADDING);

      if (strokeHitTest(stroke, hitPoint, width, height, threshold)) {
        return index;
      }
    }

    return -1;
  }

  selectedStrokeFrameContains(point) {
    if (this.selectedStrokeIndex < 0 || this.selectedStrokeIndex >= this.doodleData.strokes.length) {
      return false;
    }

    const stroke = this.doodleData.strokes[this.selectedStrokeIndex];
    const bounds = getStrokeBounds(stroke, this.canvas.clientWidth, this.canvas.clientHeight);
    if (!bounds) {
      return false;
    }

    const hitPoint = this.pointToCanvas(point);
    const padding = Math.max(SELECT_STROKE_PADDING, (stroke.width || this.penWidth) + 4);

    return hitPoint.x >= bounds.minX - padding
      && hitPoint.x <= bounds.maxX + padding
      && hitPoint.y >= bounds.minY - padding
      && hitPoint.y <= bounds.maxY + padding;
  }

  startTextEdit(element) {
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

    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

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
    this.selectedStrokeIndex = -1;
    this.plugin.scheduleDoodleSave(this.file, this.doodleData);
    this.render();
  }

  redoLastStroke() {
    if (!this.redoStack.length) {
      return;
    }

    const restored = this.redoStack.pop();
    this.doodleData.strokes.push(restored);
    this.selectedStrokeIndex = this.doodleData.strokes.length - 1;
    this.plugin.scheduleDoodleSave(this.file, this.doodleData);
    this.render();
  }

  deleteSelectedStroke() {
    if (this.selectedStrokeIndex < 0 || this.selectedStrokeIndex >= this.doodleData.strokes.length) {
      return;
    }

    this.doodleData.strokes.splice(this.selectedStrokeIndex, 1);
    this.selectedStrokeIndex = -1;
    this.redoStack = [];
    this.plugin.scheduleDoodleSave(this.file, this.doodleData);
    this.render();
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

function cleanupDoodleUi(preview) {
  preview.querySelectorAll(".note-doodle-button, .note-doodle-fallback-button, .note-doodle-toolbar, .note-doodle-canvas")
    .forEach((element) => element.remove());
  preview.classList.remove("note-doodle-shell", "is-doodle-active", "is-doodle-hidden");
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
      .filter((stroke) => stroke.points.length),
    updatedAt: data?.updatedAt || null,
  };
}

function normalizeStroke(stroke) {
  const points = Array.isArray(stroke?.points) ? stroke.points : [];

  return {
    color: typeof stroke?.color === "string" ? stroke.color : "#e53935",
    width: Number.isFinite(Number(stroke?.width)) ? Number(stroke.width) : 3,
    points: points
      .map((point) => ({
        x: clamp(Number(point?.x), 0, 1),
        y: clamp(Number(point?.y), 0, 1),
        t: Number.isFinite(Number(point?.t)) ? Number(point.t) : Date.now(),
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  };
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
