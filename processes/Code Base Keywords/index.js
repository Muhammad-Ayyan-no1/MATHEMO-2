// CBK — Code Base Keywords
// Used as the standard naming protocol between all processes, sub-processes, pipelines, tasks and instances.
// Also used in logger, CLI, and debugger.
// Also used as keys for hashmaps passed between processes.
//
// Naming protocol:
//   Short abbreviations (cbk, ins, pipln, etc.) map to full human-readable names.
//   r_<number>        → ordinal result label  (r_1 → "first result")
//   C_<kw1> <kw2>... → chain of abbreviations decoded in sequence

// Simple ordinal function
function toOrdinal(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return num + "st";
  if (j === 2 && k !== 12) return num + "nd";
  if (j === 3 && k !== 13) return num + "rd";
  return num + "th";
}

let map = {
  // Core system
  cbk: "Code Base Keywords",
  cbkM: "Code Base Map of Keywords",
  ins: "Instance",
  insM: "Instance Manager",

  // Pipeline
  pipln: "Pipeline",
  piplnMgr: "Pipeline Manager",
  piplnExe: "Pipeline Executor",
  piplnCond: "Pipeline Condition",
  piplnVar: "Pipeline Variable",
  piplnHist: "Pipeline History",
  task: "Task",
  taskPrams: "Task Parameters",

  // System processes
  autoLog: "Auto Logger",
  dbg: "Debugger",
  autoCLI: "Auto Command Line Interface",

  // Instance lifecycle
  init: "Initialise",
  despawn: "Despawn",
  expState: "Export State",
  impState: "Import State",

  // Operations
  add: "Add",
  del: "Delete",
  upd: "Update",
  read: "Read",
  run: "Run",
  pause: "Pause",
  resume: "Resume",

  // Misc
  ctx: "Context",
  prams: "Parameters",
  sel: "Selections",
  cond: "Condition",
  hist: "History",
  id: "Identifier",
};

// Build inverted map: full name → abbreviation
let inverted = (() => {
  let r = {};
  for (const k in map) r[map[k]] = k;
  return r;
})();

// fullMap supports lookup in both directions
let fullMap = { ...map, ...inverted };

// Add _underscore_ variants so pipeline hashmap keys printed with underscores still resolve
for (const k in { ...map }) {
  const underscored = k.replace(/ /g, "_");
  fullMap["_" + underscored + "_"] = map[k] ? map[k].replace(/ /g, "_") : k;
}

// r_<digits>  →  "Nth result"
function resultNum(str) {
  if (!str || !str.match(/^r_*[0-9]+$/)) return false;
  const num = Number(str.replace(/^r_*/, ""));
  const ordinal = toOrdinal(num);
  return (ordinal || num + "th") + " result";
}

// C_<kw1> <kw2> ... → decodes chain of CBK abbreviations into human readable string
// prefix must be "C_" (not "C__")
function chainAbbreviations(str) {
  if (!str || !str.startsWith("C_") || str.startsWith("C__")) return false;
  const body = str.slice(2); // strip "C_"
  const parts = body.split(" ");
  const result = parts
    .map((p) => {
      const resolved = fullMap[p];
      return resolved !== undefined ? resolved : p;
    })
    .join(" ");
  return result || false;
}

// Primary public API — resolve any CBK string
function get(item) {
  if (item === undefined || item === null) return false;
  return fullMap[item] || resultNum(item) || chainAbbreviations(item) || false;
}

// Store — pipeline-compatible hashmap with CBK keys
// Every value stored/retrieved uses CBK keys so processes stay compatible
class Store {
  constructor() {
    this._data = {};
    this._history = [];
  }

  set(cbkKey, value) {
    const prev = this._data[cbkKey];
    this._history.push({ op: "set", key: cbkKey, prev, value });
    this._data[cbkKey] = value;
    return this;
  }

  get(cbkKey) {
    return this._data[cbkKey];
  }

  delete(cbkKey) {
    const prev = this._data[cbkKey];
    this._history.push({ op: "del", key: cbkKey, prev });
    delete this._data[cbkKey];
    return this;
  }

  snapshot() {
    return { ...this._data };
  }

  history() {
    return [...this._history];
  }
}

function create() {
  const store = new Store();
  return {
    cbk: "cbk", // CBK name for this instance
    id: `cbk_${Date.now()}`,
    get,
    map,
    inverted,
    fullMap,
    store,
    // Lifecycle stubs (used by Ins Manager protocol)
    init() {},
    despawn() {},
    exportState() {
      return { map, store: store.snapshot() };
    },
    importState(state) {
      if (state && state.store) {
        for (const k in state.store) store.set(k, state.store[k]);
      }
    },
  };
}

export { create, get, map, inverted, fullMap };
