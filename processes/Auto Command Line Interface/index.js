import { get as cbkGet } from "../Code Base Keywords/index.js";
import { HEADER_OPTIONS, CLI_CHOICES } from "../constants/index.js";

function _safeLoad(lib, name, fallback) {
  if (!lib) return fallback;
  if (typeof lib.get === "function") return lib.get(name) || fallback;
  if (typeof lib.load === "function")
    return lib.load(name).catch(() => fallback);
  return fallback;
}

class AutoCLI {
  constructor(options = {}) {
    this._active = options.active !== false;
    this._logger = options.logger || null;
    this._lib = options.lib || null;
    this._spinner = null;
  }

  _chalk() {
    return _safeLoad(this._lib, "chalk", {
      bold: { white: (value) => String(value ?? "") },
      white: (value) => String(value ?? ""),
      cyan: (value) => String(value ?? ""),
      dim: (value) => String(value ?? ""),
      magenta: { bold: (value) => String(value ?? "") },
    });
  }

  _boxen() {
    return _safeLoad(this._lib, "boxen", (text) => String(text ?? ""));
  }

  _ora() {
    return _safeLoad(this._lib, "ora", () => ({
      text: "",
      start() {
        return this;
      },
      succeed() {
        return this;
      },
      fail() {
        return this;
      },
    }));
  }

  _inquirer() {
    return _safeLoad(this._lib, "inquirer", {
      prompt: async (questions) => {
        if (!Array.isArray(questions)) return {};
        return questions.reduce((result, question) => {
          if (question && question.name) {
            result[question.name] = question.default ?? null;
          }
          return result;
        }, {});
      },
    });
  }

  showOutput(cbkKey, data, title) {
    if (!this._active) return;
    const chalk = this._chalk();
    const humanCbk = cbkGet(cbkKey) || cbkKey;
    const t = title || `Output: ${humanCbk}`;
    const boxen = this._boxen();
    console.log(boxen(chalk.bold.white(t), HEADER_OPTIONS));
    if (data && typeof data === "object") {
      console.log(this.renderState(data));
    } else {
      console.log(chalk.white(data));
    }
    console.log();
  }

  renderState(state) {
    const chalk = this._chalk();
    if (!state || typeof state !== "object") return chalk.dim("(empty)");
    const lines = Object.entries(state).map(([key, value]) => {
      const humanKey = cbkGet(key) || key;
      return `  ${chalk.cyan(humanKey)}: ${chalk.white(JSON.stringify(value))}`;
    });
    return lines.join("\n");
  }

  showPipelineState(taskPrams) {
    if (!this._active || !taskPrams) return;
    this.showOutput(
      "piplnVar",
      taskPrams.piplnVar ? taskPrams.piplnVar.snapshot() : {},
      "Pipeline State",
    );
  }

  header(text) {
    if (!this._active) return text;
    const chalk = this._chalk();
    const boxen = this._boxen();
    return boxen(chalk.bold.white(text), HEADER_OPTIONS);
  }

  async prompt(questions) {
    if (!this._active) return {};
    return this._inquirer().prompt(questions);
  }

  async pickPipeline(pipelineNames) {
    if (!this._active || !pipelineNames.length) return null;
    const inquirer = this._inquirer();
    const { selected } = await inquirer.prompt([
      {
        type: "list",
        name: "selected",
        message: "Select a pipeline to run:",
        choices: pipelineNames.map((name) => ({
          name: cbkGet(name) || name,
          value: name,
        })),
      },
    ]);
    return selected;
  }

  async promptDebug(taskPrams, dbgInstance) {
    if (!this._active) return;
    const chalk = this._chalk();
    console.log(
      chalk.magenta.bold(
        "\n[DEBUGGER] Breakpoint hit. Current pipeline state:",
      ),
    );
    this.showPipelineState(taskPrams);
    const inquirer = this._inquirer();
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Debugger action:",
        choices: CLI_CHOICES,
      },
    ]);
    if (action === "history" && dbgInstance)
      dbgInstance.showPiplnVarHistory(taskPrams);
    if (action === "mgrHistory" && dbgInstance)
      dbgInstance.showPiplnMgrHistory(taskPrams);
    if (action === "deactivate" && dbgInstance) dbgInstance.deactivate();
  }

  startSpinner(text) {
    this._spinner = this._ora(text).start();
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

function inject(taskPrams, options) {
  const cli = new AutoCLI({
    ...options,
    logger: taskPrams.logger,
    lib: options.lib || taskPrams.lib,
  });
  taskPrams.cli = cli;
  return cli;
}

function create(ctx) {
  const options = ctx || {};
  const cli = new AutoCLI(options);
  return {
    cbk: "autoCLI",
    id: `autoCLI_${Date.now()}`,
    ins: cli,
    showOutput: (...args) => cli.showOutput(...args),
    showPipelineState: (taskPrams) => cli.showPipelineState(taskPrams),
    header: (text) => cli.header(text),
    prompt: (questions) => cli.prompt(questions),
    pickPipeline: (names) => cli.pickPipeline(names),
    promptDebug: (taskPrams, dbgInstance) =>
      cli.promptDebug(taskPrams, dbgInstance),
    startSpinner: (text) => cli.startSpinner(text),
    stopSpinner: (success, text) => cli.stopSpinner(success, text),
    activate: () => cli.activate(),
    deactivate: () => cli.deactivate(),
    inject,
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

export { create, AutoCLI, inject };
