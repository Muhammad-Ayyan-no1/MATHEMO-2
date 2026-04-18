const CBK_MAP = {
  cbk: "Code Base Keywords",
  cbkM: "Code Base Map of Keywords",
  ins: "Instance",
  insM: "Instance Manager",
  pipln: "Pipeline",
  piplnMgr: "Pipeline Manager",
  piplnExe: "Pipeline Executor",
  piplnCond: "Pipeline Condition",
  piplnVar: "Pipeline Variable",
  piplnHist: "Pipeline History",
  task: "Task",
  taskPrams: "Task Parameters",
  autoLog: "Auto Logger",
  dbg: "Debugger",
  autoCLI: "Auto Command Line Interface",
  init: "Initialise",
  despawn: "Despawn",
  expState: "Export State",
  impState: "Import State",
  add: "Add",
  del: "Delete",
  upd: "Update",
  read: "Read",
  run: "Run",
  pause: "Pause",
  resume: "Resume",
  ctx: "Context",
  prams: "Parameters",
  sel: "Selections",
  cond: "Condition",
  hist: "History",
  id: "Identifier",

  // MATHEMO stuff / superoptimizer
  MaTHEmO: "Math Turring complete Hardware Emulation for Optimization",
  "v=P2": "2nd Production Version",

  // Parser Nodes
  PosInt: "Positive Integer",
  NegInt: "Negative Integer",
};

const LOG_LEVELS = {
  info: { label: "INFO", color: "cyan" },
  warn: { label: "WARN", color: "yellow" },
  error: { label: "ERROR", color: "red" },
  success: { label: "OK", color: "green" },
  debug: { label: "DBG", color: "magenta" },
  task: { label: "TASK", color: "blue" },
};

const HEADER_OPTIONS = {
  padding: 1,
  margin: 1,
  borderStyle: "round",
  borderColor: "cyan",
};

const ERROR_MESSAGES = {
  INS_MANAGER_CREATE_MISSING:
    '[Ins Manager] Process module must export a "create" function',
  INS_MANAGER_CREATE_INVALID:
    "[Ins Manager] create() must return an object with at least { cbk, id }",
  PIPELINE_NOT_FOUND: '[pipln mgr] Pipeline "{name}" not found in registry',
  PIPELINE_NOT_ARRAY: "[pipln exe] pipeline must be an array of task objects",
  CONDITION_NOT_FUNCTION: "[pipln cond] prams.condition must be a function",
  CONDITION_SELECTIONS_NOT_OBJECT:
    "[pipln cond] prams.selections must be a hashmap (object)",
  CONDITION_KEY_NOT_IN_SELECTIONS:
    '[pipln cond] condition() returned "{key}" which is not in selections',
};

const CLI_CHOICES = [
  { name: "Continue", value: "continue" },
  { name: "Show piplnVar history", value: "history" },
  { name: "Show piplnMgr history", value: "mgrHistory" },
  { name: "Deactivate debugger", value: "deactivate" },
];

function create() {
  return {
    cbk: "constants",
    id: `constants_${Date.now()}`,
    CBK_MAP,
    LOG_LEVELS,
    HEADER_OPTIONS,
    ERROR_MESSAGES,
    CLI_CHOICES,
    init() {},
    despawn() {},
    exportState() {
      return {};
    },
    importState() {},
  };
}

export {
  create,
  CBK_MAP,
  LOG_LEVELS,
  HEADER_OPTIONS,
  ERROR_MESSAGES,
  CLI_CHOICES,
};
