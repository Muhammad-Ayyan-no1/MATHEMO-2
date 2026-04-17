// auto logger — Auto Logger Process
// Optional process — can be activated or deactivated.
// Injects itself into pipeline context (taskPrams.logger).
// Only shows data that has been explicitly passed to it.
// Uses chalk for styled output, ora for spinners.

import chalk from "chalk";
import ora from "ora";
import { get as cbkGet } from "../Code Base Keywords/index.js";

// Log level styles
const levels = {
  info: { label: "INFO", color: chalk.cyan },
  warn: { label: "WARN", color: chalk.yellow },
  error: { label: "ERROR", color: chalk.red },
  success: { label: "OK", color: chalk.green },
  debug: { label: "DBG", color: chalk.magenta },
  task: { label: "TASK", color: chalk.blue },
};

class AutoLogger {
  constructor(options = {}) {
    this._active = options.active !== false; // default on
    this._entries = [];
    this._spinner = null;
    this._prefix = options.prefix || "";
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _format(level, cbkKey, message, data) {
    const lvl = levels[level] || levels.info;
    const humanCbk = cbkGet(cbkKey) || cbkKey || "";
    const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    const prefix = this._prefix ? chalk.dim(`[${this._prefix}] `) : "";
    const tag = lvl.color(`[${lvl.label}]`);
    const cbkStr = humanCbk ? chalk.dim(`{${humanCbk}} `) : "";
    return `${prefix}${chalk.dim(ts)} ${tag} ${cbkStr}${message}`;
  }

  _write(level, cbkKey, message, data) {
    if (!this._active) return;
    const line = this._format(level, cbkKey, message, data);
    if (this._spinner) this._spinner.stop();
    console.log(line);
    if (data !== undefined)
      console.log(chalk.dim(JSON.stringify(data, null, 2)));
    this._entries.push({ level, cbkKey, message, data, ts: Date.now() });
    if (this._spinner) this._spinner.start();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  log(cbkKey, message, data) {
    this._write("info", cbkKey, message, data);
  }
  info(cbkKey, message, data) {
    this._write("info", cbkKey, message, data);
  }
  warn(cbkKey, message, data) {
    this._write("warn", cbkKey, message, data);
  }
  error(cbkKey, message, data) {
    this._write("error", cbkKey, message, data);
  }
  success(cbkKey, message, data) {
    this._write("success", cbkKey, message, data);
  }
  debug(cbkKey, message, data) {
    this._write("debug", cbkKey, message, data);
  }
  task(cbkKey, message, data) {
    this._write("task", cbkKey, message, data);
  }

  // Spinner helpers (wraps ora)
  startSpinner(text) {
    if (!this._active) return;
    this._spinner = ora(text).start();
  }

  stopSpinner(success = true, text) {
    if (!this._spinner) return;
    success ? this._spinner.succeed(text) : this._spinner.fail(text);
    this._spinner = null;
  }

  activate() {
    this._active = true;
  }
  deactivate() {
    this._active = false;
  }
  isActive() {
    return this._active;
  }

  entries() {
    return [...this._entries];
  }
  clear() {
    this._entries = [];
  }
}

// ── Inject helper ─────────────────────────────────────────────────────────────
// Call this to inject the logger into a taskPrams object
function inject(taskPrams, options) {
  const logger = new AutoLogger(options);
  taskPrams.logger = logger;
  return logger;
}

// ── create — Ins Manager Protocol ────────────────────────────────────────────
function create(ctx) {
  const options = ctx || {};
  const logger = new AutoLogger(options);
  return {
    cbk: "autoLog",
    id: `autoLog_${Date.now()}`,
    ins: logger,
    // Convenience pass-throughs
    log: (...a) => logger.log(...a),
    info: (...a) => logger.info(...a),
    warn: (...a) => logger.warn(...a),
    error: (...a) => logger.error(...a),
    success: (...a) => logger.success(...a),
    debug: (...a) => logger.debug(...a),
    task: (...a) => logger.task(...a),
    startSpinner: (t) => logger.startSpinner(t),
    stopSpinner: (s, t) => logger.stopSpinner(s, t),
    activate: () => logger.activate(),
    deactivate: () => logger.deactivate(),
    inject,
    entries: () => logger.entries(),
    // Ins Manager protocol
    init() {},
    despawn() {
      logger.deactivate();
      logger.clear();
    },
    exportState() {
      return { entries: logger.entries(), active: logger.isActive() };
    },
    importState(state) {
      if (state && !state.active) logger.deactivate();
    },
  };
}

export { create, AutoLogger, inject };
