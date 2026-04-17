// pipln var — Pipeline Variable Store
// Injected into every pipeline process' context.
// Acts as a large hashmap with atomic edit methods and full git-like history tracking.
// Remains fully in-memory.

class PiplnVar {
  constructor(initialData = {}) {
    this._data = { ...initialData };
    this._history = []; // array of { op, key, prev, next, ts }
    this.cbk = "piplnVar";
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  get(key) {
    return this._data[key];
  }

  has(key) {
    return Object.prototype.hasOwnProperty.call(this._data, key);
  }

  snapshot() {
    return { ...this._data };
  }

  // ── Atomic write ops (each logged to history) ───────────────────────────────

  set(key, value) {
    const prev = this._data[key];
    this._data[key] = value;
    this._history.push({ op: "set", key, prev, next: value, ts: Date.now() });
    return this;
  }

  delete(key) {
    const prev = this._data[key];
    delete this._data[key];
    this._history.push({
      op: "del",
      key,
      prev,
      next: undefined,
      ts: Date.now(),
    });
    return this;
  }

  // Merge an object of key/value pairs atomically (one history entry per key)
  merge(obj) {
    for (const k in obj) this.set(k, obj[k]);
    return this;
  }

  // Increment a numeric key atomically
  increment(key, by = 1) {
    const prev = this._data[key] || 0;
    return this.set(key, prev + by);
  }

  // ── History ─────────────────────────────────────────────────────────────────

  history() {
    return [...this._history];
  }

  // Undo last atomic op
  undo() {
    const last = this._history.pop();
    if (!last) return this;
    if (last.op === "set" || last.op === "del") {
      if (last.prev === undefined) {
        delete this._data[last.key];
      } else {
        this._data[last.key] = last.prev;
      }
    }
    return this;
  }

  // Export / import for Ins Manager protocol
  exportState() {
    return { data: this.snapshot(), history: this.history() };
  }

  importState(state) {
    if (!state) return;
    if (state.data) this._data = { ...state.data };
    if (state.history) this._history = [...state.history];
  }
}

function create(ctx) {
  const initialData = ctx && ctx.initialData ? ctx.initialData : {};
  const instance = new PiplnVar(initialData);
  return {
    cbk: "piplnVar",
    id: `piplnVar_${Date.now()}`,
    ins: instance,
    // Expose methods directly on the returned object too (convenience)
    get: (k) => instance.get(k),
    set: (k, v) => instance.set(k, v),
    delete: (k) => instance.delete(k),
    merge: (o) => instance.merge(o),
    increment: (k, by) => instance.increment(k, by),
    has: (k) => instance.has(k),
    snapshot: () => instance.snapshot(),
    history: () => instance.history(),
    undo: () => instance.undo(),
    // Ins Manager protocol
    init() {},
    despawn() {
      instance._history = [];
      instance._data = {};
    },
    exportState: () => instance.exportState(),
    importState: (s) => instance.importState(s),
  };
}

export { create };
