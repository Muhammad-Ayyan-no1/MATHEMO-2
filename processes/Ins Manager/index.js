// Ins Manager Instance Manager
// Default system process
// Imports a process (by path or pre-loaded module), runs the "create" protocol
// and returns a fully-formed instance
//
// Create protocol contract — every process index.js must export:
//   create(ctx) => {
//     cbk        : string  (CBK name of this process)
//     id         : string  (unique instance id)
//     init()     : fn      (called once after creation)
//     despawn()  : fn      (called before instance is removed)
//     exportState() => obj  (serialisable state snapshot)
//     importState(obj)     (restore from snapshot)
//     create?    : fn      (optional sub-create for inner APIs)
//     ...rest    : any     (process-specific API surface)
//   }

import path from "node:path";
import { get as cbkGet } from "../Code Base Keywords/index.js";
import { ERROR_MESSAGES } from "../constants/index.js";

const instances = {};
const instanceHistory = [];

function _record(op, id, data) {
  instanceHistory.push({ op, id, data, ts: Date.now() });
}

async function _loadModule(processPathOrModule) {
  if (typeof processPathOrModule === "string") {
    const resolved = path.isAbsolute(processPathOrModule)
      ? processPathOrModule
      : path.resolve(process.cwd(), processPathOrModule);
    const module = await import(resolved);
    return module.default || module;
  }
  return processPathOrModule;
}

async function spawn(processPathOrModule, ctx = {}) {
  const mod = await _loadModule(processPathOrModule);

  if (typeof mod.create !== "function") {
    throw new Error(ERROR_MESSAGES.INS_MANAGER_CREATE_MISSING);
  }

  const instance = mod.create(ctx);

  if (!instance || !instance.cbk || !instance.id) {
    throw new Error(ERROR_MESSAGES.INS_MANAGER_CREATE_INVALID);
  }

  if (typeof instance.init === "function") instance.init();

  instances[instance.id] = instance;
  _record("spawn", instance.id, { cbk: instance.cbk });

  return instance;
}

function despawn(id) {
  const instance = instances[id];
  if (!instance) return;

  if (typeof instance.despawn === "function") instance.despawn();

  _record("despawn", id, { cbk: instance.cbk });
  delete instances[id];
}

function getInstance(id) {
  return instances[id] || null;
}

function listInstances() {
  return Object.keys(instances).map((id) => ({
    id,
    cbk: instances[id].cbk,
  }));
}

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
    init() {},
    despawn() {
      for (const id in instances) despawn(id);
    },
    exportState: exportAllStates,
    importState(state) {
      for (const id in state) importState(id, state[id].state);
    },
  };
}

export { create, spawn, despawn, getInstance, listInstances };
