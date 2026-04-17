import { get as cbkGet } from "../Code Base Keywords/index.js";

function _safeLoad(lib, name) {
  if (!lib) return null;
  if (typeof lib.get === "function") return lib.get(name);
  if (typeof lib.load === "function") return lib.load(name).catch(() => null);
  return null;
}

class Debugger {
  constructor(options = {}) {
    this._active = options.active !== false;
    this._logger = options.logger || null;
    this._cli = options.cli || null;
    this._lib = options.lib || null;
    this._paused = false;
    this._breakpoints = [];
  }

  _chalk() {
    return (
      _safeLoad(this._lib, "chalk") ||
      new Proxy((text) => String(text ?? ""), {
        get(target) {
          return target;
        },
        apply(target, thisArg, args) {
          return args.map((value) => String(value ?? "")).join(" ");
        },
      })
    );
  }

  _show(label, data) {
    if (!this._active) return;
    if (this._logger) {
      this._logger.debug("dbg", label, data);
      return;
    }
    const chalk = this._chalk();
    console.log(
      chalk.magenta(`[DBG] ${label}`),
      data !== undefined ? data : "",
    );
  }

  showPiplnVarHistory(taskPrams) {
    if (!taskPrams || !taskPrams.piplnVar) return;
    this._show("piplnVar history", taskPrams.piplnVar.history());
  }

  showPiplnMgrHistory(taskPrams) {
    if (!taskPrams || !taskPrams.main_pipln) return;
    this._show("piplnMgr history", taskPrams.main_pipln.history());
  }

  showState(taskPrams) {
    if (!taskPrams || !taskPrams.piplnVar) return;
    this._show("current piplnVar state", taskPrams.piplnVar.snapshot());
  }

  async pauseFor(ms) {
    if (!this._active) return;
    this._paused = true;
    this._show(`pausing for ${ms}ms`, null);
    await new Promise((resolve) => setTimeout(resolve, ms));
    this._paused = false;
  }

  async pauseUntil(conditionFn, pollMs = 100, timeoutMs = 30000) {
    if (!this._active) return;
    this._paused = true;
    this._show("pausing until condition is true...", null);
    const start = Date.now();
    while (!(await conditionFn())) {
      if (Date.now() - start > timeoutMs) {
        this._show("pause timed out", null);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    this._paused = false;
    this._show("condition met, resuming", null);
  }

  addBreakpoint(id, conditionFn) {
    this._breakpoints.push({ id, condition: conditionFn });
  }

  removeBreakpoint(id) {
    this._breakpoints = this._breakpoints.filter((bp) => bp.id !== id);
  }

  async checkBreakpoints(taskPrams) {
    if (!this._active) return;
    for (const bp of this._breakpoints) {
      if (await bp.condition(taskPrams)) {
        this._show(`breakpoint hit: ${bp.id}`, null);
        if (this._cli && this._cli.promptDebug) {
          await this._cli.promptDebug(taskPrams, this);
        } else {
          await this.pauseFor(0);
        }
      }
    }
  }

  connectCLI(cliIns) {
    this._cli = cliIns;
    this._show("CLI connected to debugger", null);
  }

  disconnectCLI() {
    this._cli = null;
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

  isPaused() {
    return this._paused;
  }
}

function inject(taskPrams, options) {
  const dbg = new Debugger({
    ...options,
    logger: taskPrams.logger,
    lib: options.lib || taskPrams.lib,
  });
  taskPrams.dbg = dbg;
  return dbg;
}

function create(ctx) {
  const options = ctx || {};
  const dbg = new Debugger(options);
  return {
    cbk: "dbg",
    id: `dbg_${Date.now()}`,
    ins: dbg,
    showState: (tp) => dbg.showState(tp),
    showPiplnVarHistory: (tp) => dbg.showPiplnVarHistory(tp),
    showPiplnMgrHistory: (tp) => dbg.showPiplnMgrHistory(tp),
    pauseFor: (ms) => dbg.pauseFor(ms),
    pauseUntil: (fn, p, t) => dbg.pauseUntil(fn, p, t),
    addBreakpoint: (id, fn) => dbg.addBreakpoint(id, fn),
    removeBreakpoint: (id) => dbg.removeBreakpoint(id),
    checkBreakpoints: (tp) => dbg.checkBreakpoints(tp),
    connectCLI: (cli) => dbg.connectCLI(cli),
    disconnectCLI: () => dbg.disconnectCLI(),
    activate: () => dbg.activate(),
    deactivate: () => dbg.deactivate(),
    inject,
    init() {},
    despawn() {
      dbg.deactivate();
    },
    exportState() {
      return { active: dbg.isActive() };
    },
    importState(state) {
      if (state && !state.active) dbg.deactivate();
    },
  };
}

export { create, Debugger, inject };
