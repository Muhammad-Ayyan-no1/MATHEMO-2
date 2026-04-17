// auto cli — Auto Command Line Interface Process
// Optional process — injects itself into pipeline context (taskPrams.cli).
// Passes parameters to specific pipelines at runtime.
// Shows pipeline context/state outputs to user.
// Can be started standalone via CLI.js (runs entire codebase too).
// Uses oclif, chalk, boxen, ora, inquirer.

import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import inquirer from "inquirer";
import { get as cbkGet } from "../Code Base Keywords/index.js";

// ── Formatting helpers ────────────────────────────────────────────────────────

function header(title) {
  return boxen(chalk.bold.white(title), {
    padding: 1,
    margin: 1,
    borderStyle: "round",
    borderColor: "cyan",
  });
}

function renderState(state) {
  if (!state || typeof state !== "object") return chalk.dim("(empty)");
  const lines = Object.entries(state).map(([k, v]) => {
    const humanKey = cbkGet(k) || k;
    return `  ${chalk.cyan(humanKey)}: ${chalk.white(JSON.stringify(v))}`;
  });
  return lines.join("\n");
}

// ── AutoCLI class ─────────────────────────────────────────────────────────────

class AutoCLI {
  constructor(options = {}) {
    this._active = options.active !== false;
    this._logger = options.logger || null;
    this._spinner = null;
  }

  // ── Output ─────────────────────────────────────────────────────────────────

  showOutput(cbkKey, data, title) {
    if (!this._active) return;
    const humanCbk = cbkGet(cbkKey) || cbkKey;
    const t = title || `Output: ${humanCbk}`;
    console.log(header(t));
    if (data && typeof data === "object") {
      console.log(renderState(data));
    } else {
      console.log(chalk.white(data));
    }
    console.log();
  }

  showPipelineState(taskPrams) {
    if (!this._active || !taskPrams) return;
    this.showOutput(
      "piplnVar",
      taskPrams.piplnVar ? taskPrams.piplnVar.snapshot() : {},
      "Pipeline State",
    );
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  // Prompt user to pass a value into a pipeline parameter at runtime
  async prompt(questions) {
    if (!this._active) return {};
    return inquirer.prompt(questions);
  }

  // Ask user to pick which pipeline to run next
  async pickPipeline(pipelineNames) {
    if (!this._active || !pipelineNames.length) return null;
    const { selected } = await inquirer.prompt([
      {
        type: "list",
        name: "selected",
        message: "Select a pipeline to run:",
        choices: pipelineNames.map((n) => ({ name: cbkGet(n) || n, value: n })),
      },
    ]);
    return selected;
  }

  // Used by debugger when breakpoint is hit — lets user inspect/continue live
  async promptDebug(taskPrams, dbgInstance) {
    if (!this._active) return;
    console.log(
      chalk.magenta.bold(
        "\n[DEBUGGER] Breakpoint hit. Current pipeline state:",
      ),
    );
    this.showPipelineState(taskPrams);
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Debugger action:",
        choices: [
          { name: "Continue", value: "continue" },
          { name: "Show piplnVar history", value: "history" },
          { name: "Show piplnMgr history", value: "mgrHistory" },
          { name: "Deactivate debugger", value: "deactivate" },
        ],
      },
    ]);
    if (action === "history" && dbgInstance)
      dbgInstance.showPiplnVarHistory(taskPrams);
    if (action === "mgrHistory" && dbgInstance)
      dbgInstance.showPiplnMgrHistory(taskPrams);
    if (action === "deactivate" && dbgInstance) dbgInstance.deactivate();
    // "continue" falls through and returns
  }

  // ── Spinner ────────────────────────────────────────────────────────────────
  startSpinner(text) {
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
}

// ── Inject helper ─────────────────────────────────────────────────────────────
function inject(taskPrams, options) {
  const cli = new AutoCLI({ ...options, logger: taskPrams.logger });
  taskPrams.cli = cli;
  return cli;
}

// ── create — Ins Manager Protocol ────────────────────────────────────────────
function create(ctx) {
  const options = ctx || {};
  const cli = new AutoCLI(options);
  return {
    cbk: "autoCLI",
    id: `autoCLI_${Date.now()}`,
    ins: cli,
    // Convenience pass-throughs
    showOutput: (...a) => cli.showOutput(...a),
    showPipelineState: (tp) => cli.showPipelineState(tp),
    prompt: (q) => cli.prompt(q),
    pickPipeline: (names) => cli.pickPipeline(names),
    promptDebug: (tp, d) => cli.promptDebug(tp, d),
    startSpinner: (t) => cli.startSpinner(t),
    stopSpinner: (s, t) => cli.stopSpinner(s, t),
    activate: () => cli.activate(),
    deactivate: () => cli.deactivate(),
    inject,
    header,
    renderState,
    // Ins Manager protocol
    init() {},
    despawn() {
      cli.deactivate();
    },
    exportState() {
      return { active: cli.isActive() };
    },
    importState(state) {
      if (state && !state.active) cli.deactivate();
    },
  };
}

export { create, AutoCLI, inject, header, renderState };
