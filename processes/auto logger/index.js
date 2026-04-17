import { get as cbkGet } from "../Code Base Keywords/index.js";
import { LOG_LEVELS } from "../constants/index.js";

const DEFAULT_ORA = () => {
  const spinner = {
    start() {
      return this;
    },
    stop() {
      return this;
    },
    succeed() {
      return this;
    },
    fail() {
      return this;
    },
  };
  return () => spinner;
};

const DEFAULT_CHALK = new Proxy((text) => String(text ?? ""), {
  get(target) {
    return target;
  },
  apply(target, thisArg, args) {
    return args.map((value) => String(value ?? "")).join(" ");
  },
});

function safeLibrary(lib, name, fallback) {
  if (!lib || !lib.get) return fallback;
  return lib.get(name) || fallback;
}

class AutoLogger {
  constructor(options = {}) {
    this._active = options.active !== false;
    this._entries = [];
    this._spinner = null;
    this._prefix = options.prefix || "";
    this._lib = options.lib || null;
  }

  _chalk() {
    return safeLibrary(this._lib, "chalk", DEFAULT_CHALK);
  }

  _ora() {
    return safeLibrary(this._lib, "ora", DEFAULT_ORA());
  }

  _format(level, cbkKey, message) {
    const lvl = LOG_LEVELS[level] || LOG_LEVELS.info;
    const chalk = this._chalk();
    const humanCbk = cbkGet(cbkKey) || cbkKey || "";
    const ts = new Date().toISOString().slice(11, 23);
    const prefix = this._prefix ? chalk.dim(`[${this._prefix}] `) : "";
    const tag = chalk[lvl.color](`[${lvl.label}]`);
    const cbkStr = humanCbk ? chalk.dim(`{${humanCbk}} `) : "";
    return `${prefix}${chalk.dim(ts)} ${tag} ${cbkStr}${message}`;
  }

  _write(level, cbkKey, message, data) {
    if (!this._active) return;
    const line = this._format(level, cbkKey, message);
    if (this._spinner) this._spinner.stop();
    console.log(line);
    if (data !== undefined) {
      const chalk = this._chalk();
      console.log(chalk.dim(JSON.stringify(data, null, 2)));
    }
    this._entries.push({ level, cbkKey, message, data, ts: Date.now() });
    if (this._spinner) this._spinner.start();
  }

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

  startSpinner(text) {
    if (!this._active) return;
    const ora = this._ora();
    this._spinner = ora(text);
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

function inject(taskPrams, options) {
  const logger = new AutoLogger({
    ...options,
    lib: options.lib || taskPrams.lib,
  });
  taskPrams.logger = logger;
  return logger;
}

function create(ctx) {
  const options = ctx || {};
  const logger = new AutoLogger(options);
  return {
    cbk: "autoLog",
    id: `autoLog_${Date.now()}`,
    ins: logger,
    log: (...args) => logger.log(...args),
    info: (...args) => logger.info(...args),
    warn: (...args) => logger.warn(...args),
    error: (...args) => logger.error(...args),
    success: (...args) => logger.success(...args),
    debug: (...args) => logger.debug(...args),
    task: (...args) => logger.task(...args),
    startSpinner: (text) => logger.startSpinner(text),
    stopSpinner: (success, text) => logger.stopSpinner(success, text),
    activate: () => logger.activate(),
    deactivate: () => logger.deactivate(),
    inject,
    entries: () => logger.entries(),
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
