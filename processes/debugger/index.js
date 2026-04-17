// debugger — Debugger Process
// Optional process — can be activated or deactivated.
// Injects itself into pipeline context (taskPrams.dbg).
// Uses logger to show all modifications to state.
// Can pause the pipeline until a condition / IIFE / specific time resolves.
// Shows all atomic modifications from all history-tracking systems.
// Optionally connects to the CLI process.

import chalk from "chalk";
import { get as cbkGet } from "../Code Base Keywords/index.js";

class Debugger {
  constructor(options = {}) {
    this._active = options.active !== false;
    this._logger = options.logger || null; // AutoLogger instance
    this._cli = options.cli || null; // AutoCLI instance
    this._paused = false;
    this._breakpoints = []; // array of { id, condition: fn }
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  _show(label, data) {
    if (!this._active) return;
    if (this._logger) {
      this._logger.debug("dbg", label, data);
    } else {
      console.log(
        chalk.magenta(`[DBG] ${label}`),
        data !== undefined ? data : "",
      );
    }
  }

  // ── State inspection ───────────────────────────────────────────────────────

  // Dump all piplnVar history
  showPiplnVarHistory(taskPrams) {
    if (!taskPrams || !taskPrams.piplnVar) return;
    this._show("piplnVar history", taskPrams.piplnVar.history());
  }

  // Dump pipeline manager history
  showPiplnMgrHistory(taskPrams) {
    if (!taskPrams || !taskPrams.main_pipln) return;
    this._show("piplnMgr history", taskPrams.main_pipln.history());
  }

  // Dump full snapshot of piplnVar
  showState(taskPrams) {
    if (!taskPrams || !taskPrams.piplnVar) return;
    this._show("current piplnVar state", taskPrams.piplnVar.snapshot());
  }

  // ── Pipeline flow control ──────────────────────────────────────────────────

  // Pause execution for ms milliseconds
  async pauseFor(ms) {
    if (!this._active) return;
    this._paused = true;
    this._show(`pausing for ${ms}ms`, null);
    await new Promise((res) => setTimeout(res, ms));
    this._paused = false;
  }

  // Pause until conditionFn() returns truthy (polls every pollMs)
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
      await new Promise((res) => setTimeout(res, pollMs));
    }
    this._paused = false;
    this._show("condition met, resuming", null);
  }

  // ── Breakpoints ────────────────────────────────────────────────────────────

  addBreakpoint(id, conditionFn) {
    this._breakpoints.push({ id, condition: conditionFn });
  }

  removeBreakpoint(id) {
    this._breakpoints = this._breakpoints.filter((bp) => bp.id !== id);
  }

  // Call at start of each task to check if we should pause
  async checkBreakpoints(taskPrams) {
    if (!this._active) return;
    for (const bp of this._breakpoints) {
      if (await bp.condition(taskPrams)) {
        this._show(`breakpoint hit: ${bp.id}`, null);
        // If CLI is connected, hand control to it
        if (this._cli && this._cli.promptDebug) {
          await this._cli.promptDebug(taskPrams, this);
        } else {
          // default: pause 0ms (user must restart process to continue)
          await this.pauseFor(0);
        }
      }
    }
  }

  // ── CLI integration ────────────────────────────────────────────────────────
  connectCLI(cliIns) {
    this._cli = cliIns;
    this._show("CLI connected to debugger", null);
  }

  disconnectCLI() {
    this._cli = null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
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

// ── Inject helper ─────────────────────────────────────────────────────────────
function inject(taskPrams, options) {
  const dbg = new Debugger({ ...options, logger: taskPrams.logger });
  taskPrams.dbg = dbg;
  return dbg;
}

// ── create — Ins Manager Protocol ────────────────────────────────────────────
function create(ctx) {
  const options = ctx || {};
  const dbg = new Debugger(options);
  return {
    cbk: "dbg",
    id: `dbg_${Date.now()}`,
    ins: dbg,
    // Convenience pass-throughs
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
    // Ins Manager protocol
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
