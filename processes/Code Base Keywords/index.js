import { CBK_MAP } from "../constants/index.js";

function toOrdinal(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return num + "st";
  if (j === 2 && k !== 12) return num + "nd";
  if (j === 3 && k !== 13) return num + "rd";
  return num + "th";
}

let map = CBK_MAP;

let inverted = (() => {
  let r = {};
  for (const k in map) r[map[k]] = k;
  return r;
})();

let fullMap = { ...map, ...inverted };

for (const k in { ...map }) {
  const underscored = k.replace(/ /g, "_");
  fullMap["_" + underscored + "_"] = map[k] ? map[k].replace(/ /g, "_") : k;
}

function resultNum(str) {
  if (!str || !str.match(/^r_*[0-9]+$/)) return false;
  const num = Number(str.replace(/^r_*/, ""));
  const ordinal = toOrdinal(num);
  return (ordinal || num + "th") + " result";
}

function chainAbbreviations(str) {
  if (!str || !str.startsWith("C_") || str.startsWith("C__")) return false;
  const body = str.slice(2);
  const parts = body.split(" ");
  const result = parts
    .map((p) => {
      const resolved = fullMap[p];
      return resolved !== undefined ? resolved : p;
    })
    .join(" ");
  return result || false;
}

function get(item) {
  if (item === undefined || item === null) return false;
  return fullMap[item] || resultNum(item) || chainAbbreviations(item) || false;
}

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
    cbk: "cbk",
    id: `cbk_${Date.now()}`,
    get,
    map,
    inverted,
    fullMap,
    store,
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
