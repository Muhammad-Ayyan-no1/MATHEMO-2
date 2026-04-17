// Ins Manager — Instance Manager
// Default system process.
// Imports a process (by path or pre-loaded module), runs the "create" protocol,
// and returns a fully-formed instance.
//
// Create protocol contract — every process index.js must export:
//   create(ctx) → {
//     cbk        : string  (CBK name of this process)
//     id         : string  (unique instance id)
//     init()     : fn      (called once after creation)
//     despawn()  : fn      (called before instance is removed)
//     exportState() → obj  (serialisable state snapshot)
//     importState(obj)     (restore from snapshot)
//     create?    : fn      (optional sub-create for inner APIs)
//     ...rest    : any     (process-specific API surface)
//   }

import path from "node:path";
import { get as cbkGet } from "../Code Base Keywords/index.js";

const instances = {}; // id → instance
const instanceHistory = []; // audit log

function _record(op, id, data) {
  instanceHistory.push({ op, id, data, ts: Date.now() });
}

// Load a process module — accepts either an already-required module object or a file path string
async function _loadModule(processPathOrModule) {
  if (typeof processPathOrModule === "string") {
    const resolved = path.isAbsolute(processPathOrModule)
      ? processPathOrModule
      : path.resolve(process.cwd(), processPathOrModule);
    const module = await import(resolved);
    return module.default || module;
  }
  return processPathOrModule; // already a module object
}

// ── spawn ─────────────────────────────────────────────────────────────────────
// Creates a new instance of the given process, runs init(), registers it.
// ctx is passed directly to the process's create(ctx) call.
async function spawn(processPathOrModule, ctx = {}) {
  const mod = await _loadModule(processPathOrModule);

  if (typeof mod.create !== "function") {
    throw new Error(
      `[Ins Manager] Process module must export a "create" function`,
    );
  }

  const instance = mod.create(ctx);

  if (!instance || !instance.cbk || !instance.id) {
    throw new Error(
      `[Ins Manager] create() must return an object with at least { cbk, id }`,
    );
  }

  // Run init lifecycle hook
  if (typeof instance.init === "function") instance.init();

  instances[instance.id] = instance;
  _record("spawn", instance.id, { cbk: instance.cbk });

  return instance;
}

// ── despawn ───────────────────────────────────────────────────────────────────
function despawn(id) {
  const instance = instances[id];
  if (!instance) return;

  if (typeof instance.despawn === "function") instance.despawn();

  _record("despawn", id, { cbk: instance.cbk });
  delete instances[id];
}

// ── get ───────────────────────────────────────────────────────────────────────
function getInstance(id) {
  return instances[id] || null;
}

function listInstances() {
  return Object.keys(instances).map((id) => ({
    id,
    cbk: instances[id].cbk,
  }));
}

// ── state export / import (for backup / restore) ──────────────────────────────
function exportAllStates() {
  const snapshot = {};
  for (const id in instances) {
    const ins = instances[id];
    snapshot[id] = {
      cbk: ins.cbk,
      state: typeof ins.exportState === "function" ? ins.exportState() : null,
    };
  }
  return snapshot;
}

function importState(id, state) {
  const ins = instances[id];
  if (!ins) return;
  if (typeof ins.importState === "function") ins.importState(state);
  _record("importState", id, { cbk: ins.cbk });
}

// ── create — Ins Manager Protocol ────────────────────────────────────────────
function create(ctx) {
  return {
    cbk: "insM",
    id: `insM_${Date.now()}`,
    spawn,
    despawn,
    getInstance,
    listInstances,
    exportAllStates,
    importState,
    history: () => [...instanceHistory],
    // Ins Manager protocol (self)
    init() {},
    despawn() {
      // despawn all managed instances
      for (const id in instances) despawn(id);
    },
    exportState: exportAllStates,
    importState(state) {
      // Partial restore — only restores state into already-live instances
      for (const id in state) importState(id, state[id].state);
    },
  };
}

export { create, spawn, despawn, getInstance, listInstances };
